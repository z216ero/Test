using System.Collections.Generic;

namespace Api.Data;

public sealed class TrainerProfile
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? GymName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public List<TrainingSlot> Slots { get; set; } = new();
}
