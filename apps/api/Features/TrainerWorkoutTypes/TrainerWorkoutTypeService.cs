using System.Text;
using Api.Data;
using Api.Features.Common;
using Api.Features.WorkoutTypes;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.TrainerWorkoutTypes;

public sealed class TrainerWorkoutTypeService(AppDbContext db)
{
    private const int ActiveCustomLimit = 40;
    private static readonly TimeSpan EditWindowAfterStart = TimeSpan.FromMinutes(15);

    private static readonly (string Name, WorkoutTypeCategory Category)[] SystemTypes =
    [
        ("Все тело", WorkoutTypeCategory.Strength),
        ("Сплит", WorkoutTypeCategory.Strength),
        ("Грудь", WorkoutTypeCategory.Strength),
        ("Спина", WorkoutTypeCategory.Strength),
        ("Ноги", WorkoutTypeCategory.Strength),
        ("Плечи", WorkoutTypeCategory.Strength),
        ("Руки", WorkoutTypeCategory.Strength),
        ("Кор", WorkoutTypeCategory.Strength),
        ("Кардио", WorkoutTypeCategory.Cardio),
        ("Мобильность", WorkoutTypeCategory.Mobility),
        ("Реабилитация", WorkoutTypeCategory.Rehab),
        ("Техника", WorkoutTypeCategory.Technique)
    ];

    public static IReadOnlyList<(string Name, WorkoutTypeCategory Category)> GetSystemTypeCatalog() => SystemTypes;

    public async Task<ServiceResult<IReadOnlyList<TrainerWorkoutTypeDto>>> GetTrainerWorkoutTypesAsync(
        Guid trainerUserId,
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return NotFoundTrainerList();
        }

        await EnsureSystemTypesAsync(trainerId.Value, cancellationToken);

        var query = db.TrainerWorkoutTypes
            .AsNoTracking()
            .Where(x => x.TrainerId == trainerId.Value);

        if (!includeArchived)
        {
            query = query.Where(x => !x.IsArchived);
        }

