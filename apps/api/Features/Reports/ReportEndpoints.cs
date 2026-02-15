using System.Globalization;
using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.Reports;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trainers/me/reports")
            .WithTags("Reports")
            .RequireAuthorization();

        group.MapGet("/summary", async (
            string? fromUtc,
            string? toUtc,
            HttpContext httpContext,
            ReportService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            if (!string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
            {
                return TypedResults.Problem(
                    title: "Forbidden",
                    detail: "Only trainers can access reports.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden",
                    extensions: new List<KeyValuePair<string, object?>>
                    {
                        new("errorCode", "forbidden")
                    });
            }

            if (!TryParseUtcOrDefault(fromUtc, DateTime.UtcNow.Date, out var parsedFrom, out var fromError))
            {
                return Problems.Validation(new Dictionary<string, string[]>
                {
                    ["fromUtc"] = [fromError!]
                });
            }

            if (!TryParseUtcOrDefault(toUtc, parsedFrom.AddDays(1).AddTicks(-1), out var parsedTo, out var toError))
            {
                return Problems.Validation(new Dictionary<string, string[]>
                {
                    ["toUtc"] = [toError!]
                });
            }

            var result = await service.GetTrainerSummaryAsync(userId, parsedFrom, parsedTo, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<TrainerSummaryReportDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    private static bool TryParseUtcOrDefault(
        string? value,
        DateTime fallbackUtc,
        out DateTime parsedUtc,
        out string? error)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            parsedUtc = fallbackUtc;
            error = null;
            return true;
        }

        if (!DateTimeOffset.TryParse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind,
            out var parsed))
        {
            parsedUtc = default;
            error = "Value must be a valid ISO-8601 date-time in UTC.";
            return false;
        }

        if (parsed.Offset != TimeSpan.Zero)
        {
            parsedUtc = default;
            error = "Value must be in UTC (use Z or +00:00).";
            return false;
        }

        parsedUtc = parsed.UtcDateTime;
        error = null;
        return true;
    }
}
