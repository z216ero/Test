using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

var pgUser = builder.AddParameter("pg-user", "postgres");
var pgPassword = builder.AddParameter("pg-password", "app_password", secret: true);

var postgres = builder
    .AddPostgres("postgres", pgUser, pgPassword)
    .WithImage("postgres", "16")
    .WithDataVolume();

var postgresDb = postgres.AddDatabase("postgresdb", "app_db");

var migrations = builder
    .AddProject<Projects.Migrations>("migrations")
    .WithReference(postgresDb)
    .WaitFor(postgresDb);

builder
    .AddProject<Projects.Api>("api")
    .WithReference(postgresDb)
    .WithReference(migrations)
    .WaitForCompletion(migrations);

builder.Build().Run();
