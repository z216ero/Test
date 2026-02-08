namespace Api.Data;

public sealed class SlotAttendee
{
    public Guid Id { get; set; }
    public Guid SlotId { get; set; }
    public TrainingSlot? Slot { get; set; }
    public Guid ClientId { get; set; }
    public SlotAttendeeStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
