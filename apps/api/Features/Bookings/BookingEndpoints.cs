using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;
using Api.Features.Slots;

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
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            if (request.ClientId == Guid.Empty)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["clientId"] = new[] { "ClientId is required." }
                };
                return Problems.Validation(errors);
            }

            var result = await service.BookSlotAsync(slotId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<SlotDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/cancel", async (
            Guid slotId,
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            var result = await service.CancelSlotAsync(slotId, userId, role, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<SlotDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/complete", async (
            Guid slotId,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.MarkAttendanceAsync(
                slotId,
                BookingStatus.Completed,
                cancellationToken);

            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<BookingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/no-show", async (
            Guid slotId,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            var result = await service.MarkAttendanceAsync(
                slotId,
                BookingStatus.NoShow,
                cancellationToken);

            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<BookingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/attendees/{clientId:guid}/complete", async (
            Guid slotId,
            Guid clientId,
            HttpContext httpContext,
            BookingService service,
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
                    detail: "Only trainers can mark attendee attendance.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            var result = await service.MarkGroupAttendeeAttendanceAsync(
                slotId,
                userId,
                clientId,
                SlotAttendeeStatus.Completed,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<SlotAttendeeDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/attendees/{clientId:guid}/no-show", async (
            Guid slotId,
            Guid clientId,
            HttpContext httpContext,
            BookingService service,
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
                    detail: "Only trainers can mark attendee attendance.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            var result = await service.MarkGroupAttendeeAttendanceAsync(
                slotId,
                userId,
                clientId,
                SlotAttendeeStatus.NoShow,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<SlotAttendeeDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }
}
