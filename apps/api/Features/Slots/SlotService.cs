using System.Data;
using Api.Data;
using Api.Features.Bookings;
using Api.Features.Common;
using Api.Features.Push;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Api.Features.Slots;

public sealed class SlotService(AppDbContext db, PushService pushService)
{
    public SlotService(AppDbContext db)
        : this(db, CreateNoOpPushService(db))
    {
    }

    public Task<ServiceResult<SlotDto>> CreateSlotAsync(
        Guid trainerId,
        CreateSlotRequest request,
        CancellationToken cancellationToken)
        => CreateSlotAsync(trainerId, actorUserId: null, actorRole: null, request, cancellationToken);

    public async Task<ServiceResult<SlotDto>> CreateSlotAsync(
        Guid trainerId,
        Guid? actorUserId,
        string? actorRole,
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

        if (!TryResolveSlotType(request.SlotType, out var slotType))
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid slot type",
                "SlotType must be Individual or Group.");
        }

        var hasAssignment = request.AssignToClientId.HasValue || request.AssignToTrainerClientId.HasValue;
        if (hasAssignment && !BookingConflictChecker.HasExactlyOneClientIdentity(request.AssignToClientId, request.AssignToTrainerClientId))
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid assignment",
                "Exactly one of assignToClientId or assignToTrainerClientId must be provided.");
        }

        if (hasAssignment && slotType != TrainingSlotType.Individual)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid assignment",
                "Assignment is only supported for individual slots.");
        }

        var capacityValidation = ValidateCapacity(slotType, request.CapacityMin, request.CapacityMax);
        if (capacityValidation is not null)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid capacity",
                capacityValidation);
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

        var autoCancelValidation = ValidateGroupAutoCancellation(
            slotType,
            request.AutoCancelIfMinNotReached,
            normalizedStart,
            nowUtc);
        if (autoCancelValidation is not null)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid auto-cancellation settings",
                autoCancelValidation);
        }

        var trainerProfile = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.Id == trainerId)
            .Select(t => new { t.Id, t.UserId, t.PricePerSession, t.TrainingTypes })
            .FirstOrDefaultAsync(cancellationToken);
        if (trainerProfile is null)
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer not found",
                "Trainer does not exist.");
        }

        if (actorUserId.HasValue)
        {
            if (!string.Equals(actorRole, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "Only trainers can create slots.",
                    new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
            }

            if (trainerProfile.UserId != actorUserId.Value)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "Trainer can only create own slots.",
                    new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
            }
        }

        if (slotType == TrainingSlotType.Group
            && (trainerProfile.TrainingTypes?.Any(x => string.Equals(x, "Group", StringComparison.OrdinalIgnoreCase)) != true))
        {
            return ServiceResult<SlotDto>.Fail(
                StatusCodes.Status409Conflict,
                "Group training is disabled",
                "Enable group trainings in profile before creating group slots.");
        }

        string? assignedClientName = null;
        string? assignedClientAvatarUrl = null;
        Guid? assignedClientId = null;
        Guid? assignedTrainerClientId = null;

        if (request.AssignToClientId.HasValue)
        {
            assignedClientId = request.AssignToClientId.Value;
            var assignedUser = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == assignedClientId.Value)
                .Select(u => new { u.Id, u.Role, u.Name })
                .FirstOrDefaultAsync(cancellationToken);
            if (assignedUser is null || !string.Equals(assignedUser.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status400BadRequest,
                    "Invalid client",
                    "assignToClientId must reference an existing Client user.");
            }

            assignedClientName = assignedUser.Name;

            var hasAvatar = await db.UserAvatars
                .AsNoTracking()
                .AnyAsync(a => a.UserId == assignedClientId.Value, cancellationToken);
            if (hasAvatar)
            {
                assignedClientAvatarUrl = $"/users/{assignedClientId.Value}/avatar";
            }
        }
        else if (request.AssignToTrainerClientId.HasValue)
        {
            assignedTrainerClientId = request.AssignToTrainerClientId.Value;
            var trainerClient = await db.TrainerClients
                .AsNoTracking()
                .Where(tc => tc.Id == assignedTrainerClientId.Value)
                .Select(tc => new { tc.Id, tc.TrainerId, tc.DisplayName })
                .FirstOrDefaultAsync(cancellationToken);
            if (trainerClient is null || trainerClient.TrainerId != trainerId)
            {
                return ServiceResult<SlotDto>.Fail(
                    StatusCodes.Status403Forbidden,
                    "Forbidden",
                    "assignToTrainerClientId does not belong to this trainer.",
                    new Dictionary<string, object?> { ["errorCode"] = "forbidden" });
            }

            assignedClientName = trainerClient.DisplayName;
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

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

            if (hasAssignment)
            {
                var conflict = await BookingConflictChecker.FindTimeConflictAsync(
                    db,
                    assignedClientId,
                    assignedTrainerClientId,
                    currentSlotId: null,
                    normalizedStart,
                    newEnd,
                    cancellationToken);
                if (conflict is not null)
                {
                    return ServiceResult<SlotDto>.Fail(
                        StatusCodes.Status409Conflict,
                        "Booking time conflict",
                        "У этого клиента уже есть запись на это время.",
                        new Dictionary<string, object?>
                        {
                            ["errorCode"] = "booking_time_conflict",
                            ["conflictStartsAtUtc"] = conflict.Value.StartsAtUtc.ToString("O")
                        });
                }
            }

            var entity = new TrainingSlot
            {
                Id = Guid.NewGuid(),
                TrainerId = trainerId,
                StartsAtUtc = normalizedStart,
                DurationMinutes = request.DurationMinutes,
                SlotType = slotType,
                CapacityMin = slotType == TrainingSlotType.Group ? request.CapacityMin : null,
                CapacityMax = slotType == TrainingSlotType.Group ? request.CapacityMax : null,
                AutoCancelIfMinNotReached = slotType == TrainingSlotType.Group && request.AutoCancelIfMinNotReached,
                AutoCancelAtUtc = slotType == TrainingSlotType.Group && request.AutoCancelIfMinNotReached
                    ? normalizedStart.AddMinutes(-GroupSlotAutoCancellationService.AutoCancelLeadMinutes)
                    : null,
                Status = hasAssignment ? TrainingSlotStatus.Booked : TrainingSlotStatus.Open,
                CreatedAtUtc = DateTime.UtcNow
            };

            db.TrainingSlots.Add(entity);

            if (hasAssignment)
            {
                var booking = new Booking
                {
                    Id = Guid.NewGuid(),
                    SlotId = entity.Id,
                    ClientId = assignedClientId,
                    TrainerClientId = assignedTrainerClientId,
                    Status = BookingStatus.Booked,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                db.Bookings.Add(booking);
                db.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    BookingId = booking.Id,
                    Amount = trainerProfile.PricePerSession ?? 0,
                    Status = PaymentStatus.Pending,
                    Method = null,
                    PaidAtUtc = null,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            if (assignedClientId.HasValue)
            {
                await pushService.NotifyBookingCreatedAsync(
                    entity.Id,
                    trainerId,
                    assignedClientId.Value,
                    normalizedStart,
                    cancellationToken);
            }

            return ServiceResult<SlotDto>.Success(
                ToDto(entity, assignedClientName, assignedClientAvatarUrl, trainerProfile.PricePerSession));
        });
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

        var slots = await db.TrainingSlots
            .Include(s => s.Booking)
            .Include(s => s.Attendees)
            .Where(s => s.TrainerId == trainerId
                && s.StartsAtUtc >= normalizedFrom
                && s.StartsAtUtc <= normalizedTo)
            .OrderBy(s => s.StartsAtUtc)
            .ToListAsync(cancellationToken);

        var filtered = slots
            .Where(slot => !ShouldHideFromTrainerList(slot))
            .ToList();

        if (filtered.Count == 0)
        {
            return ServiceResult<IReadOnlyList<SlotDto>>.Success([]);
        }

        var clientIds = filtered
            .Where(slot => slot.SlotType == TrainingSlotType.Individual
                && slot.Booking is not null
                && slot.Booking.ClientId.HasValue)
            .Select(slot => slot.Booking!.ClientId!.Value)
            .Distinct()
            .ToList();

        var trainerClientIds = filtered
            .Where(slot => slot.SlotType == TrainingSlotType.Individual
                && slot.Booking is not null
                && slot.Booking.TrainerClientId.HasValue)
            .Select(slot => slot.Booking!.TrainerClientId!.Value)
            .Distinct()
            .ToList();

        Dictionary<Guid, string> clientNames = [];
        Dictionary<Guid, string> trainerClientNames = [];
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

        if (trainerClientIds.Count > 0)
        {
            trainerClientNames = await db.TrainerClients
                .AsNoTracking()
                .Where(tc => trainerClientIds.Contains(tc.Id))
                .Select(tc => new { tc.Id, tc.DisplayName })
                .ToDictionaryAsync(x => x.Id, x => x.DisplayName, cancellationToken);
        }

        var dtos = filtered.Select(slot =>
        {
            string? clientName = null;
            string? clientAvatarUrl = null;

            var clientId = slot.Booking?.ClientId;
            if (slot.SlotType == TrainingSlotType.Individual
                && clientId.HasValue
                && clientNames.TryGetValue(clientId.Value, out var name))
            {
                clientName = name;
                if (clientAvatarIds.Contains(clientId.Value))
                {
                    clientAvatarUrl = $"/users/{clientId.Value}/avatar";
                }
            }
            else if (slot.SlotType == TrainingSlotType.Individual
                && slot.Booking?.TrainerClientId is Guid trainerClientId
                && trainerClientNames.TryGetValue(trainerClientId, out var trainerClientName))
            {
                clientName = trainerClientName;
            }

            return ToDto(slot, clientName, clientAvatarUrl, trainerProfile.PricePerSession);
        }).ToList();

        return ServiceResult<IReadOnlyList<SlotDto>>.Success(dtos);
    }

    public async Task<ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>> GetAvailableSlotsAsync(
        DateTime? fromUtc,
        DateTime? toUtc,
        IReadOnlyList<string>? specializations,
        Gender? preferredTrainerGender,
        Gender? clientGender,
        int? clientCityId,
        int? clientDistrictId,
        bool districtOnly,
        Guid? clientUserId,
        CancellationToken cancellationToken)
    {
        if (fromUtc.HasValue && fromUtc.Value.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid fromUtc",
                "fromUtc must be in UTC.");
        }

        if (toUtc.HasValue && toUtc.Value.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid toUtc",
                "toUtc must be in UTC.");
        }

        var normalizedFrom = fromUtc ?? DateTime.UtcNow;
        var normalizedTo = toUtc ?? normalizedFrom.AddDays(30);

        if (normalizedFrom > normalizedTo)
        {
            return ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid range",
                "fromUtc must be earlier than or equal to toUtc.");
        }

        var nowUtc = DateTime.UtcNow;

        if (districtOnly && !clientDistrictId.HasValue)
        {
            return ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>.Success([]);
        }

        var query = db.TrainingSlots
            .AsNoTracking()
            .Include(s => s.Booking)
            .Include(s => s.Attendees)
            .Include(s => s.TrainerProfile!)
            .ThenInclude(t => t.City)
            .Include(s => s.TrainerProfile!)
            .ThenInclude(t => t.District)
            .Include(s => s.TrainerProfile!)
            .ThenInclude(t => t.User)
            .Where(s => s.StartsAtUtc >= normalizedFrom
                && s.StartsAtUtc <= normalizedTo
                && s.StartsAtUtc >= nowUtc
                && (
                    s.Status == TrainingSlotStatus.Open
                    || (clientUserId.HasValue
                        && s.Status == TrainingSlotStatus.Booked
                        && (
                            (s.SlotType == TrainingSlotType.Individual
                                && s.Booking != null
                                && s.Booking.ClientId == clientUserId.Value
                                && s.Booking.Status == BookingStatus.Booked)
                            || (s.SlotType == TrainingSlotType.Group
                                && s.Attendees.Any(a =>
                                    a.ClientId == clientUserId.Value
                                    && a.Status == SlotAttendeeStatus.Booked))
                        ))
                ));

        if (clientCityId.HasValue)
        {
            query = query.Where(s => s.TrainerProfile != null && s.TrainerProfile.CityId == clientCityId.Value);
        }

        if (districtOnly && clientDistrictId.HasValue)
        {
            query = query.Where(s => s.TrainerProfile != null && s.TrainerProfile.DistrictId == clientDistrictId.Value);
        }

        var slots = await query
            .OrderBy(s => s.StartsAtUtc)
            .ToListAsync(cancellationToken);

        if (slots.Count == 0)
        {
            return ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>.Success([]);
        }

        var trainerUserIds = slots
            .Select(slot => slot.TrainerProfile?.UserId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var trainerAvatarIds = trainerUserIds.Count == 0
            ? new HashSet<Guid>()
            : await db.UserAvatars
                .AsNoTracking()
                .Where(avatar => trainerUserIds.Contains(avatar.UserId))
                .Select(avatar => avatar.UserId)
                .ToHashSetAsync(cancellationToken);

        var trainerIds = slots
            .Select(slot => slot.TrainerId)
            .Distinct()
            .ToList();
        var trainerRatings = await LoadTrainerRatingsAsync(trainerIds, cancellationToken);

        var specializationSet = new HashSet<string>(
            specializations
                ?.Select(value => value?.Trim())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!)
                ?? Array.Empty<string>(),
            StringComparer.OrdinalIgnoreCase);

        var results = new List<AvailableSlotGroupDto>();

        foreach (var group in slots
            .Where(slot => slot.TrainerProfile is not null && slot.TrainerProfile.User is not null)
            .GroupBy(slot => slot.TrainerProfile!.Id))
        {
            var trainer = group.First().TrainerProfile!;

            if (!MatchesGenderFilter(trainer, preferredTrainerGender, clientGender))
            {
                continue;
            }

            if (!MatchesSpecializationFilter(trainer, specializationSet))
            {
                continue;
            }

            var trainerUserId = trainer.UserId;
            var avatarUrl = trainerAvatarIds.Contains(trainerUserId)
                ? $"/users/{trainerUserId}/avatar"
                : null;

            var trainerDto = new AvailableSlotTrainerDto(
                trainer.Id,
                trainer.User!.Name,
                trainer.User!.PhoneNumber,
                avatarUrl,
                trainer.PricePerSession,
                trainer.TrainingTypes ?? Array.Empty<string>(),
                trainer.WorksWithGender.ToString(),
                trainer.User!.Gender.ToString(),
                trainerRatings.GetValueOrDefault(trainer.Id),
                trainer.City?.Name,
                trainer.District?.Name);

            var slotDtos = group
                .OrderBy(slot => slot.StartsAtUtc)
                .Select(slot => ToDto(slot, null, null, trainer.PricePerSession))
                .ToList();

            results.Add(new AvailableSlotGroupDto(trainerDto, slotDtos));
        }

        var sorted = results
            .OrderBy(group =>
                group.Slots.Min(slot => slot.StartsAtUtc))
            .ToList();

        return ServiceResult<IReadOnlyList<AvailableSlotGroupDto>>.Success(sorted);
    }

    private async Task<Dictionary<Guid, double?>> LoadTrainerRatingsAsync(
        IReadOnlyCollection<Guid> trainerIds,
        CancellationToken cancellationToken)
    {
        if (trainerIds.Count == 0)
        {
            return [];
        }

        var ratings = new Dictionary<Guid, double?>();
        foreach (var trainerId in trainerIds)
        {
            var ratingSample = await db.Bookings
                .AsNoTracking()
                .Where(b => b.Slot != null
                    && b.Slot.TrainerId == trainerId
                    && (b.Status == BookingStatus.Completed || b.Status == BookingStatus.NoShow))
                .OrderByDescending(b => b.Slot!.StartsAtUtc)
                .Take(10)
                .Select(b => b.Status)
                .ToListAsync(cancellationToken);

            if (ratingSample.Count < 5)
            {
                ratings[trainerId] = null;
                continue;
            }

            var completedCount = ratingSample.Count(status => status == BookingStatus.Completed);
            var rating = Math.Round(
                completedCount / (double)ratingSample.Count * 5,
                1,
                MidpointRounding.AwayFromZero);
            ratings[trainerId] = rating;
        }

        return ratings;
    }

    public async Task<ServiceResult<IReadOnlyList<SlotAttendeeDto>>> GetSlotAttendeesAsync(
        Guid slotId,
        Guid trainerUserId,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == trainerUserId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<IReadOnlyList<SlotAttendeeDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var slot = await db.TrainingSlots
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == slotId, cancellationToken);
        if (slot is null)
        {
            return ServiceResult<IReadOnlyList<SlotAttendeeDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Slot not found",
                "Slot does not exist.");
        }

        if (slot.TrainerId != trainerProfileId.Value)
        {
            return ServiceResult<IReadOnlyList<SlotAttendeeDto>>.Fail(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "Slot does not belong to this trainer.");
        }

        if (slot.SlotType != TrainingSlotType.Group)
        {
            return ServiceResult<IReadOnlyList<SlotAttendeeDto>>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid slot type",
                "Attendees are available only for group slots.");
        }

        var attendees = await db.SlotAttendees
            .AsNoTracking()
            .Where(a => a.SlotId == slotId)
            .OrderBy(a => a.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        if (attendees.Count == 0)
        {
            return ServiceResult<IReadOnlyList<SlotAttendeeDto>>.Success([]);
        }

        var clientIds = attendees
            .Where(x => x.ClientId.HasValue)
            .Select(x => x.ClientId!.Value)
            .Distinct()
            .ToList();
        var trainerClientIds = attendees
            .Where(x => x.TrainerClientId.HasValue)
            .Select(x => x.TrainerClientId!.Value)
            .Distinct()
            .ToList();

        var names = clientIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Users
                .AsNoTracking()
                .Where(u => clientIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Name })
                .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var trainerClientNames = trainerClientIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.TrainerClients
                .AsNoTracking()
                .Where(tc => trainerClientIds.Contains(tc.Id))
                .Select(tc => new { tc.Id, tc.DisplayName })
                .ToDictionaryAsync(x => x.Id, x => x.DisplayName, cancellationToken);

        var avatarIds = clientIds.Count == 0
            ? new HashSet<Guid>()
            : await db.UserAvatars
                .AsNoTracking()
                .Where(x => clientIds.Contains(x.UserId))
                .Select(x => x.UserId)
                .ToHashSetAsync(cancellationToken);

        var dtos = attendees.Select(attendee =>
        {
            if (attendee.ClientId.HasValue)
            {
                var clientId = attendee.ClientId.Value;
                return new SlotAttendeeDto(
                    clientId,
                    names.TryGetValue(clientId, out var name) ? name : "Client",
                    avatarIds.Contains(clientId) ? $"/users/{clientId}/avatar" : null,
                    attendee.Status.ToString());
            }

            var trainerClientId = attendee.TrainerClientId!.Value;
            return new SlotAttendeeDto(
                trainerClientId,
                trainerClientNames.TryGetValue(trainerClientId, out var trainerClientName)
                    ? trainerClientName
                    : "Client",
                null,
                attendee.Status.ToString());
        })
            .ToList();

        return ServiceResult<IReadOnlyList<SlotAttendeeDto>>.Success(dtos);
    }

    private static bool MatchesGenderFilter(
        TrainerProfile trainer,
        Gender? preferredTrainerGender,
        Gender? clientGender)
    {
        if (clientGender.HasValue && clientGender != Gender.Any)
        {
            if (trainer.WorksWithGender != Gender.Any && trainer.WorksWithGender != clientGender)
            {
                return false;
            }
        }

        if (!preferredTrainerGender.HasValue || preferredTrainerGender == Gender.Any)
        {
            return true;
        }

        return trainer.User?.Gender == preferredTrainerGender;
    }

    private static bool MatchesSpecializationFilter(
        TrainerProfile trainer,
        HashSet<string> specializationSet)
    {
        if (specializationSet.Count == 0)
        {
            return true;
        }

        var trainingTypes = trainer.Specializations ?? Array.Empty<string>();
        if (trainingTypes.Any(type => specializationSet.Contains(type)))
        {
            return true;
        }

        return false;
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

    private static bool TryResolveSlotType(string? value, out TrainingSlotType slotType)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            slotType = TrainingSlotType.Individual;
            return true;
        }

        return Enum.TryParse(value.Trim(), true, out slotType);
    }

    private static string? ValidateCapacity(TrainingSlotType slotType, int? capacityMin, int? capacityMax)
    {
        if (slotType == TrainingSlotType.Individual)
        {
            if (capacityMin.HasValue || capacityMax.HasValue)
            {
                return "Individual slots must not have CapacityMin or CapacityMax.";
            }

            return null;
        }

        if (!capacityMin.HasValue || !capacityMax.HasValue)
        {
            return "Group slots require CapacityMin and CapacityMax.";
        }

        if (capacityMin.Value < 2)
        {
            return "CapacityMin must be at least 2 for group slots.";
        }

        if (capacityMax.Value > 100)
        {
            return "CapacityMax must be less than or equal to 100 for group slots.";
        }

        if (capacityMin.Value > capacityMax.Value)
        {
            return "CapacityMin must be less than or equal to CapacityMax.";
        }

        return null;
    }

    private static string? ValidateGroupAutoCancellation(
        TrainingSlotType slotType,
        bool autoCancelIfMinNotReached,
        DateTime startsAtUtc,
        DateTime nowUtc)
    {
        if (slotType == TrainingSlotType.Individual && autoCancelIfMinNotReached)
        {
            return "Auto-cancellation by minimum capacity is available only for group slots.";
        }

        if (slotType != TrainingSlotType.Group || !autoCancelIfMinNotReached)
        {
            return null;
        }

        var earliestAllowedStart = nowUtc.AddMinutes(GroupSlotAutoCancellationService.AutoCancelLeadMinutes);
        if (startsAtUtc <= earliestAllowedStart)
        {
            return $"Group slot with auto-cancellation must start at least {GroupSlotAutoCancellationService.AutoCancelLeadMinutes} minutes in the future.";
        }

        return null;
    }

    private static int GetOccupiedCount(TrainingSlot slot)
        => slot.Attendees.Count(a => a.Status != SlotAttendeeStatus.Cancelled);

    private static bool ShouldHideFromTrainerList(TrainingSlot slot)
        => slot.SlotType == TrainingSlotType.Group
            && slot.Status == TrainingSlotStatus.Cancelled
            && slot.Attendees.Count == 0;

    private static string? ResolveBookingStatus(TrainingSlot slot)
    {
        if (slot.SlotType == TrainingSlotType.Individual)
        {
            return slot.Booking?.Status.ToString();
        }

        if (slot.Attendees.Any(a => a.Status == SlotAttendeeStatus.Booked))
        {
            return SlotAttendeeStatus.Booked.ToString();
        }

        if (slot.Attendees.Any(a => a.Status == SlotAttendeeStatus.Completed))
        {
            return SlotAttendeeStatus.Completed.ToString();
        }

        if (slot.Attendees.Any(a => a.Status == SlotAttendeeStatus.NoShow))
        {
            return SlotAttendeeStatus.NoShow.ToString();
        }

        return null;
    }

    public static SlotDto ToDto(
        TrainingSlot slot,
        string? clientName,
        string? clientAvatarUrl,
        int? trainerPricePerSession)
    {
        var occupiedCount = slot.SlotType == TrainingSlotType.Group
            ? (int?)GetOccupiedCount(slot)
            : null;
        var isFull = slot.SlotType == TrainingSlotType.Group
            && slot.CapacityMax.HasValue
            ? occupiedCount >= slot.CapacityMax.Value
            : (bool?)null;

        return new SlotDto(
            slot.Id,
            slot.TrainerId,
            slot.Booking?.Id,
            slot.Booking?.ClientId,
            slot.Booking?.TrainerClientId,
            slot.StartsAtUtc,
            slot.DurationMinutes,
            slot.SlotType.ToString(),
            slot.CapacityMax,
            slot.CapacityMin,
            occupiedCount,
            isFull,
            slot.Status.ToString(),
            ResolveBookingStatus(slot),
            slot.CreatedAtUtc,
            clientName,
            clientAvatarUrl,
            trainerPricePerSession);
    }

    private static PushService CreateNoOpPushService(AppDbContext dbContext)
    {
        var pushOptions = Options.Create(new PushOptions());
        var messagingClient = new FirebaseMessagingClient(pushOptions, NullLogger<FirebaseMessagingClient>.Instance);
        return new PushService(dbContext, messagingClient, NullLogger<PushService>.Instance);
    }
}
