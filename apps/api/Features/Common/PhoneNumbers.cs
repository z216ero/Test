using System.Text.RegularExpressions;

namespace Api.Features.Common;

public static partial class PhoneNumbers
{
    [GeneratedRegex(@"[\s\-\(\)]", RegexOptions.Compiled)]
    private static partial Regex Separators();

    private static readonly Regex E164Regex = new(@"^\+[1-9]\d{7,14}$", RegexOptions.Compiled);

    public static bool TryNormalizeToE164(string? input, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        var compact = Separators().Replace(input.Trim(), string.Empty);
        if (compact.StartsWith("8", StringComparison.Ordinal)
            && compact.Length == 11
            && compact.All(char.IsDigit))
        {
            compact = $"+7{compact[1..]}";
        }

        if (!E164Regex.IsMatch(compact))
        {
            return false;
        }

        normalized = compact;
        return true;
    }

    public static string MaskE164(string? e164)
    {
        if (string.IsNullOrWhiteSpace(e164))
        {
            return string.Empty;
        }

        var normalized = e164.Trim();
        if (normalized.Length <= 6)
        {
            return normalized;
        }

        var prefix = normalized[..3];
        var suffix = normalized[^2..];
        return $"{prefix}***{suffix}";
    }
}
