using Api.Data;
using Api.Features.Common;
using Microsoft.AspNetCore.Authorization;

namespace Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").WithTags("Auth");

        group.MapPost("/register", async (
            RegisterRequest? request,
            AuthService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                errors["email"] = new[] { "Email is required." };
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                errors["password"] = new[] { "Password is required." };
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                errors["name"] = new[] { "Name is required." };
            }

            if (!UserRoles.IsValid(request.Role))
            {
                errors["role"] = new[] { "Role must be Trainer or Client." };
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            var normalized = request with
            {
                Email = request.Email.Trim(),
                Name = request.Name.Trim()
            };

            var result = await service.RegisterAsync(normalized, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .AllowAnonymous()
        .Produces<AuthResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/login", async (
            LoginRequest? request,
            AuthService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                errors["email"] = new[] { "Email is required." };
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                errors["password"] = new[] { "Password is required." };
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            var normalized = request with { Email = request.Email.Trim() };
            var result = await service.LoginAsync(normalized, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .AllowAnonymous()
        .Produces<AuthResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/refresh", async (
            RefreshRequest? request,
            AuthService service,
            CancellationToken cancellationToken) =>
        {
            if (request is null)
            {
                return Problems.BadRequest(
                    "Invalid request",
                    "Request body is required.");
            }

            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                errors["refreshToken"] = new[] { "RefreshToken is required." };
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            var normalized = request with { RefreshToken = request.RefreshToken.Trim() };
            var result = await service.RefreshAsync(normalized, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .AllowAnonymous()
        .Produces<AuthResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapGet("/me", async (
            HttpContext httpContext,
            AuthService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var result = await service.GetCurrentUserAsync(userId, cancellationToken);
            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok(result.Value);
        })
        .RequireAuthorization()
        .Produces<AuthUserDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        group.MapPost("/logout", async (
            HttpContext httpContext,
            LogoutRequest? request,
            AuthService service,
            CancellationToken cancellationToken) =>
        {
            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var result = await service.RevokeRefreshTokensAsync(
                userId,
                request?.RefreshToken?.Trim(),
                cancellationToken);

            if (!result.IsSuccess)
            {
                return Problems.FromServiceError(result.Error!);
            }

            return Results.Ok();
        })
        .RequireAuthorization()
        .Produces(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized);

        return app;
    }
}
