using System.Data;
using Api.Data;
using Api.Features.Common;
using Api.Features.Push;
using Api.Features.Slots;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Api.Features.Bookings;

public sealed class BookingService(AppDbContext db, PushService pushService)
{
    public BookingService(AppDbContext db)
        : this(db, CreateNoOpPushService(db))
    {
    }

    public async Task<ServiceResult<SlotDto>> BookSlotAsync(
        Guid slotId,
        BookSlotRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ClientId == Guid.Empty)
        {
            return ServiceResult<SlotDto>.Fail(
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
                .Include(s => s.Booking)
                .Include(s => s.Attendees)
                .Include(s => s.TrainerProfile)
                .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
            if (slot is null)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Slot not found",
                    "Slot does not exist.");
            }

            if (slot.Status == TrainingSlotStatus.Cancelled)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot not available",
                    "Only active slots can be booked.");
            }

            if (slot.StartsAtUtc <= DateTime.UtcNow)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already started",
                    "You cannot book a slot that already started.");
            }

            var conflict = await FindTimeConflictAsync(
                request.ClientId,
                slot.Id,
                slot.StartsAtUtc,
                slot.StartsAtUtc.AddMinutes(slot.DurationMinutes),
                cancellationToken);
            if (conflict is not null)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Booking time conflict",
                    "У тебя уже есть запись на это время.",
                    new Dictionary<string, object?>
                    {
                        ["errorCode"] = "booking_time_conflict",
                        ["conflictSlotId"] = conflict.Value.SlotId,
                        ["conflictStartsAtUtc"] = conflict.Value.StartsAtUtc.ToString("O")
                    });
            }

            if (slot.SlotType == TrainingSlotType.Individual)
            {
                if (slot.Status != TrainingSlotStatus.Open)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Slot not available",
                        "Only open slots can be booked.");
                }

                if (slot.Booking is not null)
                {
                    return ServiceResult<SlotDto>.Fail(
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

                db.Bookings.Add(booking);
                slot.Status = TrainingSlotStatus.Booked;
            }
            else
            {
                if (!slot.CapacityMax.HasValue)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Invalid slot configuration",
                        "Group slot capacity is not configured.");
                }

                var existingAttendee = slot.Attendees
                    .FirstOrDefault(a => a.ClientId == request.ClientId);

                if (existingAttendee?.Status == SlotAttendeeStatus.Booked)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Already booked",
                        "Client is already booked for this slot.");
                }

                if (existingAttendee?.Status is SlotAttendeeStatus.Completed or SlotAttendeeStatus.NoShow)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Attendance already marked",
                        "This attendee is already finalized.");
                }

                var occupiedCount = slot.Attendees.Count(a => a.Status == SlotAttendeeStatus.Booked);
                if (occupiedCount >= slot.CapacityMax.Value)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Slot full",
                        "Все места заняты.",
                        new Dictionary<string, object?>
                        {
                            ["errorCode"] = "slot_full"
                        });
                }

                if (existingAttendee is not null && existingAttendee.Status == SlotAttendeeStatus.Cancelled)
                {
                    existingAttendee.Status = SlotAttendeeStatus.Booked;
                    existingAttendee.UpdatedAtUtc = DateTime.UtcNow;
                }
                else
                {
                    db.SlotAttendees.Add(new SlotAttendee
                    {
                        Id = Guid.NewGuid(),
                        SlotId = slot.Id,
                        ClientId = request.ClientId,
                        Status = SlotAttendeeStatus.Booked,
                        CreatedAtUtc = DateTime.UtcNow
                    });
                }
            }

            try
            {
                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (Exception ex) when (IsBookingConflict(ex))
            {
                var slotType = await db.TrainingSlots
                    .AsNoTracking()
                    .Where(s => s.Id == slotId)
                    .Select(s => (TrainingSlotType?)s.SlotType)
                    .FirstOrDefaultAsync(cancellationToken);

                if (slotType == TrainingSlotType.Group)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Slot full",
                        "Все места заняты.",
                        new Dictionary<string, object?>
                        {
                            ["errorCode"] = "slot_full"
                        });
                }

                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already booked",
                    "Slot already has a booking.");
            }

            await pushService.NotifyBookingCreatedAsync(
                slot.Id,
                slot.TrainerId,
                request.ClientId,
                slot.StartsAtUtc,
                cancellationToken);

            var dto = await BuildSlotDtoAsync(slotId, cancellationToken);
            return ServiceResult<SlotDto>.Success(dto);
        });
    }

    public async Task<ServiceResult<SlotDto>> CancelSlotAsync(
        Guid slotId,
        Guid userId,
        string? role,
        CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database
                .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

            var slot = await db.TrainingSlots
                .Include(s => s.Booking)
                .Include(s => s.Attendees)
                .Include(s => s.TrainerProfile)
                .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
            if (slot is null)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Slot not found",
                    "Slot does not exist.");
            }

            if (slot.Status == TrainingSlotStatus.Cancelled)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already cancelled",
                    "This slot has already been cancelled.");
            }

            var isTrainer = string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase);
            var isClient = string.Equals(role, UserRoles.Client, StringComparison.OrdinalIgnoreCase);

            if (!isTrainer && !isClient)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "User role is not allowed to cancel this slot.");
            }

            var startsAtUtc = slot.StartsAtUtc;
            var trainerId = slot.TrainerId;

            if (isTrainer)
            {
                var trainerProfile = await db.TrainerProfiles
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.UserId == userId, cancellationToken);

                if (trainerProfile is null)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status404NotFound,
                        "Trainer profile not found",
                        "Trainer profile is not available for this user.");
                }

                if (slot.TrainerId != trainerProfile.Id)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status403Forbidden,
                        "Forbidden",
                        "Slot does not belong to this trainer.");
                }

                if (slot.SlotType == TrainingSlotType.Individual)
                {
                    if (slot.Booking is null)
                    {
                        slot.Status = TrainingSlotStatus.Cancelled;
                    }
                    else
                    {
                        if (slot.Booking.Status == BookingStatus.Cancelled)
                        {
                            return ServiceResult<SlotDto>.Fail(
                                StatusCodes.Status409Conflict,
                                "Booking already cancelled",
                                "This booking has already been cancelled.");
                        }

                        if (slot.Booking.Status is BookingStatus.Completed or BookingStatus.NoShow)
                        {
                            return ServiceResult<SlotDto>.Fail(
                                StatusCodes.Status409Conflict,
                                "Booking already closed",
                                "This booking has already been marked as completed or no-show.");
                        }

                        slot.Booking.Status = BookingStatus.Cancelled;
                        slot.Status = TrainingSlotStatus.Cancelled;
                    }
                }
                else
                {
                    foreach (var attendee in slot.Attendees.Where(a => a.Status != SlotAttendeeStatus.Cancelled))
                    {
                        attendee.Status = SlotAttendeeStatus.Cancelled;
                        attendee.UpdatedAtUtc = DateTime.UtcNow;
                    }
                    slot.Status = TrainingSlotStatus.Cancelled;
                }

                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                if (slot.SlotType == TrainingSlotType.Group)
                {
                    var clientIds = slot.Attendees
                        .Select(a => a.ClientId)
                        .Distinct()
                        .ToList();

                    await pushService.NotifySlotCancelledByTrainerToClientsAsync(
                        slot.Id,
                        trainerId,
                        clientIds,
                        startsAtUtc,
                        cancellationToken);
                }
                else
                {
                    await pushService.NotifySlotCancelledByTrainerAsync(
                        slot.Id,
                        trainerId,
                        slot.Booking?.ClientId,
                        startsAtUtc,
                        cancellationToken);
                }
            }
            else
            {
                if (slot.StartsAtUtc <= DateTime.UtcNow)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Booking already started",
                        "Training has already started.");
                }

                if (slot.SlotType == TrainingSlotType.Individual)
                {
                    if (slot.Booking is null)
                    {
                        return ServiceResult<SlotDto>.Fail(
                            StatusCodes.Status404NotFound,
                            "Booking not found",
                            "Booking does not exist.");
                    }

                    if (slot.Booking.ClientId != userId)
                    {
                        return ServiceResult<SlotDto>.Fail(
                            StatusCodes.Status403Forbidden,
                            "Forbidden",
                            "Booking does not belong to this client.");
                    }

                    if (slot.Booking.Status != BookingStatus.Booked)
                    {
                        return ServiceResult<SlotDto>.Fail(
                            StatusCodes.Status409Conflict,
                            "Booking already closed",
                            "Only booked sessions can be cancelled.");
                    }

                    db.Bookings.Remove(slot.Booking);
                    slot.Booking = null;
                    slot.Status = TrainingSlotStatus.Open;
                }
                else
                {
                    var attendee = slot.Attendees.FirstOrDefault(a => a.ClientId == userId);
                    if (attendee is null)
                    {
                        return ServiceResult<SlotDto>.Fail(
                            StatusCodes.Status404NotFound,
                            "Booking not found",
                            "Booking does not exist.");
                    }

                    if (attendee.Status != SlotAttendeeStatus.Booked)
                    {
                        return ServiceResult<SlotDto>.Fail(
                            StatusCodes.Status409Conflict,
                            "Booking already closed",
                            "Only booked sessions can be cancelled.");
                    }

                    attendee.Status = SlotAttendeeStatus.Cancelled;
                    attendee.UpdatedAtUtc = DateTime.UtcNow;
                }

                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                await pushService.NotifyBookingCancelledAsync(
                    slot.Id,
                    trainerId,
                    userId,
                    startsAtUtc,
                    cancellationToken);
            }

            var dto = await BuildSlotDtoAsync(slotId, cancellationToken);
            return ServiceResult<SlotDto>.Success(dto);
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

        if (slot.SlotType == TrainingSlotType.Group)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid slot type",
                "Use attendee attendance endpoints for group slots.");
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

        await pushService.NotifyAttendanceMarkedAsync(
            slot.Id,
            slot.TrainerId,
            slot.Booking.ClientId,
            slot.StartsAtUtc,
            cancellationToken);

        return ServiceResult<BookingDto>.Success(ToDto(slot.Booking));
    }

    public async Task<ServiceResult<SlotAttendeeDto>> MarkGroupAttendeeAttendanceAsync(
        Guid slotId,
        Guid trainerUserId,
        Guid clientId,
        SlotAttendeeStatus status,
        CancellationToken cancellationToken)
    {
        if (status is not SlotAttendeeStatus.Completed and not SlotAttendeeStatus.NoShow)
        {
            return ServiceResult<SlotAttendeeDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid status",
                "Only Completed or NoShow are allowed.");
        }

        var trainerProfileId = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == trainerUserId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<SlotAttendeeDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database
                .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

            var slot = await db.TrainingSlots
                .Include(s => s.Attendees)
                .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
            if (slot is null)
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Slot not found",
                    "Slot does not exist.");
            }

            if (slot.TrainerId != trainerProfileId.Value)
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "Slot does not belong to this trainer.");
            }

            if (slot.SlotType != TrainingSlotType.Group)
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid slot type",
                    "Attendee attendance is available only for group slots.");
            }

            var attendee = slot.Attendees.FirstOrDefault(a => a.ClientId == clientId);
            if (attendee is null)
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Attendee not found",
                    "Attendee does not exist for this slot.");
            }

            if (attendee.Status != SlotAttendeeStatus.Booked)
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Attendance already marked",
                    "Only booked attendees can be marked.");
            }

            var nowUtc = DateTime.UtcNow;
            if (status == SlotAttendeeStatus.NoShow
                && nowUtc < slot.StartsAtUtc.AddMinutes(15))
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Too early for no-show",
                    "No-show can be marked only 15 minutes after start.");
            }

            if (status == SlotAttendeeStatus.Completed && nowUtc < slot.StartsAtUtc)
            {
                return ServiceResult<SlotAttendeeDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Too early for completion",
                    "Complete can be marked only after slot start.");
            }

            attendee.Status = status;
            attendee.UpdatedAtUtc = nowUtc;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await pushService.NotifyAttendanceMarkedAsync(
                slot.Id,
                slot.TrainerId,
                clientId,
                slot.StartsAtUtc,
                cancellationToken);

            var user = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == clientId)
                .Select(u => u.Name)
                .FirstOrDefaultAsync(cancellationToken);
            var hasAvatar = await db.UserAvatars
                .AsNoTracking()
                .AnyAsync(a => a.UserId == clientId, cancellationToken);

            return ServiceResult<SlotAttendeeDto>.Success(new SlotAttendeeDto(
                clientId,
                string.IsNullOrWhiteSpace(user) ? "Client" : user,
                hasAvatar ? $"/users/{clientId}/avatar" : null,
                attendee.Status.ToString()));
        });
    }

    private async Task<(Guid SlotId, DateTime StartsAtUtc)?> FindTimeConflictAsync(
        Guid clientId,
        Guid currentSlotId,
        DateTime requestedStartUtc,
        DateTime requestedEndUtc,
        CancellationToken cancellationToken)
    {
        var individualConflict = await db.Bookings
            .AsNoTracking()
            .Include(b => b.Slot)
            .Where(b => b.ClientId == clientId
                && b.Status == BookingStatus.Booked
                && b.Slot != null
                && b.SlotId != currentSlotId
                && b.Slot.Status != TrainingSlotStatus.Cancelled
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
            .Where(a => a.ClientId == clientId
                && a.Status == SlotAttendeeStatus.Booked
                && a.Slot != null
                && a.SlotId != currentSlotId
                && a.Slot.Status != TrainingSlotStatus.Cancelled
                && a.Slot.StartsAtUtc < requestedEndUtc
                && a.Slot.StartsAtUtc.AddMinutes(a.Slot.DurationMinutes) > requestedStartUtc)
            .Select(a => new { a.SlotId, a.Slot!.StartsAtUtc })
            .OrderBy(x => x.StartsAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return attendeeConflict is null
            ? null
            : (attendeeConflict.SlotId, attendeeConflict.StartsAtUtc);
    }

    private async Task<SlotDto> BuildSlotDtoAsync(Guid slotId, CancellationToken cancellationToken)
    {
        var slot = await db.TrainingSlots
            .AsNoTracking()
            .Include(s => s.Booking)
            .Include(s => s.Attendees)
            .Include(s => s.TrainerProfile)
            .FirstAsync(s => s.Id == slotId, cancellationToken);

        string? clientName = null;
        string? clientAvatarUrl = null;
        if (slot.SlotType == TrainingSlotType.Individual && slot.Booking is not null)
        {
            var client = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == slot.Booking.ClientId)
                .Select(u => u.Name)
                .FirstOrDefaultAsync(cancellationToken);
            clientName = client;

            var hasAvatar = await db.UserAvatars
                .AsNoTracking()
                .AnyAsync(a => a.UserId == slot.Booking.ClientId, cancellationToken);
            if (hasAvatar)
            {
                clientAvatarUrl = $"/users/{slot.Booking.ClientId}/avatar";
            }
        }

        return SlotService.ToDto(slot, clientName, clientAvatarUrl, slot.TrainerProfile?.PricePerSession);
    }

    private static BookingDto ToDto(Booking booking)
        => new(
            booking.Id,
            booking.SlotId,
            booking.ClientId,
            booking.Status.ToString(),
            booking.CreatedAtUtc);

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

    private static PushService CreateNoOpPushService(AppDbContext dbContext)
    {
        var pushOptions = Options.Create(new PushOptions());
        var messagingClient = new FirebaseMessagingClient(pushOptions, NullLogger<FirebaseMessagingClient>.Instance);
        return new PushService(dbContext, messagingClient, NullLogger<PushService>.Instance);
    }
}
