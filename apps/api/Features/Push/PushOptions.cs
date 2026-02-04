namespace Api.Features.Push;

public sealed class PushOptions
{
    public const string SectionName = "Push";

    public string? FirebaseCredentialsPath { get; init; }
    public string? FirebaseCredentialsJson { get; init; }
    public string? FirebaseProjectId { get; init; }
}
