using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Data;
using Api.Features.Auth;
using Api.Features.Bookings;
using Api.Features.Payments;
using Api.Features.Reports;
using Api.Features.Slots;
using Api.Features.TrainerClients;
using Api.Features.Users;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests.Integration;

public sealed class CrmFirstFlowTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public CrmFirstFlowTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task TrainerClients_CreateAndListActive_ReturnsCreatedContact()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerAuth = await RegisterAsync(client, "Trainer");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var createResponse = await client.PostAsJsonAsync(
            "/trainer-clients",
            new CreateTrainerClientRequest("CRM Client", "+79991234567", "notes"));

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<TrainerClientDto>();
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.Id);
        Assert.Equal("CRM Client", created.DisplayName);
        Assert.Equal("Active", created.Status);

        var listResponse = await client.GetAsync("/trainer-clients?status=Active");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<List<TrainerClientDto>>();
        Assert.NotNull(list);
        Assert.Contains(list!, item => item.Id == created.Id);
    }

    [Fact]
    public async Task TrainerCreateSlot_AssignedToTrainerClient_CreatesBookedSlotAndBooking()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerAuth = await RegisterAsync(client, "Trainer");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var trainerClient = await CreateTrainerClientAsync(client, "Contact Client");
        var startUtc = BuildFutureStartUtc(2, 10);

        var createSlotResponse = await client.PostAsJsonAsync(
            "/trainers/me/slots",
            new CreateSlotRequest(
                startUtc,
                60,
                "Individual",
                AssignToTrainerClientId: trainerClient.Id));

        Assert.Equal(HttpStatusCode.Created, createSlotResponse.StatusCode);
        var slot = await createSlotResponse.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        Assert.Equal("Booked", slot!.Status);
        Assert.Equal("Booked", slot.BookingStatus);
        Assert.Equal(trainerClient.Id, slot.TrainerClientId);
        Assert.Null(slot.ClientId);
        Assert.NotNull(slot.BookingId);
    }

    [Fact]
    public async Task TrainerCreateSlot_AssignedToRegisteredClient_CreatesBookedSlot()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerAuth = await RegisterAsync(client, "Trainer");
        var clientAuth = await RegisterAsync(client, "Client");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var startUtc = BuildFutureStartUtc(2, 12);

        var createSlotResponse = await client.PostAsJsonAsync(
            "/trainers/me/slots",
            new CreateSlotRequest(
                startUtc,
                60,
                "Individual",
                AssignToClientId: clientAuth.User.Id));

        Assert.Equal(HttpStatusCode.Created, createSlotResponse.StatusCode);
        var slot = await createSlotResponse.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        Assert.Equal("Booked", slot!.Status);
        Assert.Equal(clientAuth.User.Id, slot.ClientId);
        Assert.Null(slot.TrainerClientId);
    }

    [Fact]
    public async Task BookSlot_WhenRegisteredClientHasOverlap_ReturnsBookingTimeConflict()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerOne = await RegisterAsync(client, "Trainer");
        var trainerTwo = await RegisterAsync(client, "Trainer");
        var clientAuth = await RegisterAsync(client, "Client");

        var startUtc = BuildFutureStartUtc(3, 14);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerOne.AccessToken);
        var slotOne = await CreateOpenSlotAsync(client, startUtc);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerTwo.AccessToken);
        var slotTwo = await CreateOpenSlotAsync(client, startUtc.AddMinutes(15));

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", clientAuth.AccessToken);

        var firstBook = await client.PostAsJsonAsync(
            $"/slots/{slotOne.Id}/book",
            new BookSlotRequest(clientAuth.User.Id));
        Assert.Equal(HttpStatusCode.OK, firstBook.StatusCode);

        var secondBook = await client.PostAsJsonAsync(
            $"/slots/{slotTwo.Id}/book",
            new BookSlotRequest(clientAuth.User.Id));
        Assert.Equal(HttpStatusCode.Conflict, secondBook.StatusCode);

        var payload = await secondBook.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(payload.TryGetProperty("errorCode", out var code));
        Assert.Equal("booking_time_conflict", code.GetString());
    }

    [Fact]
    public async Task ReportsSummary_WhenCompletedAndPaid_ReturnsPaidRevenue()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerAuth = await RegisterAsync(client, "Trainer");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var updateTrainerResponse = await client.PatchAsJsonAsync(
            "/users/me",
            new UpdateUserRequest(
                trainerAuth.User.Name,
                "Москва",
                PricePerSession: 150_000));
        Assert.Equal(HttpStatusCode.OK, updateTrainerResponse.StatusCode);

        var trainerClient = await CreateTrainerClientAsync(client, "Report Client");
        var slot = await CreateAssignedSlotAsync(client, trainerClient.Id, BuildFutureStartUtc(2, 16));

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dbSlot = await db.TrainingSlots.FindAsync(slot.Id);
            Assert.NotNull(dbSlot);
            dbSlot!.StartsAtUtc = DateTime.UtcNow.AddHours(-2);
            await db.SaveChangesAsync();
        }

        var completeResponse = await client.PostAsync($"/slots/{slot.Id}/complete", null);
        Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);

        var markPaidResponse = await client.PostAsJsonAsync(
            $"/bookings/{slot.BookingId}/payment/mark-paid",
            new MarkBookingPaymentPaidRequest(nameof(PaymentMethod.Cash), null));
        Assert.Equal(HttpStatusCode.OK, markPaidResponse.StatusCode);

        var fromUtc = DateTime.UtcNow.AddDays(-2).ToString("O");
        var toUtc = DateTime.UtcNow.AddDays(2).ToString("O");
        var summaryResponse = await client.GetAsync(
            $"/trainers/me/reports/summary?fromUtc={Uri.EscapeDataString(fromUtc)}&toUtc={Uri.EscapeDataString(toUtc)}");

        Assert.Equal(HttpStatusCode.OK, summaryResponse.StatusCode);
        var summary = await summaryResponse.Content.ReadFromJsonAsync<TrainerSummaryReportDto>();
        Assert.NotNull(summary);
        Assert.Equal(1, summary!.SessionsCompleted);
        Assert.Equal(150_000m, summary.RevenuePaid);
    }

    private static DateTime BuildFutureStartUtc(int daysAhead, int hour)
    {
        var baseDate = DateTime.UtcNow.AddDays(daysAhead).Date;
        return new DateTime(
            baseDate.Year,
            baseDate.Month,
            baseDate.Day,
            hour,
            0,
            0,
            DateTimeKind.Utc);
    }

    private static async Task<AuthResponse> RegisterAsync(HttpClient client, string role)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
        var name = $"{role} {Guid.NewGuid():N}"[..20];
        var response = await client.PostAsJsonAsync(
            "/auth/register",
            new RegisterRequest(email, "Password123", role, name, "Москва"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        return auth!;
    }

    private static async Task<TrainerClientDto> CreateTrainerClientAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync(
            "/trainer-clients",
            new CreateTrainerClientRequest(name, null, null));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dto = await response.Content.ReadFromJsonAsync<TrainerClientDto>();
        Assert.NotNull(dto);
        return dto!;
    }

    private static async Task<SlotDto> CreateAssignedSlotAsync(HttpClient client, Guid trainerClientId, DateTime startUtc)
    {
        var response = await client.PostAsJsonAsync(
            "/trainers/me/slots",
            new CreateSlotRequest(
                startUtc,
                60,
                "Individual",
                AssignToTrainerClientId: trainerClientId));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var slot = await response.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        return slot!;
    }

    private static async Task<SlotDto> CreateOpenSlotAsync(HttpClient client, DateTime startUtc)
    {
        var response = await client.PostAsJsonAsync(
            "/trainers/me/slots",
            new CreateSlotRequest(startUtc, 60, "Individual"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var slot = await response.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        return slot!;
    }
}
