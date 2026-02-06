using Api.Data;

namespace Api.Features.Lookups;

public static class LookupCatalog
{
    public static readonly string[] RoleCodes = [UserRoles.Trainer, UserRoles.Client];
    public static readonly string[] GenderCodes = [nameof(Gender.Male), nameof(Gender.Female), nameof(Gender.Any)];
    public static readonly string[] LevelCodes = [nameof(ClientLevel.Beginner), nameof(ClientLevel.Intermediate), nameof(ClientLevel.Advanced)];
    public static readonly string[] GoalCodes = ["WeightLoss", "MuscleGain", "Strength", "Rehab", "GeneralFitness"];
    public static readonly string[] SpecializationCodes = [
        "StrengthTraining",
        "Crossfit",
        "Functional",
        "Rehab",
        "WeightLoss",
        "Yoga",
        "Pilates"
    ];
    public static readonly string[] TrainingTypeCodes = ["Individual", "Group"];
    public static readonly string[] SlotStatusCodes = [nameof(TrainingSlotStatus.Open), nameof(TrainingSlotStatus.Booked), nameof(TrainingSlotStatus.Cancelled)];
    public static readonly string[] BookingStatusCodes = [nameof(BookingStatus.Booked), nameof(BookingStatus.Cancelled), nameof(BookingStatus.Completed), nameof(BookingStatus.NoShow)];
    public static readonly string[] PaymentStatusCodes = ["Pending", "Paid", "Refunded"];
    public static readonly string[] PaymentMethodCodes = ["Cash", "Transfer", "SBP"];
    public static readonly string[] DateFilterCodes = ["Today", "Tomorrow", "ThisWeek", "CustomDate"];
    public static readonly string[] SortOptionCodes = ["ByRating", "ByPrice", "ByDistance"];

    public static bool IsValidRole(string? value) => IsValid(value, RoleCodes);
    public static bool IsValidGender(string? value) => IsValid(value, GenderCodes);
    public static bool IsValidLevel(string? value) => IsValid(value, LevelCodes);
    public static bool IsValidGoal(string? value) => IsValid(value, GoalCodes);
    public static bool IsValidSpecialization(string? value) => IsValid(value, SpecializationCodes);
    public static bool IsValidTrainingType(string? value) => IsValid(value, TrainingTypeCodes);

    public static LookupResponse GetRoles(string lang)
        => new(new[]
        {
            new LookupItem(
                UserRoles.Trainer,
                ResolveLabel(RoleLabels[UserRoles.Trainer], lang),
                IsDefault: false,
                IsAny: false,
                IsTrainerRole: true,
                IsClientRole: false),
            new LookupItem(
                UserRoles.Client,
                ResolveLabel(RoleLabels[UserRoles.Client], lang),
                IsDefault: true,
                IsAny: false,
                IsTrainerRole: false,
                IsClientRole: true)
        });

    public static LookupResponse GetGenders(string lang)
        => new(BuildItems(lang, GenderCodes, GenderLabels, defaultCode: nameof(Gender.Male), anyCode: nameof(Gender.Any)));

    public static LookupResponse GetLevels(string lang)
        => new(BuildItems(lang, LevelCodes, LevelLabels, defaultCode: nameof(ClientLevel.Beginner)));

    public static LookupResponse GetGoals(string lang)
        => new(BuildItems(lang, GoalCodes, GoalLabels));

    public static LookupResponse GetSpecializations(string lang)
        => new(BuildItems(lang, SpecializationCodes, SpecializationLabels));

    public static LookupResponse GetTrainingTypes(string lang)
        => new(BuildItems(lang, TrainingTypeCodes, TrainingTypeLabels));

    public static LookupResponse GetSlotStatuses(string lang)
        => new(BuildItems(lang, SlotStatusCodes, SlotStatusLabels));

    public static LookupResponse GetBookingStatuses(string lang)
        => new(BuildItems(lang, BookingStatusCodes, BookingStatusLabels));

    public static LookupResponse GetPaymentStatuses(string lang)
        => new(BuildItems(lang, PaymentStatusCodes, PaymentStatusLabels));

    public static LookupResponse GetPaymentMethods(string lang)
        => new(BuildItems(lang, PaymentMethodCodes, PaymentMethodLabels));

    public static LookupResponse GetDateFilters(string lang)
        => new(BuildItems(lang, DateFilterCodes, DateFilterLabels, defaultCode: "Today"));

    public static LookupResponse GetSortOptions(string lang)
        => new(BuildItems(lang, SortOptionCodes, SortOptionLabels, defaultCode: "ByRating"));

    private static IReadOnlyList<LookupItem> BuildItems(
        string lang,
        IReadOnlyList<string> codes,
        IReadOnlyDictionary<string, (string Ru, string En)> labels,
        string? defaultCode = null,
        string? anyCode = null)
    {
        return codes
            .Select(code =>
            {
                var label = labels.TryGetValue(code, out var value)
                    ? ResolveLabel(value, lang)
                    : code;
                return new LookupItem(
                    code,
                    label,
                    string.Equals(code, defaultCode, StringComparison.OrdinalIgnoreCase),
                    string.Equals(code, anyCode, StringComparison.OrdinalIgnoreCase));
            })
            .ToList();
    }

