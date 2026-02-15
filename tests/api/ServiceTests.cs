using Api.Data;
using Api.Features.Bookings;
using Api.Features.Clients;
using Api.Features.Push;
using Api.Features.Slots;
using Api.Features.Trainers;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Api.Tests;

public sealed class ServiceTests
{
    [Fact]
    public async Task CreateSlotAsync_WhenStartsInPast_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);

        var service = new SlotService(db);
        var request = new CreateSlotRequest(DateTime.UtcNow.AddMinutes(-5), 30);

        var result = await service.CreateSlotAsync(trainerId, request, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status400BadRequest, result.Error?.StatusCode);
    }

    [Fact]
    public async Task CreateSlotAsync_WhenDurationMinutesNonPositive_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);

        var service = new SlotService(db);
        var request = new CreateSlotRequest(DateTime.UtcNow.AddHours(1), 0);

        var result = await service.CreateSlotAsync(trainerId, request, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status400BadRequest, result.Error?.StatusCode);
    }

    [Fact]
    public async Task GetSlotsAsync_WhenFromUtcGreaterThanToUtc_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);

        var service = new SlotService(db);
        var fromUtc = DateTime.UtcNow.AddDays(2);
        var toUtc = DateTime.UtcNow.AddDays(1);

        var result = await service.GetSlotsAsync(trainerId, fromUtc, toUtc, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status400BadRequest, result.Error?.StatusCode);
    }

    [Fact]
    public async Task CreateSlotAsync_WhenOverlapsOpenSlot_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = Guid.NewGuid(),
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(2),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new SlotService(db);
        var request = new CreateSlotRequest(DateTime.UtcNow.AddHours(2).AddMinutes(30), 45);

        var result = await service.CreateSlotAsync(trainerId, request, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, result.Error?.StatusCode);
    }

    [Fact]
    public async Task CreateSlotAsync_WhenGroupAutoCancelEnabledTooLate_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db, trainingTypes: ["Group"]);

        var service = new SlotService(db);
        var request = new CreateSlotRequest(
            DateTime.UtcNow.AddMinutes(GroupSlotAutoCancellationService.AutoCancelLeadMinutes - 5),
            60,
            "Group",
            10,
            2,
            true);

        var result = await service.CreateSlotAsync(trainerId, request, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status400BadRequest, result.Error?.StatusCode);
    }

    [Fact]
    public async Task GetSlotsAsync_WhenGroupAttendeeIsCompleted_OccupiedCountIncludesAttendee()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db, trainingTypes: ["Group"]);
        var slotId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(3),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Group,
            CapacityMin = 2,
            CapacityMax = 10,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        db.SlotAttendees.Add(new SlotAttendee
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            ClientId = clientId,
            Status = SlotAttendeeStatus.Completed,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new SlotService(db);
        var result = await service.GetSlotsAsync(trainerId, DateTime.UtcNow.AddHours(1), DateTime.UtcNow.AddHours(5), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var slot = Assert.Single(result.Value!);
        Assert.Equal(1, slot.OccupiedCount);
    }

    [Fact]
    public async Task GetAvailableSlotsAsync_WhenClientHasBookedIndividualSlot_ReturnsBothOpenAndOwnBookedSlots()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db, trainingTypes: ["Group"]);
        var clientId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        var groupSlotId = Guid.NewGuid();
        var individualBookedSlotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = groupSlotId,
            TrainerId = trainerId,
            StartsAtUtc = nowUtc.AddHours(2),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Group,
            CapacityMin = 2,
            CapacityMax = 10,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = nowUtc
        });

        db.SlotAttendees.Add(new SlotAttendee
        {
            Id = Guid.NewGuid(),
            SlotId = groupSlotId,
            ClientId = clientId,
            Status = SlotAttendeeStatus.Booked,
            CreatedAtUtc = nowUtc
        });

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = individualBookedSlotId,
            TrainerId = trainerId,
            StartsAtUtc = nowUtc.AddHours(3),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Individual,
            Status = TrainingSlotStatus.Booked,
            CreatedAtUtc = nowUtc
        });

        db.Bookings.Add(new Booking
        {
            Id = Guid.NewGuid(),
            SlotId = individualBookedSlotId,
            ClientId = clientId,
            Status = BookingStatus.Booked,
            CreatedAtUtc = nowUtc
        });

        await db.SaveChangesAsync();

        var service = new SlotService(db);
        var result = await service.GetAvailableSlotsAsync(
            nowUtc.AddHours(1),
            nowUtc.AddHours(5),
            specializations: null,
            preferredTrainerGender: null,
            clientGender: null,
            clientCityId: null,
            clientDistrictId: null,
            districtOnly: false,
            clientUserId: clientId,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);

        var group = Assert.Single(result.Value!);
        Assert.NotNull(group.Trainer);
        Assert.Equal(trainerId, group.Trainer.Id);

        Assert.Equal(2, group.Slots.Count);
        Assert.Contains(group.Slots, slot => slot.Id == groupSlotId);
        Assert.Contains(group.Slots, slot => slot.Id == individualBookedSlotId);
    }

    [Fact]
    public async Task GetAvailableSlotsAsync_WhenTrainerHasRatingSample_ReturnsTrainerRating()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);
        var nowUtc = DateTime.UtcNow;
        var futureSlotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = futureSlotId,
            TrainerId = trainerId,
            StartsAtUtc = nowUtc.AddHours(3),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Individual,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = nowUtc
        });

        for (var i = 0; i < 5; i++)
        {
            var historicalSlotId = Guid.NewGuid();
            db.TrainingSlots.Add(new TrainingSlot
            {
                Id = historicalSlotId,
                TrainerId = trainerId,
                StartsAtUtc = nowUtc.AddDays(-i - 1),
                DurationMinutes = 60,
                SlotType = TrainingSlotType.Individual,
                Status = TrainingSlotStatus.Booked,
                CreatedAtUtc = nowUtc.AddDays(-i - 2)
            });

            db.Bookings.Add(new Booking
            {
                Id = Guid.NewGuid(),
                SlotId = historicalSlotId,
                ClientId = Guid.NewGuid(),
                Status = i < 4 ? BookingStatus.Completed : BookingStatus.NoShow,
                CreatedAtUtc = nowUtc.AddDays(-i - 2)
            });
        }

        await db.SaveChangesAsync();

        var service = new SlotService(db);
        var result = await service.GetAvailableSlotsAsync(
            nowUtc.AddHours(1),
            nowUtc.AddHours(5),
            specializations: null,
            preferredTrainerGender: null,
            clientGender: null,
            clientCityId: null,
            clientDistrictId: null,
            districtOnly: false,
            clientUserId: null,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        var group = Assert.Single(result.Value!);
        Assert.Equal(trainerId, group.Trainer.Id);
        Assert.Equal(4.0, group.Trainer.Rating);
    }

    [Fact]
    public async Task ProcessDueSlotsAsync_WhenGroupBelowMinimum_CancelsSlot()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db, trainingTypes: ["Group"]);
        var slotId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = nowUtc.AddHours(2),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Group,
            CapacityMin = 2,
            CapacityMax = 10,
            AutoCancelIfMinNotReached = true,
            AutoCancelAtUtc = nowUtc.AddMinutes(-1),
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = nowUtc
        });

        db.SlotAttendees.Add(new SlotAttendee
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            ClientId = clientId,
            Status = SlotAttendeeStatus.Booked,
            CreatedAtUtc = nowUtc
        });

        await db.SaveChangesAsync();

        var service = new GroupSlotAutoCancellationService(db);
        var cancelledCount = await service.ProcessDueSlotsAsync(nowUtc, CancellationToken.None);

        Assert.Equal(1, cancelledCount);
        var slot = await db.TrainingSlots.FirstAsync(s => s.Id == slotId);
        Assert.Equal(TrainingSlotStatus.Cancelled, slot.Status);
        Assert.Null(slot.AutoCancelAtUtc);
        var attendee = await db.SlotAttendees.FirstAsync(a => a.SlotId == slotId && a.ClientId == clientId);
        Assert.Equal(SlotAttendeeStatus.Cancelled, attendee.Status);
    }

    [Fact]
    public async Task ProcessDueRemindersAsync_WhenReminderIsDue_DispatchesOnce()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);
        var clientId = Guid.NewGuid();
        var nowUtc = DateTime.UtcNow;
        var slotId = Guid.NewGuid();

        db.Users.Add(new AppUser
        {
            Id = clientId,
            Email = "reminder-client@example.com",
            NormalizedEmail = "REMINDER-CLIENT@EXAMPLE.COM",
            UserName = "reminder-client@example.com",
            NormalizedUserName = "REMINDER-CLIENT@EXAMPLE.COM",
            Name = "Reminder Client",
            Role = UserRoles.Client,
            PushReminderEnabled = true,
            PushReminderOffsetMinutes = 120
        });

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = nowUtc.AddMinutes(110),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Individual,
            Status = TrainingSlotStatus.Booked,
            CreatedAtUtc = nowUtc
        });

        db.Bookings.Add(new Booking
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            ClientId = clientId,
            Status = BookingStatus.Booked,
            CreatedAtUtc = nowUtc
        });

        await db.SaveChangesAsync();

        var pushOptions = Options.Create(new PushOptions());
        var firebase = new FirebaseMessagingClient(pushOptions, NullLogger<FirebaseMessagingClient>.Instance);
        var pushService = new PushService(db, firebase, NullLogger<PushService>.Instance);
        var reminderService = new TrainingReminderService(
            db,
            pushService,
            NullLogger<TrainingReminderService>.Instance);

        var firstRun = await reminderService.ProcessDueRemindersAsync(nowUtc, CancellationToken.None);
        var secondRun = await reminderService.ProcessDueRemindersAsync(nowUtc.AddMinutes(1), CancellationToken.None);

        Assert.Equal(1, firstRun);
        Assert.Equal(0, secondRun);
        Assert.Equal(1, await db.PushReminderDispatches.CountAsync());
    }

    [Fact]
    public async Task BookSlotAsync_WhenAlreadyBooked_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);
        var slotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(4),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new BookingService(db);
        var firstClientId = Guid.NewGuid();
        var secondClientId = Guid.NewGuid();
        var first = await service.BookSlotAsync(slotId, firstClientId, new BookSlotRequest(firstClientId), CancellationToken.None);
        var second = await service.BookSlotAsync(slotId, secondClientId, new BookSlotRequest(secondClientId), CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.False(second.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, second.Error?.StatusCode);
    }

    [Fact]
    public async Task BookSlotAsync_WhenSuccessful_CreatesPendingPayment()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db, 175_000);
        var slotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(4),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var clientId = Guid.NewGuid();
        var service = new BookingService(db);
        var result = await service.BookSlotAsync(slotId, clientId, new BookSlotRequest(clientId), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var booking = await db.Bookings.SingleAsync(b => b.SlotId == slotId);
        var payment = await db.Payments.SingleAsync(p => p.BookingId == booking.Id);

        Assert.Equal(175_000m, payment.Amount);
        Assert.Equal(PaymentStatus.Pending, payment.Status);
        Assert.Null(payment.Method);
        Assert.Null(payment.PaidAtUtc);
    }

    [Fact]
    public async Task GetBookingHistoryAsync_WhenPastBookingStillBooked_ReturnsPendingConfirmationEntry()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);

        var clientId = Guid.NewGuid();
        db.Users.Add(new AppUser
        {
            Id = clientId,
            Email = "client@example.com",
            NormalizedEmail = "CLIENT@EXAMPLE.COM",
            UserName = "client@example.com",
            NormalizedUserName = "CLIENT@EXAMPLE.COM",
            Name = "Client",
            Role = UserRoles.Client
        });
        db.ClientProfiles.Add(new ClientProfile
        {
            UserId = clientId,
            CreatedAtUtc = DateTime.UtcNow
        });

        var slotId = Guid.NewGuid();
        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(-2),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Booked,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-1)
        });

        db.Bookings.Add(new Booking
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            ClientId = clientId,
            Status = BookingStatus.Booked,
            CreatedAtUtc = DateTime.UtcNow.AddDays(-1)
        });

        await db.SaveChangesAsync();

        var service = new ClientService(db);
        var result = await service.GetBookingHistoryAsync(clientId, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        var session = Assert.Single(result.Value!);
        Assert.Equal("Booked", session.Slot.BookingStatus);
    }

    [Fact]
    public async Task CancelSlotAsync_WhenSlotIsOpen_ByTrainer_CancelsSlot()
    {
        await using var db = CreateDbContext();
        var (trainerId, trainerUserId) = await SeedTrainerAsync(db);
        var slotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(1),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new BookingService(db);
        var result = await service.CancelSlotAsync(
            slotId,
            trainerUserId,
            UserRoles.Trainer,
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var slot = await db.TrainingSlots.FirstAsync(s => s.Id == slotId);
        Assert.Equal(TrainingSlotStatus.Cancelled, slot.Status);
    }

    [Fact]
    public async Task CancelSlotAsync_WhenTrainerCancelsWithinThirtyMinutes_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var (trainerId, trainerUserId) = await SeedTrainerAsync(db);
        var slotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddMinutes(20),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new BookingService(db);
        var result = await service.CancelSlotAsync(
            slotId,
            trainerUserId,
            UserRoles.Trainer,
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, result.Error?.StatusCode);
    }

    [Fact]
    public async Task CancelSlotAsync_WhenBooked_MarksBookingCancelled_AndSetsSlotOpen()
    {
        await using var db = CreateDbContext();
        var (trainerId, _) = await SeedTrainerAsync(db);
        var slotId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(1),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Booked,
            CreatedAtUtc = DateTime.UtcNow
        });

        var clientId = Guid.NewGuid();
        db.Bookings.Add(new Booking
        {
            Id = bookingId,
            SlotId = slotId,
            ClientId = clientId,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new BookingService(db);
        var result = await service.CancelSlotAsync(
            slotId,
            clientId,
            UserRoles.Client,
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var slot = await db.TrainingSlots.FirstAsync(s => s.Id == slotId);
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.SlotId == slotId);

        Assert.Equal(TrainingSlotStatus.Open, slot.Status);
        Assert.NotNull(booking);
        Assert.Equal(BookingStatus.Cancelled, booking!.Status);
    }

    [Fact]
    public async Task CancelSlotAsync_WhenGroupSlotAlreadyStarted_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var (trainerId, trainerUserId) = await SeedTrainerAsync(db, trainingTypes: ["Group"]);
        var slotId = Guid.NewGuid();

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddMinutes(-10),
            DurationMinutes = 60,
            SlotType = TrainingSlotType.Group,
            CapacityMin = 2,
            CapacityMax = 10,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow.AddHours(-1)
        });

        await db.SaveChangesAsync();

        var service = new BookingService(db);
        var result = await service.CancelSlotAsync(
            slotId,
            trainerUserId,
            UserRoles.Trainer,
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, result.Error?.StatusCode);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .ConfigureWarnings(warnings =>
                warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new AppDbContext(options);
    }

    private static async Task<(Guid TrainerId, Guid UserId)> SeedTrainerAsync(
        AppDbContext db,
        int? pricePerSession = null,
        string[]? trainingTypes = null)
    {
        var userId = Guid.NewGuid();
        var trainerId = Guid.NewGuid();

        db.Users.Add(new AppUser
        {
            Id = userId,
            Email = "trainer@example.com",
            NormalizedEmail = "TRAINER@EXAMPLE.COM",
            UserName = "trainer@example.com",
            NormalizedUserName = "TRAINER@EXAMPLE.COM",
            Name = "Trainer",
            Role = UserRoles.Trainer
        });

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            UserId = userId,
            PricePerSession = pricePerSession,
            TrainingTypes = trainingTypes ?? Array.Empty<string>(),
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        return (trainerId, userId);
    }
}
