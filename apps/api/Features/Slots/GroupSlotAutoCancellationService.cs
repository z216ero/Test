using Api.Data;
using Api.Features.Push;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Api.Features.Slots;

public sealed class GroupSlotAutoCancellationService(
    AppDbContext db,
    PushService pushService,
    ILogger<GroupSlotAutoCancellationService> logger)
{
    public const int AutoCancelLeadMinutes = 40;
    private const int BatchSize = 100;

    public GroupSlotAutoCancellationService(AppDbContext db)
        : this(db, CreateNoOpPushService(db), NullLogger<GroupSlotAutoCancellationService>.Instance)
    {
    }

    public Task<int> ProcessDueSlotsAsync(CancellationToken cancellationToken)
        => ProcessDueSlotsAsync(DateTime.UtcNow, cancellationToken);

    public async Task<int> ProcessDueSlotsAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var dueSlots = await db.TrainingSlots
            .Include(slot => slot.Attendees)
            .Where(slot =>
                slot.SlotType == TrainingSlotType.Group
                && slot.Status == TrainingSlotStatus.Open
                && slot.AutoCancelIfMinNotReached
                && slot.AutoCancelAtUtc.HasValue
                && slot.AutoCancelAtUtc <= nowUtc
                && slot.StartsAtUtc > nowUtc)
            .OrderBy(slot => slot.AutoCancelAtUtc)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        if (dueSlots.Count == 0)
        {
            return 0;
        }

        var cancelled = new List<(Guid SlotId, Guid TrainerId, DateTime StartsAtUtc, List<Guid> ClientIds)>();

        foreach (var slot in dueSlots)
        {
            if (!slot.CapacityMin.HasValue)
            {
                slot.AutoCancelAtUtc = null;
                continue;
            }

            var bookedAttendees = slot.Attendees
                .Where(attendee => attendee.Status == SlotAttendeeStatus.Booked)
                .ToList();

            if (bookedAttendees.Count < slot.CapacityMin.Value)
            {
                var clientIds = bookedAttendees
                    .Select(attendee => attendee.ClientId)
                    .Distinct()
                    .ToList();

                foreach (var attendee in bookedAttendees)
                {
                    attendee.Status = SlotAttendeeStatus.Cancelled;
                    attendee.UpdatedAtUtc = nowUtc;
                }

                slot.Status = TrainingSlotStatus.Cancelled;
                slot.AutoCancelAtUtc = null;
                cancelled.Add((slot.Id, slot.TrainerId, slot.StartsAtUtc, clientIds));
                continue;
            }

            slot.AutoCancelAtUtc = null;
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var item in cancelled)
        {
            await pushService.NotifySlotCancelledByTrainerToClientsAsync(
                item.SlotId,
                item.TrainerId,
                item.ClientIds,
                item.StartsAtUtc,
                PushCancellationReasons.MinParticipantsNotReached,
                cancellationToken);
        }

        if (cancelled.Count > 0)
        {
            logger.LogInformation(
                "Auto-cancelled {Count} group slots due to insufficient participants.",
                cancelled.Count);
        }

        return cancelled.Count;
    }

    private static PushService CreateNoOpPushService(AppDbContext dbContext)
    {
        var pushOptions = Options.Create(new PushOptions());
        var messagingClient = new FirebaseMessagingClient(pushOptions, NullLogger<FirebaseMessagingClient>.Instance);
        return new PushService(dbContext, messagingClient, NullLogger<PushService>.Instance);
    }
}
