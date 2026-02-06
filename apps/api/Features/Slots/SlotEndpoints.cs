using System.Globalization;
using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Slots;

public static class SlotEndpoints
{
    public static IEndpointRouteBuilder MapSlotEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trainers/{trainerId:guid}/slots").WithTags("Slots");
        var availableGroup = app.MapGroup("/slots").WithTags("Slots");

        group.MapPost("/", async (
            Guid trainerId,
            CreateSlotRequest? request,
            SlotService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
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
                return Problems.Validation(errors);
            }

            var result = await service.CreateSlotAsync(trainerId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            var slot = result.Value!;
            return Results.Created($"/trainers/{trainerId}/slots/{slot.Id}", slot);
        })
        .Produces<SlotDto>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

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
                return Problems.Validation(errors);
            }

            if (parsedFrom.HasValue && parsedTo.HasValue && parsedFrom > parsedTo)
            {
                errors["fromUtc"] = new[] { "fromUtc must be earlier than or equal to toUtc." };
                return Problems.Validation(errors);
            }

            var result = await service.GetSlotsAsync(trainerId, parsedFrom, parsedTo, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<IReadOnlyList<SlotDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        availableGroup.MapGet("/available", async (
            HttpContext httpContext,
            string? fromUtc,
            string? toUtc,
            string[]? specializations,
            string? gender,
            AppDbContext db,
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

            Gender? requestedTrainerGender = null;
            if (!string.IsNullOrWhiteSpace(gender))
            {
                if (Enum.TryParse<Gender>(gender, true, out var parsedGender))
                {
                    requestedTrainerGender = parsedGender;
                }
                else
                {
                    errors["gender"] = new[] { "Gender must be Male, Female, or Any." };
                }
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            var normalizedSpecializations = NormalizeFilters(specializations);

            Gender? clientGender = null;
            if (AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                var user = await db.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
                if (user is not null && string.Equals(user.Role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
                {
                    clientGender = user.Gender;
                }
            }

            var result = await service.GetAvailableSlotsAsync(
                parsedFrom,
                parsedTo,
                normalizedSpecializations,
                requestedTrainerGender,
                clientGender,
                cancellationToken);

            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<IReadOnlyList<AvailableSlotGroupDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        return app;
    }

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

    private static IReadOnlyList<string> NormalizeFilters(string[]? values)
    {
        if (values is null || values.Length == 0)
        {
            return Array.Empty<string>();
        }

        var normalized = new List<string>();
        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            var parts = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var part in parts)
            {
                if (string.IsNullOrWhiteSpace(part))
                {
                    continue;
                }

                normalized.Add(part.Trim());
            }
        }

        return normalized;
    }
}
