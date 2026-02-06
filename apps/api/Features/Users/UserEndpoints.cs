using Api.Data;
using Api.Features.Auth;
using Api.Features.Common;
using Api.Features.Lookups;

namespace Api.Features.Users;

public static class UserEndpoints
{
    private const int NameMaxLength = 100;
    private const int AboutMaxLength = 250;
    private const long MaxAvatarBytes = 5 * 1024 * 1024;
    private const int TrainingTypesMinCount = 1;
    private const int PricePerSessionMin = 0;
    private const int PricePerSessionMax = 1_000_000;

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

            string? normalizedAbout = null;
            if (!string.IsNullOrWhiteSpace(request.About))
            {
                normalizedAbout = request.About.Trim();
                if (normalizedAbout.Length > AboutMaxLength)
                {
                    errors["about"] = new[] { $"About must be {AboutMaxLength} characters or fewer." };
                }
            }

            string? normalizedGender = null;
            if (!string.IsNullOrWhiteSpace(request.Gender))
            {
                if (LookupCatalog.IsValidGender(request.Gender))
                {
                    normalizedGender = NormalizeCode(request.Gender);
                }
                else
                {
                    errors["gender"] = new[] { "Gender is invalid." };
                }
            }

            string[]? normalizedSpecializations = null;
            if (request.Specializations is not null)
            {
                var (normalized, error) = NormalizeCodeArray(
                    request.Specializations,
                    LookupCatalog.IsValidSpecialization,
                    requireAtLeastOne: false);
                if (error is not null)
                {
                    errors["specializations"] = new[] { error };
                }
                else
                {
                    normalizedSpecializations = normalized;
                }
            }

            string[]? normalizedTrainingTypes = null;
            if (request.TrainingTypes is not null)
            {
                var (normalized, error) = NormalizeCodeArray(
                    request.TrainingTypes,
                    LookupCatalog.IsValidTrainingType,
                    requireAtLeastOne: true);
                if (error is not null)
                {
                    errors["trainingTypes"] = new[] { error };
                }
                else
                {
                    if (normalized.Length < TrainingTypesMinCount)
                    {
                        errors["trainingTypes"] = new[] { "At least one training type is required." };
                    }
                    else
                    {
                        normalizedTrainingTypes = normalized;
                    }
                }
            }

            string? normalizedWorksWithGender = null;
            if (!string.IsNullOrWhiteSpace(request.WorksWithGender))
            {
                if (LookupCatalog.IsValidGender(request.WorksWithGender))
                {
                    normalizedWorksWithGender = NormalizeCode(request.WorksWithGender);
                }
                else
                {
                    errors["worksWithGender"] = new[] { "WorksWithGender is invalid." };
                }
            }

            string? normalizedPreferredTrainerGender = null;
            if (!string.IsNullOrWhiteSpace(request.PreferredTrainerGender))
            {
                if (LookupCatalog.IsValidGender(request.PreferredTrainerGender))
                {
                    normalizedPreferredTrainerGender = NormalizeCode(request.PreferredTrainerGender);
                }
                else
                {
                    errors["preferredTrainerGender"] = new[] { "PreferredTrainerGender is invalid." };
                }
            }

            string? normalizedLevel = null;
            if (!string.IsNullOrWhiteSpace(request.Level))
            {
                if (LookupCatalog.IsValidLevel(request.Level))
                {
                    normalizedLevel = NormalizeCode(request.Level);
                }
                else
                {
                    errors["level"] = new[] { "Level is invalid." };
                }
            }

            string[]? normalizedGoals = null;
            if (request.Goals is not null)
            {
                var (normalized, error) = NormalizeCodeArray(
                    request.Goals,
                    LookupCatalog.IsValidGoal,
                    requireAtLeastOne: false);
                if (error is not null)
                {
                    errors["goals"] = new[] { error };
                }
                else
                {
                    normalizedGoals = normalized;
                }
            }

            if (request.PricePerSession.HasValue)
            {
                var price = request.PricePerSession.Value;
                if (price < PricePerSessionMin || price > PricePerSessionMax)
                {
                    errors["pricePerSession"] = new[]
                    {
                        $"PricePerSession must be between {PricePerSessionMin} and {PricePerSessionMax}."
                    };
                }
            }

            if (errors.Count > 0)
            {
                return Problems.Validation(errors);
            }

            if (!AuthClaims.TryGetUserId(httpContext.User, out var userId))
            {
                return Problems.Unauthorized("Unauthorized", "Authentication is required.");
            }

            var normalizedRequest = request with
            {
                Name = request.Name.Trim(),
                Gender = normalizedGender,
                About = normalizedAbout,
                Specializations = normalizedSpecializations,
                TrainingTypes = normalizedTrainingTypes,
                WorksWithGender = normalizedWorksWithGender,
                PreferredTrainerGender = normalizedPreferredTrainerGender,
                Level = normalizedLevel,
                Goals = normalizedGoals
            };
            var updateResult = await userService.UpdateProfileAsync(userId, normalizedRequest, cancellationToken);
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

    private static string NormalizeCode(string value)
        => value.Trim();

    private static (string[] Normalized, string? Error) NormalizeCodeArray(
        IEnumerable<string>? values,
        Func<string?, bool> isValid,
        bool requireAtLeastOne)
    {
        if (values is null)
        {
            return (Array.Empty<string>(), requireAtLeastOne ? "At least one value is required." : null);
        }

        var collected = new List<string>();
        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            var trimmed = value.Trim();
            if (!isValid(trimmed))
            {
                return (Array.Empty<string>(), "Contains invalid values.");
            }

            if (!collected.Any(item => string.Equals(item, trimmed, StringComparison.OrdinalIgnoreCase)))
            {
                collected.Add(trimmed);
            }
        }

        if (requireAtLeastOne && collected.Count == 0)
        {
            return (Array.Empty<string>(), "At least one value is required.");
        }

        return (collected.ToArray(), null);
    }
}
