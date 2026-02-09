using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<AppMeta> AppMetas => Set<AppMeta>();
    public DbSet<TrainerProfile> TrainerProfiles => Set<TrainerProfile>();
    public DbSet<ClientProfile> ClientProfiles => Set<ClientProfile>();
    public DbSet<TrainingSlot> TrainingSlots => Set<TrainingSlot>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SlotAttendee> SlotAttendees => Set<SlotAttendee>();
    public DbSet<UserAvatar> UserAvatars => Set<UserAvatar>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<PushEventDedup> PushEventDedups => Set<PushEventDedup>();
    public DbSet<PushReminderDispatch> PushReminderDispatches => Set<PushReminderDispatch>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<District> Districts => Set<District>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.Property(x => x.Name)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(x => x.Role)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(x => x.Gender)
                .HasConversion<string>()
                .HasMaxLength(12)
                .HasDefaultValue(Gender.Male)
                .IsRequired();
            entity.Property(x => x.PushEventsEnabled)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(x => x.PushGroupMinCancellationEnabled)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(x => x.PushReminderEnabled)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(x => x.PushReminderOffsetMinutes)
                .HasDefaultValue(120)
                .IsRequired();
        });

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
            entity.Property(x => x.CityId);
            entity.Property(x => x.DistrictId);
            entity.Property(x => x.GymName)
                .HasMaxLength(120);
            entity.Property(x => x.About)
                .HasMaxLength(250);
            entity.Property(x => x.Specializations)
                .HasColumnType("text[]")
                .IsRequired();
            entity.Property(x => x.TrainingTypes)
                .HasColumnType("text[]")
                .IsRequired();
            entity.Property(x => x.WorksWithGender)
                .HasConversion<string>()
                .HasMaxLength(12)
                .HasDefaultValue(Gender.Any);
            entity.Property(x => x.UserId)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => x.UserId)
                .IsUnique();
            entity.HasIndex(x => x.CityId);
            entity.HasIndex(x => x.DistrictId);
            entity.HasOne(x => x.User)
                .WithOne()
                .HasForeignKey<TrainerProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.City)
                .WithMany()
                .HasForeignKey(x => x.CityId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.District)
                .WithMany()
                .HasForeignKey(x => x.DistrictId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ClientProfile>(entity =>
        {
            entity.ToTable("client_profiles");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.UserId)
                .IsRequired();
            entity.Property(x => x.CityId);
            entity.Property(x => x.DistrictId);
            entity.Property(x => x.PreferredTrainerGender)
                .HasConversion<string>()
                .HasMaxLength(12)
                .HasDefaultValue(Gender.Any);
            entity.Property(x => x.Level)
                .HasConversion<string>()
                .HasMaxLength(16)
                .HasDefaultValue(ClientLevel.Beginner);
            entity.Property(x => x.Goals)
                .HasColumnType("text[]")
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasOne(x => x.User)
                .WithOne()
                .HasForeignKey<ClientProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(x => x.CityId);
            entity.HasIndex(x => x.DistrictId);
            entity.HasOne(x => x.City)
                .WithMany()
                .HasForeignKey(x => x.CityId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.District)
                .WithMany()
                .HasForeignKey(x => x.DistrictId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TrainingSlot>(entity =>
        {
            entity.ToTable("training_slots");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.StartsAtUtc)
                .IsRequired();
            entity.Property(x => x.DurationMinutes)
                .IsRequired();
            entity.Property(x => x.SlotType)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(TrainingSlotType.Individual)
                .IsRequired();
            entity.Property(x => x.CapacityMax);
            entity.Property(x => x.CapacityMin);
            entity.Property(x => x.AutoCancelIfMinNotReached)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(x => x.AutoCancelAtUtc);
            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => new { x.TrainerId, x.StartsAtUtc });
            entity.HasIndex(x => new { x.AutoCancelIfMinNotReached, x.AutoCancelAtUtc });
            entity.ToTable(tb => tb.HasCheckConstraint(
                "CK_training_slots_slot_type_capacity",
                "(\"SlotType\" = 'Individual' AND \"CapacityMin\" IS NULL AND \"CapacityMax\" IS NULL) "
                + "OR (\"SlotType\" = 'Group' AND \"CapacityMin\" IS NOT NULL AND \"CapacityMax\" IS NOT NULL "
                + "AND \"CapacityMin\" >= 2 AND \"CapacityMin\" <= \"CapacityMax\" AND \"CapacityMax\" <= 100)"));
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
            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(BookingStatus.Booked)
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

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("payments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Amount)
                .HasPrecision(12, 2)
                .IsRequired();
            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(PaymentStatus.Pending)
                .IsRequired();
            entity.Property(x => x.Method)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(x => x.PaidAtUtc);
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.Property(x => x.UpdatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => x.BookingId)
                .IsUnique();
            entity.HasOne(x => x.Booking)
                .WithOne(x => x.Payment)
                .HasForeignKey<Payment>(x => x.BookingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SlotAttendee>(entity =>
        {
            entity.ToTable("slot_attendees");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ClientId)
                .IsRequired();
            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(SlotAttendeeStatus.Booked)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.Property(x => x.UpdatedAtUtc);
            entity.HasIndex(x => new { x.SlotId, x.ClientId })
                .IsUnique();
            entity.HasIndex(x => x.SlotId);
            entity.HasIndex(x => new { x.ClientId, x.Status });
            entity.HasOne(x => x.Slot)
                .WithMany(x => x.Attendees)
                .HasForeignKey(x => x.SlotId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAvatar>(entity =>
        {
            entity.ToTable("user_avatars");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.ContentType)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(x => x.Bytes)
                .IsRequired();
            entity.Property(x => x.UpdatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasOne(x => x.User)
                .WithOne(x => x.Avatar)
                .HasForeignKey<UserAvatar>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Token)
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(x => x.ExpiresAtUtc)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => x.Token)
                .IsUnique();
            entity.HasIndex(x => x.UserId);
            entity.HasOne(x => x.User)
                .WithMany(x => x.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeviceToken>(entity =>
        {
            entity.ToTable("device_tokens");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Platform)
                .HasMaxLength(12)
                .IsRequired();
            entity.Property(x => x.Token)
                .HasMaxLength(512)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.Property(x => x.LastSeenAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(true);
            entity.HasIndex(x => x.Token)
                .IsUnique();
            entity.HasIndex(x => new { x.UserId, x.Platform });
            entity.HasOne(x => x.User)
                .WithMany(x => x.DeviceTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PushEventDedup>(entity =>
        {
            entity.ToTable("push_event_dedup");
            entity.HasKey(x => x.KeyHash);
            entity.Property(x => x.KeyHash)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(x => x.LastSentAtUtc)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
        });

        modelBuilder.Entity<PushReminderDispatch>(entity =>
        {
            entity.ToTable("push_reminder_dispatch");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.UserId)
                .IsRequired();
            entity.Property(x => x.SlotId)
                .IsRequired();
            entity.Property(x => x.ReminderOffsetMinutes)
                .IsRequired();
            entity.Property(x => x.SentAtUtc)
                .IsRequired();
            entity.Property(x => x.CreatedAtUtc)
                .HasDefaultValueSql("now() at time zone 'utc'");
            entity.HasIndex(x => new { x.UserId, x.SlotId, x.ReminderOffsetMinutes })
                .IsUnique();
            entity.HasIndex(x => x.SentAtUtc);
        });

        modelBuilder.Entity<City>(entity =>
        {
            entity.ToTable("cities");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name)
                .HasMaxLength(120)
                .IsRequired();
            entity.HasIndex(x => x.Name)
                .IsUnique();
        });

        modelBuilder.Entity<District>(entity =>
        {
            entity.ToTable("districts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name)
                .HasMaxLength(120)
                .IsRequired();
            entity.HasIndex(x => new { x.CityId, x.Name })
                .IsUnique();
            entity.HasOne(x => x.City)
                .WithMany(x => x.Districts)
                .HasForeignKey(x => x.CityId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}

public sealed class AppMeta
{
    public int Id { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
