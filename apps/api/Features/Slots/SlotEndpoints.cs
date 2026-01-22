using System.Globalization;
using Api.Features.Common;

namespace Api.Features.Slots;

public static class SlotEndpoints
{
    public static IEndpointRouteBuilder MapSlotEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trainers/{trainerId:guid}/slots").WithTags("Slots");

        group.MapPost("/", async (
            Guid trainerId,
            CreateSlotRequest? request,
            SlotService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Results.Problem(
                    title: "Invalid request",
                    detail: "Request body is required.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var errors = new Dictionary<string, string[]>();
            if (request.StartsAtUtc == default)
            {
                errors["startsAtUtc"] = new[] { "StartsAtUtc is required." };
            }
            else if (request.StartsAtUtc.Kind != DateTimeKind.Utc)
            {
                errors["startsAtUtc"] = new[] { "StartsAtUtc must be in UTC." };
            }

            if (request.DurationMinutes <= 0)
            {
                errors["durationMinutes"] = new[] { "DurationMinutes must be greater than 0." };
            }

            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            var result = await service.CreateSlotAsync(trainerId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return ToProblem(result.Error!);
            }

            var slot = result.Value!;
            return Results.Created($"/trainers/{trainerId}/slots/{slot.Id}", slot);
        });

        group.MapGet("/", async (
            Guid trainerId,
            string? fromUtc,
            string? toUtc,
            SlotService service,
            CancellationToken cancellationToken) =>
        {
            var errors = new Dictionary<string, string[]>();
            DateTime? parsedFrom = null;
            DateTime? parsedTo = null;

            if (!string.IsNullOrWhiteSpace(fromUtc))
            {
                if (!TryParseUtc(fromUtc, out var value, out var error))
                {
                    errors["fromUtc"] = new[] { error };
                }
                else
                {
                    parsedFrom = value;
                }
            }

            if (!string.IsNullOrWhiteSpace(toUtc))
            {
                if (!TryParseUtc(toUtc, out var value, out var error))
                {
                    errors["toUtc"] = new[] { error };
                }
                else
                {
                    parsedTo = value;
                }
            }

            if (errors.Count > 0)
            {
                return Results.ValidationProblem(errors);
            }

            if (parsedFrom.HasValue && parsedTo.HasValue && parsedFrom > parsedTo)
            {
                errors["fromUtc"] = new[] { "fromUtc must be earlier than or equal to toUtc." };
                return Results.ValidationProblem(errors);
            }

            var result = await service.GetSlotsAsync(trainerId, parsedFrom, parsedTo, cancellationToken);
            if (!result.IsSuccess)
            {
                return ToProblem(result.Error!);
            }

            return Results.Ok(result.Value);
        });

        return app;
    }

    private static IResult ToProblem(ServiceError error)
        => Results.Problem(title: error.Title, detail: error.Detail, statusCode: error.StatusCode);

    private static bool TryParseUtc(string value, out DateTime utcValue, out string error)
    {
        if (!DateTimeOffset.TryParse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind,
            out var parsed))
        {
            error = "Value must be a valid ISO-8601 date-time in UTC.";
            utcValue = default;
            return false;
        }

        if (parsed.Offset != TimeSpan.Zero)
        {
            error = "Value must be in UTC (use Z or +00:00).";
            utcValue = default;
            return false;
        }

        utcValue = parsed.UtcDateTime;
        error = string.Empty;
        return true;
    }
}
