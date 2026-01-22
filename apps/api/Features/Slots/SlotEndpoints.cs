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
            DateTime? fromUtc,
            DateTime? toUtc,
            SlotService service,
            CancellationToken cancellationToken) =>
        {
            if (fromUtc.HasValue && toUtc.HasValue && fromUtc > toUtc)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["fromUtc"] = new[] { "fromUtc must be earlier than or equal to toUtc." }
                };
                return Results.ValidationProblem(errors);
            }

            var result = await service.GetSlotsAsync(trainerId, fromUtc, toUtc, cancellationToken);
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
}
