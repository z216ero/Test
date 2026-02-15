namespace Api.Features.Payments;

public sealed record PaymentListItemDto(
    Guid PaymentId,
    Guid BookingId,
    Guid? ClientId,
    Guid? TrainerClientId,
    string ClientName,
    DateTime SlotStartAtUtc,
    DateTime SlotEndAtUtc,
    decimal Amount,
    string Status,
    string? Method,
    DateTime? PaidAtUtc);

public sealed record PaymentDto(
    Guid PaymentId,
    Guid BookingId,
    Guid? ClientId,
    Guid? TrainerClientId,
    string ClientName,
    DateTime SlotStartAtUtc,
    DateTime SlotEndAtUtc,
    decimal Amount,
    string Status,
    string? Method,
    DateTime? PaidAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record MarkPaymentPaidRequest(string? Method);

public sealed record MarkBookingPaymentPaidRequest(
    string? Method,
    DateTime? PaidAtUtc);
