namespace Api.Data;

public sealed class TrainingSlot
{
    public Guid Id { get; set; }
    public Guid TrainerId { get; set; }
    public TrainerProfile? TrainerProfile { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public int DurationMinutes { get; set; }
    public TrainingSlotStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public Booking? Booking { get; set; }
}
