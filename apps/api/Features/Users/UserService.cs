using Api.Data;
using Api.Features.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Users;

public sealed class UserService(AppDbContext db)
{
    public async Task<ServiceResult<bool>> UpdateProfileAsync(
        Guid userId,
        UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        user.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.Gender)
            && Enum.TryParse<Gender>(request.Gender, true, out var parsedGender))
        {
            user.Gender = parsedGender;
        }

        if (string.Equals(user.Role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            var profile = await db.TrainerProfiles
                .FirstOrDefaultAsync(t => t.UserId == userId, cancellationToken);

            if (profile is null)
            {
                return ServiceResult<bool>.Fail(
                    StatusCodes.Status404NotFound,
                    "Trainer profile not found",
                    "Trainer profile is missing.");
            }

            profile.About = string.IsNullOrWhiteSpace(request.About)
                ? null
                : request.About.Trim();

            if (request.Specializations is not null)
            {
                profile.Specializations = request.Specializations;
            }

            if (request.TrainingTypes is not null)
            {
                profile.TrainingTypes = request.TrainingTypes;
            }

            if (!string.IsNullOrWhiteSpace(request.WorksWithGender)
                && Enum.TryParse<Gender>(request.WorksWithGender, true, out var preference))
            {
                profile.WorksWithGender = preference;
            }

            profile.PricePerSession = request.PricePerSession;
        }
        else
        {
            var profile = await db.ClientProfiles
                .FirstOrDefaultAsync(t => t.UserId == userId, cancellationToken);

            if (profile is null)
            {
                return ServiceResult<bool>.Fail(
                    StatusCodes.Status404NotFound,
                    "Client profile not found",
                    "Client profile is missing.");
            }

            if (!string.IsNullOrWhiteSpace(request.PreferredTrainerGender)
                && Enum.TryParse<Gender>(request.PreferredTrainerGender, true, out var preferred))
            {
                profile.PreferredTrainerGender = preferred;
            }

            if (!string.IsNullOrWhiteSpace(request.Level)
                && Enum.TryParse<ClientLevel>(request.Level, true, out var level))
            {
                profile.Level = level;
            }

            if (request.Goals is not null)
            {
                profile.Goals = request.Goals;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<bool>> UpsertAvatarAsync(
        Guid userId,
        string contentType,
        byte[] bytes,
        CancellationToken cancellationToken)
    {
        var userExists = await db.Users.AnyAsync(u => u.Id == userId, cancellationToken);
        if (!userExists)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        var avatar = await db.UserAvatars
            .FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);

        if (avatar is null)
        {
            avatar = new UserAvatar
            {
                UserId = userId,
                ContentType = contentType,
                Bytes = bytes,
                UpdatedAtUtc = DateTime.UtcNow
            };
            db.UserAvatars.Add(avatar);
        }
        else
        {
            avatar.ContentType = contentType;
            avatar.Bytes = bytes;
            avatar.UpdatedAtUtc = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<UserAvatarResult>> GetAvatarAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var userExists = await db.Users.AnyAsync(u => u.Id == userId, cancellationToken);
        if (!userExists)
        {
            return ServiceResult<UserAvatarResult>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        var avatar = await db.UserAvatars
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);

        if (avatar is null)
        {
            return ServiceResult<UserAvatarResult>.Fail(
                StatusCodes.Status404NotFound,
                "Avatar not found",
                "Avatar has not been uploaded.");
        }

        return ServiceResult<UserAvatarResult>.Success(new UserAvatarResult(avatar.ContentType, avatar.Bytes));
    }
}
