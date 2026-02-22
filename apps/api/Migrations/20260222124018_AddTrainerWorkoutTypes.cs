using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainerWorkoutTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "WorkoutTypeId",
                table: "bookings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "trainer_workout_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    NormalizeKey = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Other"),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now() at time zone 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trainer_workout_types", x => x.Id);
                    table.ForeignKey(
                        name: "FK_trainer_workout_types_trainer_profiles_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "trainer_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bookings_WorkoutTypeId",
                table: "bookings",
                column: "WorkoutTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_workout_types_TrainerId_IsArchived",
                table: "trainer_workout_types",
                columns: new[] { "TrainerId", "IsArchived" });

            migrationBuilder.CreateIndex(
                name: "IX_trainer_workout_types_TrainerId_NormalizeKey",
                table: "trainer_workout_types",
                columns: new[] { "TrainerId", "NormalizeKey" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_bookings_trainer_workout_types_WorkoutTypeId",
                table: "bookings",
                column: "WorkoutTypeId",
                principalTable: "trainer_workout_types",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bookings_trainer_workout_types_WorkoutTypeId",
                table: "bookings");

            migrationBuilder.DropTable(
                name: "trainer_workout_types");

            migrationBuilder.DropIndex(
                name: "IX_bookings_WorkoutTypeId",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "WorkoutTypeId",
                table: "bookings");
        }
    }
}
