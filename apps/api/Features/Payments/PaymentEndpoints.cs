using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.Payments;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var trainerGroup = app.MapGroup("/trainer/payments")
            .WithTags("Payments")
            .RequireAuthorization();

        trainerGroup.MapGet("", async (
            HttpContext httpContext,
            string? status,
            DateTime? from,
            DateTime? to,
            PaymentService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var result = await service.GetTrainerPaymentsAsync(
                userId,
                status,
                from,
                to,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<IReadOnlyList<PaymentListItemDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound);

        var bookingGroup = app.MapGroup("/bookings")
            .WithTags("Payments")
            .RequireAuthorization();

        bookingGroup.MapGet("/{bookingId:guid}/payment", async (
            Guid bookingId,
            HttpContext httpContext,
            PaymentService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            var result = await service.GetPaymentByBookingAsync(
                bookingId,
                userId,
                role,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<PaymentDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound);

        var paymentsGroup = app.MapGroup("/payments")
            .WithTags("Payments")
            .RequireAuthorization();

        paymentsGroup.MapPatch("/{paymentId:guid}/mark-paid", async (
            Guid paymentId,
            MarkPaymentPaidRequest? request,
            HttpContext httpContext,
            PaymentService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            if (request is null || string.IsNullOrWhiteSpace(request.Method))
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["method"] = new[] { "Method is required." }
                };
                return Problems.Validation(errors);
            }

            if (!Enum.TryParse<PaymentMethod>(request.Method, true, out var method))
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["method"] = new[] { "Method must be Cash, Transfer or SBP." }
                };
                return Problems.Validation(errors);
            }

            var role = AuthClaims.GetRole(httpContext.User);
            var result = await service.MarkPaidAsync(
                paymentId,
                userId,
                role,
                method,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<PaymentDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        paymentsGroup.MapPatch("/{paymentId:guid}/refund", async (
            Guid paymentId,
            HttpContext httpContext,
            PaymentService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var role = AuthClaims.GetRole(httpContext.User);
            var result = await service.RefundAsync(
                paymentId,
                userId,
                role,
                cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<PaymentDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }
}
