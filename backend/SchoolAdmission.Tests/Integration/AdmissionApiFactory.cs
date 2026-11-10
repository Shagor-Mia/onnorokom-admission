using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SchoolAdmission.Application.Configuration;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

/// <summary>
/// Hosts the real API (controllers, middleware, JSON, background worker) in memory
/// against an isolated PostgreSQL schema. Two factories pointed at the same schema
/// behave like two backend processes sharing one database.
/// </summary>
public sealed class AdmissionApiFactory(
    string connectionString,
    int holdDurationSeconds = 600) : WebApplicationFactory<Program>
{
    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        // Concurrency tests queue many requests on a shared lock; allow slow CI machines.
        client.Timeout = TimeSpan.FromMinutes(5);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        builder.UseSetting("HOLD_DURATION_SECONDS", holdDurationSeconds.ToString());
        // PostgreSqlTestDatabase has already migrated the isolated schema.
        builder.UseSetting("SKIP_DB_MIGRATION", "true");
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
        builder.UseSetting("Logging:LogLevel:Microsoft.EntityFrameworkCore", "Warning");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<HoldDurationSettings>();
            services.AddSingleton(HoldDurationSettings.Create(holdDurationSeconds));

            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();
            services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
        });
    }
}
