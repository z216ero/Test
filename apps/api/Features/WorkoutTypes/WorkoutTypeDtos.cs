namespace Api.Features.WorkoutTypes;

public sealed record WorkoutTypeSummaryDto(
    Guid Id,
    string Name,
    string Category,
    bool IsSystem,
    bool IsArchived);
