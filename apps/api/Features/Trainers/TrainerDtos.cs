namespace Api.Features.Trainers;

public sealed record CreateTrainerRequest(string DisplayName, string? GymName);

public sealed record TrainerDto(
    Guid Id,
    string DisplayName,
    string? GymName,
    int? PricePerSession,
    DateTime CreatedAtUtc);
