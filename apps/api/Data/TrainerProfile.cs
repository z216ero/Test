namespace Api.Data;

public sealed class TrainerProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public string? GymName { get; set; }
    public string? Specialization { get; set; }
    public string? About { get; set; }
    public string[] TrainingTypes { get; set; } = Array.Empty<string>();
    public ClientGenderPreference ClientGenderPreference { get; set; } = ClientGenderPreference.All;
    public DateTime CreatedAtUtc { get; set; }
    public List<TrainingSlot> Slots { get; set; } = new();
}
