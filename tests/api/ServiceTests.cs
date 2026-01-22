using Api.Data;
using Api.Features.Bookings;
using Api.Features.Slots;
using Api.Features.Trainers;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Api.Tests;

public sealed class ServiceTests
{
    [Fact]
    public async Task CreateSlotAsync_WhenStartsInPast_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var trainerId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

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
        var trainerId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

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
        var trainerId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

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
        var trainerId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

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
    public async Task BookSlotAsync_WhenAlreadyBooked_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var trainerId = Guid.NewGuid();
        var slotId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

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
        var first = await service.BookSlotAsync(slotId, new BookSlotRequest(Guid.NewGuid()), CancellationToken.None);
        var second = await service.BookSlotAsync(slotId, new BookSlotRequest(Guid.NewGuid()), CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.False(second.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, second.Error?.StatusCode);
    }

    [Fact]
    public async Task CancelSlotAsync_WhenSlotIsOpen_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var trainerId = Guid.NewGuid();
        var slotId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

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
        var result = await service.CancelSlotAsync(slotId, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(StatusCodes.Status409Conflict, result.Error?.StatusCode);
    }

    [Fact]
    public async Task CancelSlotAsync_WhenBooked_DeletesBooking_AndSetsSlotOpen()
    {
        await using var db = CreateDbContext();
        var trainerId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();

        db.TrainerProfiles.Add(new TrainerProfile
        {
            Id = trainerId,
            DisplayName = "Trainer",
            CreatedAtUtc = DateTime.UtcNow
        });

        db.TrainingSlots.Add(new TrainingSlot
        {
            Id = slotId,
            TrainerId = trainerId,
            StartsAtUtc = DateTime.UtcNow.AddHours(1),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Booked,
            CreatedAtUtc = DateTime.UtcNow
        });

        db.Bookings.Add(new Booking
        {
            Id = bookingId,
            SlotId = slotId,
            ClientId = Guid.NewGuid(),
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var service = new BookingService(db);
        var result = await service.CancelSlotAsync(slotId, CancellationToken.None);

        Assert.True(result.IsSuccess);

        var slot = await db.TrainingSlots.FirstAsync(s => s.Id == slotId);
        var bookingExists = await db.Bookings.AnyAsync(b => b.SlotId == slotId);

        Assert.Equal(TrainingSlotStatus.Open, slot.Status);
        Assert.False(bookingExists);
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
}
