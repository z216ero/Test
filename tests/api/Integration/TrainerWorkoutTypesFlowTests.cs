using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Data;
using Api.Features.Auth;
using Api.Features.Bookings;
using Api.Features.Slots;
using Api.Features.TrainerWorkoutTypes;
using Api.Features.Trainers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests.Integration;

public sealed class TrainerWorkoutTypesFlowTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public TrainerWorkoutTypesFlowTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task GetWorkoutTypes_FirstRequest_SeedsSystemTypesForTrainer()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();
        var trainer = await RegisterAsync(client, "Trainer");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);

        var response = await client.GetAsync("/trainer/workout-types");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = await response.Content.ReadFromJsonAsync<List<TrainerWorkoutTypeDto>>();
        Assert.NotNull(items);
        Assert.Equal(TrainerWorkoutTypeService.GetSystemTypeCatalog().Count, items!.Count);
        Assert.All(items, x => Assert.True(x.IsSystem));
    }

    [Fact]
    public async Task CreateCustomWorkoutType_EnforcesNormalizedUniqueness_AndLimit40ActiveCustom()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();
        var trainer = await RegisterAsync(client, "Trainer");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);

        var first = await client.PostAsJsonAsync("/trainer/workout-types", new CreateTrainerWorkoutTypeRequest(" ноги ", "Strength"));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var duplicate = await client.PostAsJsonAsync("/trainer/workout-types", new CreateTrainerWorkoutTypeRequest("НОГИ", "Strength"));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        for (var i = 0; i < 39; i++)
        {
            var create = await client.PostAsJsonAsync(
                "/trainer/workout-types",
                new CreateTrainerWorkoutTypeRequest($"Custom {i + 1}", "Other"));
            Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        }

        var limitResponse = await client.PostAsJsonAsync(
            "/trainer/workout-types",
            new CreateTrainerWorkoutTypeRequest("Custom 41", "Other"));
        Assert.Equal(HttpStatusCode.Conflict, limitResponse.StatusCode);
    }

    [Fact]
    public async Task ArchiveWorkoutType_SystemForbidden_CustomIdempotent()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();
        var trainer = await RegisterAsync(client, "Trainer");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);

        var list = await client.GetFromJsonAsync<List<TrainerWorkoutTypeDto>>("/trainer/workout-types");
        Assert.NotNull(list);
        var systemType = list!.First();

        var systemArchive = await client.PostAsync($"/trainer/workout-types/{systemType.Id}/archive", null);
        Assert.Equal(HttpStatusCode.Forbidden, systemArchive.StatusCode);

        var create = await client.PostAsJsonAsync(
            "/trainer/workout-types",
            new CreateTrainerWorkoutTypeRequest("Custom archive", "Mobility"));
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        var custom = await create.Content.ReadFromJsonAsync<TrainerWorkoutTypeDto>();
        Assert.NotNull(custom);

        var archive1 = await client.PostAsync($"/trainer/workout-types/{custom!.Id}/archive", null);
        Assert.Equal(HttpStatusCode.OK, archive1.StatusCode);
        var archived1 = await archive1.Content.ReadFromJsonAsync<TrainerWorkoutTypeDto>();
        Assert.True(archived1!.IsArchived);

        var archive2 = await client.PostAsync($"/trainer/workout-types/{custom.Id}/archive", null);
        Assert.Equal(HttpStatusCode.OK, archive2.StatusCode);
        var archived2 = await archive2.Content.ReadFromJsonAsync<TrainerWorkoutTypeDto>();
        Assert.True(archived2!.IsArchived);
    }

    [Fact]
    public async Task PatchBookingWorkoutType_WorksWithinWindow_RejectsAfter15Minutes()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();
        var scenario = await CreateBookedSlotScenarioAsync(factory, client);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var createType = await client.PostAsJsonAsync(
            "/trainer/workout-types",
            new CreateTrainerWorkoutTypeRequest("Bench", "Strength"));
        Assert.Equal(HttpStatusCode.OK, createType.StatusCode);
        var workoutType = await createType.Content.ReadFromJsonAsync<TrainerWorkoutTypeDto>();
        Assert.NotNull(workoutType);

        var patchOk = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{scenario.BookingId}/workout-type",
            new SetBookingWorkoutTypeRequest(workoutType!.Id));
        Assert.Equal(HttpStatusCode.OK, patchOk.StatusCode);
        var payload = await patchOk.Content.ReadFromJsonAsync<SetBookingWorkoutTypeResponse>();
        Assert.NotNull(payload);
        Assert.Equal(workoutType.Id, payload!.WorkoutTypeId);
        Assert.Equal("Bench", payload.WorkoutType!.Name);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var slot = await db.TrainingSlots.FirstAsync(x => x.Id == scenario.SlotId);
            slot.StartsAtUtc = DateTime.UtcNow.AddMinutes(-16);
            await db.SaveChangesAsync();
        }

        var patchLate = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{scenario.BookingId}/workout-type",
            new SetBookingWorkoutTypeRequest(null));
        Assert.Equal(HttpStatusCode.Conflict, patchLate.StatusCode);
    }

    [Fact]
    public async Task PatchBookingWorkoutType_RejectsArchivedType_ExceptCurrentArchived()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();
        var scenario = await CreateBookedSlotScenarioAsync(factory, client);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var firstType = await CreateWorkoutTypeAsync(client, "Current Type", "Technique");
        var secondType = await CreateWorkoutTypeAsync(client, "Another Type", "Technique");

        var assignFirst = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{scenario.BookingId}/workout-type",
            new SetBookingWorkoutTypeRequest(firstType.Id));
        Assert.Equal(HttpStatusCode.OK, assignFirst.StatusCode);

        var archiveFirst = await client.PostAsync($"/trainer/workout-types/{firstType.Id}/archive", null);
        Assert.Equal(HttpStatusCode.OK, archiveFirst.StatusCode);

        var keepCurrentArchived = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{scenario.BookingId}/workout-type",
            new SetBookingWorkoutTypeRequest(firstType.Id));
        Assert.Equal(HttpStatusCode.OK, keepCurrentArchived.StatusCode);

        var archiveSecond = await client.PostAsync($"/trainer/workout-types/{secondType.Id}/archive", null);
        Assert.Equal(HttpStatusCode.OK, archiveSecond.StatusCode);

        var assignArchivedOther = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{scenario.BookingId}/workout-type",
            new SetBookingWorkoutTypeRequest(secondType.Id));
        Assert.Equal(HttpStatusCode.Conflict, assignArchivedOther.StatusCode);
    }

    [Fact]
    public async Task PatchBookingWorkoutType_ReturnsForbiddenForForeignBooking_AndNotFoundForMissing()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();
        var ownerScenario = await CreateBookedSlotScenarioAsync(factory, client);
        var otherTrainer = await RegisterAsync(client, "Trainer");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", otherTrainer.AccessToken);

        var foreign = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{ownerScenario.BookingId}/workout-type",
            new SetBookingWorkoutTypeRequest(null));
        Assert.Equal(HttpStatusCode.Forbidden, foreign.StatusCode);

        var missing = await client.PatchAsJsonAsync(
            $"/trainer/bookings/{Guid.NewGuid()}/workout-type",
            new SetBookingWorkoutTypeRequest(null));
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    private static async Task<TrainerWorkoutTypeDto> CreateWorkoutTypeAsync(HttpClient client, string name, string category)
    {
        var response = await client.PostAsJsonAsync("/trainer/workout-types", new CreateTrainerWorkoutTypeRequest(name, category));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TrainerWorkoutTypeDto>();
        Assert.NotNull(dto);
        return dto!;
    }

    private static async Task<BookedSlotScenario> CreateBookedSlotScenarioAsync(ApiWebApplicationFactory factory, HttpClient client)
    {
        var trainerAuth = await RegisterAsync(client, "Trainer");
        var clientAuth = await RegisterAsync(client, "Client");
        var slotId = await CreateIndividualSlotAsync(client, trainerAuth, DateTime.UtcNow.AddHours(3));
        var bookedSlot = await BookSlotAsync(client, slotId, clientAuth.User.Id, clientAuth.AccessToken);
        Assert.True(bookedSlot.BookingId.HasValue);
        return new BookedSlotScenario(trainerAuth, clientAuth, slotId, bookedSlot.BookingId!.Value);
    }

    private static async Task<AuthResponse> RegisterAsync(HttpClient client, string role)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
        var name = $"{role} {Guid.NewGuid():N}"[..20];
        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            email,
            "Password123",
            role,
            name,
            "Moscow"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        return auth!;
    }

    private static async Task<Guid> CreateIndividualSlotAsync(HttpClient client, AuthResponse trainerAuth, DateTime startUtc)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var trainerResponse = await client.GetAsync("/trainers/me");
        Assert.Equal(HttpStatusCode.OK, trainerResponse.StatusCode);
        var trainer = await trainerResponse.Content.ReadFromJsonAsync<TrainerDto>();
        Assert.NotNull(trainer);

        var createResponse = await client.PostAsJsonAsync(
            $"/trainers/{trainer!.Id}/slots",
            new CreateSlotRequest(DateTime.SpecifyKind(startUtc, DateTimeKind.Utc), 60));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var slot = await createResponse.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        return slot!.Id;
    }

    private static async Task<SlotDto> BookSlotAsync(HttpClient client, Guid slotId, Guid clientId, string accessToken)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await client.PostAsJsonAsync($"/slots/{slotId}/book", new BookSlotRequest(clientId));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var slot = await response.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        return slot!;
    }

    private sealed record BookedSlotScenario(
        AuthResponse TrainerAuth,
        AuthResponse ClientAuth,
        Guid SlotId,
        Guid BookingId);
}
