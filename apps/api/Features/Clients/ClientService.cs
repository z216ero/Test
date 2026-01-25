using Api.Data;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Clients;

public sealed class ClientService(AppDbContext db)
{
    public async Task<ServiceResult<ClientProfileDto>> GetClientProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<ClientProfileDto>.Fail(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "User is not available.");
        }

        if (!string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<ClientProfileDto>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        var profile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return ServiceResult<ClientProfileDto>.Fail(
                StatusCodes.Status404NotFound,
                "Client profile not found",
                "Client profile is not available for this user.");
        }

        return ServiceResult<ClientProfileDto>.Success(new ClientProfileDto(profile.UserId));
    }
}
