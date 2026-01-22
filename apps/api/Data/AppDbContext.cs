using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppMeta> AppMetas => Set<AppMeta>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppMeta>(entity =>
        {
            entity.ToTable("__app_meta");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
        });
    }
}

public sealed class AppMeta
{
    public int Id { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
