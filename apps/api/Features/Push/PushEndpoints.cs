using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.Push;

public static class PushEndpoints
{
    public static IEndpointRouteBuilder MapPushEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/push").WithTags("Push");

        group.MapPost("/tokens", async (
            RegisterPushTokenRequest? request,
            HttpContext httpContext,
            PushService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.Token))
            {
                errors["token"] = new[] { "Token is required." };
            }

            if (!PushPlatforms.IsSupported(request.Platform))
            {
                errors["platform"] = new[] { "Platform must be android or ios." };
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            await service.RegisterTokenAsync(
                userId,
                request.Token,
                request.Platform,
                cancellationToken);

            return Results.Ok();
        })
        .RequireAuthorization()
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/tokens/disable", async (
            DisablePushTokenRequest? request,
            HttpContext httpContext,
            PushService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Token))
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["token"] = new[] { "Token is required." }
                };
                return Problems.Validation(errors);
            }

            await service.DisableTokenAsync(userId, request.Token, cancellationToken);
            return Results.Ok();
        })
        .RequireAuthorization()
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        return app;
    }
}
