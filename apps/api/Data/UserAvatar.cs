using System;

namespace Api.Data;

public sealed class UserAvatar
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
    public DateTime UpdatedAtUtc { get; set; }
}
