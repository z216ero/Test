namespace Api.Features.Common;

public sealed record ServiceError(int StatusCode, string Title, string Detail);

public sealed record ServiceResult<T>(T? Value, ServiceError? Error)
{
    public bool IsSuccess => Error is null;

    public static ServiceResult<T> Success(T value) => new(value, null);

    public static ServiceResult<T> Fail(int statusCode, string title, string detail)
        => new(default, new ServiceError(statusCode, title, detail));
}
