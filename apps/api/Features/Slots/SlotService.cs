using Api.Data;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Slots;

public sealed class SlotService(AppDbContext db)
{
    public async Task<ServiceResult<SlotDto>> CreateSlotAsync(
        Guid trainerId,
        CreateSlotRequest request,
        CancellationToken cancellationToken)
    {
        if (request.StartsAtUtc == default)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid start time",
                "StartsAtUtc is required.");
        }

        if (request.StartsAtUtc.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid start time",
                "StartsAtUtc must be in UTC.");
        }

        if (request.DurationMinutes <= 0)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid duration",
                "DurationMinutes must be greater than 0.");
        }

        var normalizedStart = request.StartsAtUtc;
        var nowUtc = DateTime.UtcNow;
        if (normalizedStart <= nowUtc)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid start time",
                "StartsAtUtc must be in the future.");
        }

        var trainerProfile = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.Id == trainerId)
            .Select(t => new { t.Id, t.PricePerSession })
            .FirstOrDefaultAsync(cancellationToken);
        if (trainerProfile is null)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer not found",
                "Trainer does not exist.");
        }

        var newEnd = normalizedStart.AddMinutes(request.DurationMinutes);
        var existingSlots = await db.TrainingSlots
            .Where(s => s.TrainerId == trainerId
                && (s.Status == TrainingSlotStatus.Open || s.Status == TrainingSlotStatus.Booked))
            .ToListAsync(cancellationToken);

        if (existingSlots.Any(slot => Overlaps(normalizedStart, newEnd, slot)))
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status409Conflict,
                "Overlapping slot",
                "Trainer already has a slot that overlaps with the requested time.");
        }

        var entity = new TrainingSlot
        {
            Id = Guid.NewGuid(),
            TrainerId = trainerId,
            StartsAtUtc = normalizedStart,
            DurationMinutes = request.DurationMinutes,
            Status = TrainingSlotStatus.Open,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.TrainingSlots.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        return ServiceResult<SlotDto>.Success(ToDto(entity, null, null, trainerProfile.PricePerSession));
    }

    public async Task<ServiceResult<IReadOnlyList<SlotDto>>> GetSlotsAsync(
        Guid trainerId,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var trainerProfile = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.Id == trainerId)
            .Select(t => new { t.Id, t.PricePerSession })
            .FirstOrDefaultAsync(cancellationToken);
        if (trainerProfile is null)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer not found",
                "Trainer does not exist.");
        }

        if (fromUtc.HasValue && fromUtc.Value.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid fromUtc",
                "fromUtc must be in UTC.");
        }

        if (toUtc.HasValue && toUtc.Value.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid toUtc",
                "toUtc must be in UTC.");
        }

        var normalizedFrom = fromUtc ?? DateTime.UtcNow;
        var normalizedTo = toUtc ?? normalizedFrom.AddDays(30);

        if (normalizedFrom > normalizedTo)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid range",
                "fromUtc must be earlier than or equal to toUtc.");
        }

        var query = db.TrainingSlots
            .Include(s => s.Booking)
            .Where(s => s.TrainerId == trainerId);
        query = query.Where(s => s.StartsAtUtc >= normalizedFrom && s.StartsAtUtc <= normalizedTo);

        var slots = await query
            .OrderBy(s => s.StartsAtUtc)
            .ToListAsync(cancellationToken);

        if (slots.Count == 0)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Success([]);
        }

        var clientIds = slots
            .Where(slot => slot.Booking is not null)
            .Select(slot => slot.Booking!.ClientId)
            .Distinct()
            .ToList();

        Dictionary<Guid, string> clientNames = [];
        HashSet<Guid> clientAvatarIds = [];

        if (clientIds.Count > 0)
        {
            clientNames = await db.Users
                .AsNoTracking()
                .Where(user => clientIds.Contains(user.Id))
                .Select(user => new { user.Id, user.Name })
                .ToDictionaryAsync(entry => entry.Id, entry => entry.Name, cancellationToken);

            clientAvatarIds = await db.UserAvatars
                .AsNoTracking()
                .Where(avatar => clientIds.Contains(avatar.UserId))
                .Select(avatar => avatar.UserId)
                .ToHashSetAsync(cancellationToken);
        }

        var dtos = slots.Select(slot =>
        {
            string? clientName = null;
            string? clientAvatarUrl = null;

            var clientId = slot.Booking?.ClientId;
            if (clientId.HasValue && clientNames.TryGetValue(clientId.Value, out var name))
            {
                clientName = name;
                if (clientAvatarIds.Contains(clientId.Value))
                {
                    clientAvatarUrl = $"/users/{clientId.Value}/avatar";
                }
            }

            return ToDto(slot, clientName, clientAvatarUrl, trainerProfile.PricePerSession);
        }).ToList();

        return ServiceResult<IReadOnlyList<SlotDto>>.Success(dtos);
    }

    private static bool Overlaps(DateTime newStart, DateTime newEnd, TrainingSlot existing)
    {
        var existingStart = existing.StartsAtUtc.Kind == DateTimeKind.Utc
            ? existing.StartsAtUtc
            : NormalizeUtc(existing.StartsAtUtc);
        var existingEnd = existingStart.AddMinutes(existing.DurationMinutes);
        return newStart < existingEnd && existingStart < newEnd;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    private static SlotDto ToDto(
        TrainingSlot slot,
        string? clientName,
        string? clientAvatarUrl,
        int? trainerPricePerSession)
        => new(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.Status.ToString(),
            slot.Booking?.Status.ToString(),
            slot.CreatedAtUtc,
            clientName,
            clientAvatarUrl,
            trainerPricePerSession);
}
