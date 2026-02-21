using Microsoft.AspNetCore.Identity;

namespace Api.Data;

public sealed class AppUser : IdentityUser<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Client;
    public Gender Gender { get; set; } = Gender.Male;
    public bool PushEventsEnabled { get; set; } = true;
    public bool PushGroupMinCancellationEnabled { get; set; } = true;
    public bool PushReminderEnabled { get; set; } = true;
    public bool PushTrainerLinkRequestsEnabled { get; set; } = true;
    public bool PushClientLinkResponsesEnabled { get; set; } = true;
    public int PushReminderOffsetMinutes { get; set; } = 120;
    public UserAvatar? Avatar { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
    public List<DeviceToken> DeviceTokens { get; set; } = new();
}
