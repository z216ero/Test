namespace Api.Features.Push;

public sealed record RegisterPushTokenRequest(string Token, string Platform);

public sealed record DisablePushTokenRequest(string Token);
