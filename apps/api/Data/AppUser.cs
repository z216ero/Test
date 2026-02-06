using Microsoft.AspNetCore.Identity;

namespace Api.Data;

public sealed class AppUser : IdentityUser<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Client;
    public Gender Gender { get; set; } = Gender.Male;
    public UserAvatar? Avatar { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
    public List<DeviceToken> DeviceTokens { get; set; } = new();
}
