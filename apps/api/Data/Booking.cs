namespace Api.Data;

public sealed class Booking
{
    public Guid Id { get; set; }
    public Guid SlotId { get; set; }
    public TrainingSlot? Slot { get; set; }
    public Guid? ClientId { get; set; }
    public Guid? TrainerClientId { get; set; }
    public TrainerClient? TrainerClient { get; set; }
    public BookingStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Payment? Payment { get; set; }
}
