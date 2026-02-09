using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Api.Features.Auth;
using Api.Features.Slots;
using Api.Features.Trainers;
using Api.Features.Users;

namespace Api.Tests.Integration;

public sealed class TrainerPriceTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public TrainerPriceTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task GetTrainerSlots_IncludesTrainerPricePerSession()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "trainer-slots@example.com",
            "Password123",
            "Trainer",
            "Trainer Slots",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var updateResponse = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            "Trainer Slots",
            "Москва",
            PricePerSession: 180_000));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var trainerResponse = await client.GetAsync("/trainers/me");
        Assert.Equal(HttpStatusCode.OK, trainerResponse.StatusCode);
        var trainer = await trainerResponse.Content.ReadFromJsonAsync<TrainerDto>();
        Assert.NotNull(trainer);

        var slotRequest = new CreateSlotRequest(DateTime.UtcNow.AddDays(1), 60);
        var slotResponse = await client.PostAsJsonAsync(
            $"/trainers/{trainer!.Id}/slots",
            slotRequest);

        Assert.Equal(HttpStatusCode.Created, slotResponse.StatusCode);

        var listResponse = await client.GetAsync($"/trainers/{trainer.Id}/slots");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var slots = await listResponse.Content.ReadFromJsonAsync<List<SlotDto>>();

        Assert.NotNull(slots);
        Assert.NotEmpty(slots);
        Assert.Equal(180_000, slots![0].TrainerPricePerSession);
    }
}
