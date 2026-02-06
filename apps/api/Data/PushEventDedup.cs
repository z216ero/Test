namespace Api.Data;

public sealed class PushEventDedup
{
    public string KeyHash { get; set; } = string.Empty;
    public DateTime LastSentAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
