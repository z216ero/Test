namespace Api.Features.Bookings;

public sealed record BookSlotRequest(Guid ClientId);

public sealed record BookingDto(
    Guid Id,
    Guid SlotId,
    Guid ClientId,
    string Status,
    DateTime CreatedAtUtc);
