using Api.Data;
using Api.Features.Bookings;
using Api.Features.Trainers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace Api.Tests.Integration;

public sealed class PostgresBookingTests : IClassFixture<PostgresFixture>
{
    private readonly PostgresFixture _fixture;

    public PostgresBookingTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task BookSlotAsync_WhenConcurrentBooking_ThenOneSucceedsOtherConflict()
    {
        await using (var setup = _fixture.CreateDbContext())
        {
            var trainerId = Guid.NewGuid();
            var slotId = Guid.NewGuid();

            var userId = Guid.NewGuid();

            setup.Users.Add(new AppUser
            {
                Id = userId,
                Email = "trainer@example.com",
                NormalizedEmail = "TRAINER@EXAMPLE.COM",
                UserName = "trainer@example.com",
                NormalizedUserName = "TRAINER@EXAMPLE.COM",
                Name = "Trainer",
                Role = UserRoles.Trainer
            });

            setup.TrainerProfiles.Add(new TrainerProfile
            {
                Id = trainerId,
                UserId = userId,
                CreatedAtUtc = DateTime.UtcNow
            });

            setup.TrainingSlots.Add(new TrainingSlot
            {
                Id = slotId,
                TrainerId = trainerId,
                StartsAtUtc = DateTime.UtcNow.AddHours(2),
                DurationMinutes = 60,
                Status = TrainingSlotStatus.Open,
                CreatedAtUtc = DateTime.UtcNow
            });

            await setup.SaveChangesAsync();

            var start = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            async Task<Api.Features.Common.ServiceResult<Api.Features.Slots.SlotDto>> AttemptAsync()
            {
                await start.Task;
                await using var db = _fixture.CreateDbContext();
                var service = new BookingService(db);
                return await service.BookSlotAsync(slotId, new BookSlotRequest(Guid.NewGuid()), CancellationToken.None);
            }

            var firstTask = AttemptAsync();
            var secondTask = AttemptAsync();

            start.SetResult(true);

            var results = await Task.WhenAll(firstTask, secondTask);

            var successCount = results.Count(r => r.IsSuccess);
            var conflictCount = results.Count(r => !r.IsSuccess && r.Error?.StatusCode == StatusCodes.Status409Conflict);

            Assert.Equal(1, successCount);
            Assert.Equal(1, conflictCount);
        }
    }
}

public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public async Task InitializeAsync()
    {
        _container = new PostgreSqlBuilder("postgres:16")
            .WithDatabase("app_db")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .Build();

        await _container.StartAsync();

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    public AppDbContext CreateDbContext()
    {
        if (_container is null)
        {
            throw new InvalidOperationException("PostgreSQL container has not been initialized.");
        }

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .Options;

        return new AppDbContext(options);
    }
}
