using Api.Data;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.TrainerClients;

public sealed class TrainerClientService(AppDbContext db)
{
    public async Task<ServiceResult<TrainerClientDto>> CreateAsync(
        Guid trainerUserId,
        CreateTrainerClientRequest request,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return NotFoundTrainer();
        }

        var nowUtc = DateTime.UtcNow;
        var entity = new TrainerClient
        {
            Id = Guid.NewGuid(),
            TrainerId = trainerProfileId.Value,
            DisplayName = request.DisplayName!.Trim(),
            Phone = NormalizeOptional(request.Phone),
            Notes = NormalizeOptional(request.Notes),
            Status = TrainerClientStatus.Active,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc
        };

        db.TrainerClients.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConflict(ex))
        {
            return ServiceResult<TrainerClientDto>.Fail(
                StatusCodes.Status409Conflict,
                "Trainer client conflict",
                "Trainer client with this value already exists.",
                new Dictionary<string, object?> { ["errorCode"] = "invalid_state_transition" });
        }

        return ServiceResult<TrainerClientDto>.Success(ToDto(entity));
    }

    public async Task<ServiceResult<IReadOnlyList<TrainerClientDto>>> GetListAsync(
        Guid trainerUserId,
        string? status,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<IReadOnlyList<TrainerClientDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        TrainerClientStatus? filter = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<TrainerClientStatus>(status, true, out var parsed))
            {
                return ServiceResult<IReadOnlyList<TrainerClientDto>>.Fail(
                    StatusCodes.Status400BadRequest,
                    "Invalid status",
                    "Status must be Active or Archived.");
            }

            filter = parsed;
        }

        var query = db.TrainerClients
            .AsNoTracking()
            .Where(x => x.TrainerId == trainerProfileId.Value);

        if (filter.HasValue)
        {
            query = query.Where(x => x.Status == filter.Value);
        }

        var items = await query
            .OrderBy(x => x.DisplayName)
            .ThenBy(x => x.CreatedAtUtc)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<TrainerClientDto>>.Success(items);
    }

    public async Task<ServiceResult<TrainerClientDto>> UpdateAsync(
        Guid trainerUserId,
        Guid id,
        UpdateTrainerClientRequest request,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return NotFoundTrainer();
        }

        var entity = await db.TrainerClients
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null || entity.TrainerId != trainerProfileId.Value)
        {
            return ServiceResult<TrainerClientDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer client not found",
                "Trainer client does not exist.");
        }

        if (request.DisplayName is not null)
        {
            entity.DisplayName = request.DisplayName.Trim();
        }

        if (request.Phone is not null)
        {
            entity.Phone = NormalizeOptional(request.Phone);
        }

        if (request.Notes is not null)
        {
            entity.Notes = NormalizeOptional(request.Notes);
        }

        if (request.Status is not null)
        {
            if (!Enum.TryParse<TrainerClientStatus>(request.Status, true, out var status))
            {
                return ServiceResult<TrainerClientDto>.Fail(
                    StatusCodes.Status400BadRequest,
                    "Invalid status",
                    "Status must be Active or Archived.");
            }

            entity.Status = status;
        }

        entity.UpdatedAtUtc = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConflict(ex))
        {
            return ServiceResult<TrainerClientDto>.Fail(
                StatusCodes.Status409Conflict,
                "Trainer client conflict",
                "Trainer client with this value already exists.",
                new Dictionary<string, object?> { ["errorCode"] = "invalid_state_transition" });
        }

        return ServiceResult<TrainerClientDto>.Success(ToDto(entity));
    }

    public async Task<ServiceResult<TrainerClientDto>> LinkAsync(
        Guid trainerUserId,
        Guid id,
        Guid linkedUserId,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return NotFoundTrainer();
        }

        var entity = await db.TrainerClients
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null || entity.TrainerId != trainerProfileId.Value)
        {
            return ServiceResult<TrainerClientDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer client not found",
                "Trainer client does not exist.");
        }

        var linkedUser = await db.Users
            .AsNoTracking()
            .Where(x => x.Id == linkedUserId)
            .Select(x => new { x.Id, x.Role })
            .FirstOrDefaultAsync(cancellationToken);
        if (linkedUser is null || !string.Equals(linkedUser.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<TrainerClientDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid linked user",
                "Linked user must exist and have Client role.");
        }

        var hasLinkConflict = await db.TrainerClients
            .AsNoTracking()
            .AnyAsync(
                x => x.TrainerId == trainerProfileId.Value
                    && x.LinkedUserId == linkedUserId
                    && x.Id != id,
                cancellationToken);
        if (hasLinkConflict)
        {
            return ServiceResult<TrainerClientDto>.Fail(
                StatusCodes.Status409Conflict,
                "Trainer client conflict",
                "This user is already linked to another trainer client.",
                new Dictionary<string, object?> { ["errorCode"] = "invalid_state_transition" });
        }

        entity.LinkedUserId = linkedUserId;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return ServiceResult<TrainerClientDto>.Success(ToDto(entity));
    }

    private async Task<Guid?> ResolveTrainerProfileIdAsync(Guid trainerUserId, CancellationToken cancellationToken)
        => await db.TrainerProfiles
            .AsNoTracking()
            .Where(x => x.UserId == trainerUserId)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

    private static string? NormalizeOptional(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static TrainerClientDto ToDto(TrainerClient entity)
        => new(
            entity.Id,
            entity.TrainerId,
            entity.LinkedUserId,
            entity.DisplayName,
            entity.Phone,
            entity.Notes,
            entity.Status.ToString(),
            entity.CreatedAtUtc,
            entity.UpdatedAtUtc);

    private static ServiceResult<TrainerClientDto> NotFoundTrainer()
        => ServiceResult<TrainerClientDto>.Fail(
            StatusCodes.Status404NotFound,
            "Trainer profile not found",
            "Trainer profile is not available for this user.");

    private static bool IsUniqueConflict(DbUpdateException exception)
    {
        var current = exception as Exception;
        while (current is not null)
        {
            if (current is Npgsql.PostgresException postgresException
                && postgresException.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }

            current = current.InnerException;
        }

        return false;
    }
}
