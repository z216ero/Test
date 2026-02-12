using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
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
            "Москва"));

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
            "Москва"));

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
            "Москва");

        var first = await client.PostAsJsonAsync("/auth/register", payload);
        var second = await client.PostAsJsonAsync("/auth/register", payload);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Register_WhenPhoneNumberInvalid_ReturnsBadRequest()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "invalid-phone@example.com",
            "Password123",
            "Client",
            "Invalid Phone",
            "Москва",
            PhoneNumber: "+1 202 555 0101"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_WhenPhoneNumberStartsWith8_NormalizesToPlus7()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "phone-normalize@example.com",
            "Password123",
            "Trainer",
            "Phone Trainer",
            "Москва",
            PhoneNumber: "8 (999) 123-45-67"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.Equal("+79991234567", auth!.User.PhoneNumber);
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
            "Москва"));

        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        var profileResponse = await client.GetAsync("/clients/me");

        Assert.Equal(HttpStatusCode.NotFound, profileResponse.StatusCode);
    }

    [Fact]
    public async Task Refresh_WhenTokenValid_ReturnsNewAccessToken()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "refresh@example.com",
            "Password123",
            "Client",
            "Refresh Client",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth!.RefreshToken));

        var refreshResponse = await client.PostAsJsonAsync(
            "/auth/refresh",
            new RefreshRequest(auth.RefreshToken!));

        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        var refreshed = await refreshResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(refreshed);
        Assert.False(string.IsNullOrWhiteSpace(refreshed!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(refreshed.RefreshToken));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            refreshed.AccessToken);

        var meResponse = await client.GetAsync("/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
    }

    [Fact]
    public async Task Logout_WhenRefreshTokenProvided_RevokesToken()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "logout@example.com",
            "Password123",
            "Client",
            "Logout Client",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            auth!.AccessToken);

        var logoutResponse = await client.PostAsJsonAsync(
            "/auth/logout",
            new LogoutRequest(auth.RefreshToken));

        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);

        var refreshResponse = await client.PostAsJsonAsync(
            "/auth/refresh",
            new RefreshRequest(auth.RefreshToken));

        Assert.Equal(HttpStatusCode.Unauthorized, refreshResponse.StatusCode);
    }

    [Fact]
    public async Task PushPreferences_WhenRequested_ReturnDefaultsAndAllowUpdate()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "pushprefs@example.com",
            "Password123",
            "Client",
            "Push Prefs Client",
            "РњРѕСЃРєРІР°"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var getDefaultsResponse = await client.GetAsync("/push/preferences");
        Assert.Equal(HttpStatusCode.OK, getDefaultsResponse.StatusCode);

        var defaultsPayload = await getDefaultsResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(defaultsPayload.GetProperty("eventsEnabled").GetBoolean());
        Assert.True(defaultsPayload.GetProperty("groupMinCancellationEnabled").GetBoolean());
        Assert.True(defaultsPayload.GetProperty("reminderEnabled").GetBoolean());
        Assert.Equal(120, defaultsPayload.GetProperty("reminderOffsetMinutes").GetInt32());

        var updateResponse = await client.PutAsJsonAsync(
            "/push/preferences",
            new
            {
                eventsEnabled = false,
                groupMinCancellationEnabled = false,
                reminderEnabled = false,
                reminderOffsetMinutes = 1440
            });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updatedPayload = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(updatedPayload.GetProperty("eventsEnabled").GetBoolean());
        Assert.False(updatedPayload.GetProperty("groupMinCancellationEnabled").GetBoolean());
        Assert.False(updatedPayload.GetProperty("reminderEnabled").GetBoolean());
        Assert.Equal(1440, updatedPayload.GetProperty("reminderOffsetMinutes").GetInt32());
    }
}
