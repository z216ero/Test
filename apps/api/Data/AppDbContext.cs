using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppMeta> AppMetas => Set<AppMeta>();
    public DbSet<TrainerProfile> TrainerProfiles => Set<TrainerProfile>();
    public DbSet<TrainingSlot> TrainingSlots => Set<TrainingSlot>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppMeta>(entity =>
        {
            entity.ToTable("__app_meta");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
        });

        modelBuilder.Entity<TrainerProfile>(entity =>
        {
            entity.ToTable("trainer_profiles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DisplayName)
                .IsRequired()
                .HasMaxLength(100);
            entity.Property(x => x.GymName)
                .HasMaxLength(120);
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
        });

        modelBuilder.Entity<TrainingSlot>(entity =>
        {
            entity.ToTable("training_slots");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.StartsAtUtc)
                .IsRequired();
            entity.Property(x => x.DurationMinutes)
                .IsRequired();
            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => new { x.TrainerId, x.StartsAtUtc });
            entity.HasOne(x => x.TrainerProfile)
                .WithMany(x => x.Slots)
                .HasForeignKey(x => x.TrainerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.ToTable("bookings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ClientId)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => x.SlotId)
                .IsUnique();
            entity.HasOne(x => x.Slot)
                .WithOne(x => x.Booking)
                .HasForeignKey<Booking>(x => x.SlotId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

public sealed class AppMeta
{
    public int Id { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