        var items = await query
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Name)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);

        return ServiceResult<IReadOnlyList<TrainerWorkoutTypeDto>>.Success(items);
    }

    public async Task<ServiceResult<TrainerWorkoutTypeDto>> CreateCustomAsync(
        Guid trainerUserId,
        string name,
        string? categoryRaw,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return NotFoundTrainer();
        }

        await EnsureSystemTypesAsync(trainerId.Value, cancellationToken);

        var parsedCategory = ParseCategoryOrDefault(categoryRaw);
        if (!parsedCategory.IsSuccess)
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                parsedCategory.Error!.StatusCode,
                parsedCategory.Error.Title,
                parsedCategory.Error.Detail);
        }

        var normalizedName = NormalizeDisplayName(name);
        var normalizeKey = NormalizeKey(normalizedName);
        if (normalizedName.Length == 0)
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid name",
                "Name is required.");
        }

        if (normalizedName.Length > 40)
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid name",
                "Name must be at most 40 characters.");
        }

        var activeCustomCount = await db.TrainerWorkoutTypes
            .AsNoTracking()
            .CountAsync(x => x.TrainerId == trainerId.Value && !x.IsSystem && !x.IsArchived, cancellationToken);
        if (activeCustomCount >= ActiveCustomLimit)
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                StatusCodes.Status409Conflict,
                "Workout types limit reached",
                $"Active custom workout types limit is {ActiveCustomLimit}.",
                new Dictionary<string, object?> { ["errorCode"] = "workout_type_limit_reached", ["limit"] = ActiveCustomLimit });
        }

        var entity = new TrainerWorkoutType
        {
            Id = Guid.NewGuid(),
            TrainerId = trainerId.Value,
            Name = normalizedName,
            NormalizeKey = normalizeKey,
            Category = parsedCategory.Value,
            IsSystem = false,
            IsArchived = false,
            CreatedAtUtc = DateTime.UtcNow
        };

        db.TrainerWorkoutTypes.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConflict(ex))
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                StatusCodes.Status409Conflict,
                "Workout type already exists",
                "Workout type with this name already exists.",
                new Dictionary<string, object?> { ["errorCode"] = "duplicate_workout_type_name" });
        }

        return ServiceResult<TrainerWorkoutTypeDto>.Success(ToDto(entity));
    }

    public async Task<ServiceResult<TrainerWorkoutTypeDto>> ArchiveCustomAsync(
        Guid trainerUserId,
        Guid workoutTypeId,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return NotFoundTrainer();
        }

        var entity = await db.TrainerWorkoutTypes
            .FirstOrDefaultAsync(x => x.Id == workoutTypeId, cancellationToken);
        if (entity is null || entity.TrainerId != trainerId.Value)
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                StatusCodes.Status404NotFound,
                "Workout type not found",
                "Workout type does not exist.");
        }

        if (entity.IsSystem)
        {
            return ServiceResult<TrainerWorkoutTypeDto>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "System workout types cannot be archived.",
                new Dictionary<string, object?> { ["errorCode"] = "system_workout_type_immutable" });
        }

        if (!entity.IsArchived)
        {
            entity.IsArchived = true;
            await db.SaveChangesAsync(cancellationToken);
        }

        return ServiceResult<TrainerWorkoutTypeDto>.Success(ToDto(entity));
    }

    public async Task<ServiceResult<SetBookingWorkoutTypeResponse>> SetBookingWorkoutTypeAsync(
        Guid trainerUserId,
        Guid bookingId,
        Guid? workoutTypeId,
        CancellationToken cancellationToken)
    {
        var trainerId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerId.HasValue)
        {
            return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        var booking = await db.Bookings
            .Include(b => b.Slot)
            .Include(b => b.WorkoutType)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        if (booking is null || booking.Slot is null)
        {
            return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        if (booking.Slot.TrainerId != trainerId.Value)
        {
            return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Booking does not belong to this trainer.",
                new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
        }

        var nowUtc = DateTime.UtcNow;
        if (nowUtc > booking.Slot.StartsAtUtc.Add(EditWindowAfterStart))
        {
            return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                StatusCodes.Status409Conflict,
                "Too late to edit workout type",
                "Workout type can be changed before start and within 15 minutes after start.",
                new Dictionary<string, object?> { ["errorCode"] = "workout_type_edit_window_closed" });
        }

        if (workoutTypeId.HasValue)
        {
            if (booking.WorkoutTypeId == workoutTypeId.Value)
            {
                return ServiceResult<SetBookingWorkoutTypeResponse>.Success(ToSetBookingResponse(booking));
            }

            var workoutType = await db.TrainerWorkoutTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == workoutTypeId.Value, cancellationToken);
            if (workoutType is null)
            {
                return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                    StatusCodes.Status404NotFound,
                    "Workout type not found",
                    "Workout type does not exist.");
            }

            if (workoutType.TrainerId != trainerId.Value)
            {
                return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "Workout type does not belong to this trainer.",
                    new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
            }

            if (workoutType.IsArchived)
            {
                return ServiceResult<SetBookingWorkoutTypeResponse>.Fail(
                    StatusCodes.Status409Conflict,
                    "Workout type archived",
                    "Archived workout type cannot be assigned.",
                    new Dictionary<string, object?> { ["errorCode"] = "workout_type_archived" });
            }

            booking.WorkoutTypeId = workoutType.Id;
        }
        else
        {
            booking.WorkoutTypeId = null;
        }

        booking.UpdatedAtUtc = nowUtc;
        await db.SaveChangesAsync(cancellationToken);

        if (booking.WorkoutTypeId.HasValue)
        {
            booking.WorkoutType = await db.TrainerWorkoutTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == booking.WorkoutTypeId.Value, cancellationToken);
        }
        else
        {
            booking.WorkoutType = null;
        }

        return ServiceResult<SetBookingWorkoutTypeResponse>.Success(ToSetBookingResponse(booking));
    }

    public async Task EnsureSystemTypesAsync(Guid trainerId, CancellationToken cancellationToken)
    {
        var existing = await db.TrainerWorkoutTypes
            .Where(x => x.TrainerId == trainerId)
            .Select(x => x.NormalizeKey)
            .ToListAsync(cancellationToken);
        var existingKeys = existing.ToHashSet(StringComparer.Ordinal);

        var nowUtc = DateTime.UtcNow;
        var hasChanges = false;
        foreach (var (name, category) in SystemTypes)
        {
            var key = NormalizeKey(name);
            if (existingKeys.Contains(key))
            {
                continue;
            }

            db.TrainerWorkoutTypes.Add(new TrainerWorkoutType
            {
                Id = Guid.NewGuid(),
                TrainerId = trainerId,
                Name = name,
                NormalizeKey = key,
                Category = category,
                IsSystem = true,
                IsArchived = false,
                CreatedAtUtc = nowUtc
            });
            hasChanges = true;
        }

        if (!hasChanges)
        {
            return;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConflict(ex))
        {
            db.ChangeTracker.Clear();
        }
    }

    private async Task<Guid?> ResolveTrainerProfileIdAsync(Guid trainerUserId, CancellationToken cancellationToken)
        => await db.TrainerProfiles
            .AsNoTracking()
            .Where(x => x.UserId == trainerUserId)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

    private static ServiceResult<WorkoutTypeCategory> ParseCategoryOrDefault(string? categoryRaw)
    {
        if (string.IsNullOrWhiteSpace(categoryRaw))
        {
            return ServiceResult<WorkoutTypeCategory>.Success(WorkoutTypeCategory.Other);
        }

        if (!Enum.TryParse<WorkoutTypeCategory>(categoryRaw, true, out var category))
        {
            return ServiceResult<WorkoutTypeCategory>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid category",
                "Category must be Strength, Cardio, Mobility, Rehab, Technique or Other.");
        }

        return ServiceResult<WorkoutTypeCategory>.Success(category);
    }

    private static TrainerWorkoutTypeDto ToDto(TrainerWorkoutType entity)
        => new(
            entity.Id,
            entity.Name,
            entity.Category.ToString(),
            entity.IsSystem,
            entity.IsArchived);

    public static WorkoutTypeSummaryDto? ToSummaryDto(TrainerWorkoutType? entity)
        => entity is null
            ? null
            : new WorkoutTypeSummaryDto(
                entity.Id,
                entity.Name,
                entity.Category.ToString(),
                entity.IsSystem,
                entity.IsArchived);

    private static SetBookingWorkoutTypeResponse ToSetBookingResponse(Booking booking)
        => new(
            booking.Id,
            booking.WorkoutTypeId,
            ToSummaryDto(booking.WorkoutType),
            booking.UpdatedAtUtc);

    public static string NormalizeDisplayName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(value.Length);
        var wasSpace = false;
        foreach (var ch in value.Trim())
        {
            if (char.IsWhiteSpace(ch))
            {
                if (!wasSpace)
                {
                    builder.Append(' ');
                    wasSpace = true;
                }

                continue;
            }

            builder.Append(ch);
            wasSpace = false;
        }

        return builder.ToString();
    }

    public static string NormalizeKey(string value)
        => NormalizeDisplayName(value).ToLowerInvariant();

    private static ServiceResult<TrainerWorkoutTypeDto> NotFoundTrainer()
        => ServiceResult<TrainerWorkoutTypeDto>.Fail(
            StatusCodes.Status404NotFound,
            "Trainer profile not found",
            "Trainer profile is not available for this user.");

    private static ServiceResult<IReadOnlyList<TrainerWorkoutTypeDto>> NotFoundTrainerList()
        => ServiceResult<IReadOnlyList<TrainerWorkoutTypeDto>>.Fail(
            StatusCodes.Status404NotFound,
            "Trainer profile not found",
            "Trainer profile is not available for this user.");

    private static bool IsUniqueConflict(DbUpdateException exception)
    {
        for (var current = exception as Exception; current is not null; current = current.InnerException)
        {
            if (current is Npgsql.PostgresException pg && pg.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
            {
                return true;
            }
        }

        return false;
    }
}
