namespace Api.Data;

public sealed class TrainerProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public int? CityId { get; set; }
    public City? City { get; set; }
    public int? DistrictId { get; set; }
    public District? District { get; set; }
    public int? PricePerSession { get; set; }
    public string? GymName { get; set; }
    public string? About { get; set; }
    public string[] Specializations { get; set; } = Array.Empty<string>();
    public string[] TrainingTypes { get; set; } = Array.Empty<string>();
    public Gender WorksWithGender { get; set; } = Gender.Any;
    public DateTime CreatedAtUtc { get; set; }
    public List<TrainingSlot> Slots { get; set; } = new();
}
