using Api.Data;
using Api.Features.Common;
using Api.Features.Slots;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Clients;

public sealed class ClientService(AppDbContext db)
{
    public async Task<ServiceResult<UpcomingSessionDto?>> GetUpcomingSessionAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<UpcomingSessionDto?>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<UpcomingSessionDto?>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<UpcomingSessionDto?>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var now = DateTime.UtcNow;

        var booking = await db.Bookings
            .Include(b => b.Slot!)
            .ThenInclude(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(b => b.ClientId == profile.UserId
                && b.Slot != null
                && b.Slot.StartsAtUtc >= now
                && b.Slot.Status == TrainingSlotStatus.Booked)
            .OrderBy(b => b.Slot!.StartsAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (booking?.Slot is null)
        {
            return ServiceResult<UpcomingSessionDto?>.Success(null);
        }

        var trainerProfile = booking.Slot.TrainerProfile;
        var trainerName = trainerProfile?.User?.Name;
        var trainerSpecialization = trainerProfile?.Specialization;

        var dto = new UpcomingSessionDto(
            ToSlotDto(booking.Slot),
            trainerName,
            trainerSpecialization);

        return ServiceResult<UpcomingSessionDto?>.Success(dto);
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

    private static SlotDto ToSlotDto(TrainingSlot slot)
        => new(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.Status.ToString(),
            slot.CreatedAtUtc);
}
