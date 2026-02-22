using System.Data;
using Api.Data;
using Api.Features.Common;
using Api.Features.Push;
using Api.Features.Slots;
using Api.Features.TrainerWorkoutTypes;
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
        Guid actorClientUserId,
        BookSlotRequest request,
        CancellationToken cancellationToken)
    {
        if (actorClientUserId == Guid.Empty)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "Authentication is required.");
        }

        if (request.ClientId.HasValue && request.ClientId.Value != actorClientUserId)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Client can only book for self.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
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

            var conflict = await BookingConflictChecker.FindTimeConflictAsync(
                db,
                actorClientUserId,
                trainerClientId: null,
                slot.Id,
                slot.StartsAtUtc,
                slot.StartsAtUtc.AddMinutes(slot.DurationMinutes),
                cancellationToken);
            if (conflict is not null)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Booking time conflict",
                    "У этого клиента уже есть запись на это время.",
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

                if (slot.Booking is null)
                {
                    var booking = new Booking
                    {
                        Id = Guid.NewGuid(),
                        SlotId = slotId,
                        ClientId = actorClientUserId,
                        TrainerClientId = null,
                        Status = BookingStatus.Booked,
                        ClientConfirmationStatus = BookingClientConfirmationStatus.Confirmed,
                        ClientConfirmationRequestedAtUtc = null,
                        ClientConfirmationRespondedAtUtc = DateTime.UtcNow,
                        CreatedAtUtc = DateTime.UtcNow,
                        UpdatedAtUtc = DateTime.UtcNow
                    };

                    db.Bookings.Add(booking);
                    db.Payments.Add(new Payment
                    {
                        Id = Guid.NewGuid(),
                        BookingId = booking.Id,
                        Amount = slot.TrainerProfile?.PricePerSession ?? 0,
                        Status = PaymentStatus.Pending,
                        Method = null,
                        PaidAtUtc = null,
                        CreatedAtUtc = DateTime.UtcNow,
                        UpdatedAtUtc = DateTime.UtcNow
                    });
                }
                else if (slot.Booking.Status == BookingStatus.Cancelled)
                {
                    slot.Booking.ClientId = actorClientUserId;
                    slot.Booking.TrainerClientId = null;
                    slot.Booking.Status = BookingStatus.Booked;
                    slot.Booking.ClientConfirmationStatus = BookingClientConfirmationStatus.Confirmed;
                    slot.Booking.ClientConfirmationRequestedAtUtc = null;
                    slot.Booking.ClientConfirmationRespondedAtUtc = DateTime.UtcNow;
                    slot.Booking.UpdatedAtUtc = DateTime.UtcNow;

                    var existingPayment = await db.Payments
                        .FirstOrDefaultAsync(p => p.BookingId == slot.Booking.Id, cancellationToken);
                    if (existingPayment is null)
                    {
                        db.Payments.Add(new Payment
                        {
                            Id = Guid.NewGuid(),
                            BookingId = slot.Booking.Id,
                            Amount = slot.TrainerProfile?.PricePerSession ?? 0,
                            Status = PaymentStatus.Pending,
                            Method = null,
                            PaidAtUtc = null,
                            CreatedAtUtc = DateTime.UtcNow,
                            UpdatedAtUtc = DateTime.UtcNow
                        });
                    }
                    else
                    {
                        existingPayment.Status = PaymentStatus.Pending;
                        existingPayment.Method = null;
                        existingPayment.PaidAtUtc = null;
                        existingPayment.UpdatedAtUtc = DateTime.UtcNow;
                    }
                }
                else
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Slot already booked",
                        "Slot already has a booking.");
                }

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

                var nowUtc = DateTime.UtcNow;
                if (slot.AutoCancelIfMinNotReached
                    && slot.AutoCancelAtUtc.HasValue
                    && slot.AutoCancelAtUtc.Value <= nowUtc)
                {
                    var minCapacity = slot.CapacityMin;
                    if (minCapacity.HasValue)
                    {
                        var bookedAttendees = slot.Attendees
                            .Where(attendee => attendee.Status == SlotAttendeeStatus.Booked)
                            .ToList();

                        if (bookedAttendees.Count < minCapacity.Value)
                        {
                            var clientIds = bookedAttendees
                                .Where(attendee => attendee.ClientId.HasValue)
                                .Select(attendee => attendee.ClientId!.Value)
                                .Distinct()
                                .ToList();

                            foreach (var attendee in bookedAttendees)
                            {
                                attendee.Status = SlotAttendeeStatus.Cancelled;
                                attendee.UpdatedAtUtc = nowUtc;
                            }

                            slot.Status = TrainingSlotStatus.Cancelled;
                            slot.AutoCancelAtUtc = null;

                            await db.SaveChangesAsync(cancellationToken);
                            await transaction.CommitAsync(cancellationToken);

                            await pushService.NotifySlotCancelledByTrainerToClientsAsync(
                                slot.Id,
                                slot.TrainerId,
                                clientIds,
                                slot.StartsAtUtc,
                                PushCancellationReasons.MinParticipantsNotReached,
                                cancellationToken);

                            return ServiceResult<SlotDto>.Fail(
                                StatusCodes.Status409Conflict,
                                "Slot auto-cancelled",
                                "This group slot was cancelled because minimum participants were not reached.");
                        }
                    }

                    slot.AutoCancelAtUtc = null;
                }

                var existingAttendee = slot.Attendees
                    .FirstOrDefault(a => a.ClientId == actorClientUserId);

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
                        ClientId = actorClientUserId,
                        TrainerClientId = null,
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
                if (IsPaymentConflict(ex))
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Payment already exists",
                        "Payment already exists for this booking.");
                }

                if (slot.SlotType == TrainingSlotType.Group)
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
                actorClientUserId,
                slot.StartsAtUtc,
                cancellationToken);

            var dto = await BuildSlotDtoAsync(slotId, cancellationToken);
            return ServiceResult<SlotDto>.Success(dto);
        });
    }

    public async Task<ServiceResult<BookingDto>> AssignRegisteredClientToSlotAsync(
        Guid slotId,
        Guid trainerUserId,
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        if (clientUserId == Guid.Empty)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid client",
                "ClientUserId is required.");
        }

        var trainerProfileId = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == trainerUserId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var clientExists = await db.Users
            .AsNoTracking()
            .AnyAsync(
                u => u.Id == clientUserId
                    && u.Role == UserRoles.Client,
                cancellationToken);
        if (!clientExists)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid client",
                "Client user must exist and have Client role.");
        }

        var hasAcceptedLink = await db.TrainerClientLinks
            .AsNoTracking()
            .AnyAsync(
                l => l.TrainerId == trainerProfileId.Value
                    && l.ClientUserId == clientUserId
                    && l.Status == TrainerClientLinkStatus.Accepted,
                cancellationToken);
        if (!hasAcceptedLink)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Link is required",
                "Client must accept trainer link request before assignment.",
                new Dictionary<string, object?> { ["errorCode"] = "link_required" });
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database
                .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

            var slot = await db.TrainingSlots
                .Include(s => s.Booking)
                .Include(s => s.TrainerProfile)
                .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
            if (slot is null)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Slot not found",
                    "Slot does not exist.");
            }

            if (slot.TrainerId != trainerProfileId.Value)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "Slot does not belong to this trainer.",
                    new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
            }

            if (slot.SlotType != TrainingSlotType.Individual)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid slot type",
                    "Only individual slots support direct assignment.");
            }

            if (slot.Status == TrainingSlotStatus.Cancelled)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot not available",
                    "Cancelled slot cannot be assigned.");
            }

            if (slot.StartsAtUtc <= DateTime.UtcNow)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already started",
                    "Started slot cannot be assigned.");
            }

            if (slot.Booking is not null && slot.Booking.Status == BookingStatus.Booked)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already booked",
                    "Slot already has an active booking.");
            }

            var startsAtUtc = slot.StartsAtUtc;
            var endsAtUtc = slot.StartsAtUtc.AddMinutes(slot.DurationMinutes);
            var conflict = await BookingConflictChecker.FindTimeConflictAsync(
                db,
                clientUserId,
                trainerClientId: null,
                currentSlotId: slot.Id,
                startsAtUtc,
                endsAtUtc,
                cancellationToken);
            if (conflict is not null)
            {
                return ServiceResult<BookingDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Booking time conflict",
                    "У этого клиента уже есть запись на это время.",
                    new Dictionary<string, object?>
                    {
                        ["errorCode"] = "booking_time_conflict",
                        ["conflictSlotId"] = conflict.Value.SlotId,
                        ["conflictStartsAtUtc"] = conflict.Value.StartsAtUtc.ToString("O")
                    });
            }

            var nowUtc = DateTime.UtcNow;
            Booking booking;
            if (slot.Booking is null)
            {
                booking = new Booking
                {
                    Id = Guid.NewGuid(),
                    SlotId = slot.Id,
                    ClientId = clientUserId,
                    TrainerClientId = null,
                    Status = BookingStatus.Booked,
                    ClientConfirmationStatus = BookingClientConfirmationStatus.Pending,
                    ClientConfirmationRequestedAtUtc = nowUtc,
                    ClientConfirmationRespondedAtUtc = null,
                    CreatedAtUtc = nowUtc,
                    UpdatedAtUtc = nowUtc
                };
                db.Bookings.Add(booking);
            }
            else
            {
                booking = slot.Booking;
                booking.ClientId = clientUserId;
                booking.TrainerClientId = null;
                booking.Status = BookingStatus.Booked;
                booking.ClientConfirmationStatus = BookingClientConfirmationStatus.Pending;
                booking.ClientConfirmationRequestedAtUtc = nowUtc;
                booking.ClientConfirmationRespondedAtUtc = null;
                booking.UpdatedAtUtc = nowUtc;
            }

            var payment = await db.Payments
                .FirstOrDefaultAsync(p => p.BookingId == booking.Id, cancellationToken);
            if (payment is null)
            {
                db.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    Amount = slot.TrainerProfile?.PricePerSession ?? 0,
                    Status = PaymentStatus.Pending,
                    Method = null,
                    PaidAtUtc = null,
                    CreatedAtUtc = nowUtc,
                    UpdatedAtUtc = nowUtc
                });
            }
            else
            {
                payment.Status = PaymentStatus.Pending;
                payment.Method = null;
                payment.PaidAtUtc = null;
                payment.UpdatedAtUtc = nowUtc;
            }

            slot.Status = TrainingSlotStatus.Booked;

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

            await pushService.NotifyBookingConfirmationRequestedAsync(
                booking.Id,
                slot.Id,
                slot.TrainerId,
                clientUserId,
                startsAtUtc,
                cancellationToken);

            return ServiceResult<BookingDto>.Success(ToDto(booking));
        });
    }

    public async Task<ServiceResult<BookingDto>> ConfirmClientBookingAsync(
        Guid bookingId,
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        var booking = await db.Bookings
            .Include(b => b.Slot)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        if (booking is null || booking.Slot is null)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        if (booking.ClientId != clientUserId)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Booking does not belong to this client.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
        }

        if (booking.Slot.StartsAtUtc <= DateTime.UtcNow)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Booking already started",
                "Тренировка уже началась, подтверждение недоступно.");
        }

        if (booking.Status != BookingStatus.Booked)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid booking state",
                "Only active bookings can be confirmed.");
        }

        if (booking.ClientConfirmationStatus != BookingClientConfirmationStatus.Pending)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Already processed",
                "Booking confirmation has already been processed.");
        }

        booking.ClientConfirmationStatus = BookingClientConfirmationStatus.Confirmed;
        booking.ClientConfirmationRespondedAtUtc = DateTime.UtcNow;
        booking.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await pushService.NotifyBookingConfirmationConfirmedAsync(
            booking.Id,
            booking.SlotId,
            booking.Slot.TrainerId,
            clientUserId,
            booking.Slot.StartsAtUtc,
            cancellationToken);

        return ServiceResult<BookingDto>.Success(ToDto(booking));
    }

    public async Task<ServiceResult<BookingDto>> DeclineClientBookingAsync(
        Guid bookingId,
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        var booking = await db.Bookings
            .Include(b => b.Slot)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        if (booking is null || booking.Slot is null)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        if (booking.ClientId != clientUserId)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Booking does not belong to this client.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
        }

        if (booking.Slot.StartsAtUtc <= DateTime.UtcNow)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Booking already started",
                "Тренировка уже началась, подтверждение недоступно.");
        }

        if (booking.Status != BookingStatus.Booked
            || booking.ClientConfirmationStatus != BookingClientConfirmationStatus.Pending)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Already processed",
                "Booking confirmation has already been processed.");
        }

        booking.ClientConfirmationStatus = BookingClientConfirmationStatus.Declined;
        booking.ClientConfirmationRespondedAtUtc = DateTime.UtcNow;
        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAtUtc = DateTime.UtcNow;
        booking.Slot.Status = TrainingSlotStatus.Open;
        await db.SaveChangesAsync(cancellationToken);

        await pushService.NotifyBookingConfirmationDeclinedAsync(
            booking.Id,
            booking.SlotId,
            booking.Slot.TrainerId,
            clientUserId,
            booking.Slot.StartsAtUtc,
            cancellationToken);

        return ServiceResult<BookingDto>.Success(ToDto(booking));
    }

    public async Task<ServiceResult<SlotDto>> ReleaseDeclinedClientFromSlotAsync(
        Guid slotId,
        Guid trainerUserId,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == trainerUserId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<SlotDto>.Fail(
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
                .Include(s => s.Booking)
                .Include(s => s.TrainerProfile)
                .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
            if (slot is null)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Slot not found",
                    "Slot does not exist.");
            }

            if (slot.TrainerId != trainerProfileId.Value)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "Slot does not belong to this trainer.",
                    new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
            }

            if (slot.SlotType != TrainingSlotType.Individual)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid slot type",
                    "Only individual slots can be made open.");
            }

            if (slot.StartsAtUtc <= DateTime.UtcNow)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot already started",
                    "Started slot cannot be changed.");
            }

            if (slot.Status == TrainingSlotStatus.Cancelled)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Slot not available",
                    "Cancelled slot cannot be changed.");
            }

            if (slot.Booking is null)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid slot state",
                    "Slot has no booking to release.");
            }

            var booking = slot.Booking;
            if (booking.Status != BookingStatus.Cancelled
                || booking.ClientConfirmationStatus != BookingClientConfirmationStatus.Declined)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid slot state",
                    "Only client-declined bookings can be released.");
            }

            booking.ClientId = null;
            booking.TrainerClientId = null;
            booking.ClientConfirmationRequestedAtUtc = null;
            booking.ClientConfirmationRespondedAtUtc = null;
            booking.UpdatedAtUtc = DateTime.UtcNow;
            slot.Status = TrainingSlotStatus.Open;

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var dto = await BuildSlotDtoAsync(slotId, cancellationToken);
            return ServiceResult<SlotDto>.Success(dto);
        });
    }

    public async Task<ServiceResult<PendingBookingConfirmationsCountDto>> GetPendingBookingConfirmationsCountAsync(
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        var nowUtc = DateTime.UtcNow;
        var count = await db.Bookings
            .AsNoTracking()
            .CountAsync(
                b => b.ClientId == clientUserId
                    && b.Status == BookingStatus.Booked
                    && b.ClientConfirmationStatus == BookingClientConfirmationStatus.Pending
                    && b.Slot != null
                    && b.Slot.Status != TrainingSlotStatus.Cancelled
                    && b.Slot.StartsAtUtc > nowUtc,
                cancellationToken);

        return ServiceResult<PendingBookingConfirmationsCountDto>.Success(
            new PendingBookingConfirmationsCountDto(count));
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

                var nowUtc = DateTime.UtcNow;
                if (slot.StartsAtUtc <= nowUtc)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Slot already started",
                        "Started slots cannot be cancelled.");
                }

                if (slot.StartsAtUtc - nowUtc <= TimeSpan.FromMinutes(30))
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Too late to cancel",
                        "Trainer cancellation is not allowed within 30 minutes before start.");
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
                        slot.Booking.UpdatedAtUtc = nowUtc;
                        slot.Status = TrainingSlotStatus.Cancelled;
                    }
                }
                else
                {
                    foreach (var attendee in slot.Attendees.Where(a => a.Status == SlotAttendeeStatus.Booked))
                    {
                        attendee.Status = SlotAttendeeStatus.Cancelled;
                        attendee.UpdatedAtUtc = nowUtc;
                    }
                    slot.Status = TrainingSlotStatus.Cancelled;
                    slot.AutoCancelAtUtc = null;
                }

                await db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                if (slot.SlotType == TrainingSlotType.Group)
                {
                    var clientIds = slot.Attendees
                        .Where(a => a.ClientId.HasValue)
                        .Select(a => a.ClientId!.Value)
                        .Distinct()
                        .ToList();

                    await pushService.NotifySlotCancelledByTrainerToClientsAsync(
                        slot.Id,
                        trainerId,
                        clientIds,
                        startsAtUtc,
                        cancellationReason: null,
                        cancellationToken);
                }
                else
                {
                    await pushService.NotifySlotCancelledByTrainerAsync(
                        slot.Id,
                        trainerId,
                        slot.Booking?.ClientId,
                        startsAtUtc,
                        cancellationReason: null,
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

                    slot.Booking.Status = BookingStatus.Cancelled;
                    slot.Booking.UpdatedAtUtc = DateTime.UtcNow;
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
        Guid trainerUserId,
        string? role,
        BookingStatus status,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Only trainers can mark attendance.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
        }

        if (status is not BookingStatus.Completed and not BookingStatus.NoShow)
        {
            return ServiceResult<BookingDto>.Fail(
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
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
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

        if (slot.TrainerId != trainerProfileId.Value)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Slot does not belong to this trainer.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
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

        var nowUtc = DateTime.UtcNow;
        if (status == BookingStatus.Completed && nowUtc < slot.StartsAtUtc)
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Too early for completion",
                "Complete can be marked only after slot start.");
        }

        if (status == BookingStatus.NoShow && nowUtc < slot.StartsAtUtc.AddMinutes(15))
        {
            return ServiceResult<BookingDto>.Fail(
                StatusCodes.Status409Conflict,
                "Too early for no-show",
                "No-show can be marked only 15 minutes after start.");
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
        slot.Booking.UpdatedAtUtc = nowUtc;
        await db.SaveChangesAsync(cancellationToken);

        if (slot.Booking.ClientId.HasValue)
        {
            await pushService.NotifyAttendanceMarkedAsync(
                slot.Id,
                slot.TrainerId,
                slot.Booking.ClientId.Value,
                slot.StartsAtUtc,
                cancellationToken);
        }

        return ServiceResult<BookingDto>.Success(ToDto(slot.Booking));
    }

    public async Task<ServiceResult<CloseBookingResultDto>> CloseBookingAsync(
        Guid bookingId,
        Guid trainerUserId,
        string? role,
        BookingStatus attendance,
        bool markPaid,
        PaymentMethod? paymentMethod,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<CloseBookingResultDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        var trainerProfileId = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == trainerUserId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<CloseBookingResultDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database
                .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

            var booking = await db.Bookings
                .Include(b => b.Slot)
                .Include(b => b.Payment)
                .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
            if (booking is null || booking.Slot is null || booking.Slot.TrainerId != trainerProfileId.Value)
            {
                return ServiceResult<CloseBookingResultDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Booking not found",
                    "Booking does not exist.");
            }

            if (booking.Status == BookingStatus.Cancelled)
            {
                return ServiceResult<CloseBookingResultDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid booking state",
                    "Cancelled booking cannot be closed.");
            }

            if (booking.Status is BookingStatus.Completed or BookingStatus.NoShow)
            {
                return ServiceResult<CloseBookingResultDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Booking already closed",
                    "This booking has already been closed.");
            }

            if (booking.Status != BookingStatus.Booked)
            {
                return ServiceResult<CloseBookingResultDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid booking state",
                    "Only booked sessions can be closed.");
            }

            var payment = booking.Payment;
            if (payment is null)
            {
                return ServiceResult<CloseBookingResultDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid payment state",
                    "Payment is missing for this booking.");
            }

            if (payment.Status == PaymentStatus.Refunded && markPaid)
            {
                return ServiceResult<CloseBookingResultDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Invalid payment state",
                    "Refunded payment cannot be marked as paid.");
            }

            if (markPaid && payment.Status == PaymentStatus.Paid)
            {
                if (payment.Method != paymentMethod)
                {
                    return ServiceResult<CloseBookingResultDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Payment method conflict",
                        "Payment is already marked with another method.");
                }
            }

            var nowUtc = DateTime.UtcNow;
            booking.Status = attendance;
            booking.UpdatedAtUtc = nowUtc;

            if (markPaid)
            {
                if (payment.Status == PaymentStatus.Pending)
                {
                    payment.Status = PaymentStatus.Paid;
                    payment.Method = paymentMethod;
                    payment.PaidAtUtc = nowUtc;
                }

                payment.UpdatedAtUtc = nowUtc;
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return ServiceResult<CloseBookingResultDto>.Success(ToCloseResultDto(booking, payment));
        });
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

    private async Task<SlotDto> BuildSlotDtoAsync(Guid slotId, CancellationToken cancellationToken)
    {
        var slot = await db.TrainingSlots
            .AsNoTracking()
            .Include(s => s.Booking)
            .ThenInclude(b => b!.WorkoutType)
            .Include(s => s.Attendees)
            .Include(s => s.TrainerProfile)
            .FirstAsync(s => s.Id == slotId, cancellationToken);

        string? clientName = null;
        string? clientAvatarUrl = null;
        if (slot.SlotType == TrainingSlotType.Individual && slot.Booking is not null)
        {
            if (slot.Booking.ClientId.HasValue)
            {
                var clientUserId = slot.Booking.ClientId.Value;
                var client = await db.Users
                    .AsNoTracking()
                    .Where(u => u.Id == clientUserId)
                    .Select(u => u.Name)
                    .FirstOrDefaultAsync(cancellationToken);
                clientName = client;

                var hasAvatar = await db.UserAvatars
                    .AsNoTracking()
                    .AnyAsync(a => a.UserId == clientUserId, cancellationToken);
                if (hasAvatar)
                {
                    clientAvatarUrl = $"/users/{clientUserId}/avatar";
                }
            }
            else if (slot.Booking.TrainerClientId.HasValue)
            {
                clientName = await db.TrainerClients
                    .AsNoTracking()
                    .Where(tc => tc.Id == slot.Booking.TrainerClientId.Value)
                    .Select(tc => tc.DisplayName)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }

        return SlotService.ToDto(slot, clientName, clientAvatarUrl, slot.TrainerProfile?.PricePerSession);
    }

    private static BookingDto ToDto(Booking booking)
        => new(
            booking.Id,
            booking.SlotId,
            booking.ClientId,
            booking.TrainerClientId,
            booking.Status.ToString(),
            booking.ClientConfirmationStatus.ToString(),
            TrainerWorkoutTypeService.ToSummaryDto(booking.WorkoutType),
            booking.ClientConfirmationRequestedAtUtc,
            booking.ClientConfirmationRespondedAtUtc,
            booking.CreatedAtUtc,
            booking.UpdatedAtUtc);

    private static CloseBookingResultDto ToCloseResultDto(Booking booking, Payment payment)
        => new(
            booking.Id,
            booking.Status.ToString(),
            new CloseBookingPaymentDto(
                payment.Id,
                payment.Amount,
                payment.Status.ToString(),
                payment.Method?.ToString(),
                payment.PaidAtUtc,
                payment.UpdatedAtUtc));

    private static bool IsBookingConflict(Exception ex)
    {
        var pg = FindPostgresException(ex);
        return pg is not null && (pg.SqlState == PostgresErrorCodes.UniqueViolation
            || pg.SqlState == PostgresErrorCodes.SerializationFailure);
    }

    private static bool IsPaymentConflict(Exception ex)
    {
        var pg = FindPostgresException(ex);
        return pg is not null
            && pg.SqlState == PostgresErrorCodes.UniqueViolation
            && string.Equals(pg.TableName, "payments", StringComparison.OrdinalIgnoreCase);
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

