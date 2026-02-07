using Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Migrations;

public sealed class Worker(
    IServiceProvider serviceProvider,
    ILogger<Worker> logger,
    IHostApplicationLifetime hostApplicationLifetime) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = serviceProvider.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            await db.Database.MigrateAsync(stoppingToken);
            await SeedLocationsAsync(db, stoppingToken);
            logger.LogInformation("Database migrations applied successfully.");
        }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            logger.LogError(ex, "Database migration failed.");
        }
        finally
        {
            hostApplicationLifetime.StopApplication();
        }
    }

    private static async Task SeedLocationsAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        const string moscowName = "Москва";
        var districtNames = new[]
        {
            "Центральный (ЦАО)",
            "Северный (САО)",
            "Северо-Восточный (СВАО)",
            "Восточный (ВАО)",
            "Юго-Восточный (ЮВАО)",
            "Южный (ЮАО)",
            "Юго-Западный (ЮЗАО)",
            "Западный (ЗАО)",
            "Северо-Западный (СЗАО)",
            "Зеленоградский (ЗелАО)",
            "Новомосковский (НАО)",
            "Троицкий (ТАО)",
        };

        var moscow = await db.Cities
            .FirstOrDefaultAsync(c => EF.Functions.ILike(c.Name, moscowName), cancellationToken);

        if (moscow is null)
        {
            moscow = new City { Name = moscowName };
            db.Cities.Add(moscow);
            await db.SaveChangesAsync(cancellationToken);
        }

        var existingDistricts = await db.Districts
            .Where(d => d.CityId == moscow.Id)
            .Select(d => d.Name)
            .ToListAsync(cancellationToken);

        var existingDistrictSet = new HashSet<string>(existingDistricts, StringComparer.OrdinalIgnoreCase);
        var newDistricts = districtNames
            .Where(name => !existingDistrictSet.Contains(name))
            .Select(name => new District
            {
                CityId = moscow.Id,
                Name = name
            })
            .ToList();

        if (newDistricts.Count == 0)
        {
            return;
        }

        db.Districts.AddRange(newDistricts);
        await db.SaveChangesAsync(cancellationToken);
    }
}
