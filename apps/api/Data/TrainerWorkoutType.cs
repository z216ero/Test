namespace Api.Data;

public sealed class TrainerWorkoutType
{
    public Guid Id { get; set; }
    public Guid TrainerId { get; set; }
    public TrainerProfile? TrainerProfile { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizeKey { get; set; } = string.Empty;
    public WorkoutTypeCategory Category { get; set; } = WorkoutTypeCategory.Other;
    public bool IsSystem { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
