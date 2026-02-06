namespace Api.Data;

public sealed class DeviceToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public string Platform { get; set; } = "android";
    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
    public bool IsEnabled { get; set; } = true;
}
