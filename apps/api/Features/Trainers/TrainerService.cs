using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Trainers;

public sealed class TrainerService(AppDbContext db)
{
    public async Task<TrainerDto> CreateTrainerAsync(CreateTrainerRequest request, CancellationToken cancellationToken)
    {
        var trainer = new TrainerProfile
        {
            Id = Guid.NewGuid(),
            DisplayName = request.DisplayName.Trim(),
            GymName = string.IsNullOrWhiteSpace(request.GymName) ? null : request.GymName.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        db.TrainerProfiles.Add(trainer);
        await db.SaveChangesAsync(cancellationToken);

        return new TrainerDto(
            trainer.Id,
            trainer.DisplayName,
            trainer.GymName,
            trainer.CreatedAtUtc);
    }

    public async Task<IReadOnlyList<TrainerDto>> GetAllTrainersAsync(CancellationToken cancellationToken)
    {
        return await db.TrainerProfiles
            .OrderBy(t => t.CreatedAtUtc)
            .Select(t => new TrainerDto(
                t.Id,
                t.DisplayName,
                t.GymName,
                t.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }
}
