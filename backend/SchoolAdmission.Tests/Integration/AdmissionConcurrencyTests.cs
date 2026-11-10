using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Application.Configuration;
using SchoolAdmission.Application.Exceptions;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Services;
using Xunit;

namespace SchoolAdmission.Tests.Integration;

public sealed class AdmissionConcurrencyTests
{
    [PostgreSqlFact]
    public async Task CreateHold_OneHundredDistinctStudents_NeverExceedsTenSeats()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        var classId = await CreateClassAsync(database, totalSeats: 10);

        var results = await Task.WhenAll(Enumerable.Range(0, 100).Select(async index =>
        {
            await using var dbContext = database.CreateDbContext();
            var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));
            return await TryCreateHoldAsync(
                service,
                classId,
                index.ToString("D17"));
        }));

        Assert.Equal(10, results.Count(result => result));
        Assert.Equal(90, results.Count(result => !result));

        await using var verificationContext = database.CreateDbContext();
        var occupiedSeats = await verificationContext.Holds.CountAsync(hold =>
            hold.ClassId == classId &&
            (hold.Status == HoldStatus.Confirmed ||
             (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > DateTimeOffset.UtcNow)));
        Assert.Equal(10, occupiedSeats);
    }

    [PostgreSqlFact]
    public async Task CreateHold_SimultaneousRequestsForSameStudent_CreateOnlyOneActiveHold()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        var classId = await CreateClassAsync(database, totalSeats: 50);

        var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(async _ =>
        {
            await using var dbContext = database.CreateDbContext();
            var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));
            return await TryCreateHoldAsync(service, classId, "20152691234567890");
        }));

        Assert.Single(results, result => result);
        Assert.Equal(19, results.Count(result => !result));

        await using var verificationContext = database.CreateDbContext();
        Assert.Equal(
            1,
            await verificationContext.Holds.CountAsync(hold =>
                hold.ClassId == classId &&
                (hold.Status == HoldStatus.Held || hold.Status == HoldStatus.Confirmed)));
    }

    [PostgreSqlFact]
    public async Task HoldLifecycle_EnforcesOwnershipExpiryAndIdempotency()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        var classId = await CreateClassAsync(database, totalSeats: 3);

        var hold = await CreateHoldAsync(database, classId, "20152691234567890");
        var holdId = ParseHoldId(hold.HoldId);
        var ownershipError = await Assert.ThrowsAsync<AdmissionException>(
            () => ConfirmHoldAsync(database, holdId, "20152691234567891"));
        Assert.Equal(403, ownershipError.StatusCode);

        var confirmed = await ConfirmHoldAsync(database, holdId, "20152691234567890");
        var repeatedConfirmation = await ConfirmHoldAsync(database, holdId, "20152691234567890");
        Assert.Equal("CONFIRMED", confirmed.Status);
        Assert.Equal(confirmed, repeatedConfirmation);

        var cancelled = await CreateHoldAsync(database, classId, "20152691234567891");
        var cancelledId = ParseHoldId(cancelled.HoldId);
        var cancellationOwnershipError = await Assert.ThrowsAsync<AdmissionException>(
            () => CancelHoldAsync(database, cancelledId, "20152691234567890"));
        Assert.Equal(403, cancellationOwnershipError.StatusCode);
        await CancelHoldAsync(database, cancelledId, "20152691234567891");
        await CancelHoldAsync(database, cancelledId, "20152691234567891");
        var cancelledConfirmationError = await Assert.ThrowsAsync<AdmissionException>(
            () => ConfirmHoldAsync(database, cancelledId, "20152691234567891"));
        Assert.Equal(409, cancelledConfirmationError.StatusCode);

        var expired = await CreateHoldAsync(database, classId, "20152691234567892");
        var expiredId = ParseHoldId(expired.HoldId);
        await ExpireHoldAsync(database, expiredId);
        var expiredStatus = await GetHoldAsync(database, expiredId);
        Assert.Equal("EXPIRED", expiredStatus!.Status);

        var expirationError = await Assert.ThrowsAsync<AdmissionException>(
            () => ConfirmHoldAsync(database, expiredId, "20152691234567892"));
        Assert.Equal(409, expirationError.StatusCode);

        var retry = await CreateHoldAsync(database, classId, "20152691234567892");
        Assert.Equal("HELD", retry.Status);

        await using var verificationContext = database.CreateDbContext();
        var classMetrics = await new AdmissionService(
                verificationContext,
                HoldDurationSettings.Create(600))
            .GetClassAsync(classId, CancellationToken.None);
        Assert.NotNull(classMetrics);
        Assert.Equal(1, classMetrics.ConfirmedSeats);
        Assert.Equal(1, classMetrics.HeldSeats);
        Assert.Equal(1, classMetrics.AvailableSeats);
    }

    private static async Task<Guid> CreateClassAsync(
        PostgreSqlTestDatabase database,
        int totalSeats)
    {
        await using var dbContext = database.CreateDbContext();
        var admissionClass = new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = "Concurrency test class",
            TotalSeats = totalSeats,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        dbContext.Classes.Add(admissionClass);
        await dbContext.SaveChangesAsync();
        return admissionClass.Id;
    }

    private static async Task<bool> TryCreateHoldAsync(
        AdmissionService service,
        Guid classId,
        string studentId)
    {
        try
        {
            await service.CreateHoldAsync(classId, studentId, CancellationToken.None);
            return true;
        }
        catch (AdmissionException exception) when (exception.StatusCode == 409)
        {
            return false;
        }
    }

    private static async Task<SchoolAdmission.Application.DTOs.CreatedHoldResponse> CreateHoldAsync(
        PostgreSqlTestDatabase database,
        Guid classId,
        string studentId)
    {
        await using var dbContext = database.CreateDbContext();
        var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));
        return await service.CreateHoldAsync(classId, studentId, CancellationToken.None);
    }

    private static async Task<SchoolAdmission.Application.DTOs.ConfirmedHoldResponse> ConfirmHoldAsync(
        PostgreSqlTestDatabase database,
        Guid holdId,
        string studentId)
    {
        await using var dbContext = database.CreateDbContext();
        var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));
        return await service.ConfirmHoldAsync(holdId, studentId, CancellationToken.None);
    }

    private static async Task CancelHoldAsync(
        PostgreSqlTestDatabase database,
        Guid holdId,
        string studentId)
    {
        await using var dbContext = database.CreateDbContext();
        var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));
        await service.CancelHoldAsync(holdId, studentId, CancellationToken.None);
    }

    private static async Task<SchoolAdmission.Application.DTOs.HoldStatusResponse?> GetHoldAsync(
        PostgreSqlTestDatabase database,
        Guid holdId)
    {
        await using var dbContext = database.CreateDbContext();
        var service = new AdmissionService(dbContext, HoldDurationSettings.Create(600));
        return await service.GetHoldAsync(holdId, CancellationToken.None);
    }

    private static async Task ExpireHoldAsync(
        PostgreSqlTestDatabase database,
        Guid holdId)
    {
        await using var dbContext = database.CreateDbContext();
        await dbContext.Holds
            .Where(hold => hold.Id == holdId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(
                hold => hold.ExpiresAtUtc,
                DateTimeOffset.UtcNow.AddSeconds(-1)));
    }

    private static Guid ParseHoldId(string value) =>
        Guid.ParseExact(value.AsSpan(2), "N");
}
