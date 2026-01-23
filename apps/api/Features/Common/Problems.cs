using Microsoft.AspNetCore.Http;

namespace Api.Features.Common;

public static class Problems
{
    private const string ErrorTypeBase = "https://errors.trainerapp";
    private static readonly string ValidationType = $"{ErrorTypeBase}/validation";
    private static readonly string BadRequestType = $"{ErrorTypeBase}/bad-request";
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

    public static IResult NotFound(string title, string detail)
        => CreateProblem(StatusCodes.Status404NotFound, title, detail, NotFoundType);

    public static IResult Conflict(string title, string detail)
        => CreateProblem(StatusCodes.Status409Conflict, title, detail, ConflictType);

    public static IResult FromServiceError(ServiceError error)
        => error.StatusCode switch
        {
            StatusCodes.Status400BadRequest => BadRequest(error.Title, error.Detail),
            StatusCodes.Status404NotFound => NotFound(error.Title, error.Detail),
            StatusCodes.Status409Conflict => Conflict(error.Title, error.Detail),
            _ => CreateProblem(error.StatusCode, error.Title, error.Detail, UnknownType)
        };

    private static IResult CreateProblem(
        int statusCode,
        string title,
        string detail,
        string type,
        IDictionary<string, string[]>? errors = null)
    {
        List<KeyValuePair<string, object?>>? extensions = null;
        if (errors is not null)
        {
            extensions = new List<KeyValuePair<string, object?>>
            {
                new("errors", errors)
            };
        }

        return TypedResults.Problem(
            title: title,
            detail: detail,
            statusCode: statusCode,
            type: type,
            extensions: extensions);
    }
}
