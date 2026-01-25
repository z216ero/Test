namespace Api.Features.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = "TrainerApp";
    public string Audience { get; init; } = "TrainerApp";
    public string SigningKey { get; init; } = string.Empty;
    public int AccessTokenMinutes { get; init; } = 60;
}
