namespace Api.Features.Push;

public sealed record RegisterPushTokenRequest(string Token, string Platform);

public sealed record DisablePushTokenRequest(string Token);

public sealed record PushPreferencesResponse(
    bool EventsEnabled,
    bool GroupMinCancellationEnabled,
    bool ReminderEnabled,
    int ReminderOffsetMinutes);

public sealed record UpdatePushPreferencesRequest(
    bool EventsEnabled,
    bool GroupMinCancellationEnabled,
    bool ReminderEnabled,
    int ReminderOffsetMinutes);
