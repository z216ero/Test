using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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

        var existingUser = await userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
        {
            return ServiceResult<AuthResponse>.Fail(
                StatusCodes.Status409Conflict,
                "Email already in use",
                "Email is already registered.");
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
            if (createResult.Errors.Any(error => string.Equals(error.Code, "DuplicateEmail", StringComparison.OrdinalIgnoreCase)
                || string.Equals(error.Code, "DuplicateUserName", StringComparison.OrdinalIgnoreCase)))
            {
                return ServiceResult<AuthResponse>.Fail(
                    StatusCodes.Status409Conflict,
                    "Email already in use",
                    "Email is already registered.");
            }

            return ServiceResult<AuthResponse>.Fail(
                StatusCodes.Status400BadRequest,
                "Registration failed",
                string.Join(" ", createResult.Errors.Select(e => e.Description)));
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

        var response = await BuildAuthResponseAsync(user, cancellationToken);
        return ServiceResult<AuthResponse>.Success(response);
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

        var response = await BuildAuthResponseAsync(user, cancellationToken);
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

    private async Task<AuthResponse> BuildAuthResponseAsync(AppUser user, CancellationToken cancellationToken)
    {
        var token = CreateToken(user);
        var dto = await BuildUserDtoAsync(user, cancellationToken);
        return new AuthResponse(token, dto);
    }

    private async Task<AuthUserDto> BuildUserDtoAsync(AppUser user, CancellationToken cancellationToken)
    {
        string? specialization = null;
        string? gymName = null;

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
            gymName);
    }

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
