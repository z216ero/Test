using Api.Data;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Trainers;

public sealed class TrainerService(AppDbContext db)
{
    public async Task<ServiceResult<TrainerDto>> GetTrainerProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<TrainerDto>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<TrainerDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var profile = await db.TrainerProfiles
            .Include(t => t.User)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<TrainerDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        return ServiceResult<TrainerDto>.Success(new TrainerDto(
            profile.Id,
            profile.User!.Name,
            profile.GymName,
            profile.PricePerSession,
            profile.CreatedAtUtc));
    }

    public async Task<ServiceResult<TrainerDto>> CreateTrainerAsync(
        Guid userId,
        CreateTrainerRequest request,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<TrainerDto>.Fail(
                StatusCodes.Status404NotFound,
                "User not found",
                "User does not exist.");
        }

        if (!string.Equals(user.Role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<TrainerDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid role",
                "Only trainer users can create trainer profiles.");
        }

        var existingProfile = await db.TrainerProfiles
            .AnyAsync(t => t.UserId == userId, cancellationToken);
        if (existingProfile)
        {
            return ServiceResult<TrainerDto>.Fail(
                StatusCodes.Status409Conflict,
                "Trainer profile exists",
                "Trainer profile already exists for this user.");
        }

        var name = request.DisplayName.Trim();
        if (!string.Equals(user.Name, name, StringComparison.Ordinal))
        {
            user.Name = name;
        }

        var trainer = new TrainerProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            GymName = string.IsNullOrWhiteSpace(request.GymName) ? null : request.GymName.Trim(),
            About = null,
            Specializations = Array.Empty<string>(),
            TrainingTypes = Array.Empty<string>(),
            WorksWithGender = Gender.Any,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.TrainerProfiles.Add(trainer);
        await db.SaveChangesAsync(cancellationToken);

        return ServiceResult<TrainerDto>.Success(new TrainerDto(
            trainer.Id,
            user.Name,
            trainer.GymName,
            trainer.PricePerSession,
            trainer.CreatedAtUtc));
    }

    public async Task<IReadOnlyList<TrainerDto>> GetAllTrainersAsync(CancellationToken cancellationToken)
    {
        return await db.TrainerProfiles
            .OrderBy(t => t.CreatedAtUtc)
            .Select(t => new TrainerDto(
                t.Id,
                t.User!.Name,
                t.GymName,
                t.PricePerSession,
                t.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }
}
