using Api.Data;
using Api.Features.Common;
using Api.Features.Push;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.TrainerClientLinks;

public sealed class TrainerClientLinkService(AppDbContext db, PushService pushService)
{
    private static readonly TimeSpan RejectCooldown = TimeSpan.FromDays(7);
    private static readonly TimeSpan RevokedCooldown = TimeSpan.FromDays(1);

    public async Task<ServiceResult<SearchTrainerClientByPhoneResponse>> SearchByPhoneAsync(
        string rawPhone,
        CancellationToken cancellationToken)
    {
        if (!PhoneNumbers.TryNormalizeToE164(rawPhone, out var normalizedPhone))
        {
            return ServiceResult<SearchTrainerClientByPhoneResponse>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid phone number",
                "Phone must be in E.164 format.");
        }

        var match = await db.Users
            .AsNoTracking()
            .Where(u => u.PhoneNumber == normalizedPhone
                && u.Role == UserRoles.Client)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.PhoneNumber
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (match is null)
        {
            return ServiceResult<SearchTrainerClientByPhoneResponse>.Fail(
                StatusCodes.Status404NotFound,
                "Client not found",
                "Registered client with this phone number was not found.");
        }

        return ServiceResult<SearchTrainerClientByPhoneResponse>.Success(
            new SearchTrainerClientByPhoneResponse(
                match.Id,
                match.Name,
                PhoneNumbers.MaskE164(match.PhoneNumber)));
    }

    public async Task<ServiceResult<TrainerClientLinkDto>> RequestLinkAsync(
        Guid trainerUserId,
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        if (clientUserId == Guid.Empty)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid client user",
                "ClientUserId is required.");
        }

        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return NotFoundTrainer();
        }

        var clientUser = await db.Users
            .AsNoTracking()
            .Where(x => x.Id == clientUserId)
            .Select(x => new { x.Id, x.Role })
            .FirstOrDefaultAsync(cancellationToken);
        if (clientUser is null || !string.Equals(clientUser.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid linked client",
                "Client user must exist and have Client role.");
        }

        var nowUtc = DateTime.UtcNow;
        var link = await db.TrainerClientLinks
            .FirstOrDefaultAsync(
                x => x.TrainerId == trainerId.Value && x.ClientUserId == clientUserId,
                cancellationToken);

        if (link is null)
        {
            link = new TrainerClientLink
            {
                Id = Guid.NewGuid(),
                TrainerId = trainerId.Value,
                ClientUserId = clientUserId,
                Status = TrainerClientLinkStatus.Pending,
                RequestedAtUtc = nowUtc,
                LastRequestAtUtc = nowUtc
            };
            db.TrainerClientLinks.Add(link);
        }
        else
        {
            if (link.Status is TrainerClientLinkStatus.Pending or TrainerClientLinkStatus.Accepted)
            {
                return ServiceResult<TrainerClientLinkDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Link request already exists",
                    "Pending or accepted link already exists.",
                    new Dictionary<string, object?>
                    {
                        ["errorCode"] = "link_already_exists"
                    });
            }

            if (link.Status == TrainerClientLinkStatus.Rejected
                && link.RejectedUntilUtc.HasValue
                && link.RejectedUntilUtc.Value > nowUtc)
            {
                return ServiceResult<TrainerClientLinkDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Link request cooldown",
                    $"Нельзя отправить повторно до {link.RejectedUntilUtc.Value:O}.",
                    new Dictionary<string, object?>
                    {
                        ["errorCode"] = "link_request_cooldown",
                        ["retryAfterUtc"] = link.RejectedUntilUtc.Value.ToString("O")
                    });
            }

            if (link.Status == TrainerClientLinkStatus.Revoked
                && nowUtc < link.LastRequestAtUtc.Add(RevokedCooldown))
            {
                var retryAfter = link.LastRequestAtUtc.Add(RevokedCooldown);
                return ServiceResult<TrainerClientLinkDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Link request cooldown",
                    $"Нельзя отправить повторно до {retryAfter:O}.",
                    new Dictionary<string, object?>
                    {
                        ["errorCode"] = "link_request_cooldown",
                        ["retryAfterUtc"] = retryAfter.ToString("O")
                    });
            }

            link.Status = TrainerClientLinkStatus.Pending;
            link.RequestedAtUtc = nowUtc;
            link.LastRequestAtUtc = nowUtc;
            link.RespondedAtUtc = null;
            link.RejectedUntilUtc = null;
        }

        await db.SaveChangesAsync(cancellationToken);

        await pushService.NotifyTrainerClientLinkRequestedAsync(
            link.Id,
            link.TrainerId,
            link.ClientUserId,
            cancellationToken);

        return await GetByIdForTrainerAsync(trainerUserId, link.Id, cancellationToken);
    }

    public async Task<ServiceResult<TrainerClientLinkDto>> AcceptAsync(
        Guid clientUserId,
        Guid linkId,
        CancellationToken cancellationToken)
    {
        var link = await db.TrainerClientLinks
            .FirstOrDefaultAsync(x => x.Id == linkId, cancellationToken);
        if (link is null)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status404NotFound,
                "Link not found",
                "Link request does not exist.");
        }

        if (link.ClientUserId != clientUserId)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Link request does not belong to this client.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
        }

        if (link.Status != TrainerClientLinkStatus.Pending)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid state transition",
                "Only pending link requests can be accepted.");
        }

        link.Status = TrainerClientLinkStatus.Accepted;
        link.RespondedAtUtc = DateTime.UtcNow;
        link.RejectedUntilUtc = null;
        await db.SaveChangesAsync(cancellationToken);

        await pushService.NotifyTrainerClientLinkAcceptedAsync(
            link.Id,
            link.TrainerId,
            link.ClientUserId,
            cancellationToken);

        return await GetByIdForClientAsync(clientUserId, link.Id, cancellationToken);
    }

    public async Task<ServiceResult<TrainerClientLinkDto>> RejectAsync(
        Guid clientUserId,
        Guid linkId,
        CancellationToken cancellationToken)
    {
        var link = await db.TrainerClientLinks
            .FirstOrDefaultAsync(x => x.Id == linkId, cancellationToken);
        if (link is null)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status404NotFound,
                "Link not found",
                "Link request does not exist.");
        }

        if (link.ClientUserId != clientUserId)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Link request does not belong to this client.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
        }

        if (link.Status != TrainerClientLinkStatus.Pending)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid state transition",
                "Only pending link requests can be rejected.");
        }

        var nowUtc = DateTime.UtcNow;
        link.Status = TrainerClientLinkStatus.Rejected;
        link.RespondedAtUtc = nowUtc;
        link.RejectedUntilUtc = nowUtc.Add(RejectCooldown);
        await db.SaveChangesAsync(cancellationToken);

        await pushService.NotifyTrainerClientLinkRejectedAsync(
            link.Id,
            link.TrainerId,
            link.ClientUserId,
            cancellationToken);

        return await GetByIdForClientAsync(clientUserId, link.Id, cancellationToken);
    }

    public async Task<ServiceResult<bool>> RevokeByTrainerAsync(
        Guid trainerUserId,
        Guid linkId,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var link = await db.TrainerClientLinks
            .FirstOrDefaultAsync(x => x.Id == linkId, cancellationToken);
        if (link is null || link.TrainerId != trainerId.Value)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status404NotFound,
                "Link not found",
                "Link request does not exist.");
        }

        if (link.Status == TrainerClientLinkStatus.Revoked)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status409Conflict,
                "Already revoked",
                "Link request is already revoked.");
        }

        link.Status = TrainerClientLinkStatus.Revoked;
        link.RespondedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<bool>> RevokeByClientAsync(
        Guid clientUserId,
        Guid linkId,
        CancellationToken cancellationToken)
    {
        var link = await db.TrainerClientLinks
            .FirstOrDefaultAsync(x => x.Id == linkId, cancellationToken);
        if (link is null || link.ClientUserId != clientUserId)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status404NotFound,
                "Link not found",
                "Link request does not exist.");
        }

        if (link.Status == TrainerClientLinkStatus.Revoked)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status409Conflict,
                "Already revoked",
                "Link request is already revoked.");
        }

        link.Status = TrainerClientLinkStatus.Revoked;
        link.RespondedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Success(true);
    }

    public async Task<ServiceResult<IReadOnlyList<TrainerClientLinkDto>>> GetTrainerLinksAsync(
        Guid trainerUserId,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return ServiceResult<IReadOnlyList<TrainerClientLinkDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var items = await QueryLinks()
            .Where(x => x.TrainerId == trainerId.Value && x.Status != TrainerClientLinkStatus.Revoked)
            .OrderByDescending(x => x.RequestedAtUtc)
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<TrainerClientLinkDto>>.Success(items.Select(ToDto).ToList());
    }

    public async Task<ServiceResult<IReadOnlyList<TrainerClientLinkDto>>> GetClientPendingRequestsAsync(
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        var items = await QueryLinks()
            .Where(x => x.ClientUserId == clientUserId && x.Status == TrainerClientLinkStatus.Pending)
            .OrderByDescending(x => x.RequestedAtUtc)
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<TrainerClientLinkDto>>.Success(items.Select(ToDto).ToList());
    }

    public async Task<ServiceResult<IReadOnlyList<TrainerClientLinkDto>>> GetClientAcceptedLinksAsync(
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        var items = await QueryLinks()
            .Where(x => x.ClientUserId == clientUserId && x.Status == TrainerClientLinkStatus.Accepted)
            .OrderByDescending(x => x.RequestedAtUtc)
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<TrainerClientLinkDto>>.Success(items.Select(ToDto).ToList());
    }

    public async Task<ServiceResult<PendingCountDto>> GetPendingLinkRequestsCountAsync(
        Guid clientUserId,
        CancellationToken cancellationToken)
    {
        var count = await db.TrainerClientLinks
            .AsNoTracking()
            .CountAsync(
                x => x.ClientUserId == clientUserId && x.Status == TrainerClientLinkStatus.Pending,
                cancellationToken);

        return ServiceResult<PendingCountDto>.Success(new PendingCountDto(count));
    }

    public async Task<bool> HasAcceptedLinkAsync(
        Guid trainerId,
        Guid clientUserId,
        CancellationToken cancellationToken)
        => await db.TrainerClientLinks
            .AsNoTracking()
            .AnyAsync(
                x => x.TrainerId == trainerId
                    && x.ClientUserId == clientUserId
                    && x.Status == TrainerClientLinkStatus.Accepted,
                cancellationToken);

    public async Task<ServiceResult<TrainerClientLinkDto>> GetByIdForClientAsync(
        Guid clientUserId,
        Guid linkId,
        CancellationToken cancellationToken)
    {
        var item = await QueryLinks()
            .FirstOrDefaultAsync(x => x.Id == linkId && x.ClientUserId == clientUserId, cancellationToken);
        if (item is null)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status404NotFound,
                "Link not found",
                "Link request does not exist.");
        }

        return ServiceResult<TrainerClientLinkDto>.Success(ToDto(item));
    }

    public async Task<ServiceResult<TrainerClientLinkDto>> GetByIdForTrainerAsync(
        Guid trainerUserId,
        Guid linkId,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return NotFoundTrainer();
        }

        var item = await QueryLinks()
            .FirstOrDefaultAsync(x => x.Id == linkId && x.TrainerId == trainerId.Value, cancellationToken);
        if (item is null)
        {
            return ServiceResult<TrainerClientLinkDto>.Fail(
                StatusCodes.Status404NotFound,
                "Link not found",
                "Link request does not exist.");
        }

        return ServiceResult<TrainerClientLinkDto>.Success(ToDto(item));
    }

    private IQueryable<TrainerClientLinkView> QueryLinks()
        => db.TrainerClientLinks
            .AsNoTracking()
            .Select(x => new TrainerClientLinkView
            {
                Id = x.Id,
                TrainerId = x.TrainerId,
                ClientUserId = x.ClientUserId,
                Status = x.Status,
                RequestedAtUtc = x.RequestedAtUtc,
                RespondedAtUtc = x.RespondedAtUtc,
                LastRequestAtUtc = x.LastRequestAtUtc,
                RejectedUntilUtc = x.RejectedUntilUtc,
                TrainerName = x.TrainerProfile != null && x.TrainerProfile.User != null ? x.TrainerProfile.User.Name : null,
                TrainerCityName = x.TrainerProfile != null && x.TrainerProfile.City != null ? x.TrainerProfile.City.Name : null,
                ClientName = x.ClientUser != null ? x.ClientUser.Name : null,
                ClientPhone = x.ClientUser != null ? x.ClientUser.PhoneNumber : null
            });

    private async Task<Guid?> ResolveTrainerProfileIdAsync(Guid trainerUserId, CancellationToken cancellationToken)
        => await db.TrainerProfiles
            .AsNoTracking()
            .Where(x => x.UserId == trainerUserId)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

    private static TrainerClientLinkDto ToDto(TrainerClientLinkView view)
        => new(
            view.Id,
            view.TrainerId,
            view.ClientUserId,
            view.Status.ToString(),
            view.RequestedAtUtc,
            view.RespondedAtUtc,
            view.LastRequestAtUtc,
            view.RejectedUntilUtc,
            view.TrainerName,
            view.TrainerCityName,
            view.ClientName,
            view.ClientPhone);

    private static ServiceResult<TrainerClientLinkDto> NotFoundTrainer()
        => ServiceResult<TrainerClientLinkDto>.Fail(
            StatusCodes.Status404NotFound,
            "Trainer profile not found",
            "Trainer profile is not available for this user.");

    private sealed class TrainerClientLinkView
    {
        public Guid Id { get; init; }
        public Guid TrainerId { get; init; }
        public Guid ClientUserId { get; init; }
        public TrainerClientLinkStatus Status { get; init; }
        public DateTime RequestedAtUtc { get; init; }
        public DateTime? RespondedAtUtc { get; init; }
        public DateTime LastRequestAtUtc { get; init; }
        public DateTime? RejectedUntilUtc { get; init; }
        public string? TrainerName { get; init; }
        public string? TrainerCityName { get; init; }
        public string? ClientName { get; init; }
        public string? ClientPhone { get; init; }
    }
}
