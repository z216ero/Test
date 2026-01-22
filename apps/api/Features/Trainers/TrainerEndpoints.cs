namespace Api.Features.Trainers;

public static class TrainerEndpoints
{
    public static IEndpointRouteBuilder MapTrainerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/trainers").WithTags("Trainers");

        group.MapPost("/", async (
            CreateTrainerRequest? request,
            TrainerService service,
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
                return Results.ValidationProblem(errors);
            }

            var trainer = await service.CreateTrainerAsync(request, cancellationToken);
            return Results.Created($"/trainers/{trainer.Id}", trainer);
        });

        group.MapGet("/", async (
            TrainerService service,
            CancellationToken cancellationToken) =>
        {
            var trainers = await service.GetAllTrainersAsync(cancellationToken);
            return Results.Ok(trainers);
        });

        return app;
    }
}
