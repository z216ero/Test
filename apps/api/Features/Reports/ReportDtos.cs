namespace Api.Features.Reports;

public sealed record TrainerSummaryReportDto(
    DateTime FromUtc,
    DateTime ToUtc,
    int SessionsBooked,
    int SessionsCompleted,
    int SessionsNoShow,
    int SessionsCancelled,
    decimal RevenuePaid,
    decimal RevenuePending);
