namespace Api.Features.TrainerClientLinks;

public sealed record SearchTrainerClientByPhoneRequest(string? Phone);

public sealed record SearchTrainerClientByPhoneResponse(
    Guid ClientUserId,
    string DisplayName,
    string MaskedPhone);

public sealed record CreateTrainerClientLinkRequest(Guid ClientUserId);

public sealed record TrainerClientLinkDto(
    Guid Id,
    Guid TrainerId,
    Guid ClientUserId,
    string Status,
    DateTime RequestedAtUtc,
    DateTime? RespondedAtUtc,
    DateTime LastRequestAtUtc,
    DateTime? RejectedUntilUtc,
    string? TrainerName,
    string? TrainerCityName,
    string? ClientName,
    string? ClientPhone);

public sealed record PendingCountDto(int Count);

