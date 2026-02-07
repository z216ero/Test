using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupSlotsAndAttendees : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CapacityMax",
                table: "training_slots",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CapacityMin",
                table: "training_slots",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SlotType",
                table: "training_slots",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Individual");

            migrationBuilder.CreateTable(
                name: "slot_attendees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Booked"),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now() at time zone 'utc'"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_slot_attendees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_slot_attendees_training_slots_SlotId",
                        column: x => x.SlotId,
                        principalTable: "training_slots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_training_slots_slot_type_capacity",
                table: "training_slots",
                sql: "(\"SlotType\" = 'Individual' AND \"CapacityMin\" IS NULL AND \"CapacityMax\" IS NULL) OR (\"SlotType\" = 'Group' AND \"CapacityMin\" IS NOT NULL AND \"CapacityMax\" IS NOT NULL AND \"CapacityMin\" >= 2 AND \"CapacityMin\" <= \"CapacityMax\" AND \"CapacityMax\" <= 100)");

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_ClientId_Status",
                table: "slot_attendees",
                columns: new[] { "ClientId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_SlotId",
                table: "slot_attendees",
                column: "SlotId");

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_SlotId_ClientId",
                table: "slot_attendees",
                columns: new[] { "SlotId", "ClientId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "slot_attendees");

            migrationBuilder.DropCheckConstraint(
                name: "CK_training_slots_slot_type_capacity",
                table: "training_slots");

            migrationBuilder.DropColumn(
                name: "CapacityMax",
                table: "training_slots");

            migrationBuilder.DropColumn(
                name: "CapacityMin",
                table: "training_slots");

            migrationBuilder.DropColumn(
                name: "SlotType",
                table: "training_slots");
        }
    }
}
