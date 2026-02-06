using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;
using System.Text;

namespace Api.Features.Push;

public sealed class FirebaseMessagingClient
{
    private readonly PushOptions options;
    private readonly ILogger<FirebaseMessagingClient> logger;
    private FirebaseMessaging? messaging;
    private bool initialized;

    public FirebaseMessagingClient(
        IOptions<PushOptions> options,
        ILogger<FirebaseMessagingClient> logger)
    {
        this.options = options.Value;
        this.logger = logger;
    }

    public async Task<BatchResponse?> SendMulticastAsync(
        MulticastMessage message,
        CancellationToken cancellationToken)
    {
        var client = EnsureMessaging();
        if (client is null)
        {
            return null;
        }

        return await client.SendEachForMulticastAsync(message, cancellationToken);
    }

    private FirebaseMessaging? EnsureMessaging()
    {
        if (initialized)
        {
            return messaging;
        }

        initialized = true;

        var credential = BuildCredential();
        if (credential is null)
        {
            logger.LogInformation("Push disabled: Firebase credentials not configured.");
            return null;
        }

        try
        {
            FirebaseApp? app = null;
            try
            {
                app = FirebaseApp.DefaultInstance;
            }
            catch
            {
                // ignored - will attempt to create below
            }

            if (app is null)
            {
                var appOptions = new AppOptions
                {
                    Credential = credential
                };
                if (!string.IsNullOrWhiteSpace(options.FirebaseProjectId))
                {
                    appOptions.ProjectId = options.FirebaseProjectId;
                }
                app = FirebaseApp.Create(appOptions);
            }

            if (app is null)
            {
                logger.LogError("Failed to initialize Firebase app (instance is null).");
                return null;
            }

            messaging = FirebaseMessaging.GetMessaging(app);
            return messaging;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize Firebase messaging client.");
            return null;
        }
    }

    private GoogleCredential? BuildCredential()
    {
        if (!string.IsNullOrWhiteSpace(options.FirebaseCredentialsJsonBase64))
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(options.FirebaseCredentialsJsonBase64));
            json = json.Replace("\\n", "\n");

            return GoogleCredential.FromJson(json);
        }

        if (!string.IsNullOrWhiteSpace(options.FirebaseCredentialsJson))
        {
            return GoogleCredential.FromJson(options.FirebaseCredentialsJson);
        }

        if (!string.IsNullOrWhiteSpace(options.FirebaseCredentialsPath))
        {
            return GoogleCredential.FromFile(options.FirebaseCredentialsPath);
        }

        try
        {
            return GoogleCredential.GetApplicationDefault();
        }
        catch
        {
            return null;
        }
    }
}
