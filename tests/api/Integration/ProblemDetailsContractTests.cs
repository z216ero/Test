using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Data;
using Api.Features.Bookings;
using Api.Features.Trainers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Api.Tests.Integration;

public sealed class ProblemDetailsContractTests
{
    [Fact]
    public async Task BookSlot_WhenAlreadyBooked_ReturnsConflictProblemDetails()
    {
        using var factory = new ApiWebApplicationFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

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
            StartsAtUtc = DateTime.UtcNow.AddHours(2),
            DurationMinutes = 60,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var client = factory.CreateClient();

        var firstResponse = await client.PostAsJsonAsync(
            $"/slots/{slotId}/book",
            new BookSlotRequest(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        var secondResponse = await client.PostAsJsonAsync(
            $"/slots/{slotId}/book",
            new BookSlotRequest(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);

        var payload = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(409, payload.GetProperty("status").GetInt32());
        Assert.Equal("Slot not available", payload.GetProperty("title").GetString());
        Assert.Equal("https://errors.trainerapp/conflict", payload.GetProperty("type").GetString());
        Assert.False(payload.TryGetProperty("exception", out _));
        Assert.False(payload.TryGetProperty("stackTrace", out _));
        Assert.False(payload.TryGetProperty("stacktrace", out _));
    }
}

public sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:postgresdb"] = "Host=localhost;Database=app_db;Username=postgres;Password=postgres"
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<AppDbContext>));
            services.RemoveAll(typeof(AppDbContext));

            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase($"api-tests-{Guid.NewGuid():N}"));
        });
    }
}
