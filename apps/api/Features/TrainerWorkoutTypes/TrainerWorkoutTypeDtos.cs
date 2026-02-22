using Api.Features.WorkoutTypes;

namespace Api.Features.TrainerWorkoutTypes;

public sealed record TrainerWorkoutTypeDto(
    Guid Id,
    string Name,
    string Category,
    bool IsSystem,
    bool IsArchived);

public sealed record CreateTrainerWorkoutTypeRequest(
    string? Name,
    string? Category);

public sealed record SetBookingWorkoutTypeRequest(Guid? WorkoutTypeId);

public sealed record SetBookingWorkoutTypeResponse(
    Guid BookingId,
    Guid? WorkoutTypeId,
    WorkoutTypeSummaryDto? WorkoutType,
    DateTime? UpdatedAtUtc);
