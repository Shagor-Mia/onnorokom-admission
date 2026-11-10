using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;

#nullable disable

namespace SchoolAdmission.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

        modelBuilder.Entity<AdmissionClass>(entity =>
        {
            entity.Property(admissionClass => admissionClass.Id)
                .HasColumnType("uuid")
                .HasColumnName("id");

            entity.Property(admissionClass => admissionClass.CreatedAtUtc)
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            entity.Property(admissionClass => admissionClass.Name)
                .IsRequired()
                .HasMaxLength(200)
                .HasColumnType("character varying(200)")
                .HasColumnName("name");

            entity.Property(admissionClass => admissionClass.TotalSeats)
                .HasColumnType("integer")
                .HasColumnName("total_seats");

            entity.HasKey(admissionClass => admissionClass.Id)
                .HasName("pk_admission_classes");

            entity.ToTable("admission_classes", table =>
            {
                table.HasCheckConstraint(
                    "ck_admission_classes_name_not_empty",
                    "length(btrim(name)) > 0");
                table.HasCheckConstraint(
                    "ck_admission_classes_total_seats_positive",
                    "total_seats > 0");
            });
        });

        modelBuilder.Entity<AdmissionHold>(entity =>
        {
            entity.Property(hold => hold.Id)
                .HasColumnType("uuid")
                .HasColumnName("id");

            entity.Property(hold => hold.CancelledAtUtc)
                .HasColumnType("timestamp with time zone")
                .HasColumnName("cancelled_at_utc");

            entity.Property(hold => hold.ClassId)
                .HasColumnType("uuid")
                .HasColumnName("class_id");

            entity.Property(hold => hold.ConfirmedAtUtc)
                .HasColumnType("timestamp with time zone")
                .HasColumnName("confirmed_at_utc");

            entity.Property(hold => hold.CreatedAtUtc)
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            entity.Property(hold => hold.ExpiresAtUtc)
                .HasColumnType("timestamp with time zone")
                .HasColumnName("expires_at_utc");

            entity.Property(hold => hold.StudentId)
                .IsRequired()
                .HasMaxLength(17)
                .HasColumnType("character varying(17)")
                .HasColumnName("student_id");

            entity.Property(hold => hold.Status)
                .HasConversion<HoldStatusConverter>()
                .IsRequired()
                .HasMaxLength(10)
                .HasColumnType("character varying(10)")
                .HasColumnName("status");

            entity.HasKey(hold => hold.Id)
                .HasName("pk_admission_holds");

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

            entity.ToTable("admission_holds", table =>
            {
                table.HasCheckConstraint(
                    "ck_admission_holds_student_id_format",
                    "student_id ~ '^[0-9]{17}$'");
                table.HasCheckConstraint(
                    "ck_admission_holds_status",
                    "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
            });
        });

        modelBuilder.Entity<AdmissionHold>()
            .HasOne(hold => hold.Class)
            .WithMany(admissionClass => admissionClass.Holds)
            .HasForeignKey(hold => hold.ClassId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
