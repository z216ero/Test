using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Api.Data;
using Api.Features.Auth;
using Api.Features.Bookings;
using Api.Features.Payments;
using Api.Features.Slots;
using Api.Features.Trainers;
using Api.Features.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests.Integration;

public sealed class PaymentsFlowTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public PaymentsFlowTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Booking_WhenCreated_CreatesPendingPaymentWithTrainerPrice()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var trainerAuth = await RegisterAsync(client, "Trainer");
        var clientAuth = await RegisterAsync(client, "Client");

        await UpdateTrainerPriceAsync(client, trainerAuth, 180_000);
        var slotStartUtc = BuildFutureStartUtc(2);
        var slotId = await CreateIndividualSlotAsync(client, trainerAuth, slotStartUtc);
        await BookSlotAsync(client, slotId, clientAuth.User.Id);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);
        var listResponse = await client.GetAsync("/trainer/payments?status=Pending");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var payments = await listResponse.Content.ReadFromJsonAsync<List<PaymentListItemDto>>();
        Assert.NotNull(payments);

        var payment = payments!.SingleOrDefault(p =>
            p.ClientId == clientAuth.User.Id
            && p.SlotStartAtUtc == slotStartUtc);
        Assert.NotNull(payment);
        Assert.Equal(180_000m, payment!.Amount);
        Assert.Equal(nameof(PaymentStatus.Pending), payment.Status);
        Assert.Null(payment.Method);
        Assert.Null(payment.PaidAtUtc);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", clientAuth.AccessToken);
        var byBookingResponse = await client.GetAsync($"/bookings/{payment.BookingId}/payment");
        Assert.Equal(HttpStatusCode.OK, byBookingResponse.StatusCode);
        var byBooking = await byBookingResponse.Content.ReadFromJsonAsync<PaymentDto>();
        Assert.NotNull(byBooking);
        Assert.Equal(payment.PaymentId, byBooking!.PaymentId);
        Assert.Equal(payment.Amount, byBooking.Amount);
        Assert.Equal(payment.Status, byBooking.Status);
    }

    [Fact]
    public async Task CloseBooking_WhenMarkPaidFalse_ClosesBookingAndKeepsPaymentPending()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 210_000, markCompleted: false);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var closeResponse = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(false, null)));

        Assert.Equal(HttpStatusCode.OK, closeResponse.StatusCode);
        var payload = await closeResponse.Content.ReadFromJsonAsync<CloseBookingResultDto>();
        Assert.NotNull(payload);
        Assert.Equal(scenario.Payment.BookingId, payload!.BookingId);
        Assert.Equal(nameof(BookingStatus.Completed), payload.BookingStatus);
        Assert.Equal(nameof(PaymentStatus.Pending), payload.Payment.Status);
        Assert.Null(payload.Payment.Method);
        Assert.Null(payload.Payment.PaidAtUtc);
    }

    [Fact]
    public async Task CloseBooking_WhenMarkPaidTrue_ClosesBookingAndMarksPaymentPaid()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 215_000, markCompleted: false);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var closeResponse = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(true, nameof(PaymentMethod.SBP))));

        Assert.Equal(HttpStatusCode.OK, closeResponse.StatusCode);
        var payload = await closeResponse.Content.ReadFromJsonAsync<CloseBookingResultDto>();
        Assert.NotNull(payload);
        Assert.Equal(nameof(BookingStatus.Completed), payload!.BookingStatus);
        Assert.Equal(nameof(PaymentStatus.Paid), payload.Payment.Status);
        Assert.Equal(nameof(PaymentMethod.SBP), payload.Payment.Method);
        Assert.NotNull(payload.Payment.PaidAtUtc);
    }

    [Fact]
    public async Task CloseBooking_WhenRepeated_ReturnsConflict()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 205_000, markCompleted: false);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var first = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(false, null)));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.NoShow),
                new CloseBookingPaymentRequest(true, nameof(PaymentMethod.Cash))));
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task CloseBooking_WhenBookingCancelled_ReturnsConflict()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 190_000, markCompleted: false);
        await SetBookingStatusAsync(factory, scenario.Payment.BookingId, BookingStatus.Cancelled);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var closeResponse = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(false, null)));

        Assert.Equal(HttpStatusCode.Conflict, closeResponse.StatusCode);
    }

    [Fact]
    public async Task CloseBooking_WhenMarkPaidTrueWithoutMethod_ReturnsBadRequest()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 225_000, markCompleted: false);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var closeResponse = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(true, null)));

        Assert.Equal(HttpStatusCode.BadRequest, closeResponse.StatusCode);
    }

    [Fact]
    public async Task CloseBooking_WhenUserIsNotOwnerTrainer_ReturnsNotFound()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 200_000, markCompleted: false);
        var anotherTrainer = await RegisterAsync(client, "Trainer");
        var anotherClient = await RegisterAsync(client, "Client");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", anotherTrainer.AccessToken);

        var closeByAnotherTrainer = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(false, null)));
        Assert.Equal(HttpStatusCode.NotFound, closeByAnotherTrainer.StatusCode);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", anotherClient.AccessToken);

        var closeByClient = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(false, null)));
        Assert.Equal(HttpStatusCode.NotFound, closeByClient.StatusCode);
    }

    [Fact]
    public async Task MarkPaid_IsIdempotentForSameMethod_AndConflictsForDifferentMethod()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 200_000, markCompleted: true);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var firstMarkPaid = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.SBP)));
        Assert.Equal(HttpStatusCode.OK, firstMarkPaid.StatusCode);
        var firstDto = await firstMarkPaid.Content.ReadFromJsonAsync<PaymentDto>();
        Assert.NotNull(firstDto);
        Assert.Equal(nameof(PaymentStatus.Paid), firstDto!.Status);
        Assert.Equal(nameof(PaymentMethod.SBP), firstDto.Method);
        Assert.NotNull(firstDto.PaidAtUtc);

        var secondMarkPaid = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.SBP)));
        Assert.Equal(HttpStatusCode.OK, secondMarkPaid.StatusCode);
        var secondDto = await secondMarkPaid.Content.ReadFromJsonAsync<PaymentDto>();
        Assert.NotNull(secondDto);
        Assert.Equal(nameof(PaymentStatus.Paid), secondDto!.Status);
        Assert.Equal(nameof(PaymentMethod.SBP), secondDto.Method);

        var methodConflict = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Cash)));
        Assert.Equal(HttpStatusCode.Conflict, methodConflict.StatusCode);
    }

    [Fact]
    public async Task MarkPaid_WhenBookingClosedWithoutImmediatePayment_MarksPaidSuccessfully()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 200_000, markCompleted: false);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var closeResponse = await client.PatchAsJsonAsync(
            $"/bookings/{scenario.Payment.BookingId}/close",
            new CloseBookingRequest(
                nameof(BookingStatus.Completed),
                new CloseBookingPaymentRequest(false, null)));
        Assert.Equal(HttpStatusCode.OK, closeResponse.StatusCode);

        var markPaid = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Transfer)));
        Assert.Equal(HttpStatusCode.OK, markPaid.StatusCode);
        var dto = await markPaid.Content.ReadFromJsonAsync<PaymentDto>();
        Assert.NotNull(dto);
        Assert.Equal(nameof(PaymentStatus.Paid), dto!.Status);
        Assert.Equal(nameof(PaymentMethod.Transfer), dto.Method);
    }

    [Fact]
    public async Task MarkPaid_WhenTrainingNotCompleted_ReturnsConflict()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 205_000, markCompleted: false);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var markPaid = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Cash)));

        Assert.Equal(HttpStatusCode.Conflict, markPaid.StatusCode);
    }

    [Fact]
    public async Task Refund_WhenPaid_ChangesStatusToRefunded()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var scenario = await CreateBookedPaymentScenarioAsync(factory, client, 220_000, markCompleted: true);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", scenario.TrainerAuth.AccessToken);

        var markPaid = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Transfer)));
        Assert.Equal(HttpStatusCode.OK, markPaid.StatusCode);

        var refund = await client.PatchAsync(
            $"/payments/{scenario.Payment.PaymentId}/refund",
            null);
        Assert.Equal(HttpStatusCode.OK, refund.StatusCode);
        var refundDto = await refund.Content.ReadFromJsonAsync<PaymentDto>();
        Assert.NotNull(refundDto);
        Assert.Equal(nameof(PaymentStatus.Refunded), refundDto!.Status);
        Assert.Equal(nameof(PaymentMethod.Transfer), refundDto.Method);
        Assert.NotNull(refundDto.PaidAtUtc);

        var markPaidAfterRefund = await client.PatchAsJsonAsync(
            $"/payments/{scenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Transfer)));
        Assert.Equal(HttpStatusCode.Conflict, markPaidAfterRefund.StatusCode);
    }

    [Fact]
    public async Task PaymentsAccess_WhenUserIsNotOwner_ReturnsNotFound()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var ownerScenario = await CreateBookedPaymentScenarioAsync(factory, client, 195_000, markCompleted: true);
        var anotherTrainer = await RegisterAsync(client, "Trainer");
        var anotherClient = await RegisterAsync(client, "Client");

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", anotherTrainer.AccessToken);

        var readByAnotherTrainer = await client.GetAsync(
            $"/bookings/{ownerScenario.Payment.BookingId}/payment");
        Assert.Equal(HttpStatusCode.NotFound, readByAnotherTrainer.StatusCode);

        var markByAnotherTrainer = await client.PatchAsJsonAsync(
            $"/payments/{ownerScenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Cash)));
        Assert.Equal(HttpStatusCode.NotFound, markByAnotherTrainer.StatusCode);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", anotherClient.AccessToken);

        var markByClient = await client.PatchAsJsonAsync(
            $"/payments/{ownerScenario.Payment.PaymentId}/mark-paid",
            new MarkPaymentPaidRequest(nameof(PaymentMethod.Cash)));
        Assert.Equal(HttpStatusCode.NotFound, markByClient.StatusCode);

        var refundByClient = await client.PatchAsync(
            $"/payments/{ownerScenario.Payment.PaymentId}/refund",
            null);
        Assert.Equal(HttpStatusCode.NotFound, refundByClient.StatusCode);
    }

    private static DateTime BuildFutureStartUtc(int daysAhead)
    {
        var start = DateTime.UtcNow.AddDays(daysAhead);
        return new DateTime(
            start.Year,
            start.Month,
            start.Day,
            start.Hour,
            start.Minute,
            0,
            DateTimeKind.Utc);
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
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        return auth!;
    }

    private static async Task UpdateTrainerPriceAsync(
        HttpClient client,
        AuthResponse trainerAuth,
        int pricePerSession)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var updateResponse = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            trainerAuth.User.Name,
            "Москва",
            PricePerSession: pricePerSession));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
    }

    private static async Task<Guid> CreateIndividualSlotAsync(
        HttpClient client,
        AuthResponse trainerAuth,
        DateTime startUtc)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);

        var trainerResponse = await client.GetAsync("/trainers/me");
        Assert.Equal(HttpStatusCode.OK, trainerResponse.StatusCode);
        var trainer = await trainerResponse.Content.ReadFromJsonAsync<TrainerDto>();
        Assert.NotNull(trainer);

        var createResponse = await client.PostAsJsonAsync(
            $"/trainers/{trainer!.Id}/slots",
            new CreateSlotRequest(startUtc, 60));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var slot = await createResponse.Content.ReadFromJsonAsync<SlotDto>();
        Assert.NotNull(slot);
        Assert.NotEqual(Guid.Empty, slot!.Id);
        return slot.Id;
    }

    private static async Task BookSlotAsync(HttpClient client, Guid slotId, Guid clientId)
    {
        var bookResponse = await client.PostAsJsonAsync(
            $"/slots/{slotId}/book",
            new BookSlotRequest(clientId));
        Assert.Equal(HttpStatusCode.OK, bookResponse.StatusCode);
    }

    private static async Task<BookedPaymentScenario> CreateBookedPaymentScenarioAsync(
        ApiWebApplicationFactory factory,
        HttpClient client,
        int pricePerSession,
        bool markCompleted = false)
    {
        var trainerAuth = await RegisterAsync(client, "Trainer");
        var clientAuth = await RegisterAsync(client, "Client");

        await UpdateTrainerPriceAsync(client, trainerAuth, pricePerSession);
        var slotStartUtc = BuildFutureStartUtc(3);
        var slotId = await CreateIndividualSlotAsync(client, trainerAuth, slotStartUtc);
        await BookSlotAsync(client, slotId, clientAuth.User.Id);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", trainerAuth.AccessToken);
        var listResponse = await client.GetAsync("/trainer/payments?status=Pending");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var payments = await listResponse.Content.ReadFromJsonAsync<List<PaymentListItemDto>>();
        Assert.NotNull(payments);

        var payment = payments!.SingleOrDefault(p =>
            p.ClientId == clientAuth.User.Id
            && p.SlotStartAtUtc == slotStartUtc);
        Assert.NotNull(payment);
        if (markCompleted)
        {
            await MarkBookingCompletedForPaymentAsync(factory, payment!.PaymentId);
        }

        return new BookedPaymentScenario(trainerAuth, clientAuth, payment!);
    }

    private static async Task MarkBookingCompletedForPaymentAsync(
        ApiWebApplicationFactory factory,
        Guid paymentId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var payment = await db.Payments
            .Include(x => x.Booking)
            .ThenInclude(x => x!.Slot)
            .FirstOrDefaultAsync(x => x.Id == paymentId);
        Assert.NotNull(payment);
        Assert.NotNull(payment!.Booking);
        Assert.NotNull(payment.Booking!.Slot);

        payment.Booking.Status = BookingStatus.Completed;
        payment.Booking.Slot!.StartsAtUtc = DateTime.UtcNow.AddHours(-2);
        await db.SaveChangesAsync();
    }

    private static async Task SetBookingStatusAsync(
        ApiWebApplicationFactory factory,
        Guid bookingId,
        BookingStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var booking = await db.Bookings.FirstOrDefaultAsync(x => x.Id == bookingId);
        Assert.NotNull(booking);
        booking!.Status = status;
        await db.SaveChangesAsync();
    }

    private sealed record BookedPaymentScenario(
        AuthResponse TrainerAuth,
        AuthResponse ClientAuth,
        PaymentListItemDto Payment);
}
