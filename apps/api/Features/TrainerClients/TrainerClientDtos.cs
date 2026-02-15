namespace Api.Features.TrainerClients;

public sealed record CreateTrainerClientRequest(
    string? DisplayName,
    string? Phone,
    string? Notes);

public sealed record UpdateTrainerClientRequest(
    string? DisplayName,
    string? Phone,
    string? Notes,
    string? Status);

public sealed record LinkTrainerClientRequest(Guid LinkedUserId);

public sealed record TrainerClientDto(
    Guid Id,
    Guid TrainerId,
    Guid? LinkedUserId,
    string DisplayName,
    string? Phone,
    string? Notes,
    string Status,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
