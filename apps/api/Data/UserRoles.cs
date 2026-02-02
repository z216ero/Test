namespace Api.Data;

public static class UserRoles
{
    public const string Trainer = "Trainer";
    public const string Client = "Client";

    public static bool IsValid(string? value)
        => string.Equals(value, Trainer, StringComparison.OrdinalIgnoreCase)
           || string.Equals(value, Client, StringComparison.OrdinalIgnoreCase);

    public static string Normalize(string value)
        => string.Equals(value, Trainer, StringComparison.OrdinalIgnoreCase)
            ? Trainer
            : Client;
}
