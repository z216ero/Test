using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using System.Text.RegularExpressions;
using Api.Data;
using Api.Features.Common;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Api.Features.Auth;

public sealed class AuthService(
    AppDbContext db,
    UserManager<AppUser> userManager,
    IOptions<JwtOptions> jwtOptions)
{
    public async Task<ServiceResult<AuthResponse>> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedRole = UserRoles.Normalize(request.Role);
        var normalizedCityName = NormalizeLocationName(request.CityName);
        var normalizedDistrictName = string.IsNullOrWhiteSpace(request.DistrictName)
            ? null
            : NormalizeLocationName(request.DistrictName);
        var normalizedPhoneNumber = NormalizeRussianPhoneNumber(request.PhoneNumber);

        var strategy = db.Database.CreateExecutionStrategy();
        ServiceResult<AuthResponse>? result = null;

        await strategy.ExecuteAsync(async () =>
        {
            var existingUser = await userManager.FindByEmailAsync(request.Email);
            if (existingUser is not null)
            {
                result = ServiceResult<AuthResponse>.Fail(
                    StatusCodes.Status409Conflict,
                    "Email already in use",
                    "Email is already registered.");
                return;
            }

            var user = new AppUser
            {
                Id = Guid.NewGuid(),
                Email = request.Email.Trim(),
                UserName = request.Email.Trim(),
                Name = request.Name.Trim(),
                Role = normalizedRole,
                PhoneNumber = normalizedPhoneNumber,
                Gender = Enum.TryParse<Gender>(request.Gender, true, out var parsedGender)
                    ? parsedGender
                    : Gender.Male
            };

            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            var createResult = await userManager.CreateAsync(user, request.Password);
            if (!createResult.Succeeded)
            {
                if (createResult.Errors.Any(error =>
                        string.Equals(error.Code, "DuplicateEmail", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(error.Code, "DuplicateUserName", StringComparison.OrdinalIgnoreCase)))
                {
                    result = ServiceResult<AuthResponse>.Fail(
                        StatusCodes.Status409Conflict,
                        "Email already in use",
                        "Email is already registered.");
                    return;
                }

                result = ServiceResult<AuthResponse>.Fail(
                    StatusCodes.Status400BadRequest,
                    "Registration failed",
                    string.Join(" ", createResult.Errors.Select(e => e.Description)));
                return;
            }

            if (normalizedRole == UserRoles.Trainer)
            {
                var city = await GetOrCreateCityAsync(normalizedCityName, cancellationToken);
                District? district = null;
                if (!string.IsNullOrWhiteSpace(normalizedDistrictName))
                {
                    district = await GetOrCreateDistrictAsync(city.Id, normalizedDistrictName!, cancellationToken);
                }

                db.TrainerProfiles.Add(new TrainerProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    CityId = city.Id,
                    DistrictId = district?.Id,
                    GymName = null,
                    About = null,
                    Specializations = request.Specializations?.Where(code => !string.IsNullOrWhiteSpace(code))
                        .Select(code => code.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray() ?? Array.Empty<string>(),
                    TrainingTypes = ["Individual"],
                    WorksWithGender = Gender.Any,
                    CreatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                var city = await GetOrCreateCityAsync(normalizedCityName, cancellationToken);
                District? district = null;
                if (!string.IsNullOrWhiteSpace(normalizedDistrictName))
                {
                    district = await GetOrCreateDistrictAsync(city.Id, normalizedDistrictName!, cancellationToken);
                }

                db.ClientProfiles.Add(new ClientProfile
                {
                    UserId = user.Id,
                    CityId = city.Id,
                    DistrictId = district?.Id,
                    PreferredTrainerGender = Gender.Any,
                    Level = ClientLevel.Beginner,
                    Goals = Array.Empty<string>(),
                    CreatedAtUtc = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var response = await IssueAuthResponseAsync(user, cancellationToken);
            result = ServiceResult<AuthResponse>.Success(response);
        });

        return result ?? ServiceResult<AuthResponse>.Fail(
            StatusCodes.Status500InternalServerError,
            "Registration failed",
            "Unexpected registration failure.");
    }

    public async Task<ServiceResult<AuthResponse>> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return ServiceResult<AuthResponse>.Fail(
                StatusCodes.Status401Unauthorized,
                "Invalid credentials",
                "Email or password is incorrect.");
        }

        var valid = await userManager.CheckPasswordAsync(user, request.Password);
        if (!valid)
        {
            return ServiceResult<AuthResponse>.Fail(
                StatusCodes.Status401Unauthorized,
                "Invalid credentials",
                "Email or password is incorrect.");
        }

        var response = await IssueAuthResponseAsync(user, cancellationToken);
        return ServiceResult<AuthResponse>.Success(response);
    }

    public async Task<ServiceResult<AuthUserDto>> GetCurrentUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<AuthUserDto>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        var authUser = await BuildUserDtoAsync(user, cancellationToken);
        return ServiceResult<AuthUserDto>.Success(authUser);
    }

    public async Task<ServiceResult<bool>> RevokeRefreshTokensAsync(
        Guid userId,
        string? refreshToken,
        CancellationToken cancellationToken)
    {
        var query = db.RefreshTokens.Where(x => x.UserId == userId);

        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            query = query.Where(x => x.Token == refreshToken);
        }

        var tokens = await query
            .Where(x => x.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        if (tokens.Count == 0)
        {
            return ServiceResult<bool>.Success(true);
        }

        var now = DateTime.UtcNow;
        foreach (var token in tokens)
        {
            token.RevokedAtUtc = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<AuthResponse>> RefreshAsync(
        RefreshRequest request,
        CancellationToken cancellationToken)
    {
        var stored = await db.RefreshTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Token == request.RefreshToken, cancellationToken);

        if (stored is null
            || stored.RevokedAtUtc.HasValue
            || stored.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return ServiceResult<AuthResponse>.Fail(
                StatusCodes.Status401Unauthorized,
                "Invalid refresh token",
                "Refresh token is invalid or expired.");
        }

        if (stored.User is null)
        {
            return ServiceResult<AuthResponse>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        stored.RevokedAtUtc = DateTime.UtcNow;

        var newToken = CreateRefreshToken(stored.UserId);
        db.RefreshTokens.Add(newToken);

        await db.SaveChangesAsync(cancellationToken);

        var accessToken = CreateToken(stored.User);
        var dto = await BuildUserDtoAsync(stored.User, cancellationToken);
        return ServiceResult<AuthResponse>.Success(new AuthResponse(accessToken, newToken.Token, dto));
    }

    private async Task<AuthResponse> IssueAuthResponseAsync(AppUser user, CancellationToken cancellationToken)
    {
        var accessToken = CreateToken(user);
        var refreshToken = CreateRefreshToken(user.Id);

        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync(cancellationToken);

        var dto = await BuildUserDtoAsync(user, cancellationToken);
        return new AuthResponse(accessToken, refreshToken.Token, dto);
    }

    private async Task<AuthUserDto> BuildUserDtoAsync(AppUser user, CancellationToken cancellationToken)
    {
        var specializations = Array.Empty<string>();
        string? gymName = null;
        string? about = null;
        IReadOnlyList<string> trainingTypes = Array.Empty<string>();
        int? pricePerSession = null;
        string? worksWithGender = null;
        string? preferredTrainerGender = null;
        string? clientLevel = null;
        IReadOnlyList<string> clientGoals = Array.Empty<string>();
        double? trainerRating = null;
        int? trainerRatingCount = null;
        int? cityId = null;
        string? cityName = null;
        int? districtId = null;
        string? districtName = null;
        var hasAvatar = await db.UserAvatars
            .AsNoTracking()
            .AnyAsync(a => a.UserId == user.Id, cancellationToken);
        var avatarUrl = hasAvatar ? "/users/me/avatar" : null;

        if (string.Equals(user.Role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            var trainerProfile = await db.TrainerProfiles
                .AsNoTracking()
                .Include(t => t.City)
                .Include(t => t.District)
                .FirstOrDefaultAsync(t => t.UserId == user.Id, cancellationToken);
            if (trainerProfile?.Specializations is { Length: > 0 })
            {
                specializations = trainerProfile.Specializations;
            }
            gymName = trainerProfile?.GymName;
            about = trainerProfile?.About;
            if (trainerProfile?.TrainingTypes is { Length: > 0 })
            {
                trainingTypes = trainerProfile.TrainingTypes;
            }
            worksWithGender = trainerProfile?.WorksWithGender.ToString();
            pricePerSession = trainerProfile?.PricePerSession;
            cityId = trainerProfile?.CityId;
            cityName = trainerProfile?.City?.Name;
            districtId = trainerProfile?.DistrictId;
            districtName = trainerProfile?.District?.Name;

            if (trainerProfile is not null)
            {
                var ratingSample = await db.Bookings
                    .AsNoTracking()
                    .Where(b => b.Slot != null
                        && b.Slot.TrainerId == trainerProfile.Id
                        && (b.Status == BookingStatus.Completed || b.Status == BookingStatus.NoShow))
                    .OrderByDescending(b => b.Slot!.StartsAtUtc)
                    .Take(10)
                    .Select(b => b.Status)
                    .ToListAsync(cancellationToken);

                if (ratingSample.Count >= 5)
                {
                    var completedCount = ratingSample.Count(status => status == BookingStatus.Completed);
                    trainerRatingCount = ratingSample.Count;
                    trainerRating = Math.Round(
                        completedCount / (double)trainerRatingCount * 5,
                        1,
                        MidpointRounding.AwayFromZero);
                }
            }
        }
        else
        {
            var clientProfile = await db.ClientProfiles
                .AsNoTracking()
                .Include(c => c.City)
                .Include(c => c.District)
                .FirstOrDefaultAsync(c => c.UserId == user.Id, cancellationToken);
            if (clientProfile is not null)
            {
                preferredTrainerGender = clientProfile.PreferredTrainerGender.ToString();
                clientLevel = clientProfile.Level.ToString();
                clientGoals = clientProfile.Goals ?? Array.Empty<string>();
                cityId = clientProfile.CityId;
                cityName = clientProfile.City?.Name;
                districtId = clientProfile.DistrictId;
                districtName = clientProfile.District?.Name;
            }
        }

        return new AuthUserDto(
            user.Id,
            user.Email ?? string.Empty,
            user.PhoneNumber,
            user.Role,
            user.Name,
            user.Gender.ToString(),
            cityId,
            cityName,
            districtId,
            districtName,
            gymName,
            about,
            trainingTypes,
            specializations,
            worksWithGender,
            pricePerSession,
            preferredTrainerGender,
            clientLevel,
            clientGoals,
            trainerRating,
            trainerRatingCount,
            hasAvatar,
            avatarUrl);
    }

    private RefreshToken CreateRefreshToken(Guid userId)
        => new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(jwtOptions.Value.RefreshTokenDays),
            CreatedAtUtc = DateTime.UtcNow
        };

    private string CreateToken(AppUser user)
    {
        var options = jwtOptions.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(options.AccessTokenMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
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
}
