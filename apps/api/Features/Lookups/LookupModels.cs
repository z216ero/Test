namespace Api.Features.Lookups;

public sealed record LookupItem(
    string Code,
    string Label,
    bool IsDefault = false,
    bool IsAny = false,
    bool? IsTrainerRole = null,
    bool? IsClientRole = null);

public sealed record LookupResponse(IReadOnlyList<LookupItem> Items);

public sealed record CityDto(int Id, string Name);

public sealed record DistrictDto(int Id, int CityId, string Name);
