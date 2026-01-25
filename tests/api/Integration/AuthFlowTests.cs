using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Api.Features.Auth;
using Api.Features.Clients;
using Api.Features.Trainers;

namespace Api.Tests.Integration;

public sealed class AuthFlowTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public AuthFlowTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task RegisterTrainer_WhenSuccessful_TrainersListIncludesTrainer()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "trainer1@example.com",
            "Password123",
            "Trainer",
            "Trainer One",
            "Strength"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);

        var trainersResponse = await client.GetAsync("/trainers");
        Assert.Equal(HttpStatusCode.OK, trainersResponse.StatusCode);

        var trainers = await trainersResponse.Content.ReadFromJsonAsync<List<TrainerDto>>();
        Assert.NotNull(trainers);
        Assert.Contains(trainers!, t => t.DisplayName == "Trainer One");
    }

    [Fact]
    public async Task RegisterClient_WhenSuccessful_ReturnsClientProfile()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "client1@example.com",
            "Password123",
            "Client",
            "Client One",
            null));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var profileResponse = await client.GetAsync("/clients/me");
        Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);

        var profile = await profileResponse.Content.ReadFromJsonAsync<ClientProfileDto>();
        Assert.NotNull(profile);
        Assert.Equal(auth.User.Id, profile!.UserId);

        var trainersResponse = await client.GetAsync("/trainers");
        var trainers = await trainersResponse.Content.ReadFromJsonAsync<List<TrainerDto>>();
        Assert.DoesNotContain(trainers ?? new List<TrainerDto>(), t => t.DisplayName == "Client One");
    }

    [Fact]
    public async Task Register_WhenDuplicateEmail_ReturnsConflict()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var payload = new RegisterRequest(
            "dup@example.com",
            "Password123",
            "Trainer",
            "Duplicate Trainer",
            null);

        var first = await client.PostAsJsonAsync("/auth/register", payload);
        var second = await client.PostAsJsonAsync("/auth/register", payload);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task AuthMe_WithoutToken_ReturnsUnauthorized()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ClientsMe_WhenTrainerToken_ReturnsNotFound()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "trainer2@example.com",
            "Password123",
            "Trainer",
            "Trainer Two",
            null));

        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        var profileResponse = await client.GetAsync("/clients/me");

        Assert.Equal(HttpStatusCode.NotFound, profileResponse.StatusCode);
    }
}
