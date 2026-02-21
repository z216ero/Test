using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainerClientLinksAndBookingConfirmations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ClientConfirmationRequestedAtUtc",
                table: "bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClientConfirmationRespondedAtUtc",
                table: "bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClientConfirmationStatus",
                table: "bookings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Confirmed");

            migrationBuilder.AddColumn<bool>(
                name: "PushClientLinkResponsesEnabled",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "PushTrainerLinkRequestsEnabled",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "trainer_client_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastRequestAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RejectedUntilUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trainer_client_links", x => x.Id);
                    table.ForeignKey(
                        name: "FK_trainer_client_links_AspNetUsers_ClientUserId",
                        column: x => x.ClientUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_trainer_client_links_trainer_profiles_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "trainer_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bookings_ClientId_ClientConfirmationStatus",
                table: "bookings",
                columns: new[] { "ClientId", "ClientConfirmationStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_trainer_client_links_ClientUserId",
                table: "trainer_client_links",
                column: "ClientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_client_links_ClientUserId_Status",
                table: "trainer_client_links",
                columns: new[] { "ClientUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_trainer_client_links_TrainerId",
                table: "trainer_client_links",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_client_links_TrainerId_ClientUserId",
                table: "trainer_client_links",
                columns: new[] { "TrainerId", "ClientUserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "trainer_client_links");

            migrationBuilder.DropIndex(
                name: "IX_bookings_ClientId_ClientConfirmationStatus",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "ClientConfirmationRequestedAtUtc",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "ClientConfirmationRespondedAtUtc",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "ClientConfirmationStatus",
                table: "bookings");

            migrationBuilder.DropColumn(
                name: "PushClientLinkResponsesEnabled",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PushTrainerLinkRequestsEnabled",
                table: "AspNetUsers");
        }
    }
}
