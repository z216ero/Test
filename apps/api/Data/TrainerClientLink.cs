namespace Api.Data;

public sealed class TrainerClientLink
{
    public Guid Id { get; set; }
    public Guid TrainerId { get; set; }
    public TrainerProfile? TrainerProfile { get; set; }
    public Guid ClientUserId { get; set; }
    public AppUser? ClientUser { get; set; }
    public TrainerClientLinkStatus Status { get; set; } = TrainerClientLinkStatus.Pending;
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? RespondedAtUtc { get; set; }
    public DateTime LastRequestAtUtc { get; set; }
    public DateTime? RejectedUntilUtc { get; set; }
}
