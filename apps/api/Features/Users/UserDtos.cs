namespace Api.Features.Users;

public sealed record UpdateUserRequest(
    string Name,
    string CityName,
    string? DistrictName,
    string? Gender,
    string? About,
    string[]? Specializations,
    string[]? TrainingTypes,
    string? WorksWithGender,
    int? PricePerSession,
    string? PreferredTrainerGender,
    string? Level,
    string[]? Goals);

public sealed record UserAvatarResult(string ContentType, byte[] Bytes);
