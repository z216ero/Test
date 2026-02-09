using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPushTrainingReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PushReminderEnabled",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "PushReminderOffsetMinutes",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 120);

            migrationBuilder.CreateTable(
                name: "push_reminder_dispatch",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SlotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReminderOffsetMinutes = table.Column<int>(type: "integer", nullable: false),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now() at time zone 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_push_reminder_dispatch", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_push_reminder_dispatch_SentAtUtc",
                table: "push_reminder_dispatch",
                column: "SentAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_push_reminder_dispatch_UserId_SlotId_ReminderOffsetMinutes",
                table: "push_reminder_dispatch",
                columns: new[] { "UserId", "SlotId", "ReminderOffsetMinutes" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "push_reminder_dispatch");

            migrationBuilder.DropColumn(
                name: "PushReminderEnabled",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PushReminderOffsetMinutes",
                table: "AspNetUsers");
        }
    }
}
