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
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var now = DateTime.UtcNow;

        var bookings = await db.Bookings
            .AsNoTracking()
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(b => b.ClientId == profile.UserId
                && b.Slot != null
                && b.Status == BookingStatus.Booked
                && b.Slot.Status == TrainingSlotStatus.Booked
                && b.Slot.StartsAtUtc > now)
            .OrderBy(b => b.Slot!.StartsAtUtc)
            .ToListAsync(cancellationToken);

        var trainerAvatarIds = await GetTrainerAvatarIdsAsync(bookings, cancellationToken);
        var dtos = bookings
            .Where(booking => booking.Slot is not null)
            .Select(booking => ToSessionDto(booking, booking.Slot!, trainerAvatarIds))
            .ToList();

        return ServiceResult<List<UpcomingSessionDto>>.Success(dtos);
    }

    public async Task<ServiceResult<List<UpcomingSessionDto>>> GetBookingHistoryAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<List<UpcomingSessionDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var bookings = await db.Bookings
            .AsNoTracking()
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(b => b.ClientId == profile.UserId
                && b.Slot != null
                && (b.Status == BookingStatus.Completed
                    || b.Status == BookingStatus.NoShow
                    || b.Status == BookingStatus.Cancelled))
            .OrderByDescending(b => b.Slot!.StartsAtUtc)
            .ToListAsync(cancellationToken);

        var trainerAvatarIds = await GetTrainerAvatarIdsAsync(bookings, cancellationToken);
        var dtos = bookings
            .Where(booking => booking.Slot is not null)
            .Select(booking => ToSessionDto(booking, booking.Slot!, trainerAvatarIds))
            .ToList();

        return ServiceResult<List<UpcomingSessionDto>>.Success(dtos);
    }

    public async Task<ServiceResult<ClientProfileDto>> GetClientProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<ClientProfileDto>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<ClientProfileDto>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<ClientProfileDto>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        return ServiceResult<ClientProfileDto>.Success(new ClientProfileDto(profile.UserId));
    }

    private static UpcomingSessionDto ToSessionDto(
        Booking booking,
        TrainingSlot slot,
        HashSet<Guid> trainerAvatarIds)
    {
        var trainerProfile = slot.TrainerProfile;
        var trainerName = trainerProfile?.User?.Name;
        var trainerSpecialization = trainerProfile?.Specialization;
        var trainerUserId = trainerProfile?.UserId;
        var trainerAvatarUrl = trainerUserId.HasValue && trainerAvatarIds.Contains(trainerUserId.Value)
            ? $"/users/{trainerUserId.Value}/avatar"
            : null;

        return new UpcomingSessionDto(
            ToSlotDto(slot, booking.Status),
            trainerName,
            trainerSpecialization,
            trainerAvatarUrl);
    }

    private async Task<HashSet<Guid>> GetTrainerAvatarIdsAsync(
        List<Booking> bookings,
        CancellationToken cancellationToken)
    {
        var trainerUserIds = bookings
            .Select(booking => booking.Slot?.TrainerProfile?.UserId)
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

    private static SlotDto ToSlotDto(TrainingSlot slot, BookingStatus? bookingStatus)
        => new(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.Status.ToString(),
            bookingStatus?.ToString(),
            slot.CreatedAtUtc,
            null,
            null);
}
