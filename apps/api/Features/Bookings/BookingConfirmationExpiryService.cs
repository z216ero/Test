using Api.Data;
using Api.Features.Push;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Bookings;

public sealed class BookingConfirmationExpiryService(
    AppDbContext db,
    PushService pushService,
    ILogger<BookingConfirmationExpiryService> logger)
{
    private const int BatchSize = 200;

    public Task<int> ProcessDueAsync(CancellationToken cancellationToken)
        => ProcessDueAsync(DateTime.UtcNow, cancellationToken);

    public async Task<int> ProcessDueAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var dueBookings = await db.Bookings
            .Include(b => b.Slot)
            .Where(b =>
                b.Status == BookingStatus.Booked
                && b.ClientConfirmationStatus == BookingClientConfirmationStatus.Pending
                && b.Slot != null
                && b.Slot.Status != TrainingSlotStatus.Cancelled
                && b.Slot.StartsAtUtc <= nowUtc)
            .OrderBy(b => b.Slot!.StartsAtUtc)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        if (dueBookings.Count == 0)
        {
            return 0;
        }

        var expired = new List<(Guid BookingId, Guid SlotId, Guid TrainerId, Guid? ClientId, DateTime StartsAtUtc)>();
        foreach (var booking in dueBookings)
        {
            var slot = booking.Slot;
            if (slot is null)
            {
                continue;
            }

            booking.ClientConfirmationStatus = BookingClientConfirmationStatus.Declined;
            booking.ClientConfirmationRespondedAtUtc = nowUtc;
            booking.Status = BookingStatus.Cancelled;
            booking.UpdatedAtUtc = nowUtc;

            if (slot.Status != TrainingSlotStatus.Cancelled)
            {
                slot.Status = TrainingSlotStatus.Open;
            }

            expired.Add((booking.Id, booking.SlotId, slot.TrainerId, booking.ClientId, slot.StartsAtUtc));
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var item in expired)
        {
            if (!item.ClientId.HasValue)
            {
                continue;
            }

            await pushService.NotifyBookingConfirmationDeclinedAsync(
                item.BookingId,
                item.SlotId,
                item.TrainerId,
                item.ClientId.Value,
                item.StartsAtUtc,
                cancellationToken);
        }

        logger.LogInformation(
            "Expired {Count} pending booking confirmations.",
            expired.Count);

        return expired.Count;
    }
}
