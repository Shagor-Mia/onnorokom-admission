using Xunit;

namespace SchoolAdmission.Tests.Integration;

public sealed class PostgreSqlFactAttribute : FactAttribute
{
    public PostgreSqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TEST_DATABASE_CONNECTION")))
        {
            Skip = "Set TEST_DATABASE_CONNECTION to run PostgreSQL integration tests.";
        }
    }
}
