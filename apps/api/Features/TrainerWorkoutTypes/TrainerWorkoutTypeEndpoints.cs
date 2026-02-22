using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.TrainerWorkoutTypes;

public static class TrainerWorkoutTypeEndpoints
{
    public static IEndpointRouteBuilder MapTrainerWorkoutTypeEndpoints(this IEndpointRouteBuilder app)
    {
        var types = app.MapGroup("/trainer/workout-types")
            .WithTags("TrainerWorkoutTypes")
            .RequireAuthorization();

        types.MapGet("", async (
            bool? includeArchived,
            HttpContext httpContext,
            TrainerWorkoutTypeService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var error))
            {
                return error!;
            }

            var result = await service.GetTrainerWorkoutTypesAsync(userId, includeArchived ?? false, cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : Problems.FromServiceError(result.Error!);
        })
        .Produces<IReadOnlyList<TrainerWorkoutTypeDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound);

        types.MapPost("", async (
            CreateTrainerWorkoutTypeRequest? request,
            HttpContext httpContext,
            TrainerWorkoutTypeService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var error))
            {
                return error!;
            }

            if (request is null)
            {
                return Problems.BadRequest("Invalid request", "Request body is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return Problems.Validation(new Dictionary<string, string[]>
                {
                    ["name"] = ["Name is required."]
                });
            }

            if (request.Name.Trim().Length > 40)
            {
                return Problems.Validation(new Dictionary<string, string[]>
                {
                    ["name"] = ["Name must be at most 40 characters."]
                });
            }

            var result = await service.CreateCustomAsync(userId, request.Name, request.Category, cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : Problems.FromServiceError(result.Error!);
        })
        .Produces<TrainerWorkoutTypeDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        types.MapPost("/{id:guid}/archive", async (
            Guid id,
            HttpContext httpContext,
            TrainerWorkoutTypeService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var error))
            {
                return error!;
            }

            var result = await service.ArchiveCustomAsync(userId, id, cancellationToken);
            return result.IsSuccess ? Results.Ok(result.Value) : Problems.FromServiceError(result.Error!);
        })
        .Produces<TrainerWorkoutTypeDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        var bookings = app.MapGroup("/trainer/bookings")
            .WithTags("TrainerWorkoutTypes")
            .RequireAuthorization();

        bookings.MapPatch("/{bookingId:guid}/workout-type", async (
            Guid bookingId,
            SetBookingWorkoutTypeRequest? request,
            HttpContext httpContext,
            TrainerWorkoutTypeService service,
            CancellationToken cancellationToken) =>
        {
            if (!TryRequireTrainer(httpContext, out var userId, out var error))
            {
                return error!;
            }

            if (request is null)
            {
                return Problems.BadRequest("Invalid request", "Request body is required.");
            }

            var result = await service.SetBookingWorkoutTypeAsync(
                userId,
                bookingId,
                request.WorkoutTypeId,
                cancellationToken);

            return result.IsSuccess ? Results.Ok(result.Value) : Problems.FromServiceError(result.Error!);
        })
        .Produces<SetBookingWorkoutTypeResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status403Forbidden)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
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
