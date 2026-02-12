using System.Globalization;
using System.Text.RegularExpressions;
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
        var normalizedCityName = NormalizeLocationName(request.CityName);
        var normalizedDistrictName = string.IsNullOrWhiteSpace(request.DistrictName)
            ? null
            : NormalizeLocationName(request.DistrictName);

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        user.Name = request.Name.Trim();
        user.PhoneNumber = NormalizeRussianPhoneNumber(request.PhoneNumber);
        if (!string.IsNullOrWhiteSpace(request.Gender)
            && Enum.TryParse<Gender>(request.Gender, true, out var parsedGender))
        {
            user.Gender = parsedGender;
        }

        var city = await GetOrCreateCityAsync(normalizedCityName, cancellationToken);
        District? district = null;
        if (!string.IsNullOrWhiteSpace(normalizedDistrictName))
        {
            district = await GetOrCreateDistrictAsync(city.Id, normalizedDistrictName!, cancellationToken);
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
            profile.CityId = city.Id;
            profile.DistrictId = district?.Id;
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

            profile.CityId = city.Id;
            profile.DistrictId = district?.Id;
        }

        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    private async Task<City> GetOrCreateCityAsync(string cityName, CancellationToken cancellationToken)
    {
        var existing = await db.Cities
            .FirstOrDefaultAsync(c => EF.Functions.ILike(c.Name, cityName), cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var city = new City { Name = cityName };
        db.Cities.Add(city);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return city;
        }
        catch (DbUpdateException)
        {
            db.Entry(city).State = EntityState.Detached;
            var fallback = await db.Cities
                .FirstOrDefaultAsync(c => EF.Functions.ILike(c.Name, cityName), cancellationToken);
            if (fallback is not null)
            {
                return fallback;
            }
            throw;
        }
    }

    private async Task<District> GetOrCreateDistrictAsync(
        int cityId,
        string districtName,
        CancellationToken cancellationToken)
    {
        var existing = await db.Districts
            .FirstOrDefaultAsync(
                d => d.CityId == cityId && EF.Functions.ILike(d.Name, districtName),
                cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var district = new District { CityId = cityId, Name = districtName };
        db.Districts.Add(district);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return district;
        }
        catch (DbUpdateException)
        {
            db.Entry(district).State = EntityState.Detached;
            var fallback = await db.Districts
                .FirstOrDefaultAsync(
                    d => d.CityId == cityId && EF.Functions.ILike(d.Name, districtName),
                    cancellationToken);
            if (fallback is not null)
            {
                return fallback;
            }
            throw;
        }
    }

    private static string NormalizeLocationName(string value)
    {
        var trimmed = value.Trim();
        var collapsed = Regex.Replace(trimmed, "\\s+", " ");
        var culture = CultureInfo.GetCultureInfo("ru-RU");
        var lowered = collapsed.ToLower(culture);
        return culture.TextInfo.ToTitleCase(lowered);
    }

    private static string? NormalizeRussianPhoneNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = Regex.Replace(value.Trim(), @"[\s\-\(\)]", string.Empty);
        if (normalized.StartsWith("+7", StringComparison.Ordinal)
            && normalized.Length == 12
            && normalized[2..].All(char.IsDigit))
        {
            return normalized;
        }

        if (normalized.StartsWith("8", StringComparison.Ordinal)
            && normalized.Length == 11
            && normalized.All(char.IsDigit))
        {
            return $"+7{normalized[1..]}";
        }

        return null;
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