    private static bool IsValid(string? value, IReadOnlyList<string> allowed)
        => !string.IsNullOrWhiteSpace(value)
           && allowed.Any(code => string.Equals(code, value, StringComparison.OrdinalIgnoreCase));

    private static string ResolveLabel((string Ru, string En) value, string lang)
        => string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase)
            ? value.En
            : value.Ru;

    private static readonly Dictionary<string, (string Ru, string En)> RoleLabels = new()
    {
        [UserRoles.Trainer] = ("Тренер", "Trainer"),
        [UserRoles.Client] = ("Клиент", "Client")
    };

    private static readonly Dictionary<string, (string Ru, string En)> GenderLabels = new()
    {
        [nameof(Gender.Male)] = ("Мужской", "Male"),
        [nameof(Gender.Female)] = ("Женский", "Female"),
        [nameof(Gender.Any)] = ("Любой", "Any")
    };

    private static readonly Dictionary<string, (string Ru, string En)> LevelLabels = new()
    {
        [nameof(ClientLevel.Beginner)] = ("Новичок", "Beginner"),
        [nameof(ClientLevel.Intermediate)] = ("Средний", "Intermediate"),
        [nameof(ClientLevel.Advanced)] = ("Продвинутый", "Advanced")
    };

    private static readonly Dictionary<string, (string Ru, string En)> GoalLabels = new()
    {
        ["WeightLoss"] = ("Снижение веса", "Weight loss"),
        ["MuscleGain"] = ("Набор мышечной массы", "Muscle gain"),
        ["Strength"] = ("Сила", "Strength"),
        ["Rehab"] = ("Реабилитация", "Rehab"),
        ["GeneralFitness"] = ("Общая физическая форма", "General fitness")
    };

    private static readonly Dictionary<string, (string Ru, string En)> SpecializationLabels = new()
    {
        ["StrengthTraining"] = ("Силовой тренинг", "Strength training"),
        ["Crossfit"] = ("Кроссфит", "Crossfit"),
        ["Functional"] = ("Функциональный тренинг", "Functional training"),
        ["Rehab"] = ("Реабилитация/ЛФК", "Rehab"),
        ["WeightLoss"] = ("Похудение", "Weight loss"),
        ["Yoga"] = ("Йога", "Yoga"),
        ["Pilates"] = ("Пилатес", "Pilates")
    };

    private static readonly Dictionary<string, (string Ru, string En)> TrainingTypeLabels = new()
    {
        ["Individual"] = ("Индивидуальная тренировка", "Individual training"),
        ["Group"] = ("Групповая тренировка", "Group training")
    };

    private static readonly Dictionary<string, (string Ru, string En)> SlotStatusLabels = new()
    {
        [nameof(TrainingSlotStatus.Open)] = ("Открыт", "Open"),
        [nameof(TrainingSlotStatus.Booked)] = ("Забронирован", "Booked"),
        [nameof(TrainingSlotStatus.Cancelled)] = ("Отменён", "Cancelled")
    };

    private static readonly Dictionary<string, (string Ru, string En)> BookingStatusLabels = new()
    {
        [nameof(BookingStatus.Booked)] = ("Записано", "Booked"),
        [nameof(BookingStatus.Cancelled)] = ("Отменено", "Cancelled"),
        [nameof(BookingStatus.Completed)] = ("Проведена", "Completed"),
        [nameof(BookingStatus.NoShow)] = ("Неявка", "No show")
    };

    private static readonly Dictionary<string, (string Ru, string En)> PaymentStatusLabels = new()
    {
        ["Pending"] = ("Ожидает оплаты", "Pending"),
        ["Paid"] = ("Оплачено", "Paid"),
        ["Refunded"] = ("Возврат", "Refunded")
    };

    private static readonly Dictionary<string, (string Ru, string En)> PaymentMethodLabels = new()
    {
        ["Cash"] = ("Наличные", "Cash"),
        ["Transfer"] = ("Перевод", "Transfer"),
        ["SBP"] = ("СБП", "SBP")
    };

    private static readonly Dictionary<string, (string Ru, string En)> DateFilterLabels = new()
    {
        ["Today"] = ("Сегодня", "Today"),
        ["Tomorrow"] = ("Завтра", "Tomorrow"),
        ["ThisWeek"] = ("На этой неделе", "This week"),
        ["CustomDate"] = ("Выбрать дату", "Custom date")
    };

    private static readonly Dictionary<string, (string Ru, string En)> SortOptionLabels = new()
    {
        ["ByRating"] = ("По рейтингу", "By rating"),
        ["ByPrice"] = ("По цене", "By price"),
        ["ByDistance"] = ("По расстоянию", "By distance")
    };
}
