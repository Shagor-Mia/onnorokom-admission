using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace SchoolAdmission.Infrastructure.Persistence;

/// <summary>
/// Applies EF Core migrations at startup. It waits for PostgreSQL to accept
/// connections and takes a PostgreSQL advisory lock so several backend processes
/// starting at the same time never run the same migration concurrently.
/// </summary>
public static class DatabaseInitializer
{
    // Arbitrary constant shared by every backend process of this application.
    private const long MigrationLockKey = 7_420_202_611;

    public static async Task MigrateAsync(
        AppDbContext dbContext,
        ILogger logger,
        CancellationToken cancellationToken = default,
        int maxAttempts = 30)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await dbContext.Database.OpenConnectionAsync(cancellationToken);
                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(
                        $"SELECT pg_advisory_lock({MigrationLockKey})",
                        cancellationToken);
                    try
                    {
                        await dbContext.Database.MigrateAsync(cancellationToken);
                    }
                    finally
                    {
                        await dbContext.Database.ExecuteSqlRawAsync(
                            $"SELECT pg_advisory_unlock({MigrationLockKey})",
                            CancellationToken.None);
                    }
                }
                finally
                {
                    await dbContext.Database.CloseConnectionAsync();
                }

                logger.LogInformation("Database schema is up to date.");
                return;
            }
            catch (Exception exception) when (attempt < maxAttempts &&
                                              IsTransient(exception) &&
                                              !cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(
                    "Database not ready (attempt {Attempt}/{MaxAttempts}): {Message}",
                    attempt,
                    maxAttempts,
                    exception.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }

    /// <summary>
    /// Only connection-level failures (server starting, refused, unreachable) are retried;
    /// a real migration/SQL error surfaces immediately.
    /// </summary>
    private static bool IsTransient(Exception exception) => exception switch
    {
        PostgresException postgres =>
            postgres.SqlState.StartsWith("08", StringComparison.Ordinal) ||   // connection exception
            postgres.SqlState.StartsWith("57P", StringComparison.Ordinal) ||  // admin shutdown / cannot connect now
            postgres.SqlState.StartsWith("53", StringComparison.Ordinal),     // insufficient resources
        NpgsqlException => true,                                               // socket/timeout errors
        System.Net.Sockets.SocketException => true,
        TimeoutException => true,
        InvalidOperationException { InnerException: { } inner } => IsTransient(inner),
        _ => false
    };
}
