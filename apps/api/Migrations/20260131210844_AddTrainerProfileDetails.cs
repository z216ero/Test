using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainerProfileDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "About",
                table: "trainer_profiles",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClientGenderPreference",
                table: "trainer_profiles",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "All");

            migrationBuilder.AddColumn<string[]>(
                name: "TrainingTypes",
                table: "trainer_profiles",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "About",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "ClientGenderPreference",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "TrainingTypes",
                table: "trainer_profiles");
        }
    }
}
