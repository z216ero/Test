using Api.Data;
using Migrations;

var builder = Host.CreateApplicationBuilder(args);

builder.AddNpgsqlDbContext<AppDbContext>("postgresdb");
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
