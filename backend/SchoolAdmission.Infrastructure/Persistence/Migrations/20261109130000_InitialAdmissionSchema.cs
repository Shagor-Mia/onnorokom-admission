using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolAdmission.Infrastructure.Persistence.Migrations;

public partial class InitialAdmissionSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "admission_classes",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                total_seats = table.Column<int>(type: "integer", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_admission_classes", column => column.id);
                table.CheckConstraint("ck_admission_classes_name_not_empty", "length(btrim(name)) > 0");
                table.CheckConstraint("ck_admission_classes_total_seats_positive", "total_seats > 0");
            });

        migrationBuilder.CreateTable(
            name: "admission_holds",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                class_id = table.Column<Guid>(type: "uuid", nullable: false),
                student_id = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: false),
                status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                confirmed_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                cancelled_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_admission_holds", column => column.id);
                table.CheckConstraint("ck_admission_holds_student_id_format", "student_id ~ '^[0-9]{17}$'");
                table.CheckConstraint("ck_admission_holds_status", "status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')");
                table.ForeignKey(
                    name: "fk_admission_holds_admission_classes_class_id",
                    column: hold => hold.class_id,
                    principalTable: "admission_classes",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_holds_class_status_expiry",
            table: "admission_holds",
            columns: new[] { "class_id", "status", "expires_at_utc" });

        migrationBuilder.CreateIndex(
            name: "ix_holds_student_created",
            table: "admission_holds",
            columns: new[] { "student_id", "created_at_utc" });

        migrationBuilder.CreateIndex(
            name: "ix_holds_student_class_status",
            table: "admission_holds",
            columns: new[] { "student_id", "class_id", "status" });

        migrationBuilder.CreateIndex(
            name: "ux_holds_student_class_active",
            table: "admission_holds",
            columns: new[] { "student_id", "class_id" },
            unique: true,
            filter: "\"status\" IN ('HELD', 'CONFIRMED')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "admission_holds");
        migrationBuilder.DropTable(name: "admission_classes");
    }
}
