using System.Security.Cryptography;
using System.Text;
using Api.Data;
using FirebaseAdmin.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Push;

public sealed class PushService(
    AppDbContext db,
    FirebaseMessagingClient messagingClient,
    ILogger<PushService> logger)
{
    private static readonly TimeSpan DedupWindow = TimeSpan.FromSeconds(30);

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
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    PushEventTypes.BookingCreated,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationToken);

                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
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
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    PushEventTypes.BookingCancelled,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationToken);

                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
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
                if (clientId.HasValue && clientId.Value != Guid.Empty)
                {
                    var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                    var payload = await BuildPayloadAsync(
                        PushEventTypes.SlotCancelledByTrainer,
                        slotId,
                        trainerId,
                        clientId,
                        startsAtUtc,
                        trainerUserId,
                        cancellationToken);

                    await SafeSendToUserAsync(clientId.Value, UserRoles.Client, payload, cancellationToken);
                }
            });
    }

    public async Task NotifySlotCancelledByTrainerToClientsAsync(
        Guid slotId,
        Guid trainerId,
        IReadOnlyCollection<Guid> clientIds,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.SlotCancelledByTrainer,
            async () =>
            {
                if (clientIds.Count == 0)
                {
                    return;
                }

                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                foreach (var clientId in clientIds.Distinct())
                {
                    var payload = await BuildPayloadAsync(
                        PushEventTypes.SlotCancelledByTrainer,
                        slotId,
                        trainerId,
                        clientId,
                        startsAtUtc,
                        trainerUserId,
                        cancellationToken);

                    await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
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
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    PushEventTypes.AttendanceMarked,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationToken);

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

    private async Task<string?> GetUserNameAsync(Guid? userId, CancellationToken cancellationToken)
    {
        if (!userId.HasValue || userId.Value == Guid.Empty)
        {
            return null;
        }

        var name = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId.Value)
            .Select(user => user.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var trimmed = name?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string ResolveActorRole(string eventType)
        => eventType switch
        {
            PushEventTypes.BookingCreated => UserRoles.Client,
            PushEventTypes.BookingCancelled => UserRoles.Client,
            PushEventTypes.SlotCancelledByTrainer => UserRoles.Trainer,
            PushEventTypes.AttendanceMarked => UserRoles.Trainer,
            _ => UserRoles.Client
        };

    private static string ResolveActorName(string actorRole, string? trainerName, string? clientName)
        => string.Equals(actorRole, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase)
            ? trainerName ?? "Тренер"
            : clientName ?? "Клиент";

    private async Task<PushPayload> BuildPayloadAsync(
        string eventType,
        Guid slotId,
        Guid trainerId,
        Guid? clientId,
        DateTime startsAtUtc,
        Guid? trainerUserId,
        CancellationToken cancellationToken)
    {
        var slotDurationMinutes = await db.TrainingSlots
            .AsNoTracking()
            .Where(slot => slot.Id == slotId)
            .Select(slot => (int?)slot.DurationMinutes)
            .FirstOrDefaultAsync(cancellationToken);

        var trainerName = await GetUserNameAsync(trainerUserId, cancellationToken);
        var clientName = await GetUserNameAsync(clientId, cancellationToken);
        var actorRole = ResolveActorRole(eventType);
        var actorName = ResolveActorName(actorRole, trainerName, clientName);

        return new PushPayload(
            eventType,
            slotId,
            trainerId,
            clientId,
            startsAtUtc,
            slotDurationMinutes,
            actorName,
            actorRole,
            trainerName,
            clientName,
            Guid.NewGuid(),
            DateTime.UtcNow);
    }

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

        if (!await ShouldSendAsync(userId, payload, cancellationToken))
        {
            return;
        }

        var message = new MulticastMessage
        {
            Tokens = tokens,
            Data = BuildData(roleHint, payload),
            Notification = BuildNotification(payload),
            Android = new AndroidConfig
            {
                Priority = Priority.High,
                CollapseKey = $"{payload.Type}:{payload.SlotId}"
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
            ["slotId"] = payload.SlotId.ToString(),
            ["eventId"] = payload.EventId.ToString()
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
            data["slotStartsAtUtc"] = payload.StartsAtUtc.Value.ToString("O");
        }

        if (payload.SlotDurationMinutes.HasValue)
        {
            data["slotDurationMinutes"] = payload.SlotDurationMinutes.Value.ToString();
        }

        if (!string.IsNullOrWhiteSpace(payload.ActorName))
        {
            data["actorName"] = payload.ActorName;
        }

        if (!string.IsNullOrWhiteSpace(payload.ActorRole))
        {
            data["actorRole"] = payload.ActorRole!;
        }

        if (!string.IsNullOrWhiteSpace(payload.TrainerName))
        {
            data["trainerName"] = payload.TrainerName;
        }

        if (!string.IsNullOrWhiteSpace(payload.ClientName))
        {
            data["clientName"] = payload.ClientName;
        }

        data["occurredAtUtc"] = payload.OccurredAtUtc.ToString("O");

        return data;
    }

    private static Notification BuildNotification(PushPayload payload)
        => payload.Type switch
        {
            PushEventTypes.BookingCreated => new Notification
            {
                Title = "Новая запись",
                Body = "Клиент записался на тренировку"
            },
            PushEventTypes.BookingCancelled => new Notification
            {
                Title = "Отмена записи",
                Body = "Клиент отменил тренировку"
            },
            PushEventTypes.SlotCancelledByTrainer => new Notification
            {
                Title = "Тренировка отменена",
                Body = "Тренер отменил занятие"
            },
            PushEventTypes.AttendanceMarked => new Notification
            {
                Title = "Обновление тренировки",
                Body = "Статус тренировки обновлён"
            },
            _ => new Notification
            {
                Title = "Уведомление",
                Body = "Есть обновление по расписанию."
            }
        };

    private async Task<bool> ShouldSendAsync(
        Guid userId,
        PushPayload payload,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var keyHash = BuildDedupKeyHash(userId, payload.Type, payload.SlotId);

        var entry = await db.PushEventDedups
            .FirstOrDefaultAsync(x => x.KeyHash == keyHash, cancellationToken);

        if (entry is not null && now - entry.LastSentAtUtc < DedupWindow)
        {
            return false;
        }

        if (entry is null)
        {
            entry = new PushEventDedup
            {
                KeyHash = keyHash,
                LastSentAtUtc = now,
                CreatedAtUtc = now
            };
            db.PushEventDedups.Add(entry);
        }
        else
        {
            entry.LastSentAtUtc = now;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex)
        {
            logger.LogWarning(ex, "Push dedup update failed for {UserId} ({EventType}).", userId, payload.Type);
            return true;
        }
    }

    private static string BuildDedupKeyHash(Guid userId, string type, Guid slotId)
    {
        var raw = $"{userId:N}:{type}:{slotId:N}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
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
        DateTime? StartsAtUtc,
        int? SlotDurationMinutes,
        string ActorName,
        string ActorRole,
        string? TrainerName,
        string? ClientName,
        Guid EventId,
        DateTime OccurredAtUtc);
}
