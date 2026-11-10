using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain.Entities;

namespace SchoolAdmission.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AdmissionClass> Classes => Set<AdmissionClass>();
    public DbSet<AdmissionHold> Holds => Set<AdmissionHold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AdmissionClass>(entity =>
        {
            entity.ToTable("admission_classes", table =>
            {
                table.HasCheckConstraint(
                    "ck_admission_classes_name_not_empty",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint(
                    "ck_admission_classes_total_seats_positive",
                    "total_seats > 0");
            });

            entity.HasKey(admissionClass => admissionClass.Id)
                .HasName("pk_admission_classes");
            entity.Property(admissionClass => admissionClass.Id).HasColumnName("id");
            entity.Property(admissionClass => admissionClass.Name)
                .HasColumnName("name")
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(admissionClass => admissionClass.TotalSeats)
                .HasColumnName("total_seats")
                .IsRequired();
            entity.Property(admissionClass => admissionClass.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();
        });

        modelBuilder.Entity<AdmissionHold>(entity =>
        {
            entity.ToTable("admission_holds", table =>
            {
                table.HasCheckConstraint(
                    "ck_admission_holds_student_id_format",
                    "student_id ~ '^[0-9]{17}$'");
                table.HasCheckConstraint(
                    "ck_admission_holds_status",
                    "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
            });

            entity.HasKey(hold => hold.Id)
                .HasName("pk_admission_holds");
            entity.Property(hold => hold.Id).HasColumnName("id");
            entity.Property(hold => hold.ClassId).HasColumnName("class_id");
            entity.Property(hold => hold.StudentId)
                .HasColumnName("student_id")
                .HasMaxLength(17)
                .IsRequired();
            entity.Property(hold => hold.Status)
                .HasColumnName("status")
                .HasMaxLength(10)
                .HasConversion<HoldStatusConverter>()
                .IsRequired();
            entity.Property(hold => hold.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();
            entity.Property(hold => hold.ExpiresAtUtc)
                .HasColumnName("expires_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();
            entity.Property(hold => hold.ConfirmedAtUtc)
                .HasColumnName("confirmed_at_utc")
                .HasColumnType("timestamp with time zone");
            entity.Property(hold => hold.CancelledAtUtc)
                .HasColumnName("cancelled_at_utc")
                .HasColumnType("timestamp with time zone");

            entity.HasOne(hold => hold.Class)
                .WithMany(admissionClass => admissionClass.Holds)
                .HasForeignKey(hold => hold.ClassId)
                .HasConstraintName("fk_admission_holds_admission_classes_class_id")
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            entity.HasIndex(hold => new { hold.ClassId, hold.Status, hold.ExpiresAtUtc })
                .HasDatabaseName("ix_holds_class_status_expiry");
            entity.HasIndex(hold => new { hold.StudentId, hold.CreatedAtUtc })
                .HasDatabaseName("ix_holds_student_created");
            entity.HasIndex(hold => new { hold.StudentId, hold.ClassId, hold.Status })
                .HasDatabaseName("ix_holds_student_class_status");
            entity.HasIndex(hold => new { hold.StudentId, hold.ClassId })
                .IsUnique()
                .HasDatabaseName("ux_holds_student_class_active")
                .HasFilter("\"status\" IN ('HELD', 'CONFIRMED')");
        });
    }
}
