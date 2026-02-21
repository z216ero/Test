using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Data;
using Api.Features.Auth;
using Api.Features.Bookings;
using Api.Features.Slots;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests.Integration;

public sealed class TrainerClientLinksFlowTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public TrainerClientLinksFlowTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task SearchByPhone_Returns200And404()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainer = await RegisterAsync(client, "Trainer", null);
        var linkedClient = await RegisterAsync(client, "Client", "+79991234567");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);

        var success = await client.PostAsJsonAsync(
            "/trainer/clients/link/search-by-phone",
            new { phone = "8 (999) 123-45-67" });
        Assert.Equal(HttpStatusCode.OK, success.StatusCode);

        var dto = await success.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(dto.TryGetProperty("clientUserId", out var clientUserId));
        Assert.Equal(linkedClient.User.Id, clientUserId.GetGuid());

        var missing = await client.PostAsJsonAsync(
            "/trainer/clients/link/search-by-phone",
            new { phone = "+79990000000" });
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task LinkRequest_PendingAcceptedAndCooldown_Returns409()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainer = await RegisterAsync(client, "Trainer", null);
        var linkedClient = await RegisterAsync(client, "Client", "+79995554433");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);

        var firstRequest = await RequestLinkAsync(client, linkedClient.User.Id);
        Assert.Equal(HttpStatusCode.OK, firstRequest.StatusCode);
        var link = await firstRequest.Content.ReadFromJsonAsync<JsonElement>();
        var linkId = link.GetProperty("id").GetGuid();

        var duplicatePending = await RequestLinkAsync(client, linkedClient.User.Id);
        Assert.Equal(HttpStatusCode.Conflict, duplicatePending.StatusCode);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);
        var reject = await client.PostAsync($"/client/links/{linkId}/reject", null);
        Assert.Equal(HttpStatusCode.OK, reject.StatusCode);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var cooldown = await RequestLinkAsync(client, linkedClient.User.Id);
        Assert.Equal(HttpStatusCode.Conflict, cooldown.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var entity = await db.TrainerClientLinks.FindAsync(linkId);
            Assert.NotNull(entity);
            entity!.RejectedUntilUtc = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var afterCooldown = await RequestLinkAsync(client, linkedClient.User.Id);
        Assert.Equal(HttpStatusCode.OK, afterCooldown.StatusCode);

        var activeLink = await afterCooldown.Content.ReadFromJsonAsync<JsonElement>();
        var activeLinkId = activeLink.GetProperty("id").GetGuid();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);
        var accept = await client.PostAsync($"/client/links/{activeLinkId}/accept", null);
        Assert.Equal(HttpStatusCode.OK, accept.StatusCode);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var duplicateAccepted = await RequestLinkAsync(client, linkedClient.User.Id);
        Assert.Equal(HttpStatusCode.Conflict, duplicateAccepted.StatusCode);
    }

    [Fact]
    public async Task AcceptReject_OnlyOwnerAndOnlyPending()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainer = await RegisterAsync(client, "Trainer", null);
        var linkedClient = await RegisterAsync(client, "Client", "+79993332211");
        var otherClient = await RegisterAsync(client, "Client", "+79993332212");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var request = await RequestLinkAsync(client, linkedClient.User.Id);
        var link = await request.Content.ReadFromJsonAsync<JsonElement>();
        var linkId = link.GetProperty("id").GetGuid();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", otherClient.AccessToken);
        var forbidden = await client.PostAsync($"/client/links/{linkId}/accept", null);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);
        var accepted = await client.PostAsync($"/client/links/{linkId}/accept", null);
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);

        var secondAccept = await client.PostAsync($"/client/links/{linkId}/accept", null);
        Assert.Equal(HttpStatusCode.BadRequest, secondAccept.StatusCode);
    }

    [Fact]
    public async Task Revoke_WorksForTrainerAndClient()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainer = await RegisterAsync(client, "Trainer", null);
        var linkedClient = await RegisterAsync(client, "Client", "+79991112233");

        var linkId = await CreateAcceptedLinkAsync(client, trainer, linkedClient);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var revokeTrainer = await client.DeleteAsync($"/trainer/clients/link/{linkId}");
        Assert.Equal(HttpStatusCode.NoContent, revokeTrainer.StatusCode);

        var secondRevokeTrainer = await client.DeleteAsync($"/trainer/clients/link/{linkId}");
        Assert.Equal(HttpStatusCode.Conflict, secondRevokeTrainer.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var revokedLink = await db.TrainerClientLinks.FindAsync(linkId);
            Assert.NotNull(revokedLink);
            revokedLink!.LastRequestAtUtc = DateTime.UtcNow.AddDays(-2);
            await db.SaveChangesAsync();
        }

        var linkId2 = await CreateAcceptedLinkAsync(client, trainer, linkedClient);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);
        var revokeClient = await client.DeleteAsync($"/client/links/{linkId2}");
        Assert.Equal(HttpStatusCode.NoContent, revokeClient.StatusCode);
    }

    [Fact]
    public async Task AssignRequiresAcceptedLink_AndPendingBlocksConflict()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerOne = await RegisterAsync(client, "Trainer", null);
        var trainerTwo = await RegisterAsync(client, "Trainer", null);
        var linkedClient = await RegisterAsync(client, "Client", "+79997776655");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerOne.AccessToken);
        var slotOne = await CreateOpenSlotAsync(client, BuildFutureStartUtc(2, 11));

        var noLinkAssign = await client.PostAsJsonAsync(
            $"/trainer/slots/{slotOne.Id}/assign-client",
            new AssignRegisteredClientRequest(linkedClient.User.Id));
        Assert.Equal(HttpStatusCode.Conflict, noLinkAssign.StatusCode);

        await CreateAcceptedLinkAsync(client, trainerOne, linkedClient);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerOne.AccessToken);

        var assigned = await client.PostAsJsonAsync(
            $"/trainer/slots/{slotOne.Id}/assign-client",
            new AssignRegisteredClientRequest(linkedClient.User.Id));
        Assert.Equal(HttpStatusCode.OK, assigned.StatusCode);

        await CreateAcceptedLinkAsync(client, trainerTwo, linkedClient);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerTwo.AccessToken);
        var slotTwo = await CreateOpenSlotAsync(client, BuildFutureStartUtc(2, 11).AddMinutes(15));

        var conflict = await client.PostAsJsonAsync(
            $"/trainer/slots/{slotTwo.Id}/assign-client",
            new AssignRegisteredClientRequest(linkedClient.User.Id));
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task ConfirmDecline_TransitionsAndCounts()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainer = await RegisterAsync(client, "Trainer", null);
        var linkedClient = await RegisterAsync(client, "Client", "+79994443322");
        await CreateAcceptedLinkAsync(client, trainer, linkedClient);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var slotForConfirm = await CreateOpenSlotAsync(client, BuildFutureStartUtc(3, 10));

        var assignedConfirm = await client.PostAsJsonAsync(
            $"/trainer/slots/{slotForConfirm.Id}/assign-client",
            new AssignRegisteredClientRequest(linkedClient.User.Id));
        Assert.Equal(HttpStatusCode.OK, assignedConfirm.StatusCode);
        var bookingConfirm = await assignedConfirm.Content.ReadFromJsonAsync<BookingDto>();
        Assert.NotNull(bookingConfirm);
        Assert.Equal("Pending", bookingConfirm!.ClientConfirmationStatus);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);

        var pendingBookingCount = await client.GetFromJsonAsync<JsonElement>(
            "/client/me/pending-booking-confirmations/count");
        Assert.Equal(1, pendingBookingCount.GetProperty("count").GetInt32());

        var confirm = await client.PostAsync($"/client/bookings/{bookingConfirm.Id}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var persisted = await db.Bookings.FindAsync(bookingConfirm.Id);
            Assert.NotNull(persisted);
            Assert.Equal(BookingClientConfirmationStatus.Confirmed, persisted!.ClientConfirmationStatus);
            Assert.Equal(BookingStatus.Booked, persisted.Status);
        }

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var slotForDecline = await CreateOpenSlotAsync(client, BuildFutureStartUtc(3, 13));
        var assignedDecline = await client.PostAsJsonAsync(
            $"/trainer/slots/{slotForDecline.Id}/assign-client",
            new AssignRegisteredClientRequest(linkedClient.User.Id));
        var bookingDecline = await assignedDecline.Content.ReadFromJsonAsync<BookingDto>();
        Assert.NotNull(bookingDecline);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);
        var decline = await client.PostAsync($"/client/bookings/{bookingDecline!.Id}/decline", null);
        Assert.Equal(HttpStatusCode.OK, decline.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var persisted = await db.Bookings.FindAsync(bookingDecline.Id);
            var slot = await db.TrainingSlots.FindAsync(slotForDecline.Id);
            Assert.NotNull(persisted);
            Assert.NotNull(slot);
            Assert.Equal(BookingClientConfirmationStatus.Declined, persisted!.ClientConfirmationStatus);
            Assert.Equal(BookingStatus.Cancelled, persisted.Status);
            Assert.Equal(TrainingSlotStatus.Open, slot!.Status);
        }

        var pendingLinkCount = await client.GetFromJsonAsync<JsonElement>(
            "/client/me/pending-link-requests/count");
        Assert.Equal(0, pendingLinkCount.GetProperty("count").GetInt32());
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

    private static async Task<AuthResponse> RegisterAsync(HttpClient client, string role, string? phone)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
        var name = $"{role} {Guid.NewGuid():N}"[..20];
        var response = await client.PostAsJsonAsync(
            "/auth/register",
            new RegisterRequest(email, "Password123", role, name, "Москва", PhoneNumber: phone));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        return auth!;
    }

    private static Task<HttpResponseMessage> RequestLinkAsync(HttpClient client, Guid clientUserId)
        => client.PostAsJsonAsync("/trainer/clients/link/request", new { clientUserId });

    private static async Task<SlotDto> CreateOpenSlotAsync(HttpClient client, DateTime startsAtUtc)
    {
        var response = await client.PostAsJsonAsync(
            "/trainers/me/slots",
            new CreateSlotRequest(startsAtUtc, 60, "Individual"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var slot = await response.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        return slot!;
    }

    private static async Task<Guid> CreateAcceptedLinkAsync(HttpClient client, AuthResponse trainer, AuthResponse linkedClient)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainer.AccessToken);
        var request = await RequestLinkAsync(client, linkedClient.User.Id);
        Assert.Equal(HttpStatusCode.OK, request.StatusCode);
        var link = await request.Content.ReadFromJsonAsync<JsonElement>();
        var linkId = link.GetProperty("id").GetGuid();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", linkedClient.AccessToken);
        var accept = await client.PostAsync($"/client/links/{linkId}/accept", null);
        Assert.Equal(HttpStatusCode.OK, accept.StatusCode);
        return linkId;
    }
}
