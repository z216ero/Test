using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupSlotAutoCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AutoCancelAtUtc",
                table: "training_slots",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoCancelIfMinNotReached",
                table: "training_slots",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_training_slots_AutoCancelIfMinNotReached_AutoCancelAtUtc",
                table: "training_slots",
                columns: new[] { "AutoCancelIfMinNotReached", "AutoCancelAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_training_slots_AutoCancelIfMinNotReached_AutoCancelAtUtc",
                table: "training_slots");

            migrationBuilder.DropColumn(
                name: "AutoCancelAtUtc",
                table: "training_slots");

            migrationBuilder.DropColumn(
                name: "AutoCancelIfMinNotReached",
                table: "training_slots");
        }
    }
}
