namespace Api.Features.Auth;

public sealed record RegisterRequest(
    string Email,
    string Password,
    string Role,
    string Name,
    string CityName,
    string? DistrictName,
    string? Gender,
    IReadOnlyList<string>? Specializations);

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthUserDto(
    Guid Id,
    string Email,
    string Role,
    string Name,
    string Gender,
    int? CityId,
    string? CityName,
    int? DistrictId,
    string? DistrictName,
    string? GymName,
    string? About,
    IReadOnlyList<string> TrainingTypes,
    IReadOnlyList<string> Specializations,
    string? WorksWithGender,
    int? PricePerSession,
    string? PreferredTrainerGender,
    string? ClientLevel,
    IReadOnlyList<string> ClientGoals,
    double? TrainerRating,
    int? TrainerRatingCount,
    bool HasAvatar,
    string? AvatarUrl);

public sealed record AuthResponse(string AccessToken, string RefreshToken, AuthUserDto User);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string? RefreshToken);
