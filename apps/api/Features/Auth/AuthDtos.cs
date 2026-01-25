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
    string? GymName);

public sealed record AuthResponse(string AccessToken, AuthUserDto User);
