using System.Data;
using Api.Data;
using Api.Features.Common;
using Api.Features.Slots;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Bookings;

public sealed class BookingService(AppDbContext db)
{
    public async Task<ServiceResult<BookingDto>> BookSlotAsync(
        Guid slotId,
        BookSlotRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ClientId == Guid.Empty)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid client",
                "ClientId is required.");
        }

        await using var transaction = await db.Database
            .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var slot = await db.TrainingSlots
            .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
        if (slot is null)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Slot not found",
                "Slot does not exist.");
        }

        if (slot.Status != TrainingSlotStatus.Open)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Slot not available",
                "Only open slots can be booked.");
        }

        var existingBooking = await db.Bookings
            .AnyAsync(b => b.SlotId == slotId, cancellationToken);
        if (existingBooking)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Slot already booked",
                "Slot already has a booking.");
        }

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            ClientId = request.ClientId,
            CreatedAtUtc = DateTime.UtcNow
        };

        slot.Status = TrainingSlotStatus.Booked;
        db.Bookings.Add(booking);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Slot already booked",
                "Slot already has a booking.");
        }

        return ServiceResult<BookingDto>.Success(ToDto(booking));
    }

    public async Task<ServiceResult<SlotDto>> CancelSlotAsync(Guid slotId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database
            .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var slot = await db.TrainingSlots
            .Include(s => s.Booking)
            .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
        if (slot is null)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status404NotFound,
                "Slot not found",
                "Slot does not exist.");
        }

        if (slot.Status != TrainingSlotStatus.Booked)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status409Conflict,
                "Cannot cancel slot",
                "Only booked slots can be cancelled.");
        }

        if (slot.Booking is not null)
        {
            db.Bookings.Remove(slot.Booking);
        }

        slot.Status = TrainingSlotStatus.Open;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ServiceResult<SlotDto>.Success(ToSlotDto(slot));
    }

    private static BookingDto ToDto(Booking booking)
        => new(
            booking.Id,
            booking.SlotId,
            booking.ClientId,
            booking.CreatedAtUtc);

    private static SlotDto ToSlotDto(TrainingSlot slot)
        => new(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.Status.ToString(),
            slot.CreatedAtUtc);
}
