using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Application.Configuration;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Infrastructure;
using SchoolAdmission.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AdmissionExceptionHandler>();

var holdDurationSetting =
    builder.Configuration["HOLD_DURATION_SECONDS"] ??
    builder.Configuration["HoldDurationSeconds"];

var holdDurationSeconds = 600;
if (holdDurationSetting is not null &&
    (!int.TryParse(holdDurationSetting, out holdDurationSeconds) || holdDurationSeconds <= 0))
{
    throw new InvalidOperationException("HOLD_DURATION_SECONDS must be a positive integer.");
}

builder.Services.AddSingleton(HoldDurationSettings.Create(holdDurationSeconds));
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();
app.UseExceptionHandler();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.MapGet("/health/live", () => Results.Ok(new { status = "Healthy" }));

app.MapGet("/health/ready", async Task<IResult> (
    AppDbContext dbContext,
    CancellationToken cancellationToken) =>
    await dbContext.Database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "Ready" })
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

app.MapControllers();

app.Run();

public partial class Program
{
}
