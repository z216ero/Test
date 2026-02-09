namespace Api.Data;

public sealed class PushReminderDispatch
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid SlotId { get; set; }
    public int ReminderOffsetMinutes { get; set; }
    public DateTime SentAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
