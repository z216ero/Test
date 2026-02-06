namespace Api.Features.Push;

public static class PushPlatforms
{
    public const string Android = "android";
    public const string Ios = "ios";

    public static bool IsSupported(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return string.Equals(value, Android, StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, Ios, StringComparison.OrdinalIgnoreCase);
    }

    public static string Normalize(string value)
        => string.Equals(value, Ios, StringComparison.OrdinalIgnoreCase) ? Ios : Android;
}

public static class PushEventTypes
{
    public const string BookingCreated = "booking_created";
    public const string BookingCancelled = "booking_cancelled";
    public const string SlotCancelledByTrainer = "slot_cancelled_by_trainer";
    public const string AttendanceMarked = "attendance_marked";
}
