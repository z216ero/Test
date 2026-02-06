namespace Api.Data;

public sealed class ClientProfile
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public Gender PreferredTrainerGender { get; set; } = Gender.Any;
    public ClientLevel Level { get; set; } = ClientLevel.Beginner;
    public string[] Goals { get; set; } = Array.Empty<string>();
    public DateTime CreatedAtUtc { get; set; }
}
