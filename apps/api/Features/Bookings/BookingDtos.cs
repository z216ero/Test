namespace Api.Features.Bookings;

public sealed record BookSlotRequest(Guid ClientId);

public sealed record BookingDto(
    Guid Id,
    Guid SlotId,
    Guid ClientId,
    string Status,
    DateTime CreatedAtUtc);

public sealed record CloseBookingRequest(
    string? Attendance,
    CloseBookingPaymentRequest? Payment);

public sealed record CloseBookingPaymentRequest(
    bool MarkPaid,
    string? Method);

public sealed record CloseBookingPaymentDto(
    Guid PaymentId,
    decimal Amount,
    string Status,
    string? Method,
    DateTime? PaidAtUtc,
    DateTime UpdatedAtUtc);

public sealed record CloseBookingResultDto(
    Guid BookingId,
    string BookingStatus,
    CloseBookingPaymentDto Payment);
