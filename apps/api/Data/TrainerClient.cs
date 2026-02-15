namespace Api.Data;

public sealed class TrainerClient
{
    public Guid Id { get; set; }
    public Guid TrainerId { get; set; }
    public TrainerProfile? TrainerProfile { get; set; }
    public Guid? LinkedUserId { get; set; }
    public AppUser? LinkedUser { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Notes { get; set; }
    public TrainerClientStatus Status { get; set; } = TrainerClientStatus.Active;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
