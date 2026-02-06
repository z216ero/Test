using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CityId",
                table: "trainer_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DistrictId",
                table: "trainer_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CityId",
                table: "client_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DistrictId",
                table: "client_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_trainer_profiles_CityId",
                table: "trainer_profiles",
                column: "CityId");

            migrationBuilder.CreateIndex(
                name: "IX_trainer_profiles_DistrictId",
                table: "trainer_profiles",
                column: "DistrictId");

            migrationBuilder.CreateIndex(
                name: "IX_client_profiles_CityId",
                table: "client_profiles",
                column: "CityId");

            migrationBuilder.CreateIndex(
                name: "IX_client_profiles_DistrictId",
                table: "client_profiles",
                column: "DistrictId");

            migrationBuilder.AddForeignKey(
                name: "FK_client_profiles_cities_CityId",
                table: "client_profiles",
                column: "CityId",
                principalTable: "cities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_client_profiles_districts_DistrictId",
                table: "client_profiles",
                column: "DistrictId",
                principalTable: "districts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_trainer_profiles_cities_CityId",
                table: "trainer_profiles",
                column: "CityId",
                principalTable: "cities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_trainer_profiles_districts_DistrictId",
                table: "trainer_profiles",
                column: "DistrictId",
                principalTable: "districts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_client_profiles_cities_CityId",
                table: "client_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_client_profiles_districts_DistrictId",
                table: "client_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_trainer_profiles_cities_CityId",
                table: "trainer_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_trainer_profiles_districts_DistrictId",
                table: "trainer_profiles");

            migrationBuilder.DropIndex(
                name: "IX_trainer_profiles_CityId",
                table: "trainer_profiles");

            migrationBuilder.DropIndex(
                name: "IX_trainer_profiles_DistrictId",
                table: "trainer_profiles");

            migrationBuilder.DropIndex(
                name: "IX_client_profiles_CityId",
                table: "client_profiles");

            migrationBuilder.DropIndex(
                name: "IX_client_profiles_DistrictId",
                table: "client_profiles");

            migrationBuilder.DropColumn(
                name: "CityId",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "DistrictId",
                table: "trainer_profiles");

            migrationBuilder.DropColumn(
                name: "CityId",
                table: "client_profiles");

            migrationBuilder.DropColumn(
                name: "DistrictId",
                table: "client_profiles");
        }
    }
}
