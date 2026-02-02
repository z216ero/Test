namespace Api.Data;

public sealed class ClientProfile
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
