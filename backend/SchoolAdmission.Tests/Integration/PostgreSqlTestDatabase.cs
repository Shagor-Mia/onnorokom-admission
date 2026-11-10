using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Tests.Integration;

public sealed class PostgreSqlTestDatabase : IAsyncDisposable
{
    private readonly string adminConnectionString;
    private readonly string testConnectionString;

    private PostgreSqlTestDatabase(
        string adminConnectionString,
        string testConnectionString,
        string schemaName)
    {
        this.adminConnectionString = adminConnectionString;
        this.testConnectionString = testConnectionString;
        SchemaName = schemaName;
    }

    public string SchemaName { get; }

    public static async Task<PostgreSqlTestDatabase> CreateAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "TEST_DATABASE_CONNECTION must be set to create an integration-test database.");
        }

        var schemaName = $"admission_test_{Guid.NewGuid():N}";
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();

        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"CREATE SCHEMA \"{schemaName}\"";
            await command.ExecuteNonQueryAsync();
        }

        var testConnection = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schemaName,
            Timeout = 60,
            CommandTimeout = 180,
            MaxPoolSize = 100
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
            .UseNpgsql(testConnectionString)
            .Options;
        return new AppDbContext(options);
    }

    public async ValueTask DisposeAsync()
    {
        await using var connection = new NpgsqlConnection(adminConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP SCHEMA IF EXISTS \"{SchemaName}\" CASCADE";
        await command.ExecuteNonQueryAsync();
    }
}
