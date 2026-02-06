namespace Api.Features.Slots;

public sealed record CreateSlotRequest(DateTime StartsAtUtc, int DurationMinutes);

public sealed record SlotDto(
    Guid Id,
    Guid TrainerId,
    DateTime StartsAtUtc,
    int DurationMinutes,
    string Status,
    string? BookingStatus,
    DateTime CreatedAtUtc,
    string? ClientName,
    string? ClientAvatarUrl,
    int? TrainerPricePerSession);

public sealed record AvailableSlotTrainerDto(
    Guid Id,
    string Name,
    string? AvatarUrl,
    int? PricePerSession,
    IReadOnlyList<string> TrainingTypes,
    string WorksWithGender,
    string Gender,
    double? Rating);

public sealed record AvailableSlotGroupDto(
    AvailableSlotTrainerDto Trainer,
    IReadOnlyList<SlotDto> Slots);
