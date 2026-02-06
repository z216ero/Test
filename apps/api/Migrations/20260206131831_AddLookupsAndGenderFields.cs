using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLookupsAndGenderFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClientGenderPreference",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "Specialization",
                table: "trainer_profiles");

            migrationBuilder.AddColumn<string[]>(
                name: "Specializations",
                table: "trainer_profiles",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            migrationBuilder.AddColumn<string>(
                name: "WorksWithGender",
                table: "trainer_profiles",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "Any");

            migrationBuilder.AddColumn<string[]>(
                name: "Goals",
                table: "client_profiles",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            migrationBuilder.AddColumn<string>(
                name: "Level",
                table: "client_profiles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Beginner");

            migrationBuilder.AddColumn<string>(
                name: "PreferredTrainerGender",
                table: "client_profiles",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "Any");

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "AspNetUsers",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "Male");

            migrationBuilder.CreateTable(
                name: "cities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "districts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CityId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_districts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_districts_cities_CityId",
                        column: x => x.CityId,
                        principalTable: "cities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cities_Name",
                table: "cities",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_districts_CityId_Name",
                table: "districts",
                columns: new[] { "CityId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "districts");

            migrationBuilder.DropTable(
                name: "cities");

            migrationBuilder.DropColumn(
                name: "Specializations",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "WorksWithGender",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "Goals",
                table: "client_profiles");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "client_profiles");

            migrationBuilder.DropColumn(
                name: "PreferredTrainerGender",
                table: "client_profiles");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "AspNetUsers");

            migrationBuilder.AddColumn<string>(
                name: "ClientGenderPreference",
                table: "trainer_profiles",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "All");

            migrationBuilder.AddColumn<string>(
                name: "Specialization",
                table: "trainer_profiles",
                type: "text",
                nullable: true);
        }
    }
}
