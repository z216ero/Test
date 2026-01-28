namespace Api.Features.Users;

public sealed record UpdateUserRequest(string Name, string? Specialization);

public sealed record UserAvatarResult(string ContentType, byte[] Bytes);
