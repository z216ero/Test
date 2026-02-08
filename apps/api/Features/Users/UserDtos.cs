namespace Api.Features.Users;

public sealed record UpdateUserRequest(
    string Name,
    string CityName,
    string? DistrictName = null,
    string? Gender = null,
    string? About = null,
    string[]? Specializations = null,
    string[]? TrainingTypes = null,
    string? WorksWithGender = null,
    int? PricePerSession = null,
    string? PreferredTrainerGender = null,
    string? Level = null,
    string[]? Goals = null);

public sealed record UserAvatarResult(string ContentType, byte[] Bytes);
