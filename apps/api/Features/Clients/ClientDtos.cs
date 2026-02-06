namespace Api.Features.Clients;

public sealed record ClientProfileDto(Guid UserId);

public sealed record UpcomingSessionDto(
    Api.Features.Slots.SlotDto Slot,
    string? TrainerName,
    string? TrainerCityName,
    string? TrainerDistrictName,
    IReadOnlyList<string> TrainerSpecializations,
    IReadOnlyList<string> TrainerTrainingTypes,
    string? TrainerAvatarUrl);
