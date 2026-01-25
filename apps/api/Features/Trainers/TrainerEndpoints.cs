using Api.Features.Auth;
using Api.Features.Common;
using Microsoft.AspNetCore.Authorization;

namespace Api.Features.Trainers;

public static class TrainerEndpoints
{
    public static IEndpointRouteBuilder MapTrainerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trainers").WithTags("Trainers");

        group.MapPost("/", async (
            CreateTrainerRequest? request,
            HttpContext httpContext,
            TrainerService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.DisplayName))
            {
                errors["displayName"] = new[] { "DisplayName is required." };
            }
            else if (request.DisplayName.Length > 100)
            {
                errors["displayName"] = new[] { "DisplayName must be at most 100 characters." };
            }

            if (!string.IsNullOrWhiteSpace(request.GymName) && request.GymName.Length > 120)
            {
                errors["gymName"] = new[] { "GymName must be at most 120 characters." };
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var result = await service.CreateTrainerAsync(userId, request, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            var trainer = result.Value!;
            return Results.Created($"/trainers/{trainer.Id}", trainer);
        })
        .Produces<TrainerDto>(StatusCodes.Status201Created)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .RequireAuthorization();

        group.MapGet("/", async (
            TrainerService service,
            CancellationToken cancellationToken) =>
        {
            var trainers = await service.GetAllTrainersAsync(cancellationToken);
            return Results.Ok(trainers);
        })
        .Produces<IReadOnlyList<TrainerDto>>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }
}
