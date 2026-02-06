using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Features.Lookups;

public static class LookupEndpoints
{
    public static IEndpointRouteBuilder MapLookupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/lookups").WithTags("Lookups");

        group.MapGet("/roles", (string? lang) => Results.Ok(LookupCatalog.GetRoles(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/genders", (string? lang) => Results.Ok(LookupCatalog.GetGenders(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/levels", (string? lang) => Results.Ok(LookupCatalog.GetLevels(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/goals", (string? lang) => Results.Ok(LookupCatalog.GetGoals(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/specializations", (string? lang) => Results.Ok(LookupCatalog.GetSpecializations(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/training-types", (string? lang) => Results.Ok(LookupCatalog.GetTrainingTypes(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/slot-statuses", (string? lang) => Results.Ok(LookupCatalog.GetSlotStatuses(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/booking-statuses", (string? lang) => Results.Ok(LookupCatalog.GetBookingStatuses(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/payment-statuses", (string? lang) => Results.Ok(LookupCatalog.GetPaymentStatuses(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/payment-methods", (string? lang) => Results.Ok(LookupCatalog.GetPaymentMethods(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/date-filters", (string? lang) => Results.Ok(LookupCatalog.GetDateFilters(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/sort-options", (string? lang) => Results.Ok(LookupCatalog.GetSortOptions(NormalizeLang(lang))))
            .Produces<LookupResponse>(StatusCodes.Status200OK);

        group.MapGet("/cities", async (
            string? q,
            AppDbContext db,
            CancellationToken cancellationToken) =>
        {
            var query = db.Cities.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(x => EF.Functions.ILike(x.Name, $"%{term}%"));
            }

            var items = await query
                .OrderBy(x => x.Name)
                .Take(20)
                .Select(x => new CityDto(x.Id, x.Name))
                .ToListAsync(cancellationToken);
            return Results.Ok(items);
        })
        .Produces<IReadOnlyList<CityDto>>(StatusCodes.Status200OK);

        group.MapGet("/districts", async (
            int? cityId,
            string? q,
            AppDbContext db,
            CancellationToken cancellationToken) =>
        {
            var query = db.Districts.AsNoTracking();
            if (cityId.HasValue)
            {
                query = query.Where(x => x.CityId == cityId.Value);
            }
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(x => EF.Functions.ILike(x.Name, $"%{term}%"));
            }

            var items = await query
                .OrderBy(x => x.Name)
                .Take(20)
                .Select(x => new DistrictDto(x.Id, x.CityId, x.Name))
                .ToListAsync(cancellationToken);

            return Results.Ok(items);
        })
        .Produces<IReadOnlyList<DistrictDto>>(StatusCodes.Status200OK);

        return app;
    }

    private static string NormalizeLang(string? lang)
        => string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase)
            ? "en"
            : "ru";
}
