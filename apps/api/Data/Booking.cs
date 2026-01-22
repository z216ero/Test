namespace Api.Data;

public sealed class Booking
{
    public Guid Id { get; set; }
    public Guid SlotId { get; set; }
    public TrainingSlot? Slot { get; set; }
    public Guid ClientId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
