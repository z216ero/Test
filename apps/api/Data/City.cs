namespace Api.Data;

public sealed class City
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<District> Districts { get; set; } = new();
}
