namespace Api.Features.Users;

public sealed record UpdateUserRequest(
    string Name,
    string? Specialization,
    string? About,
    string[]? TrainingTypes,
    string? ClientGenderPreference,
    int? PricePerSession);

public sealed record UserAvatarResult(string ContentType, byte[] Bytes);
