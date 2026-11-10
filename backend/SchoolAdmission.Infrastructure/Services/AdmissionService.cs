using System.Net;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Application.Configuration;
using SchoolAdmission.Application.DTOs;
using SchoolAdmission.Application.Exceptions;
using SchoolAdmission.Application.Services;
using SchoolAdmission.Domain.Entities;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Infrastructure.Services;

public sealed class AdmissionService(
    AppDbContext dbContext,
    HoldDurationSettings holdDurationSettings) : IAdmissionService
{
    public async Task<CreatedClassResponse> CreateClassAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new AdmissionException(
                (int)HttpStatusCode.BadRequest,
                "Invalid request",
                "Class name is required.");
        }

        var admissionClass = new AdmissionClass
        {
            Id = Guid.NewGuid(),
            Name = name,
            TotalSeats = request.TotalSeats,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        dbContext.Classes.Add(admissionClass);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new CreatedClassResponse(
            ClassId(admissionClass.Id),
            admissionClass.Name,
            admissionClass.TotalSeats);
    }

    public async Task<IReadOnlyList<ClassMetricsResponse>> ListClassesAsync(
        CancellationToken cancellationToken)
    {
        await ExpireStaleHoldsAsync(null, DateTimeOffset.UtcNow, cancellationToken);
        var metrics = await ClassMetricsQuery(DateTimeOffset.UtcNow)
            .ToListAsync(cancellationToken);
        return metrics
            .OrderBy(admissionClass => admissionClass.Name)
            .Select(ToClassMetricsResponse)
            .ToList();
    }

    public async Task<ClassMetricsResponse?> GetClassAsync(
        Guid classId,
        CancellationToken cancellationToken)
    {
        await ExpireStaleHoldsAsync(classId, DateTimeOffset.UtcNow, cancellationToken);
        var metrics = await ClassMetricsQuery(DateTimeOffset.UtcNow, classId)
            .SingleOrDefaultAsync(cancellationToken);
        return metrics is null ? null : ToClassMetricsResponse(metrics);
    }

    public async Task<CreatedHoldResponse> CreateHoldAsync(
        Guid classId,
        string studentId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var admissionClass = await dbContext.Classes
            .FromSqlInterpolated(
                $"SELECT * FROM admission_classes WHERE id = {classId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        if (admissionClass is null)
        {
            throw NotFound("Class");
        }

        var now = DateTimeOffset.UtcNow;
        await ExpireStaleHoldsAsync(classId, now, cancellationToken);

        var hasExistingApplication = await dbContext.Holds.AnyAsync(
            hold => hold.ClassId == classId &&
                    hold.StudentId == studentId &&
                    (hold.Status == HoldStatus.Confirmed ||
                     (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > now)),
            cancellationToken);

        if (hasExistingApplication)
        {
            throw Conflict("This student already has an active application for this class.");
        }

        var occupiedSeats = await dbContext.Holds.CountAsync(
            hold => hold.ClassId == classId &&
                    (hold.Status == HoldStatus.Confirmed ||
                     (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > now)),
            cancellationToken);

        if (occupiedSeats >= admissionClass.TotalSeats)
        {
            throw Conflict("No seats are currently available for this class.");
        }

        var hold = new AdmissionHold
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.Held,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddSeconds(holdDurationSettings.Seconds)
        };

        dbContext.Holds.Add(hold);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new CreatedHoldResponse(
            HoldId(hold.Id),
            ClassId(classId),
            hold.StudentId,
            StatusName(hold.Status),
            hold.ExpiresAtUtc);
    }

    public async Task<HoldStatusResponse?> GetHoldAsync(
        Guid holdId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await dbContext.Holds
            .Where(hold =>
                hold.Id == holdId &&
                hold.Status == HoldStatus.Held &&
                hold.ExpiresAtUtc <= now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(hold => hold.Status, HoldStatus.Expired),
                cancellationToken);

        var hold = await dbContext.Holds
            .Where(hold => hold.Id == holdId)
            .Select(hold => new HoldStatusData(
                hold.Id,
                hold.ClassId,
                hold.Status,
                hold.ExpiresAtUtc))
            .SingleOrDefaultAsync(cancellationToken);

        return hold is null
            ? null
            : new HoldStatusResponse(
                HoldId(hold.Id),
                ClassId(hold.ClassId),
                StatusName(hold.Status),
                hold.ExpiresAtUtc);
    }

    public async Task<ConfirmedHoldResponse> ConfirmHoldAsync(
        Guid holdId,
        string studentId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var hold = await dbContext.Holds
            .FromSqlInterpolated($"SELECT * FROM admission_holds WHERE id = {holdId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        if (hold is null)
        {
            throw NotFound("Hold");
        }

        EnsureOwner(hold, studentId);
        if (hold.Status == HoldStatus.Confirmed)
        {
            await transaction.CommitAsync(cancellationToken);
            return new ConfirmedHoldResponse(HoldId(hold.Id), StatusName(hold.Status));
        }

        if (hold.Status != HoldStatus.Held)
        {
            throw Conflict("Only an active hold can be confirmed.");
        }

        var now = DateTimeOffset.UtcNow;
        if (hold.ExpiresAtUtc <= now)
        {
            hold.Status = HoldStatus.Expired;
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            throw Conflict("This hold has expired and cannot be confirmed.");
        }

        hold.Status = HoldStatus.Confirmed;
        hold.ConfirmedAtUtc = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ConfirmedHoldResponse(HoldId(hold.Id), StatusName(hold.Status));
    }

    public async Task CancelHoldAsync(
        Guid holdId,
        string studentId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var hold = await dbContext.Holds
            .FromSqlInterpolated($"SELECT * FROM admission_holds WHERE id = {holdId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        if (hold is null)
        {
            throw NotFound("Hold");
        }

        EnsureOwner(hold, studentId);
        if (hold.Status == HoldStatus.Cancelled)
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        if (hold.Status != HoldStatus.Held)
        {
            throw Conflict("Only an active hold can be cancelled.");
        }

        var now = DateTimeOffset.UtcNow;
        if (hold.ExpiresAtUtc <= now)
        {
            hold.Status = HoldStatus.Expired;
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            throw Conflict("This hold has expired and cannot be cancelled.");
        }

        hold.Status = HoldStatus.Cancelled;
        hold.CancelledAtUtc = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StudentHoldResponse>> ListStudentHoldsAsync(
        string studentId,
        CancellationToken cancellationToken)
    {
        await ExpireStaleHoldsAsync(null, DateTimeOffset.UtcNow, cancellationToken);
        var holds = await dbContext.Holds
            .Where(hold => hold.StudentId == studentId)
            .OrderByDescending(hold => hold.CreatedAtUtc)
            .Select(hold => new StudentHoldData(
                hold.Id,
                hold.ClassId,
                hold.Class!.Name,
                hold.Status,
                hold.ExpiresAtUtc))
            .ToListAsync(cancellationToken);

        return holds.Select(hold => new StudentHoldResponse(
            HoldId(hold.Id),
            ClassId(hold.ClassId),
            hold.ClassName,
            StatusName(hold.Status),
            hold.ExpiresAtUtc)).ToList();
    }

    private IQueryable<ClassMetricsData> ClassMetricsQuery(DateTimeOffset now, Guid? classId = null)
    {
        var classes = dbContext.Classes.AsQueryable();
        if (classId.HasValue)
        {
            classes = classes.Where(admissionClass => admissionClass.Id == classId.Value);
        }

        return classes.Select(admissionClass => new ClassMetricsData(
            admissionClass.Id,
            admissionClass.Name,
            admissionClass.TotalSeats,
            admissionClass.Holds.Count(hold =>
                hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > now),
            admissionClass.Holds.Count(hold => hold.Status == HoldStatus.Confirmed),
            admissionClass.TotalSeats -
            admissionClass.Holds.Count(hold =>
                hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > now) -
            admissionClass.Holds.Count(hold => hold.Status == HoldStatus.Confirmed)));
    }

    private static ClassMetricsResponse ToClassMetricsResponse(ClassMetricsData metrics) =>
        new(
            ClassId(metrics.Id),
            metrics.Name,
            metrics.TotalSeats,
            metrics.HeldSeats,
            metrics.ConfirmedSeats,
            metrics.AvailableSeats);

    private Task<int> ExpireStaleHoldsAsync(
        Guid? classId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var staleHolds = dbContext.Holds
            .Where(hold => hold.Status == HoldStatus.Held && hold.ExpiresAtUtc <= now);

        if (classId.HasValue)
        {
            staleHolds = staleHolds.Where(hold => hold.ClassId == classId.Value);
        }

        return staleHolds.ExecuteUpdateAsync(
            setters => setters.SetProperty(hold => hold.Status, HoldStatus.Expired),
            cancellationToken);
    }

    private static void EnsureOwner(AdmissionHold hold, string studentId)
    {
        if (hold.StudentId != studentId)
        {
            throw new AdmissionException(
                (int)HttpStatusCode.Forbidden,
                "Forbidden",
                "This application belongs to a different student.");
        }
    }

    private static AdmissionException NotFound(string resource) =>
        new((int)HttpStatusCode.NotFound, "Not Found", $"{resource} was not found.");

    private static AdmissionException Conflict(string detail) =>
        new((int)HttpStatusCode.Conflict, "Conflict", detail);

    private static string ClassId(Guid id) => $"c_{id:N}";
    private static string HoldId(Guid id) => $"h_{id:N}";

    private static string StatusName(HoldStatus status) => status switch
    {
        HoldStatus.Held => "HELD",
        HoldStatus.Confirmed => "CONFIRMED",
        HoldStatus.Expired => "EXPIRED",
        HoldStatus.Cancelled => "CANCELLED",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown hold status.")
    };

    private sealed record ClassMetricsData(
        Guid Id,
        string Name,
        int TotalSeats,
        int HeldSeats,
        int ConfirmedSeats,
        int AvailableSeats);

    private sealed record HoldStatusData(
        Guid Id,
        Guid ClassId,
        HoldStatus Status,
        DateTimeOffset ExpiresAtUtc);

    private sealed record StudentHoldData(
        Guid Id,
        Guid ClassId,
        string ClassName,
        HoldStatus Status,
        DateTimeOffset ExpiresAtUtc);
}
