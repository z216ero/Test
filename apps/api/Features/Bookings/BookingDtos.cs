using Api.Features.WorkoutTypes;

namespace Api.Features.Bookings;

public sealed record BookSlotRequest(Guid? ClientId);

public sealed record BookingDto(
    Guid Id,
    Guid SlotId,
    Guid? ClientId,
    Guid? TrainerClientId,
    string Status,
    string ClientConfirmationStatus,
    WorkoutTypeSummaryDto? WorkoutType,
    DateTime? ClientConfirmationRequestedAtUtc,
    DateTime? ClientConfirmationRespondedAtUtc,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record AssignRegisteredClientRequest(Guid ClientUserId);

public sealed record PendingBookingConfirmationsCountDto(int Count);

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
