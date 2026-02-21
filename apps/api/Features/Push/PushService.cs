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

    public async Task<PushPreferencesResponse?> GetPushPreferencesAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new PushPreferencesResponse(
                user.PushEventsEnabled,
                user.PushGroupMinCancellationEnabled,
                user.PushReminderEnabled,
                user.PushTrainerLinkRequestsEnabled,
                user.PushClientLinkResponsesEnabled,
                user.PushReminderOffsetMinutes))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<PushPreferencesResponse?> UpdatePushPreferencesAsync(
        Guid userId,
        UpdatePushPreferencesRequest request,
        CancellationToken cancellationToken)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null)
        {
            return null;
        }

        user.PushEventsEnabled = request.EventsEnabled;
        user.PushGroupMinCancellationEnabled = request.GroupMinCancellationEnabled;
        user.PushReminderEnabled = request.ReminderEnabled;
        user.PushTrainerLinkRequestsEnabled = request.TrainerLinkRequestsEnabled;
        user.PushClientLinkResponsesEnabled = request.ClientLinkResponsesEnabled;
        user.PushReminderOffsetMinutes = request.ReminderOffsetMinutes;
        await db.SaveChangesAsync(cancellationToken);

        return new PushPreferencesResponse(
            user.PushEventsEnabled,
            user.PushGroupMinCancellationEnabled,
            user.PushReminderEnabled,
            user.PushTrainerLinkRequestsEnabled,
            user.PushClientLinkResponsesEnabled,
            user.PushReminderOffsetMinutes);
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
                    cancellationReason: null,
                    cancellationToken);

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
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    PushEventTypes.BookingCancelled,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken);

                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
            });
    }

    public async Task NotifySlotCancelledByTrainerAsync(
        Guid slotId,
        Guid trainerId,
        Guid? clientId,
        DateTime startsAtUtc,
        string? cancellationReason,
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
                        cancellationReason,
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
        string? cancellationReason,
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
                        cancellationReason,
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
                    cancellationReason: null,
                    cancellationToken);

                await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
            });
    }

    public async Task NotifyPaymentMarkedAsync(
        Guid paymentId,
        bool markedPaid,
        CancellationToken cancellationToken)
    {
        var eventType = markedPaid
            ? PushEventTypes.PaymentMarkedPaid
            : PushEventTypes.PaymentMarkedPending;

        await SafeNotifyAsync(
            eventType,
            async () =>
            {
                var payment = await db.Payments
                    .AsNoTracking()
                    .Where(p => p.Id == paymentId)
                    .Select(p => new
                    {
                        p.Id,
                        p.BookingId,
                        p.Booking!.ClientId,
                        p.Booking.TrainerClientId,
                        SlotId = p.Booking.SlotId,
                        TrainerId = p.Booking.Slot!.TrainerId,
                        StartsAtUtc = p.Booking.Slot.StartsAtUtc
                    })
                    .FirstOrDefaultAsync(cancellationToken);
                if (payment is null)
                {
                    return;
                }

                var trainerUserId = await GetTrainerUserIdAsync(payment.TrainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    eventType,
                    payment.SlotId,
                    payment.TrainerId,
                    payment.ClientId,
                    payment.StartsAtUtc,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    bookingId: payment.BookingId,
                    paymentId: payment.Id,
                    trainerClientId: payment.TrainerClientId);

                await SafeSendToUserAsync(trainerUserId, UserRoles.Trainer, payload, cancellationToken);
                if (payment.ClientId.HasValue)
                {
                    await SafeSendToUserAsync(payment.ClientId.Value, UserRoles.Client, payload, cancellationToken);
                }
            });
    }

    public async Task<bool> TryNotifyTrainingReminderAsync(
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        try
        {
            var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
            var payload = await BuildPayloadAsync(
                PushEventTypes.TrainingReminder,
                slotId,
                trainerId,
                clientId,
                startsAtUtc,
                trainerUserId,
                cancellationReason: null,
                cancellationToken);

            var result = await SendToUserInternalAsync(
                clientId,
                UserRoles.Client,
                payload,
                cancellationToken);

            return result is not PushSendResult.Failed;
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Push send failed for reminder. SlotId={SlotId}, ClientId={ClientId}",
                slotId,
                clientId);
            return false;
        }
    }

    public async Task NotifyTrainerClientLinkRequestedAsync(
        Guid linkId,
        Guid trainerId,
        Guid clientId,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.TrainerClientLinkRequested,
            async () =>
            {
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    PushEventTypes.TrainerClientLinkRequested,
                    linkId,
                    trainerId,
                    clientId,
                    DateTime.UtcNow,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    linkId: linkId,
                    deeplink: "myapp://profile/requests");

                await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
            });
    }

    public async Task NotifyTrainerClientLinkAcceptedAsync(
        Guid linkId,
        Guid trainerId,
        Guid clientId,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.TrainerClientLinkAccepted,
            async () =>
            {
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                if (!trainerUserId.HasValue)
                {
                    return;
                }

                var payload = await BuildPayloadAsync(
                    PushEventTypes.TrainerClientLinkAccepted,
                    linkId,
                    trainerId,
                    clientId,
                    DateTime.UtcNow,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    linkId: linkId);

                await SafeSendToUserAsync(trainerUserId.Value, UserRoles.Trainer, payload, cancellationToken);
            });
    }

    public async Task NotifyTrainerClientLinkRejectedAsync(
        Guid linkId,
        Guid trainerId,
        Guid clientId,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.TrainerClientLinkRejected,
            async () =>
            {
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                if (!trainerUserId.HasValue)
                {
                    return;
                }

                var payload = await BuildPayloadAsync(
                    PushEventTypes.TrainerClientLinkRejected,
                    linkId,
                    trainerId,
                    clientId,
                    DateTime.UtcNow,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    linkId: linkId);

                await SafeSendToUserAsync(trainerUserId.Value, UserRoles.Trainer, payload, cancellationToken);
            });
    }

    public async Task NotifyBookingConfirmationRequestedAsync(
        Guid bookingId,
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.BookingConfirmationRequested,
            async () =>
            {
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                var payload = await BuildPayloadAsync(
                    PushEventTypes.BookingConfirmationRequested,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    bookingId: bookingId,
                    deeplink: $"myapp://booking/{bookingId}");

                await SafeSendToUserAsync(clientId, UserRoles.Client, payload, cancellationToken);
            });
    }

    public async Task NotifyBookingConfirmationConfirmedAsync(
        Guid bookingId,
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.BookingConfirmationConfirmed,
            async () =>
            {
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                if (!trainerUserId.HasValue)
                {
                    return;
                }

                var payload = await BuildPayloadAsync(
                    PushEventTypes.BookingConfirmationConfirmed,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    bookingId: bookingId);

                await SafeSendToUserAsync(trainerUserId.Value, UserRoles.Trainer, payload, cancellationToken);
            });
    }

    public async Task NotifyBookingConfirmationDeclinedAsync(
        Guid bookingId,
        Guid slotId,
        Guid trainerId,
        Guid clientId,
        DateTime startsAtUtc,
        CancellationToken cancellationToken)
    {
        await SafeNotifyAsync(
            PushEventTypes.BookingConfirmationDeclined,
            async () =>
            {
                var trainerUserId = await GetTrainerUserIdAsync(trainerId, cancellationToken);
                if (!trainerUserId.HasValue)
                {
                    return;
                }

                var payload = await BuildPayloadAsync(
                    PushEventTypes.BookingConfirmationDeclined,
                    slotId,
                    trainerId,
                    clientId,
                    startsAtUtc,
                    trainerUserId,
                    cancellationReason: null,
                    cancellationToken,
                    bookingId: bookingId);

                await SafeSendToUserAsync(trainerUserId.Value, UserRoles.Trainer, payload, cancellationToken);
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
            PushEventTypes.PaymentMarkedPaid => UserRoles.Trainer,
            PushEventTypes.PaymentMarkedPending => UserRoles.Trainer,
            PushEventTypes.TrainingReminder => UserRoles.Trainer,
            PushEventTypes.TrainerClientLinkRequested => UserRoles.Trainer,
            PushEventTypes.TrainerClientLinkAccepted => UserRoles.Client,
            PushEventTypes.TrainerClientLinkRejected => UserRoles.Client,
            PushEventTypes.BookingConfirmationRequested => UserRoles.Trainer,
            PushEventTypes.BookingConfirmationConfirmed => UserRoles.Client,
            PushEventTypes.BookingConfirmationDeclined => UserRoles.Client,
            _ => UserRoles.Client
        };

    private static string ResolveActorName(string actorRole, string? trainerName, string? clientName)
        => string.Equals(actorRole, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase)
            ? trainerName ?? "\u0422\u0440\u0435\u043D\u0435\u0440"
            : clientName ?? "\u041A\u043B\u0438\u0435\u043D\u0442";

    private async Task<PushPayload> BuildPayloadAsync(
        string eventType,
        Guid slotId,
        Guid trainerId,
        Guid? clientId,
        DateTime startsAtUtc,
        Guid? trainerUserId,
        string? cancellationReason,
        CancellationToken cancellationToken,
        Guid? bookingId = null,
        Guid? paymentId = null,
        Guid? trainerClientId = null,
        Guid? linkId = null,
        string? deeplink = null)
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
            trainerClientId,
            bookingId,
            paymentId,
            linkId,
            startsAtUtc,
            slotDurationMinutes,
            actorName,
            actorRole,
            trainerName,
            clientName,
            cancellationReason,
            deeplink,
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
            await SendToUserInternalAsync(userId.Value, roleHint, payload, cancellationToken);
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

    private async Task<PushSendResult> SendToUserInternalAsync(
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
            return PushSendResult.Skipped;
        }

        if (!await IsPushAllowedByPreferencesAsync(userId, payload, cancellationToken))
        {
            return PushSendResult.Skipped;
        }

        if (!await ShouldSendAsync(userId, payload, cancellationToken))
        {
            return PushSendResult.Skipped;
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
        if (response is null)
        {
            return PushSendResult.Failed;
        }

        var failureCount = response?.FailureCount ?? 0;
        if (failureCount > 0)
        {
            logger.LogInformation(
                "Push send completed with {FailureCount} failures for {UserId}.",
                failureCount,
                userId);
        }

        return (response?.SuccessCount ?? 0) > 0
            ? PushSendResult.Sent
            : PushSendResult.Failed;
    }

    private async Task<bool> IsPushAllowedByPreferencesAsync(
        Guid userId,
        PushPayload payload,
        CancellationToken cancellationToken)
    {
        var preferences = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new
            {
                user.PushEventsEnabled,
                user.PushGroupMinCancellationEnabled,
                user.PushReminderEnabled,
                user.PushTrainerLinkRequestsEnabled,
                user.PushClientLinkResponsesEnabled
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (preferences is null)
        {
            return false;
        }

        if (payload.Type == PushEventTypes.TrainingReminder)
        {
            return preferences.PushReminderEnabled;
        }

        if (payload.Type == PushEventTypes.TrainerClientLinkRequested)
        {
            return preferences.PushTrainerLinkRequestsEnabled;
        }

        if (payload.Type is PushEventTypes.TrainerClientLinkAccepted or PushEventTypes.TrainerClientLinkRejected)
        {
            return preferences.PushClientLinkResponsesEnabled;
        }

        if (!preferences.PushEventsEnabled)
        {
            return false;
        }

        var isGroupMinCancellationEvent = payload.Type == PushEventTypes.SlotCancelledByTrainer
            && string.Equals(
                payload.CancellationReason,
                PushCancellationReasons.MinParticipantsNotReached,
                StringComparison.Ordinal);

        if (isGroupMinCancellationEvent && !preferences.PushGroupMinCancellationEnabled)
        {
            return false;
        }

        return true;
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
            data["clientUserId"] = payload.ClientId.Value.ToString();
        }

        if (payload.TrainerClientId.HasValue)
        {
            data["trainerClientId"] = payload.TrainerClientId.Value.ToString();
        }

        if (payload.BookingId.HasValue)
        {
            data["bookingId"] = payload.BookingId.Value.ToString();
        }

        if (payload.LinkId.HasValue)
        {
            data["linkId"] = payload.LinkId.Value.ToString();
        }

        if (payload.PaymentId.HasValue)
        {
            data["paymentId"] = payload.PaymentId.Value.ToString();
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

        if (!string.IsNullOrWhiteSpace(payload.CancellationReason))
        {
            data["cancellationReason"] = payload.CancellationReason!;
        }

        if (!string.IsNullOrWhiteSpace(payload.Deeplink))
        {
            data["deeplink"] = payload.Deeplink!;
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
            PushEventTypes.PaymentMarkedPaid => new Notification
            {
                Title = "Оплата отмечена",
                Body = "Статус оплаты изменён на «Оплачено»"
            },
            PushEventTypes.PaymentMarkedPending => new Notification
            {
                Title = "Оплата обновлена",
                Body = "Статус оплаты изменён на «В ожидании»"
            },
            PushEventTypes.TrainingReminder => new Notification
            {
                Title = "Напоминание о тренировке",
                Body = "Скоро начнётся ваша тренировка"
            },
            PushEventTypes.TrainerClientLinkRequested => new Notification
            {
                Title = "Запрос от тренера",
                Body = "Тренер хочет добавить вас в список клиентов"
            },
            PushEventTypes.TrainerClientLinkAccepted => new Notification
            {
                Title = "Клиент принял запрос",
                Body = "Связь с клиентом успешно установлена"
            },
            PushEventTypes.TrainerClientLinkRejected => new Notification
            {
                Title = "Клиент отклонил запрос",
                Body = "Запрос на связь был отклонён"
            },
            PushEventTypes.BookingConfirmationRequested => new Notification
            {
                Title = "Тренер записал вас на тренировку",
                Body = "Подтвердите участие или отклоните запись"
            },
            PushEventTypes.BookingConfirmationConfirmed => new Notification
            {
                Title = "Клиент подтвердил тренировку",
                Body = "Назначение подтверждено"
            },
            PushEventTypes.BookingConfirmationDeclined => new Notification
            {
                Title = "Клиент отклонил тренировку",
                Body = "Слот освобождён"
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

    private enum PushSendResult
    {
        Sent,
        Skipped,
        Failed
    }

    private sealed record PushPayload(
        string Type,
        Guid SlotId,
        Guid? TrainerId,
        Guid? ClientId,
        Guid? TrainerClientId,
        Guid? BookingId,
        Guid? PaymentId,
        Guid? LinkId,
        DateTime? StartsAtUtc,
        int? SlotDurationMinutes,
        string ActorName,
        string ActorRole,
        string? TrainerName,
        string? ClientName,
        string? CancellationReason,
        string? Deeplink,
        Guid EventId,
        DateTime OccurredAtUtc);
}

