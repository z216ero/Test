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
        var trainerAssignments = app.MapGroup("/trainer/slots/{slotId:guid}").WithTags("Bookings");
        var clientBookings = app.MapGroup("/client/bookings").WithTags("Bookings");
        var clientGroup = app.MapGroup("/client").WithTags("Bookings");

        group.MapPost("/book", async (
            Guid slotId,
            BookSlotRequest? request,
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            if (!string.Equals(role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
            {
                return TypedResults.Problem(
                    title: "Forbidden",
                    detail: "Only clients can book slots.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            request ??= new BookSlotRequest(null);
            var result = await service.BookSlotAsync(slotId, userId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<SlotDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .RequireAuthorization();

        trainerAssignments.MapPost("/assign-client", async (
            Guid slotId,
            AssignRegisteredClientRequest? request,
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
                    detail: "Only trainers can assign clients to slots.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            if (request is null || request.ClientUserId == Guid.Empty)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["clientUserId"] = ["ClientUserId is required."]
                };
                return Problems.Validation(errors);
            }

            var result = await service.AssignRegisteredClientToSlotAsync(
                slotId,
                userId,
                request.ClientUserId,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<BookingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
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
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            var result = await service.MarkAttendanceAsync(
                slotId,
                userId,
                role,
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
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .RequireAuthorization();

        group.MapPost("/no-show", async (
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
            var result = await service.MarkAttendanceAsync(
                slotId,
                userId,
                role,
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
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .RequireAuthorization();

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

        var bookingsGroup = app.MapGroup("/bookings").WithTags("Bookings");

        bookingsGroup.MapPatch("/{bookingId:guid}/close", async (
            Guid bookingId,
            CloseBookingRequest? request,
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            if (!Enum.TryParse<BookingStatus>(request.Attendance, true, out var attendance)
                || attendance is not BookingStatus.Completed and not BookingStatus.NoShow)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["attendance"] = new[] { "Attendance must be Completed or NoShow." }
                };
                return Problems.Validation(errors);
            }

            var paymentRequest = request.Payment ?? new CloseBookingPaymentRequest(false, null);
            if (paymentRequest.MarkPaid)
            {
                if (!Enum.TryParse<PaymentMethod>(paymentRequest.Method, true, out _))
                {
                    var errors = new Dictionary<string, string[]>
                    {
                        ["payment.method"] = new[] { "Method must be Cash, Transfer, SBP or Other when markPaid is true." }
                    };
                    return Problems.Validation(errors);
                }
            }
            else if (!string.IsNullOrWhiteSpace(paymentRequest.Method))
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["payment.method"] = new[] { "Method must be null when markPaid is false." }
                };
                return Problems.Validation(errors);
            }

            var role = AuthClaims.GetRole(httpContext.User);
            var parsedMethod = paymentRequest.MarkPaid
                ? Enum.Parse<PaymentMethod>(paymentRequest.Method!, true)
                : (PaymentMethod?)null;

            var result = await service.CloseBookingAsync(
                bookingId,
                userId,
                role,
                attendance,
                paymentRequest.MarkPaid,
                parsedMethod,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<CloseBookingResultDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        clientBookings.MapPost("/{bookingId:guid}/confirm", async (
            Guid bookingId,
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            if (!string.Equals(role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
            {
                return TypedResults.Problem(
                    title: "Forbidden",
                    detail: "Only clients can confirm bookings.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            var result = await service.ConfirmClientBookingAsync(bookingId, userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<BookingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        clientBookings.MapPost("/{bookingId:guid}/decline", async (
            Guid bookingId,
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            if (!string.Equals(role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
            {
                return TypedResults.Problem(
                    title: "Forbidden",
                    detail: "Only clients can decline bookings.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            var result = await service.DeclineClientBookingAsync(bookingId, userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<BookingDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        clientGroup.MapGet("/me/pending-booking-confirmations/count", async (
            HttpContext httpContext,
            BookingService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            if (!string.Equals(role, UserRoles.Client, StringComparison.OrdinalIgnoreCase))
            {
                return TypedResults.Problem(
                    title: "Forbidden",
                    detail: "Only clients can access this resource.",
                    statusCode: StatusCodes.Status403Forbidden,
                    type: "https://errors.trainerapp/forbidden");
            }

            var result = await service.GetPendingBookingConfirmationsCountAsync(userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<PendingBookingConfirmationsCountDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);

        return app;
    }
}
