using SchoolAdmission.Application.Configuration;
using SchoolAdmission.Application.DTOs;
using SchoolAdmission.Application.Exceptions;
using SchoolAdmission.Infrastructure.Persistence;
using SchoolAdmission.Infrastructure.Services;
using Xunit;

namespace SchoolAdmission.Tests.Unit;

public sealed class AdmissionServiceValidationTests
{
    [Fact]
    public async Task CreateClass_RejectsWhitespaceNameAsBadRequest()
    {
        await using var dbContext = new AppDbContext(
            new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<AppDbContext>().Options);
        var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));

        var exception = await Assert.ThrowsAsync<AdmissionException>(
            () => service.CreateClassAsync(
                new CreateClassRequest("   ", 1),
                CancellationToken.None));

        Assert.Equal(400, exception.StatusCode);
    }
}
