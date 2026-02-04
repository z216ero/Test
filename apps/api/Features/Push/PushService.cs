using Api.Data;
using FirebaseAdmin.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Push;

public sealed class PushService(
    AppDbContext db,
    FirebaseMessagingClient messagingClient,
    ILogger<PushService> logger)
{
    public async Task RegisterTokenAsync(
        Guid userId,
        string token,
        string platform,
        CancellationToken cancellationToken)
    {
        var normalizedToken = token.Trim();
        var normalizedPlatform = PushPlatforms.Normalize(platform);
        var now = DateTime.UtcNow;

        var existing = await db.DeviceTokens
            .FirstOrDefaultAsync(x => x.Token == normalizedToken, cancellationToken);

        if (existing is null)
        {
            var entry = new DeviceToken
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Platform = normalizedPlatform,
                Token = normalizedToken,
                CreatedAtUtc = now,
                LastSeenAtUtc = now,
                IsEnabled = true
            };

            db.DeviceTokens.Add(entry);
        }
        else
        {
            existing.UserId = userId;
            existing.Platform = normalizedPlatform;
            existing.LastSeenAtUtc = now;
            existing.IsEnabled = true;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task DisableTokenAsync(
        Guid userId,
        string token,
        CancellationToken cancellationToken)
    {
        var normalizedToken = token.Trim();
        var stored = await db.DeviceTokens
            .FirstOrDefaultAsync(
                x => x.Token == normalizedToken && x.UserId == userId,
                cancellationToken);

        if (stored is null)
        {
            return;
        }

        stored.IsEnabled = false;
        stored.LastSeenAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task NotifyBookingCreatedAsync(
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.BookingCreated,
            async () =>
            {
                var payload = new PushPayload(
                    PushEventTypes.BookingCreated,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc);

                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
                await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
            });
    }

    public async Task NotifyBookingCancelledAsync(
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.BookingCancelled,
            async () =>
            {
                var payload = new PushPayload(
                    PushEventTypes.BookingCancelled,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc);

                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
                await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
            });
    }

    public async Task NotifySlotCancelledByTrainerAsync(
        Guid slotId,
        Guid trainerId,
        Guid? clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.SlotCancelledByTrainer,
            async () =>
            {
                var payload = new PushPayload(
                    PushEventTypes.SlotCancelledByTrainer,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc);

                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);

                if (clientId.HasValue && clientId.Value != Guid.Empty)
                {
                    await SafeSendToUserAsync(clientId.Value, UserRoles.Client, payload, cancellationToken);
                }
            });
    }

    public async Task NotifyAttendanceMarkedAsync(
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.AttendanceMarked,
            async () =>
            {
                var payload = new PushPayload(
                    PushEventTypes.AttendanceMarked,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc);

                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
                await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
            });
    }

    private async Task<Guid?> GetTrainerUserIdAsync(
        Guid trainerId,
        CancellationToken cancellationToken)
        => await db.TrainerProfiles
            .AsNoTracking()
            .Where(trainer => trainer.Id == trainerId)
            .Select(trainer => (Guid?)trainer.UserId)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task SafeSendToUserAsync(
        Guid? userId,
        string roleHint,
        PushPayload payload,
        CancellationToken cancellationToken)
    {
        if (!userId.HasValue || userId.Value == Guid.Empty)
        {
            return;
        }

        try
        {
            await SendToUserAsync(userId.Value, roleHint, payload, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Push send failed for user {UserId} ({EventType}).",
                userId,
                payload.Type);
        }
    }

    private async Task SendToUserAsync(
        Guid userId,
        string roleHint,
        PushPayload payload,
        CancellationToken cancellationToken)
    {
        var tokens = await db.DeviceTokens
            .AsNoTracking()
            .Where(token => token.UserId == userId && token.IsEnabled)
            .Select(token => token.Token)
            .ToListAsync(cancellationToken);

        if (tokens.Count == 0)
        {
            return;
        }

        var message = new MulticastMessage
        {
            Tokens = tokens,
            Data = BuildData(roleHint, payload),
            Android = new AndroidConfig
            {
                Priority = Priority.High
            }
        };

        var response = await messagingClient.SendMulticastAsync(message, cancellationToken);
        if (response is not null && response.FailureCount > 0)
        {
            logger.LogInformation(
                "Push send completed with {FailureCount} failures for {UserId}.",
                response.FailureCount,
                userId);
        }
    }

    private static Dictionary<string, string> BuildData(string roleHint, PushPayload payload)
    {
        var data = new Dictionary<string, string>
        {
            ["type"] = payload.Type,
            ["roleHint"] = UserRoles.Normalize(roleHint),
            ["slotId"] = payload.SlotId.ToString()
        };

        if (payload.TrainerId.HasValue)
        {
            data["trainerId"] = payload.TrainerId.Value.ToString();
        }

        if (payload.ClientId.HasValue)
        {
            data["clientId"] = payload.ClientId.Value.ToString();
        }

        if (payload.StartsAtUtc.HasValue)
        {
            data["startsAtUtc"] = payload.StartsAtUtc.Value.ToString("O");
        }

        return data;
    }

    private async Task SafeNotifyAsync(string eventType, Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Push notify failed for {EventType}.", eventType);
        }
    }

    private sealed record PushPayload(
        string Type,
        Guid SlotId,
        Guid? TrainerId,
        Guid? ClientId,
        DateTime? StartsAtUtc);
}
