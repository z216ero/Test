using Microsoft.AspNetCore.Identity;

namespace Api.Data;

public sealed class AppUser : IdentityUser<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Client;
}
