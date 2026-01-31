using Api.Features.Auth;
using Api.Features.Common;

namespace Api.Features.Users;

public static class UserEndpoints
{
    private const int NameMaxLength = 100;
    private const long MaxAvatarBytes = 5 * 1024 * 1024;

    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/users").WithTags("Users");

        group.MapPatch("/me", async (
            HttpContext httpContext,
            UpdateUserRequest? request,
            UserService userService,
            AuthService authService,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                errors["name"] = new[] { "Name is required." };
            }
            else if (request.Name.Trim().Length > NameMaxLength)
            {
                errors["name"] = new[] { $"Name must be {NameMaxLength} characters or fewer." };
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var normalized = request with { Name = request.Name.Trim() };
            var updateResult = await userService.UpdateProfileAsync(userId, normalized, cancellationToken);
            if (!updateResult.IsSuccess)
            {
                return Problems.FromServiceError(updateResult.Error!);
            }

            var result = await authService.GetCurrentUserAsync(userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<AuthUserDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPut("/me/avatar", async (
            HttpContext httpContext,
            IFormFile? file,
            UserService userService,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            if (file is null)
            {
                return Problems.BadRequest("Invalid file", "Avatar file is required.");
            }

            if (file.Length <= 0)
            {
                return Problems.BadRequest("Invalid file", "Avatar file is empty.");
            }

            if (file.Length > MaxAvatarBytes)
            {
                return Problems.BadRequest(
                    "Invalid file",
                    $"Avatar file must be {MaxAvatarBytes / (1024 * 1024)} MB or smaller.");
            }

            var allowedTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "image/jpeg",
                "image/png"
            };

            if (string.IsNullOrWhiteSpace(file.ContentType) || !allowedTypes.Contains(file.ContentType))
            {
                return Problems.BadRequest("Invalid file", "Avatar must be a JPEG or PNG image.");
            }

            await using var stream = file.OpenReadStream();
            using var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream, cancellationToken);

            var saveResult = await userService.UpsertAvatarAsync(
                userId,
                file.ContentType,
                memoryStream.ToArray(),
                cancellationToken);

            if (!saveResult.IsSuccess)
            {
                return Problems.FromServiceError(saveResult.Error!);
            }

            return Results.NoContent();
        })
        .Accepts<IFormFile>("multipart/form-data")
        .DisableAntiforgery()
        .RequireAuthorization()
        .Produces(StatusCodes.Status204NoContent)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapGet("/me/avatar", async (
            HttpContext httpContext,
            UserService userService,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var result = await userService.GetAvatarAsync(userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            var avatar = result.Value!;
            return Results.File(avatar.Bytes, avatar.ContentType);
        })
        .RequireAuthorization()
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/{userId:guid}/avatar", async (
            Guid userId,
            HttpContext httpContext,
            UserService userService,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out _))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var result = await userService.GetAvatarAsync(userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            var avatar = result.Value!;
            return Results.File(avatar.Bytes, avatar.ContentType);
        })
        .RequireAuthorization()
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }
}
