using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Bookings;

public static class BookingConflictChecker
{
    public static bool IntervalsOverlap(
        DateTime startA,
        DateTime endA,
        DateTime startB,
        DateTime endB)
        => startA < endB && startB < endA;

    public static bool HasExactlyOneClientIdentity(Guid? clientId, Guid? trainerClientId)
        => (clientId is null) != (trainerClientId is null);

    public static async Task<(Guid SlotId, DateTime StartsAtUtc)?> FindTimeConflictAsync(
        AppDbContext db,
        Guid? clientId,
        Guid? trainerClientId,
        Guid? currentSlotId,
        DateTime requestedStartUtc,
        DateTime requestedEndUtc,
        CancellationToken cancellationToken)
    {
        if (!HasExactlyOneClientIdentity(clientId, trainerClientId))
        {
            return null;
        }

        var individualConflict = await db.Bookings
            .AsNoTracking()
            .Include(b => b.Slot)
            .Where(b => b.Status == BookingStatus.Booked
                && b.Slot != null
                && (currentSlotId == null || b.SlotId != currentSlotId.Value)
                && b.Slot.Status != TrainingSlotStatus.Cancelled
                && (
                    (clientId.HasValue && b.ClientId == clientId.Value)
                    || (trainerClientId.HasValue && b.TrainerClientId == trainerClientId.Value)
                )
                && b.Slot.StartsAtUtc < requestedEndUtc
                && b.Slot.StartsAtUtc.AddMinutes(b.Slot.DurationMinutes) > requestedStartUtc)
            .Select(b => new { b.SlotId, b.Slot!.StartsAtUtc })
            .OrderBy(x => x.StartsAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (individualConflict is not null)
        {
            return (individualConflict.SlotId, individualConflict.StartsAtUtc);
        }

        var attendeeConflict = await db.SlotAttendees
            .AsNoTracking()
            .Include(a => a.Slot)
            .Where(a => a.Status == SlotAttendeeStatus.Booked
                && a.Slot != null
                && (currentSlotId == null || a.SlotId != currentSlotId.Value)
                && a.Slot.Status != TrainingSlotStatus.Cancelled
                && (
                    (clientId.HasValue && a.ClientId == clientId.Value)
                    || (trainerClientId.HasValue && a.TrainerClientId == trainerClientId.Value)
                )
                && a.Slot.StartsAtUtc < requestedEndUtc
                && a.Slot.StartsAtUtc.AddMinutes(a.Slot.DurationMinutes) > requestedStartUtc)
            .Select(a => new { a.SlotId, a.Slot!.StartsAtUtc })
            .OrderBy(x => x.StartsAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return attendeeConflict is null
            ? null
            : (attendeeConflict.SlotId, attendeeConflict.StartsAtUtc);
    }
}
