using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
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
                Role = normalizedRole
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
                db.TrainerProfiles.Add(new TrainerProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    GymName = null,
                    Specialization = string.IsNullOrWhiteSpace(request.Specialization)
                        ? null
                        : request.Specialization.Trim(),
                    CreatedAtUtc = DateTime.UtcNow
                });
            }
            else
            {
                db.ClientProfiles.Add(new ClientProfile
                {
                    UserId = user.Id,
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
        string? specialization = null;
        string? gymName = null;
        var hasAvatar = await db.UserAvatars
            .AsNoTracking()
            .AnyAsync(a => a.UserId == user.Id, cancellationToken);
        var avatarUrl = hasAvatar ? "/users/me/avatar" : null;

        if (string.Equals(user.Role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            var trainerProfile = await db.TrainerProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.UserId == user.Id, cancellationToken);
            specialization = trainerProfile?.Specialization;
            gymName = trainerProfile?.GymName;
        }

        return new AuthUserDto(
            user.Id,
            user.Email ?? string.Empty,
            user.Role,
            user.Name,
            specialization,
            gymName,
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
}
