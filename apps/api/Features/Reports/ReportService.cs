using Api.Data;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Reports;

public sealed class ReportService(AppDbContext db)
{
    public async Task<ServiceResult<TrainerSummaryReportDto>> GetTrainerSummaryAsync(
        Guid trainerUserId,
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken cancellationToken)
    {
        if (fromUtc.Kind != DateTimeKind.Utc || toUtc.Kind != DateTimeKind.Utc)
        {
            return ServiceResult<TrainerSummaryReportDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid range",
                "fromUtc and toUtc must be in UTC.");
        }

        if (fromUtc > toUtc)
        {
            return ServiceResult<TrainerSummaryReportDto>.Fail(
                StatusCodes.Status400BadRequest,
                "Invalid range",
                "fromUtc must be earlier than or equal to toUtc.");
        }

        var trainerProfileId = await db.TrainerProfiles
            .AsNoTracking()
            .Where(t => t.UserId == trainerUserId)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (!trainerProfileId.HasValue)
        {
            return ServiceResult<TrainerSummaryReportDto>.Fail(
                StatusCodes.Status404NotFound,
                "Trainer profile not found",
                "Trainer profile is not available for this user.");
        }

        var query = db.Bookings
            .AsNoTracking()
            .Where(b => b.Slot != null
                && b.Slot.TrainerId == trainerProfileId.Value
                && b.Slot.StartsAtUtc >= fromUtc
                && b.Slot.StartsAtUtc <= toUtc);

        var sessionsBooked = await query.CountAsync(cancellationToken);
        var sessionsCompleted = await query
            .CountAsync(b => b.Status == BookingStatus.Completed, cancellationToken);
        var sessionsNoShow = await query
            .CountAsync(b => b.Status == BookingStatus.NoShow, cancellationToken);
        var sessionsCancelled = await query
            .CountAsync(b => b.Status == BookingStatus.Cancelled, cancellationToken);

        var paymentsQuery = db.Payments
            .AsNoTracking()
            .Where(p => p.Booking != null
                && p.Booking.Slot != null
                && p.Booking.Slot.TrainerId == trainerProfileId.Value
                && p.Booking.Slot.StartsAtUtc >= fromUtc
                && p.Booking.Slot.StartsAtUtc <= toUtc);

        var revenuePaid = await paymentsQuery
            .Where(p => p.Status == PaymentStatus.Paid)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;
        var revenuePending = await paymentsQuery
            .Where(p => p.Status == PaymentStatus.Pending)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        return ServiceResult<TrainerSummaryReportDto>.Success(new TrainerSummaryReportDto(
            fromUtc,
            toUtc,
            sessionsBooked,
            sessionsCompleted,
            sessionsNoShow,
            sessionsCancelled,
            revenuePaid,
            revenuePending));
    }
}
