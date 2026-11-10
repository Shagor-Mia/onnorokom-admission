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

/// <summary>
/// Admission use cases. Every operation that changes seat occupancy runs inside a
/// PostgreSQL transaction that row-locks either the class (hold creation) or the
/// hold (confirm/cancel), so correctness holds across threads and across separate
/// backend processes sharing the database.
/// </summary>
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
                AdmissionErrorCodes.ValidationFailed,
                "Invalid request",
                "Class name is required.");
        }

        if (request.TotalSeats <= 0)
        {
            throw new AdmissionException(
                (int)HttpStatusCode.BadRequest,
                AdmissionErrorCodes.ValidationFailed,
                "Invalid request",
                "Total seats must be a positive integer.");
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
        var now = DateTimeOffset.UtcNow;
        await ExpireStaleHoldsAsync(null, now, cancellationToken);
        var metrics = await ClassMetricsQuery(now).ToListAsync(cancellationToken);
        return metrics
            .OrderBy(admissionClass => admissionClass.CreatedAtUtc)
            .ThenBy(admissionClass => admissionClass.Name)
            .Select(ToClassMetricsResponse)
            .ToList();
    }

    public async Task<ClassMetricsResponse?> GetClassAsync(
        Guid classId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await ExpireStaleHoldsAsync(classId, now, cancellationToken);
        var metrics = await ClassMetricsQuery(now, classId)
            .SingleOrDefaultAsync(cancellationToken);
        return metrics is null ? null : ToClassMetricsResponse(metrics);
    }

    public async Task<CreatedHoldResponse> CreateHoldAsync(
        Guid classId,
        string studentId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Serialize all hold allocations for this class (across every backend process).
        var admissionClass = await dbContext.Classes
            .FromSqlInterpolated(
                $"SELECT * FROM admission_classes WHERE id = {classId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        if (admissionClass is null)
        {
            throw NotFound(AdmissionErrorCodes.ClassNotFound, "Class");
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
            throw Conflict(
                AdmissionErrorCodes.DuplicateActiveApplication,
                "This student already has an active application or confirmed admission for this class.");
        }

        var occupiedSeats = await dbContext.Holds.CountAsync(
            hold => hold.ClassId == classId &&
                    (hold.Status == HoldStatus.Confirmed ||
                     (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > now)),
            cancellationToken);

        if (occupiedSeats >= admissionClass.TotalSeats)
        {
            throw Conflict(
                AdmissionErrorCodes.NoSeatsAvailable,
                "No seats are currently available for this class.");
        }

        var hold = new AdmissionHold
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.Held,
            CreatedAtUtc = now,
            // Whole seconds keep the API timestamp identical before and after a DB round trip.
            ExpiresAtUtc = TruncateToSeconds(now.AddSeconds(holdDurationSettings.Seconds))
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
            .Select(hold => new HoldData(
                hold.Id,
                hold.ClassId,
                hold.Class!.Name,
                hold.Status,
                hold.ExpiresAtUtc,
                hold.CreatedAtUtc,
                hold.ConfirmedAtUtc,
                hold.CancelledAtUtc))
            .SingleOrDefaultAsync(cancellationToken);

        return hold is null
            ? null
            : new HoldStatusResponse(
                HoldId(hold.Id),
                ClassId(hold.ClassId),
                StatusName(hold.Status),
                hold.ExpiresAtUtc,
                hold.ClassName,
                hold.CreatedAtUtc,
                hold.ConfirmedAtUtc,
                hold.CancelledAtUtc);
    }

    public async Task<ConfirmedHoldResponse> ConfirmHoldAsync(
        Guid holdId,
        string studentId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var hold = await LockHoldAsync(holdId, cancellationToken);

        EnsureOwner(hold, studentId);
        if (hold.Status == HoldStatus.Confirmed)
        {
            // Idempotent: a repeated confirmation changes nothing.
            await transaction.CommitAsync(cancellationToken);
            return new ConfirmedHoldResponse(HoldId(hold.Id), StatusName(hold.Status));
        }

        var now = DateTimeOffset.UtcNow;
        if (hold.Status == HoldStatus.Expired ||
            (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc <= now))
        {
            if (hold.Status == HoldStatus.Held)
            {
                hold.Status = HoldStatus.Expired;
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            throw Conflict(
                AdmissionErrorCodes.HoldExpired,
                "This hold has expired and cannot be confirmed.");
        }

        if (hold.Status != HoldStatus.Held)
        {
            throw Conflict(
                AdmissionErrorCodes.HoldNotActive,
                "Only an active hold can be confirmed.");
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
        var hold = await LockHoldAsync(holdId, cancellationToken);

        EnsureOwner(hold, studentId);
        if (hold.Status == HoldStatus.Cancelled)
        {
            // Idempotent: a repeated cancellation is a no-op success.
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        if (hold.Status == HoldStatus.Expired ||
            (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc <= now))
        {
            if (hold.Status == HoldStatus.Held)
            {
                hold.Status = HoldStatus.Expired;
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            throw Conflict(
                AdmissionErrorCodes.HoldExpired,
                "This hold has already expired; its seat has been released.");
        }

        if (hold.Status != HoldStatus.Held)
        {
            throw Conflict(
                AdmissionErrorCodes.HoldNotActive,
                "A confirmed admission cannot be cancelled.");
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
        var now = DateTimeOffset.UtcNow;
        await dbContext.Holds
            .Where(hold =>
                hold.StudentId == studentId &&
                hold.Status == HoldStatus.Held &&
                hold.ExpiresAtUtc <= now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(hold => hold.Status, HoldStatus.Expired),
                cancellationToken);

        var holds = await dbContext.Holds
            .Where(hold => hold.StudentId == studentId)
            .OrderByDescending(hold => hold.CreatedAtUtc)
            .Select(hold => new HoldData(
                hold.Id,
                hold.ClassId,
                hold.Class!.Name,
                hold.Status,
                hold.ExpiresAtUtc,
                hold.CreatedAtUtc,
                hold.ConfirmedAtUtc,
                hold.CancelledAtUtc))
            .ToListAsync(cancellationToken);

        return holds.Select(hold => new StudentHoldResponse(
            HoldId(hold.Id),
            ClassId(hold.ClassId),
            hold.ClassName,
            StatusName(hold.Status),
            hold.ExpiresAtUtc,
            hold.CreatedAtUtc,
            hold.ConfirmedAtUtc,
            hold.CancelledAtUtc)).ToList();
    }

    private async Task<AdmissionHold> LockHoldAsync(Guid holdId, CancellationToken cancellationToken)
    {
        var hold = await dbContext.Holds
            .FromSqlInterpolated($"SELECT * FROM admission_holds WHERE id = {holdId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        return hold ?? throw NotFound(AdmissionErrorCodes.HoldNotFound, "Hold");
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
            admissionClass.CreatedAtUtc,
            admissionClass.Holds.Count(hold =>
                hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > now),
            admissionClass.Holds.Count(hold => hold.Status == HoldStatus.Confirmed)));
    }

    private static ClassMetricsResponse ToClassMetricsResponse(ClassMetricsData metrics) =>
        new(
            ClassId(metrics.Id),
            metrics.Name,
            metrics.TotalSeats,
            metrics.HeldSeats,
            metrics.ConfirmedSeats,
            Math.Max(0, metrics.TotalSeats - metrics.HeldSeats - metrics.ConfirmedSeats));

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
                AdmissionErrorCodes.HoldNotOwned,
                "Forbidden",
                "This application belongs to a different student.");
        }
    }

    private static DateTimeOffset TruncateToSeconds(DateTimeOffset value) =>
        new(value.Ticks - value.Ticks % TimeSpan.TicksPerSecond, TimeSpan.Zero);

    private static AdmissionException NotFound(string code, string resource) =>
        new((int)HttpStatusCode.NotFound, code, "Not Found", $"{resource} was not found.");

    private static AdmissionException Conflict(string code, string detail) =>
        new((int)HttpStatusCode.Conflict, code, "Conflict", detail);

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
        DateTimeOffset CreatedAtUtc,
        int HeldSeats,
        int ConfirmedSeats);

    private sealed record HoldData(
        Guid Id,
        Guid ClassId,
        string ClassName,
        HoldStatus Status,
        DateTimeOffset ExpiresAtUtc,
        DateTimeOffset CreatedAtUtc,
        DateTimeOffset? ConfirmedAtUtc,
        DateTimeOffset? CancelledAtUtc);
}
