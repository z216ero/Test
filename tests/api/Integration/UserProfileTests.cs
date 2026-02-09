using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Api.Features.Auth;
using Api.Features.Users;

namespace Api.Tests.Integration;

public sealed class UserProfileTests : IClassFixture<ApiPostgresFixture>
{
    private readonly ApiPostgresFixture _fixture;

    public UserProfileTests(ApiPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task PatchUsersMe_WhenClient_UpdatesName()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "client-profile@example.com",
            "Password123",
            "Client",
            "Client One",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var response = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            "Client Updated",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<AuthUserDto>();
        Assert.NotNull(updated);
        Assert.Equal("Client Updated", updated!.Name);
        Assert.Empty(updated.Specializations);
    }

    [Fact]
    public async Task PatchUsersMe_WhenTrainer_UpdatesSpecialization()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "trainer-profile@example.com",
            "Password123",
            "Trainer",
            "Trainer One",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var response = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            "Trainer One",
            "Москва",
            Specializations: new[] { "Yoga" },
            PricePerSession: 150_000));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<AuthUserDto>();
        Assert.NotNull(updated);
        Assert.Contains("Yoga", updated!.Specializations);
        Assert.Equal(150_000, updated.PricePerSession);
    }

    [Fact]
    public async Task PatchUsersMe_WhenTrainer_CanClearPricePerSession()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "trainer-price@example.com",
            "Password123",
            "Trainer",
            "Trainer Price",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var setResponse = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            "Trainer Price",
            "Москва",
            PricePerSession: 200_000));

        Assert.Equal(HttpStatusCode.OK, setResponse.StatusCode);

        var clearResponse = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            "Trainer Price",
            "Москва",
            PricePerSession: null));

        Assert.Equal(HttpStatusCode.OK, clearResponse.StatusCode);
        var updated = await clearResponse.Content.ReadFromJsonAsync<AuthUserDto>();
        Assert.NotNull(updated);
        Assert.Null(updated!.PricePerSession);
    }

    [Fact]
    public async Task PatchUsersMe_WhenClient_IgnoresSpecialization()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "client-specialization@example.com",
            "Password123",
            "Client",
            "Client Two",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var response = await client.PatchAsJsonAsync("/users/me", new UpdateUserRequest(
            "Client Two",
            "Москва",
            Specializations: new[] { "Yoga" }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<AuthUserDto>();
        Assert.NotNull(updated);
        Assert.Empty(updated!.Specializations);
    }

    [Fact]
    public async Task GetUsersMeAvatar_WhenMissing_ReturnsNotFound()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "client-avatar-missing@example.com",
            "Password123",
            "Client",
            "Client Avatar",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var response = await client.GetAsync("/users/me/avatar");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutUsersMeAvatar_WhenUploaded_CanDownload()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "client-avatar@example.com",
            "Password123",
            "Client",
            "Client Avatar",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var payload = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0 };
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(payload);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "avatar.png");

        var uploadResponse = await client.PutAsync("/users/me/avatar", form);
        Assert.Equal(HttpStatusCode.NoContent, uploadResponse.StatusCode);

        var downloadResponse = await client.GetAsync("/users/me/avatar");
        Assert.Equal(HttpStatusCode.OK, downloadResponse.StatusCode);
        Assert.Equal("image/png", downloadResponse.Content.Headers.ContentType?.MediaType);

        var downloaded = await downloadResponse.Content.ReadAsByteArrayAsync();
        Assert.Equal(payload, downloaded);
    }

    [Fact]
    public async Task AuthMe_WhenAvatarUploaded_ReturnsHasAvatar()
    {
        using var factory = new ApiWebApplicationFactory(_fixture.ConnectionString);
        using var client = factory.CreateClient();

        var registerResponse = await client.PostAsJsonAsync("/auth/register", new RegisterRequest(
            "client-avatar-flag@example.com",
            "Password123",
            "Client",
            "Client Avatar",
            "Москва"));

        Assert.Equal(HttpStatusCode.OK, registerResponse.StatusCode);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var payload = new byte[] { 255, 216, 255, 224, 0, 16, 74, 70 };
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(payload);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(fileContent, "file", "avatar.jpg");

        var uploadResponse = await client.PutAsync("/users/me/avatar", form);
        Assert.Equal(HttpStatusCode.NoContent, uploadResponse.StatusCode);

        var meResponse = await client.GetAsync("/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var me = await meResponse.Content.ReadFromJsonAsync<AuthUserDto>();
        Assert.NotNull(me);
        Assert.True(me!.HasAvatar);
        Assert.Equal("/users/me/avatar", me.AvatarUrl);
    }
}
