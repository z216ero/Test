using System.Data;
using Api.Data;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Payments;

public sealed class PaymentService(AppDbContext db)
{
    public async Task<ServiceResult<IReadOnlyList<PaymentListItemDto>>> GetTrainerPaymentsAsync(
        Guid trainerUserId,
        string? status,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<IReadOnlyList<PaymentListItemDto>>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        if (fromUtc.HasValue && fromUtc.Value.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<IReadOnlyList<PaymentListItemDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid from",
                "from must be in UTC.");
        }

        if (toUtc.HasValue && toUtc.Value.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<IReadOnlyList<PaymentListItemDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid to",
                "to must be in UTC.");
        }

        if (fromUtc.HasValue && toUtc.HasValue && fromUtc.Value > toUtc.Value)
        {
            return ServiceResult<IReadOnlyList<PaymentListItemDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid range",
                "from must be earlier than or equal to to.");
        }

        if (!TryParseStatus(status, out var statusFilter, out var statusParseError))
        {
            return ServiceResult<IReadOnlyList<PaymentListItemDto>>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid status",
                statusParseError!);
        }

        var query = BuildBasePaymentsQuery()
            .Where(p => p.Booking!.Slot!.TrainerId == trainerProfileId.Value);

        if (statusFilter.HasValue)
        {
            query = query.Where(p => p.Status == statusFilter.Value);
        }

        if (fromUtc.HasValue)
        {
            query = query.Where(p => p.Booking!.Slot!.StartsAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(p => p.Booking!.Slot!.StartsAtUtc <= toUtc.Value);
        }

        var orderedQuery = query
            .OrderBy(p => p.Booking!.Slot!.StartsAtUtc);

        var items = await ProjectPayments(orderedQuery)
            .ToListAsync(cancellationToken);

        var dtos = items
            .Select(ToListItemDto)
            .ToList();

        return ServiceResult<IReadOnlyList<PaymentListItemDto>>.Success(dtos);
    }

    public async Task<ServiceResult<PaymentDto>> GetPaymentByBookingAsync(
        Guid bookingId,
        Guid userId,
        string? role,
        CancellationToken cancellationToken)
    {
        IQueryable<Payment> query;

        if (string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            var trainerProfileId = await ResolveTrainerProfileIdAsync(userId, cancellationToken);
            if (!trainerProfileId.HasValue)
            {
                return ServiceResult<PaymentDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Booking not found",
                    "Booking does not exist.");
            }

            query = BuildBasePaymentsQuery()
                .Where(p => p.BookingId == bookingId && p.Booking!.Slot!.TrainerId == trainerProfileId.Value);
        }
        else if (string.Equals(role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
        {
            query = BuildBasePaymentsQuery()
                .Where(p => p.BookingId == bookingId && p.Booking!.ClientId == userId);
        }
        else
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        var payment = await ProjectPayments(query)
            .FirstOrDefaultAsync(cancellationToken);
        if (payment is null)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Booking not found",
                "Booking does not exist.");
        }

        return ServiceResult<PaymentDto>.Success(ToDto(payment));
    }

    public async Task<ServiceResult<PaymentDto>> MarkPaidAsync(
        Guid paymentId,
        Guid trainerUserId,
        string? role,
        PaymentMethod method,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Payment not found",
                "Payment does not exist.");
        }

        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Payment not found",
                "Payment does not exist.");
        }

        var current = await GetTrainerPaymentAsync(paymentId, trainerProfileId.Value, cancellationToken);
        if (current is null)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Payment not found",
                "Payment does not exist.");
        }

        if (current.Status == PaymentStatus.Paid)
        {
            if (current.Method == method)
            {
                return ServiceResult<PaymentDto>.Success(ToDto(current));
            }

            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status409Conflict,
                "Payment method conflict",
                "Payment is already marked with another method.");
        }

        if (current.Status == PaymentStatus.Refunded)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid payment state",
                "Refunded payment cannot be marked as paid.");
        }

        if (current.BookingStatus != BookingStatus.Completed)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status409Conflict,
                "Training is not completed",
                "Only completed trainings can be marked as paid.");
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database
                .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

            var nowUtc = DateTime.UtcNow;
            var affectedRows = await db.Payments
                .Where(p => p.Id == paymentId
                    && p.Status == PaymentStatus.Pending
                    && p.Booking != null
                    && p.Booking.Slot != null
                    && p.Booking.Slot.TrainerId == trainerProfileId.Value)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, PaymentStatus.Paid)
                    .SetProperty(x => x.Method, method)
                    .SetProperty(x => x.PaidAtUtc, nowUtc)
                    .SetProperty(x => x.UpdatedAtUtc, nowUtc), cancellationToken);

            if (affectedRows == 0)
            {
                var latest = await GetTrainerPaymentAsync(paymentId, trainerProfileId.Value, cancellationToken);
                if (latest is null)
                {
                    return ServiceResult<PaymentDto>.Fail(
                        StatusCodes.Status404NotFound,
                        "Payment not found",
                        "Payment does not exist.");
                }

                if (latest.Status == PaymentStatus.Paid && latest.Method == method)
                {
                    return ServiceResult<PaymentDto>.Success(ToDto(latest));
                }

                return ServiceResult<PaymentDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Payment status conflict",
                    "Payment status was changed. Refresh and try again.");
            }

            var updated = await GetTrainerPaymentAsync(paymentId, trainerProfileId.Value, cancellationToken);
            if (updated is null)
            {
                return ServiceResult<PaymentDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Payment not found",
                    "Payment does not exist.");
            }

            await transaction.CommitAsync(cancellationToken);
            return ServiceResult<PaymentDto>.Success(ToDto(updated));
        });
    }

    public async Task<ServiceResult<PaymentDto>> RefundAsync(
        Guid paymentId,
        Guid trainerUserId,
        string? role,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Payment not found",
                "Payment does not exist.");
        }

        var trainerProfileId = await ResolveTrainerProfileIdAsync(trainerUserId, cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Payment not found",
                "Payment does not exist.");
        }

        var current = await GetTrainerPaymentAsync(paymentId, trainerProfileId.Value, cancellationToken);
        if (current is null)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status404NotFound,
                "Payment not found",
                "Payment does not exist.");
        }

        if (current.Status != PaymentStatus.Paid)
        {
            return ServiceResult<PaymentDto>.Fail(
                StatusCodes.Status409Conflict,
                "Invalid payment state",
                "Only paid payments can be refunded.");
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database
                .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

            var nowUtc = DateTime.UtcNow;
            var affectedRows = await db.Payments
                .Where(p => p.Id == paymentId
                    && p.Status == PaymentStatus.Paid
                    && p.Booking != null
                    && p.Booking.Slot != null
                    && p.Booking.Slot.TrainerId == trainerProfileId.Value)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, PaymentStatus.Refunded)
                    .SetProperty(x => x.UpdatedAtUtc, nowUtc), cancellationToken);

            if (affectedRows == 0)
            {
                return ServiceResult<PaymentDto>.Fail(
                    StatusCodes.Status409Conflict,
                    "Payment status conflict",
                    "Payment status was changed. Refresh and try again.");
            }

            var updated = await GetTrainerPaymentAsync(paymentId, trainerProfileId.Value, cancellationToken);
            if (updated is null)
            {
                return ServiceResult<PaymentDto>.Fail(
                    StatusCodes.Status404NotFound,
                    "Payment not found",
                    "Payment does not exist.");
            }

            await transaction.CommitAsync(cancellationToken);
            return ServiceResult<PaymentDto>.Success(ToDto(updated));
        });
    }

    private IQueryable<Payment> BuildBasePaymentsQuery()
    {
        return db.Payments
            .AsNoTracking()
            .Where(p => p.Booking != null && p.Booking.Slot != null);
    }

    private IQueryable<PaymentProjection> ProjectPayments(IQueryable<Payment> query)
    {
        return query.Select(p => new PaymentProjection(
            p.Id,
            p.BookingId,
            p.Booking!.ClientId,
            db.Users
                .Where(u => u.Id == p.Booking.ClientId)
                .Select(u => u.Name)
                .FirstOrDefault(),
            p.Booking.Slot!.TrainerId,
            p.Booking.Slot.StartsAtUtc,
            p.Booking.Slot.DurationMinutes,
            p.Booking.Status,
            p.Amount,
            p.Status,
            p.Method,
            p.PaidAtUtc,
            p.CreatedAtUtc,
            p.UpdatedAtUtc));
    }

    private async Task<Guid?> ResolveTrainerProfileIdAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == userId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<PaymentProjection?> GetTrainerPaymentAsync(
        Guid paymentId,
        Guid trainerProfileId,
        CancellationToken cancellationToken)
    {
        var query = BuildBasePaymentsQuery()
            .Where(p => p.Id == paymentId && p.Booking!.Slot!.TrainerId == trainerProfileId);

        return await ProjectPayments(query).FirstOrDefaultAsync(cancellationToken);
    }

    private static bool TryParseStatus(
        string? status,
        out PaymentStatus? statusFilter,
        out string? error)
    {
        if (string.IsNullOrWhiteSpace(status)
            || string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
        {
            statusFilter = null;
            error = null;
            return true;
        }

        if (Enum.TryParse<PaymentStatus>(status, true, out var parsed))
        {
            statusFilter = parsed;
            error = null;
            return true;
        }

        statusFilter = null;
        error = "Status must be Pending, Paid, Refunded or All.";
        return false;
    }

    private static PaymentListItemDto ToListItemDto(PaymentProjection payment)
    {
        return new PaymentListItemDto(
            payment.PaymentId,
            payment.BookingId,
            payment.ClientId,
            string.IsNullOrWhiteSpace(payment.ClientName) ? "Client" : payment.ClientName!,
            payment.SlotStartAtUtc,
            payment.SlotStartAtUtc.AddMinutes(payment.SlotDurationMinutes),
            payment.Amount,
            payment.Status.ToString(),
            payment.Method?.ToString(),
            payment.PaidAtUtc);
    }

    private static PaymentDto ToDto(PaymentProjection payment)
    {
        return new PaymentDto(
            payment.PaymentId,
            payment.BookingId,
            payment.ClientId,
            string.IsNullOrWhiteSpace(payment.ClientName) ? "Client" : payment.ClientName!,
            payment.SlotStartAtUtc,
            payment.SlotStartAtUtc.AddMinutes(payment.SlotDurationMinutes),
            payment.Amount,
            payment.Status.ToString(),
            payment.Method?.ToString(),
            payment.PaidAtUtc,
            payment.CreatedAtUtc,
            payment.UpdatedAtUtc);
    }

    private sealed record PaymentProjection(
        Guid PaymentId,
        Guid BookingId,
        Guid ClientId,
        string? ClientName,
        Guid TrainerId,
        DateTime SlotStartAtUtc,
        int SlotDurationMinutes,
        BookingStatus BookingStatus,
        decimal Amount,
        PaymentStatus Status,
        PaymentMethod? Method,
        DateTime? PaidAtUtc,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc);
}
