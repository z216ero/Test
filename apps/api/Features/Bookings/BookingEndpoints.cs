using Api.Features.Common;

namespace Api.Features.Bookings;

public static class BookingEndpoints
{
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/slots/{slotId:guid}").WithTags("Bookings");

        group.MapPost("/book", async (
            Guid slotId,
            BookSlotRequest? request,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Results.Problem(
                    title: "Invalid request",
                    detail: "Request body is required.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            if (request.ClientId == Guid.Empty)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["clientId"] = new[] { "ClientId is required." }
                };
                return Results.ValidationProblem(errors);
            }

            var result = await service.BookSlotAsync(slotId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return ToProblem(result.Error!);
            }

            var booking = result.Value!;
            return Results.Created($"/slots/{slotId}/book", booking);
        });

        group.MapPost("/cancel", async (
            Guid slotId,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.CancelSlotAsync(slotId, cancellationToken);
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
