using Api.Data;
using Api.Features.Bookings;
using Api.Features.Health;
using Api.Features.Slots;
using Api.Features.Trainers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.AddNpgsqlDbContext<AppDbContext>("postgresdb");

builder.Services.AddScoped<TrainerService>();
builder.Services.AddScoped<SlotService>();
builder.Services.AddScoped<BookingService>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.MapHealthEndpoints();
app.MapTrainerEndpoints();
app.MapSlotEndpoints();
app.MapBookingEndpoints();

await app.RunAsync();
