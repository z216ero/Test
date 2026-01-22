namespace Api.Features.Slots;

public sealed record CreateSlotRequest(DateTime StartsAtUtc, int DurationMinutes);

public sealed record SlotDto(
    Guid Id,
    Guid TrainerId,
    DateTime StartsAtUtc,
    int DurationMinutes,
    string Status,
    DateTime CreatedAtUtc);
