using System.Security.Claims;

namespace Api.Features.Auth;

public static class AuthClaims
{
    public static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        userId = Guid.Empty;
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return value is not null && Guid.TryParse(value, out userId);
    }

    public static string? GetRole(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.Role);
}
