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
using Microsoft.Extensions.Options;
using Testcontainers.PostgreSql;

namespace Api.Tests.Integration;

public sealed class ProblemDetailsContractTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public ProblemDetailsContractTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task BookSlot_WhenAlreadyBooked_ReturnsConflictProblemDetails()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var trainerId = Guid.NewGuid();
        var slotId = Guid.NewGuid();

        var userId = Guid.NewGuid();

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
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

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
    private readonly string _connectionString;

    public ApiWebApplicationFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:postgresdb"] = _connectionString
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<AppDbContext>));
            services.RemoveAll(typeof(IConfigureOptions<DbContextOptions<AppDbContext>>));
            services.RemoveAll(typeof(IConfigureNamedOptions<DbContextOptions<AppDbContext>>));
            services.RemoveAll(typeof(AppDbContext));
            DbContextServiceCleanup.RemoveInternalDbContextServices(services);

            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_connectionString));
        });
    }
}

public sealed class ApiPostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public string ConnectionString =>
        _container?.GetConnectionString()
        ?? throw new InvalidOperationException("PostgreSQL container has not been initialized.");

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

    private AppDbContext CreateDbContext()
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

internal static class DbContextServiceCleanup
{
    internal static void RemoveInternalDbContextServices(IServiceCollection services)
    {
        for (var i = services.Count - 1; i >= 0; i--)
        {
            var descriptor = services[i];
            var serviceType = descriptor.ServiceType;
            var serviceTypeName = serviceType.FullName ?? string.Empty;

            if (serviceTypeName.Contains("IDbContextPool`1", StringComparison.Ordinal)
                || serviceTypeName.Contains("IScopedDbContextLease`1", StringComparison.Ordinal)
                || serviceTypeName.Contains("IDbContextOptionsConfiguration`1", StringComparison.Ordinal))
            {
                if (serviceType.GenericTypeArguments.Length == 1
                    && serviceType.GenericTypeArguments[0] == typeof(AppDbContext))
                {
                    services.RemoveAt(i);
                    continue;
                }
            }

            var implementationType = descriptor.ImplementationType;
            if (implementationType?.IsGenericType == true
                && implementationType.GetGenericTypeDefinition().FullName is not null
                && implementationType.GetGenericTypeDefinition().FullName.Contains(
                    "DbContextOptionsConfiguration`1",
                    StringComparison.Ordinal)
                && implementationType.GenericTypeArguments.Length == 1
                && implementationType.GenericTypeArguments[0] == typeof(AppDbContext))
            {
                services.RemoveAt(i);
            }
        }
    }
}
