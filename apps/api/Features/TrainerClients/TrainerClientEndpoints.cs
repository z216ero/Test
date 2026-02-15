using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.TrainerClients;

public static class TrainerClientEndpoints
{
    public static IEndpointRouteBuilder MapTrainerClientEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trainer-clients")
            .WithTags("TrainerClients")
            .RequireAuthorization();

        group.MapPost("", async (
            CreateTrainerClientRequest? request,
            HttpContext httpContext,
            TrainerClientService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            if (request is null)
            {
                return Problems.BadRequest("Invalid request", "Request body is required.");
            }

            var errors = ValidateCreateOrUpdate(request.DisplayName, request.Phone, request.Notes);
            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            var result = await service.CreateAsync(userId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<TrainerClientDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapGet("", async (
            string? status,
            HttpContext httpContext,
            TrainerClientService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            var result = await service.GetListAsync(userId, status, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<IReadOnlyList<TrainerClientDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden);

        group.MapPatch("/{id:guid}", async (
            Guid id,
            UpdateTrainerClientRequest? request,
            HttpContext httpContext,
            TrainerClientService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            if (request is null)
            {
                return Problems.BadRequest("Invalid request", "Request body is required.");
            }

            var errors = ValidateCreateOrUpdate(request.DisplayName, request.Phone, request.Notes);
            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            var result = await service.UpdateAsync(userId, id, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<TrainerClientDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{id:guid}/link", async (
            Guid id,
            LinkTrainerClientRequest? request,
            HttpContext httpContext,
            TrainerClientService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var roleError))
            {
                return roleError!;
            }

            if (request is null || request.LinkedUserId == Guid.Empty)
            {
                var errors = new Dictionary<string, string[]>
                {
                    ["linkedUserId"] = ["LinkedUserId is required."]
                };
                return Problems.Validation(errors);
            }

            var result = await service.LinkAsync(userId, id, request.LinkedUserId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .Produces<TrainerClientDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }

    private static Dictionary<string, string[]> ValidateCreateOrUpdate(
        string? displayName,
        string? phone,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        if (displayName is not null)
        {
            if (string.IsNullOrWhiteSpace(displayName))
            {
                errors["displayName"] = ["DisplayName is required."];
            }
            else if (displayName.Trim().Length > 100)
            {
                errors["displayName"] = ["DisplayName must be at most 100 characters."];
            }
        }

        if (phone is not null && phone.Trim().Length > 30)
        {
            errors["phone"] = ["Phone must be at most 30 characters."];
        }

        if (notes is not null && notes.Trim().Length > 500)
        {
            errors["notes"] = ["Notes must be at most 500 characters."];
        }

        return errors;
    }

    private static bool TryRequireTrainer(HttpContext httpContext, out Guid userId, out IResult? error)
    {
        error = null;
        if (!AuthClaims.TryGetUserId(httpContext.User, out userId))
        {
            error = Problems.Unauthorized("Unauthorized", "Authentication is required.");
            return false;
        }

        var role = AuthClaims.GetRole(httpContext.User);
        if (!string.Equals(role, UserRoles.Trainer, StringComparison.OrdinalIgnoreCase))
        {
            error = TypedResults.Problem(
                title: "Forbidden",
                detail: "Only trainers can access this resource.",
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
