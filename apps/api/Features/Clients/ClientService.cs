using Api.Data;
using Api.Features.Common;
using Api.Features.Slots;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Clients;

public sealed class ClientService(AppDbContext db)
{
    public async Task<ServiceResult<List<UpcomingSessionDto>>> GetUpcomingSessionsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var profile = await EnsureClientProfileAsync(userId, cancellationToken);
        if (!profile.IsSuccess)
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                profile.Error!.StatusCode,
                profile.Error.Title,
                profile.Error.Detail);
        }

        var now = DateTime.UtcNow;

        var individualBookings = await db.Bookings
            .AsNoTracking()
            .Include(b => b.Slot!)
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.City)
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.District)
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(b => b.ClientId == profile.Value!.UserId
                && b.Slot != null
                && b.Status == BookingStatus.Booked
                && b.Slot.Status != TrainingSlotStatus.Cancelled
                && b.Slot.StartsAtUtc > now)
            .ToListAsync(cancellationToken);

        var groupAttendees = await db.SlotAttendees
            .AsNoTracking()
            .Include(a => a.Slot!)
            .ThenInclude(s => s.Booking)
            .Include(a => a.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.City)
            .Include(a => a.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.District)
            .Include(a => a.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(a => a.ClientId == profile.Value.UserId
                && a.Status == SlotAttendeeStatus.Booked
                && a.Slot != null
                && a.Slot.Status != TrainingSlotStatus.Cancelled
                && a.Slot.StartsAtUtc > now)
            .ToListAsync(cancellationToken);

        var occupiedCounts = await LoadGroupOccupiedCountsAsync(
            individualBookings
                .Select(b => b.SlotId)
                .Concat(groupAttendees.Select(a => a.SlotId))
                .Distinct()
                .ToList(),
            cancellationToken);

        var trainerAvatarIds = await GetTrainerAvatarIdsAsync(individualBookings, groupAttendees, cancellationToken);

        var sessions = new List<UpcomingSessionDto>(individualBookings.Count + groupAttendees.Count);
        sessions.AddRange(individualBookings
            .Where(booking => booking.Slot is not null)
            .Select(booking => ToSessionDto(booking.Slot!, booking.Status, trainerAvatarIds, occupiedCounts)));
        sessions.AddRange(groupAttendees
            .Where(attendee => attendee.Slot is not null)
            .Select(attendee => ToSessionDto(attendee.Slot!, attendee.Status, trainerAvatarIds, occupiedCounts)));

        var sorted = sessions
            .OrderBy(x => x.Slot.StartsAtUtc)
            .ToList();

        return ServiceResult<List<UpcomingSessionDto>>.Success(sorted);
    }

    public async Task<ServiceResult<List<UpcomingSessionDto>>> GetBookingHistoryAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var profile = await EnsureClientProfileAsync(userId, cancellationToken);
        if (!profile.IsSuccess)
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                profile.Error!.StatusCode,
                profile.Error.Title,
                profile.Error.Detail);
        }

        var individualBookings = await db.Bookings
            .AsNoTracking()
            .Include(b => b.Slot!)
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.City)
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.District)
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(b => b.ClientId == profile.Value!.UserId
                && b.Slot != null
                && (b.Status == BookingStatus.Completed
                    || b.Status == BookingStatus.NoShow
                    || b.Status == BookingStatus.Cancelled))
            .ToListAsync(cancellationToken);

        var groupAttendees = await db.SlotAttendees
            .AsNoTracking()
            .Include(a => a.Slot!)
            .ThenInclude(s => s.Booking)
            .Include(a => a.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.City)
            .Include(a => a.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.District)
            .Include(a => a.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(a => a.ClientId == profile.Value.UserId
                && (a.Status == SlotAttendeeStatus.Completed
                    || a.Status == SlotAttendeeStatus.NoShow
                    || a.Status == SlotAttendeeStatus.Cancelled)
                && a.Slot != null)
            .ToListAsync(cancellationToken);

        var occupiedCounts = await LoadGroupOccupiedCountsAsync(
            individualBookings
                .Select(b => b.SlotId)
                .Concat(groupAttendees.Select(a => a.SlotId))
                .Distinct()
                .ToList(),
            cancellationToken);

        var trainerAvatarIds = await GetTrainerAvatarIdsAsync(individualBookings, groupAttendees, cancellationToken);

        var sessions = new List<UpcomingSessionDto>(individualBookings.Count + groupAttendees.Count);
        sessions.AddRange(individualBookings
            .Where(booking => booking.Slot is not null)
            .Select(booking => ToSessionDto(booking.Slot!, booking.Status, trainerAvatarIds, occupiedCounts)));
        sessions.AddRange(groupAttendees
            .Where(attendee => attendee.Slot is not null)
            .Select(attendee => ToSessionDto(attendee.Slot!, attendee.Status, trainerAvatarIds, occupiedCounts)));

        var sorted = sessions
            .OrderByDescending(x => x.Slot.StartsAtUtc)
            .ToList();

        return ServiceResult<List<UpcomingSessionDto>>.Success(sorted);
    }

    public async Task<ServiceResult<ClientProfileDto>> GetClientProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var result = await EnsureClientProfileAsync(userId, cancellationToken);
        if (!result.IsSuccess)
        {
            return ServiceResult<ClientProfileDto>.Fail(
                result.Error!.StatusCode,
                result.Error.Title,
                result.Error.Detail);
        }

        return ServiceResult<ClientProfileDto>.Success(new ClientProfileDto(result.Value!.UserId));
    }

    private async Task<ServiceResult<ClientProfile>> EnsureClientProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<ClientProfile>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<ClientProfile>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<ClientProfile>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        return ServiceResult<ClientProfile>.Success(profile);
    }

    private static UpcomingSessionDto ToSessionDto(
        TrainingSlot slot,
        BookingStatus bookingStatus,
        HashSet<Guid> trainerAvatarIds,
        IReadOnlyDictionary<Guid, int> occupiedCounts)
        => ToSessionDto(slot, bookingStatus.ToString(), trainerAvatarIds, occupiedCounts);

    private static UpcomingSessionDto ToSessionDto(
        TrainingSlot slot,
        SlotAttendeeStatus attendeeStatus,
        HashSet<Guid> trainerAvatarIds,
        IReadOnlyDictionary<Guid, int> occupiedCounts)
        => ToSessionDto(slot, attendeeStatus.ToString(), trainerAvatarIds, occupiedCounts);

    private static UpcomingSessionDto ToSessionDto(
        TrainingSlot slot,
        string bookingStatus,
        HashSet<Guid> trainerAvatarIds,
        IReadOnlyDictionary<Guid, int> occupiedCounts)
    {
        var trainerProfile = slot.TrainerProfile;
        var trainerName = trainerProfile?.User?.Name;
        var trainerCityName = trainerProfile?.City?.Name;
        var trainerDistrictName = trainerProfile?.District?.Name;
        var trainerSpecializations = trainerProfile?.Specializations ?? Array.Empty<string>();
        var trainerTrainingTypes = trainerProfile?.TrainingTypes ?? Array.Empty<string>();
        var trainerUserId = trainerProfile?.UserId;
        var trainerAvatarUrl = trainerUserId.HasValue && trainerAvatarIds.Contains(trainerUserId.Value)
            ? $"/users/{trainerUserId.Value}/avatar"
            : null;

        return new UpcomingSessionDto(
            ToSlotDto(slot, bookingStatus, occupiedCounts),
            trainerName,
            trainerCityName,
            trainerDistrictName,
            trainerSpecializations,
            trainerTrainingTypes,
            trainerAvatarUrl);
    }

    private async Task<HashSet<Guid>> GetTrainerAvatarIdsAsync(
        List<Booking> bookings,
        List<SlotAttendee> attendees,
        CancellationToken cancellationToken)
    {
        var trainerUserIds = bookings
            .Select(booking => booking.Slot?.TrainerProfile?.UserId)
            .Concat(attendees.Select(attendee => attendee.Slot?.TrainerProfile?.UserId))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (trainerUserIds.Count == 0)
        {
            return new HashSet<Guid>();
        }

        var ids = await db.UserAvatars
            .AsNoTracking()
            .Where(avatar => trainerUserIds.Contains(avatar.UserId))
            .Select(avatar => avatar.UserId)
            .ToListAsync(cancellationToken);

        return ids.ToHashSet();
    }

    private async Task<Dictionary<Guid, int>> LoadGroupOccupiedCountsAsync(
        IReadOnlyCollection<Guid> slotIds,
        CancellationToken cancellationToken)
    {
        if (slotIds.Count == 0)
        {
            return [];
        }

        return await db.SlotAttendees
            .AsNoTracking()
            .Where(a => slotIds.Contains(a.SlotId) && a.Status == SlotAttendeeStatus.Booked)
            .GroupBy(a => a.SlotId)
            .Select(g => new { SlotId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SlotId, x => x.Count, cancellationToken);
    }

    private static SlotDto ToSlotDto(
        TrainingSlot slot,
        string bookingStatus,
        IReadOnlyDictionary<Guid, int> occupiedCounts)
    {
        var occupiedCount = slot.SlotType == TrainingSlotType.Group
            ? (int?)(occupiedCounts.TryGetValue(slot.Id, out var count) ? count : 0)
            : null;
        var isFull = slot.SlotType == TrainingSlotType.Group
            && slot.CapacityMax.HasValue
            ? occupiedCount >= slot.CapacityMax.Value
            : (bool?)null;

        return new SlotDto(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.SlotType.ToString(),
            slot.CapacityMax,
            slot.CapacityMin,
            occupiedCount,
            isFull,
            slot.Status.ToString(),
            bookingStatus,
            slot.CreatedAtUtc,
            null,
            null,
            slot.TrainerProfile?.PricePerSession);
    }
}
