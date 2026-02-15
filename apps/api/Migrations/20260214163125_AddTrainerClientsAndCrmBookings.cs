using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainerClientsAndCrmBookings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_slot_attendees_SlotId_ClientId",
                table: "slot_attendees");

            migrationBuilder.AlterColumn<Guid>(
                name: "ClientId",
                table: "slot_attendees",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "TrainerClientId",
                table: "slot_attendees",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ClientId",
                table: "bookings",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "TrainerClientId",
                table: "bookings",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAtUtc",
                table: "bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "trainer_clients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    LinkedUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Active"),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now() at time zone 'utc'"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trainer_clients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_trainer_clients_AspNetUsers_LinkedUserId",
                        column: x => x.LinkedUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_trainer_clients_trainer_profiles_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "trainer_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_SlotId_ClientId",
                table: "slot_attendees",
                columns: new[] { "SlotId", "ClientId" },
                unique: true,
                filter: "\"ClientId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_SlotId_TrainerClientId",
                table: "slot_attendees",
                columns: new[] { "SlotId", "TrainerClientId" },
                unique: true,
                filter: "\"TrainerClientId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_TrainerClientId_Status",
                table: "slot_attendees",
                columns: new[] { "TrainerClientId", "Status" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_slot_attendees_client_or_trainer_client",
                table: "slot_attendees",
                sql: "(\"ClientId\" IS NULL) <> (\"TrainerClientId\" IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_bookings_ClientId",
                table: "bookings",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_bookings_TrainerClientId",
                table: "bookings",
                column: "TrainerClientId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_bookings_client_or_trainer_client",
                table: "bookings",
                sql: "(\"ClientId\" IS NULL) <> (\"TrainerClientId\" IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_clients_LinkedUserId",
                table: "trainer_clients",
                column: "LinkedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_clients_TrainerId",
                table: "trainer_clients",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_clients_TrainerId_LinkedUserId",
                table: "trainer_clients",
                columns: new[] { "TrainerId", "LinkedUserId" },
                unique: true,
                filter: "\"LinkedUserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_clients_TrainerId_Phone",
                table: "trainer_clients",
                columns: new[] { "TrainerId", "Phone" },
                unique: true,
                filter: "\"Phone\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_bookings_trainer_clients_TrainerClientId",
                table: "bookings",
                column: "TrainerClientId",
                principalTable: "trainer_clients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_slot_attendees_trainer_clients_TrainerClientId",
                table: "slot_attendees",
                column: "TrainerClientId",
                principalTable: "trainer_clients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bookings_trainer_clients_TrainerClientId",
                table: "bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_slot_attendees_trainer_clients_TrainerClientId",
                table: "slot_attendees");

            migrationBuilder.DropTable(
                name: "trainer_clients");

            migrationBuilder.DropIndex(
                name: "IX_slot_attendees_SlotId_ClientId",
                table: "slot_attendees");

            migrationBuilder.DropIndex(
                name: "IX_slot_attendees_SlotId_TrainerClientId",
                table: "slot_attendees");

            migrationBuilder.DropIndex(
                name: "IX_slot_attendees_TrainerClientId_Status",
                table: "slot_attendees");

            migrationBuilder.DropCheckConstraint(
                name: "CK_slot_attendees_client_or_trainer_client",
                table: "slot_attendees");

            migrationBuilder.DropIndex(
                name: "IX_bookings_ClientId",
                table: "bookings");

            migrationBuilder.DropIndex(
                name: "IX_bookings_TrainerClientId",
                table: "bookings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_bookings_client_or_trainer_client",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "TrainerClientId",
                table: "slot_attendees");

            migrationBuilder.DropColumn(
                name: "TrainerClientId",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "bookings");

            migrationBuilder.AlterColumn<Guid>(
                name: "ClientId",
                table: "slot_attendees",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ClientId",
                table: "bookings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_slot_attendees_SlotId_ClientId",
                table: "slot_attendees",
                columns: new[] { "SlotId", "ClientId" },
                unique: true);
        }
    }
}
