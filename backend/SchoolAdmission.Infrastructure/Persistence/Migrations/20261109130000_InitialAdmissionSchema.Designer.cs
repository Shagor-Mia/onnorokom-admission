using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SchoolAdmission.Infrastructure.Persistence;

#nullable disable

namespace SchoolAdmission.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261109130000_InitialAdmissionSchema")]
partial class InitialAdmissionSchema
{
    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

        modelBuilder.Entity("SchoolAdmission.Domain.Entities.AdmissionClass", entity =>
        {
            entity.Property<Guid>("Id")
                .HasColumnType("uuid")
                .HasColumnName("id");

            entity.Property<DateTimeOffset>("CreatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            entity.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(200)
                .HasColumnType("character varying(200)")
                .HasColumnName("name");

            entity.Property<int>("TotalSeats")
                .HasColumnType("integer")
                .HasColumnName("total_seats");

            entity.HasKey("Id")
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

        modelBuilder.Entity("SchoolAdmission.Domain.Entities.AdmissionHold", entity =>
        {
            entity.Property<Guid>("Id")
                .HasColumnType("uuid")
                .HasColumnName("id");

            entity.Property<DateTimeOffset?>("CancelledAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("cancelled_at_utc");

            entity.Property<Guid>("ClassId")
                .HasColumnType("uuid")
                .HasColumnName("class_id");

            entity.Property<DateTimeOffset?>("ConfirmedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("confirmed_at_utc");

            entity.Property<DateTimeOffset>("CreatedAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("created_at_utc");

            entity.Property<DateTimeOffset>("ExpiresAtUtc")
                .HasColumnType("timestamp with time zone")
                .HasColumnName("expires_at_utc");

            entity.Property<string>("StudentId")
                .IsRequired()
                .HasMaxLength(17)
                .HasColumnType("character varying(17)")
                .HasColumnName("student_id");

            entity.Property<SchoolAdmission.Domain.Enums.HoldStatus>("Status")
                .HasConversion<HoldStatusConverter>()
                .IsRequired()
                .HasMaxLength(10)
                .HasColumnType("character varying(10)")
                .HasColumnName("status");

            entity.HasKey("Id")
                .HasName("pk_admission_holds");

            entity.HasIndex("ClassId", "Status", "ExpiresAtUtc")
                .HasDatabaseName("ix_holds_class_status_expiry");

            entity.HasIndex("StudentId", "CreatedAtUtc")
                .HasDatabaseName("ix_holds_student_created");

            entity.HasIndex("StudentId", "ClassId", "Status")
                .HasDatabaseName("ix_holds_student_class_status");

            entity.HasIndex("StudentId", "ClassId")
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

        modelBuilder.Entity("SchoolAdmission.Domain.Entities.AdmissionHold", entity =>
        {
            entity.HasOne("SchoolAdmission.Domain.Entities.AdmissionClass", "Class")
                .WithMany("Holds")
                .HasForeignKey("ClassId")
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            entity.Navigation("Class");
        });

        modelBuilder.Entity("SchoolAdmission.Domain.Entities.AdmissionClass", entity =>
        {
            entity.Navigation("Holds");
        });
    }
}
