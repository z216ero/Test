using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Push;

public sealed class TrainingReminderService(
    AppDbContext db,
    PushService pushService,
    ILogger<TrainingReminderService> logger)
{
    public const int MaxReminderOffsetMinutes = 24 * 60;

    public Task<int> ProcessDueRemindersAsync(CancellationToken cancellationToken)
        => ProcessDueRemindersAsync(DateTime.UtcNow, cancellationToken);

    public async Task<int> ProcessDueRemindersAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var latestSlotStartUtc = nowUtc.AddMinutes(MaxReminderOffsetMinutes + 5);

        var individualCandidates = await db.Bookings
            .AsNoTracking()
            .Where(booking => booking.Status == BookingStatus.Booked
                && booking.Slot != null
                && booking.Slot.Status != TrainingSlotStatus.Cancelled
                && booking.Slot.StartsAtUtc > nowUtc
                && booking.Slot.StartsAtUtc <= latestSlotStartUtc)
            .Select(booking => new ReminderCandidate(
                booking.ClientId,
                booking.SlotId,
                booking.Slot!.TrainerId,
                booking.Slot.StartsAtUtc))
            .ToListAsync(cancellationToken);

        var groupCandidates = await db.SlotAttendees
            .AsNoTracking()
            .Where(attendee => attendee.Status == SlotAttendeeStatus.Booked
                && attendee.Slot != null
                && attendee.Slot.Status != TrainingSlotStatus.Cancelled
                && attendee.Slot.StartsAtUtc > nowUtc
                && attendee.Slot.StartsAtUtc <= latestSlotStartUtc)
            .Select(attendee => new ReminderCandidate(
                attendee.ClientId,
                attendee.SlotId,
                attendee.Slot!.TrainerId,
                attendee.Slot.StartsAtUtc))
            .ToListAsync(cancellationToken);

        var candidates = individualCandidates
            .Concat(groupCandidates)
            .DistinctBy(candidate => new { candidate.ClientId, candidate.SlotId })
            .ToList();

        if (candidates.Count == 0)
        {
            return 0;
        }

        var clientIds = candidates.Select(candidate => candidate.ClientId).Distinct().ToList();
        var slotIds = candidates.Select(candidate => candidate.SlotId).Distinct().ToList();

        var preferences = await db.Users
            .AsNoTracking()
            .Where(user => clientIds.Contains(user.Id))
            .Select(user => new
            {
                user.Id,
                user.PushReminderEnabled,
                user.PushReminderOffsetMinutes
            })
            .ToDictionaryAsync(user => user.Id, cancellationToken);

        var existingDispatches = await db.PushReminderDispatches
            .AsNoTracking()
            .Where(dispatch => clientIds.Contains(dispatch.UserId)
                && slotIds.Contains(dispatch.SlotId))
            .Select(dispatch => new
            {
                dispatch.UserId,
                dispatch.SlotId,
                dispatch.ReminderOffsetMinutes
            })
            .ToListAsync(cancellationToken);

        var dispatchedKeys = existingDispatches
            .Select(dispatch => BuildDispatchKey(
                dispatch.UserId,
                dispatch.SlotId,
                dispatch.ReminderOffsetMinutes))
            .ToHashSet(StringComparer.Ordinal);

        var newDispatches = new List<PushReminderDispatch>();
        foreach (var candidate in candidates)
        {
            if (!preferences.TryGetValue(candidate.ClientId, out var preference))
            {
                continue;
            }

            if (!preference.PushReminderEnabled)
            {
                continue;
            }

            var offsetMinutes = preference.PushReminderOffsetMinutes;
            if (offsetMinutes <= 0 || offsetMinutes > MaxReminderOffsetMinutes)
            {
                continue;
            }

            var reminderAtUtc = candidate.StartsAtUtc.AddMinutes(-offsetMinutes);
            if (reminderAtUtc > nowUtc)
            {
                continue;
            }

            var key = BuildDispatchKey(candidate.ClientId, candidate.SlotId, offsetMinutes);
            if (dispatchedKeys.Contains(key))
            {
                continue;
            }

            var sent = await pushService.TryNotifyTrainingReminderAsync(
                candidate.SlotId,
                candidate.TrainerId,
                candidate.ClientId,
                candidate.StartsAtUtc,
                cancellationToken);
            if (!sent)
            {
                continue;
            }

            dispatchedKeys.Add(key);
            newDispatches.Add(new PushReminderDispatch
            {
                Id = Guid.NewGuid(),
                UserId = candidate.ClientId,
                SlotId = candidate.SlotId,
                ReminderOffsetMinutes = offsetMinutes,
                SentAtUtc = nowUtc,
                CreatedAtUtc = nowUtc
            });
        }

        if (newDispatches.Count == 0)
        {
            return 0;
        }

        db.PushReminderDispatches.AddRange(newDispatches);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            logger.LogWarning(ex, "Failed to persist reminder dispatch markers.");
            return 0;
        }

        return newDispatches.Count;
    }

    private static string BuildDispatchKey(Guid userId, Guid slotId, int offsetMinutes)
        => $"{userId:N}:{slotId:N}:{offsetMinutes}";

    private sealed record ReminderCandidate(
        Guid ClientId,
        Guid SlotId,
        Guid TrainerId,
        DateTime StartsAtUtc);
}
