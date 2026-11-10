using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Serialization;
using SchoolAdmission.Application.Configuration;
using SchoolAdmission.Application.Exceptions;
using SchoolAdmission.Infrastructure;
using SchoolAdmission.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers(options => options.Filters.Add<AdmissionExceptionFilter>())
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeOffsetJsonConverter()))
    .ConfigureApiBehaviorOptions(options =>
    {
        // Automatic model-validation failures (bad JSON, missing/invalid fields) get the
        // same machine-readable code as other validation errors.
        var defaultFactory = options.InvalidModelStateResponseFactory;
        options.InvalidModelStateResponseFactory = context =>
        {
            var result = defaultFactory(context);
            if (result is ObjectResult { Value: ProblemDetails problem })
            {
                problem.Extensions["code"] = AdmissionErrorCodes.ValidationFailed;
            }

            return result;
        };
    });
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AdmissionExceptionHandler>();

// HOLD_DURATION_SECONDS (default 600) controls how long a seat stays held.
var holdDurationSetting =
    builder.Configuration["HOLD_DURATION_SECONDS"] ??
    builder.Configuration["HoldDurationSeconds"];

var holdDurationSeconds = 600;
if (!string.IsNullOrWhiteSpace(holdDurationSetting) &&
    (!int.TryParse(holdDurationSetting, out holdDurationSeconds) || holdDurationSeconds <= 0))
{
    throw new InvalidOperationException("HOLD_DURATION_SECONDS must be a positive integer.");
}

builder.Services.AddSingleton(HoldDurationSettings.Create(holdDurationSeconds));
builder.Services.AddInfrastructure(builder.Configuration);

// The React UI runs on a different origin (default http://localhost:5173), so the
// browser needs CORS. CORS_ALLOWED_ORIGINS is a comma-separated list or "*".
const string FrontendCorsPolicy = "Frontend";
var allowedOrigins = (builder.Configuration["CORS_ALLOWED_ORIGINS"] ??
                      "http://localhost:5173,http://127.0.0.1:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy =>
{
    if (allowedOrigins.Contains("*"))
    {
        policy.AllowAnyOrigin();
    }
    else
    {
        policy.WithOrigins(allowedOrigins);
    }

    policy.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Location", "Date");
}));

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors(FrontendCorsPolicy);

// Integration tests prepare their own isolated schema and set SKIP_DB_MIGRATION.
if (!string.Equals(builder.Configuration["SKIP_DB_MIGRATION"], "true", StringComparison.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
        .CreateLogger("DatabaseInitializer");
    await DatabaseInitializer.MigrateAsync(dbContext, logger);
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
