using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

/// <summary>
/// Creates an isolated PostgreSQL schema per test (via search_path) and drops it
/// afterwards. Requires TEST_DATABASE_CONNECTION.
/// </summary>
public sealed class PostgreSqlTestDatabase : IAsyncDisposable
{
    private readonly string adminConnectionString;

    private PostgreSqlTestDatabase(
        string adminConnectionString,
        string testConnectionString,
        string schemaName)
    {
        this.adminConnectionString = adminConnectionString;
        ConnectionString = testConnectionString;
        SchemaName = schemaName;
    }

    public string SchemaName { get; }

    /// <summary>Connection string scoped to this test's schema.</summary>
    public string ConnectionString { get; }

    public static async Task<PostgreSqlTestDatabase> CreateAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "TEST_DATABASE_CONNECTION must be set to create an integration-test database.");
        }

        var schemaName = $"admission_test_{Guid.NewGuid():N}";
        await using (var connection = new NpgsqlConnection(connectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE SCHEMA \"{schemaName}\"";
            await command.ExecuteNonQueryAsync();
        }

        // Keep the pool well below PostgreSQL's default max_connections (100):
        // extra concurrent requests queue for a connection, which still exercises
        // the row-lock serialization while never exhausting the server.
        var testConnection = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schemaName,
            Timeout = 60,
            CommandTimeout = 180,
            MaxPoolSize = 10
        };
        var database = new PostgreSqlTestDatabase(
            connectionString,
            testConnection.ConnectionString,
            schemaName);

        try
        {
            await using var dbContext = database.CreateDbContext();
            await dbContext.Database.MigrateAsync();
        }
        catch
        {
            await database.DisposeAsync();
            throw;
        }

        return database;
    }

    public AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        return new AppDbContext(options);
    }

    public async ValueTask DisposeAsync()
    {
        // Release pooled server connections before the next test opens its own pool.
        await using (var pooled = new NpgsqlConnection(ConnectionString))
        {
            NpgsqlConnection.ClearPool(pooled);
        }

        await using var connection = new NpgsqlConnection(adminConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP SCHEMA IF EXISTS \"{SchemaName}\" CASCADE";
        await command.ExecuteNonQueryAsync();
        NpgsqlConnection.ClearPool(connection);
    }
}
