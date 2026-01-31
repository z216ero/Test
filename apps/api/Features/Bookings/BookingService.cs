using System.Data;
using Api.Data;
using Api.Features.Common;
using Api.Features.Slots;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
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
                Status = BookingStatus.Booked,
                CreatedAtUtc = DateTime.UtcNow
            };

            slot.Status = TrainingSlotStatus.Booked;
            db.Bookings.Add(booking);

            try
            {
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (Exception ex) when (IsBookingConflict(ex))
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already booked",
                    "Slot already has a booking.");
            }

            return ServiceResult<BookingDto>.Success(ToDto(booking));
        });
    }

    public async Task<ServiceResult<SlotDto>> CancelSlotAsync(Guid slotId, CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
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
                slot.Booking = null;
            }

            slot.Status = TrainingSlotStatus.Open;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return ServiceResult<SlotDto>.Success(ToSlotDto(slot));
        });
    }

    public async Task<ServiceResult<BookingDto>> MarkAttendanceAsync(
        Guid slotId,
        BookingStatus status,
        CancellationToken cancellationToken)
    {
        if (status is not BookingStatus.Completed and not BookingStatus.NoShow)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid status",
                "Only Completed or NoShow are allowed.");
        }

        var slot = await db.TrainingSlots
            .Include(s => s.Booking)
            .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);

        if (slot is null)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Slot not found",
                "Slot does not exist.");
        }

        if (slot.Status != TrainingSlotStatus.Booked)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid slot status",
                "Only booked slots can be marked.");
        }

        if (slot.Booking is null)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        if (slot.Booking.Status == BookingStatus.Completed
            || slot.Booking.Status == BookingStatus.NoShow)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Attendance already marked",
                "Booking already has attendance marked.");
        }

        if (slot.Booking.Status != BookingStatus.Booked)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid booking status",
                "Only booked bookings can be marked.");
        }

        slot.Booking.Status = status;
        await db.SaveChangesAsync(cancellationToken);

        return ServiceResult<BookingDto>.Success(ToDto(slot.Booking));
    }

    private static BookingDto ToDto(Booking booking)
        => new(
            booking.Id,
            booking.SlotId,
            booking.ClientId,
            booking.Status.ToString(),
            booking.CreatedAtUtc);

    private static SlotDto ToSlotDto(TrainingSlot slot)
        => new(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.Status.ToString(),
            slot.Booking?.Status.ToString(),
            slot.CreatedAtUtc,
            null,
            null);

    private static bool IsBookingConflict(Exception ex)
    {
        var pg = FindPostgresException(ex);
        return pg is not null && (pg.SqlState == PostgresErrorCodes.UniqueViolation
            || pg.SqlState == PostgresErrorCodes.SerializationFailure);
    }

    private static PostgresException? FindPostgresException(Exception ex)
    {
        for (var current = ex; current is not null; current = current.InnerException!)
        {
            if (current is PostgresException pg)
            {
                return pg;
            }
        }

        return null;
    }
}
