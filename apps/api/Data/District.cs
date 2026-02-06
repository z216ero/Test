namespace Api.Data;

public sealed class District
{
    public int Id { get; set; }
    public int CityId { get; set; }
    public City? City { get; set; }
    public string Name { get; set; } = string.Empty;
}
