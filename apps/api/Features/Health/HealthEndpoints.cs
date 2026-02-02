using Api.Data;

namespace Api.Features.Health;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/health").WithTags("Health");

        group.MapGet("/", () => TypedResults.Ok(new { status = "ok" }));

        group.MapGet("/db", async (AppDbContext db, CancellationToken cancellationToken) =>
        {
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? Results.Ok()
                : Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        });

        return app;
    }
}
