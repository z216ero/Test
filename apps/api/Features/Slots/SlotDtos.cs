using Api.Features.WorkoutTypes;

namespace Api.Features.Slots;

public sealed record CreateSlotRequest(
    DateTime StartsAtUtc,
    int DurationMinutes,
    string? SlotType = null,
    int? CapacityMax = null,
    int? CapacityMin = null,
    bool AutoCancelIfMinNotReached = false,
    Guid? AssignToTrainerClientId = null,
    Guid? AssignToClientId = null);

public sealed record SlotDto(
    Guid Id,
    Guid TrainerId,
    Guid? BookingId,
    Guid? ClientId,
    Guid? TrainerClientId,
    DateTime StartsAtUtc,
    int DurationMinutes,
    string SlotType,
    int? CapacityMax,
    int? CapacityMin,
    int? OccupiedCount,
    bool? IsFull,
    string Status,
    string? BookingStatus,
    string? ClientConfirmationStatus,
    WorkoutTypeSummaryDto? WorkoutType,
    DateTime CreatedAtUtc,
    string? ClientName,
    string? ClientAvatarUrl,
    int? TrainerPricePerSession);

public sealed record SlotAttendeeDto(
    Guid ClientId,
    string ClientName,
    string? ClientAvatarUrl,
    string Status);

public sealed record AvailableSlotTrainerDto(
    Guid Id,
    string Name,
    string? PhoneNumber,
    string? AvatarUrl,
    int? PricePerSession,
    IReadOnlyList<string> TrainingTypes,
    string WorksWithGender,
    string Gender,
    double? Rating,
    string? CityName,
    string? DistrictName);

public sealed record AvailableSlotGroupDto(
    AvailableSlotTrainerDto Trainer,
    IReadOnlyList<SlotDto> Slots);
