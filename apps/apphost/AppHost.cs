using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// Secret parameters (not committed). Provide them via user-secrets or env vars.
var pgPassword = builder.AddParameter("pg-password", secret: true);

// Optional: If your Aspire version requires username as a parameter too, uncomment:
// var pgUser = builder.AddParameter("pg-user", secret: true);

var postgres = builder
    .AddPostgres("postgres", password: pgPassword)
    .WithImage("postgres:16")
    .WithDataVolume();

// Pin image version if your API supports it:
// - Some versions use .WithImage("postgres:16")
// - Some use .WithImage("postgres", "16")
// - Some use .WithImageTag("16")
postgres = postgres.WithImage("postgres:16");

// Persist data between runs (recommended for dev). If not available in your version, remove.
// postgres = postgres.WithDataVolume();

var postgresDb = postgres.AddDatabase("postgresdb", "app_db");

builder
    .AddProject<Projects.Api>("api")
    .WithReference(postgresDb)
    .WaitFor(postgresDb);

builder.Build().Run();
