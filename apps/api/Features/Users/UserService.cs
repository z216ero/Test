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

            profile.Specialization = string.IsNullOrWhiteSpace(request.Specialization)
                ? null
                : request.Specialization.Trim();
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
