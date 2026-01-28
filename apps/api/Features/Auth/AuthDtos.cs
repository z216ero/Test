namespace Api.Features.Auth;

public sealed record RegisterRequest(
    string Email,
    string Password,
    string Role,
    string Name,
    string? Specialization);

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthUserDto(
    Guid Id,
    string Email,
    string Role,
    string Name,
    string? Specialization,
    string? GymName,
    bool HasAvatar,
    string? AvatarUrl);

public sealed record AuthResponse(string AccessToken, string RefreshToken, AuthUserDto User);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string? RefreshToken);
