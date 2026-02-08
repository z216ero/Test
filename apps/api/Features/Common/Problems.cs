using Microsoft.AspNetCore.Http;

namespace Api.Features.Common;

public static class Problems
{
    private const string ErrorTypeBase = "https://errors.trainerapp";
    private static readonly string ValidationType = $"{ErrorTypeBase}/validation";
    private static readonly string BadRequestType = $"{ErrorTypeBase}/bad-request";
    private static readonly string UnauthorizedType = $"{ErrorTypeBase}/unauthorized";
    private static readonly string NotFoundType = $"{ErrorTypeBase}/not-found";
    private static readonly string ConflictType = $"{ErrorTypeBase}/conflict";
    private static readonly string UnknownType = $"{ErrorTypeBase}/error";

    public static IResult Validation(IDictionary<string, string[]> errors, string? detail = null)
        => CreateProblem(
            StatusCodes.Status400BadRequest,
            "Validation failed",
            detail ?? "One or more validation errors occurred.",
            ValidationType,
            errors);

    public static IResult BadRequest(string title, string detail)
        => CreateProblem(StatusCodes.Status400BadRequest, title, detail, BadRequestType);

    public static IResult Unauthorized(string title, string detail)
        => CreateProblem(StatusCodes.Status401Unauthorized, title, detail, UnauthorizedType);

    public static IResult NotFound(string title, string detail)
        => CreateProblem(StatusCodes.Status404NotFound, title, detail, NotFoundType);

    public static IResult Conflict(string title, string detail)
        => CreateProblem(StatusCodes.Status409Conflict, title, detail, ConflictType);

    public static IResult FromServiceError(ServiceError error)
        => error.StatusCode switch
        {
            StatusCodes.Status400BadRequest => BadRequest(error.Title, error.Detail, error.Extensions),
            StatusCodes.Status401Unauthorized => Unauthorized(error.Title, error.Detail, error.Extensions),
            StatusCodes.Status404NotFound => NotFound(error.Title, error.Detail, error.Extensions),
            StatusCodes.Status409Conflict => Conflict(error.Title, error.Detail, error.Extensions),
            _ => CreateProblem(error.StatusCode, error.Title, error.Detail, UnknownType, null, error.Extensions)
        };

    public static IResult BadRequest(
        string title,
        string detail,
        IReadOnlyDictionary<string, object?>? extensions)
        => CreateProblem(StatusCodes.Status400BadRequest, title, detail, BadRequestType, null, extensions);

    public static IResult Unauthorized(
        string title,
        string detail,
        IReadOnlyDictionary<string, object?>? extensions)
        => CreateProblem(StatusCodes.Status401Unauthorized, title, detail, UnauthorizedType, null, extensions);

    public static IResult NotFound(
        string title,
        string detail,
        IReadOnlyDictionary<string, object?>? extensions)
        => CreateProblem(StatusCodes.Status404NotFound, title, detail, NotFoundType, null, extensions);

    public static IResult Conflict(
        string title,
        string detail,
        IReadOnlyDictionary<string, object?>? extensions)
        => CreateProblem(StatusCodes.Status409Conflict, title, detail, ConflictType, null, extensions);

    private static IResult CreateProblem(
        int statusCode,
        string title,
        string detail,
        string type,
        IDictionary<string, string[]>? errors = null,
        IReadOnlyDictionary<string, object?>? extensionsData = null)
    {
        var extensions = new List<KeyValuePair<string, object?>>();
        if (errors is not null)
        {
            extensions.Add(new("errors", errors));
        }

        if (extensionsData is not null)
        {
            foreach (var (key, value) in extensionsData)
            {
                extensions.Add(new(key, value));
            }
        }

        return TypedResults.Problem(
            title: title,
            detail: detail,
            statusCode: statusCode,
            type: type,
            extensions: extensions.Count == 0 ? null : extensions);
    }
}
