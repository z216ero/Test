using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.TrainerClientLinks;

public static class TrainerClientLinkEndpoints
{
    public static IEndpointRouteBuilder MapTrainerClientLinkEndpoints(this IEndpointRouteBuilder app)
    {
        var trainerGroup = app.MapGroup("/trainer/clients")
            .WithTags("TrainerClientLinks")
            .RequireAuthorization();
        var clientGroup = app.MapGroup("/client")
            .WithTags("TrainerClientLinks")
            .RequireAuthorization();

        trainerGroup.MapPost("/link/search-by-phone", async (
            SearchTrainerClientByPhoneRequest? request,
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out _, out var roleError))
            {
                return roleError!;
            }

            if (request is null || string.IsNullOrWhiteSpace(request.Phone))
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["phone"] = ["Phone is required."]
                };
                return Problems.Validation(errors);
            }

            var result = await service.SearchByPhoneAsync(request.Phone, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<SearchTrainerClientByPhoneResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound);

        trainerGroup.MapPost("/link/request", async (
            CreateTrainerClientLinkRequest? request,
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            if (request is null || request.ClientUserId == Guid.Empty)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["clientUserId"] = ["ClientUserId is required."]
                };
                return Problems.Validation(errors);
            }

            var result = await service.RequestLinkAsync(userId, request.ClientUserId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<TrainerClientLinkDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        trainerGroup.MapGet("/links", async (
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.GetTrainerLinksAsync(userId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<IReadOnlyList<TrainerClientLinkDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound);

        trainerGroup.MapDelete("/link/{linkId:guid}", async (
            Guid linkId,
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.RevokeByTrainerAsync(userId, linkId, cancellationToken);
            return result.IsSuccess
                ? Results.NoContent()
                : Problems.FromServiceError(result.Error!);
        })
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        clientGroup.MapGet("/links/requests", async (
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireClient(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.GetClientPendingRequestsAsync(userId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<IReadOnlyList<TrainerClientLinkDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);

        clientGroup.MapGet("/links", async (
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireClient(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.GetClientAcceptedLinksAsync(userId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<IReadOnlyList<TrainerClientLinkDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);

        clientGroup.MapPost("/links/{linkId:guid}/accept", async (
            Guid linkId,
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireClient(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.AcceptAsync(userId, linkId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<TrainerClientLinkDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound);

        clientGroup.MapPost("/links/{linkId:guid}/reject", async (
            Guid linkId,
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireClient(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.RejectAsync(userId, linkId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<TrainerClientLinkDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound);

        clientGroup.MapDelete("/links/{linkId:guid}", async (
            Guid linkId,
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireClient(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.RevokeByClientAsync(userId, linkId, cancellationToken);
            return result.IsSuccess
                ? Results.NoContent()
                : Problems.FromServiceError(result.Error!);
        })
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        clientGroup.MapGet("/me/pending-link-requests/count", async (
            HttpContext httpContext,
            TrainerClientLinkService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireClient(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.GetPendingLinkRequestsCountAsync(userId, cancellationToken);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Problems.FromServiceError(result.Error!);
        })
        .Produces<PendingCountDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);

        return app;
    }

    private static bool TryRequireTrainer(HttpContext httpContext, out Guid userId, out IResult? error)
        => TryRequireRole(httpContext, UserRoles.Trainer, "Only trainers can access this resource.", out userId, out error);

    private static bool TryRequireClient(HttpContext httpContext, out Guid userId, out IResult? error)
        => TryRequireRole(httpContext, UserRoles.Client, "Only clients can access this resource.", out userId, out error);

    private static bool TryRequireRole(
        HttpContext httpContext,
        string requiredRole,
        string forbiddenDetail,
        out Guid userId,
        out IResult? error)
    {
        error = null;
        if (!AuthClaims.TryGetUserId(httpContext.User, out userId))
        {
            error = Problems.Unauthorized("Unauthorized", "Authentication is required.");
            return false;
        }

        var role = AuthClaims.GetRole(httpContext.User);
        if (!string.Equals(role, requiredRole, StringComparison.OrdinalIgnoreCase))
        {
            error = TypedResults.Problem(
                title: "Forbidden",
                detail: forbiddenDetail,
                statusCode: StatusCodes.Status403Forbidden,
                type: "https://errors.trainerapp/forbidden",
                extensions: new List<KeyValuePair<string, object?>>
                {
                    new("errorCode", "forbidden")
                });
            return false;
        }

        return true;
    }
}
