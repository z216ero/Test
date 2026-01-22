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
        if (request.DurationMinutes <= 0)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid duration",
                "DurationMinutes must be greater than 0.");
        }

        var normalizedStart = NormalizeUtc(request.StartsAtUtc);
        if (normalizedStart < DateTime.UtcNow)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid start time",
                "StartsAtUtc cannot be in the past.");
        }

        var trainerExists = await db.TrainerProfiles
            .AnyAsync(t => t.Id == trainerId, cancellationToken);
        if (!trainerExists)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer not found",
                "Trainer does not exist.");
        }

        var newEnd = normalizedStart.AddMinutes(request.DurationMinutes);
        var existingSlots = await db.TrainingSlots
            .Where(s => s.TrainerId == trainerId)
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

        return ServiceResult<SlotDto>.Success(ToDto(entity));
    }

    public async Task<ServiceResult<IReadOnlyList<SlotDto>>> GetSlotsAsync(
        Guid trainerId,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var trainerExists = await db.TrainerProfiles
            .AnyAsync(t => t.Id == trainerId, cancellationToken);
        if (!trainerExists)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer not found",
                "Trainer does not exist.");
        }

        DateTime? normalizedFrom = fromUtc.HasValue ? NormalizeUtc(fromUtc.Value) : null;
        DateTime? normalizedTo = toUtc.HasValue ? NormalizeUtc(toUtc.Value) : null;

        var query = db.TrainingSlots.Where(s => s.TrainerId == trainerId);
        if (normalizedFrom.HasValue)
        {
            query = query.Where(s => s.StartsAtUtc >= normalizedFrom.Value);
        }

        if (normalizedTo.HasValue)
        {
            query = query.Where(s => s.StartsAtUtc <= normalizedTo.Value);
        }

        var slots = await query
            .OrderBy(s => s.StartsAtUtc)
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<SlotDto>>.Success(slots.Select(ToDto).ToList());
    }

    private static bool Overlaps(DateTime newStart, DateTime newEnd, TrainingSlot existing)
    {
        var existingStart = NormalizeUtc(existing.StartsAtUtc);
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

    private static SlotDto ToDto(TrainingSlot slot)
        => new(
            slot.Id,
            slot.TrainerId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.Status.ToString(),
            slot.CreatedAtUtc);
}
