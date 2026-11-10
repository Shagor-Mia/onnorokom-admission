namespace SchoolAdmission.Application.DTOs;

// The first fields of every record are the exact contract fields from the brief.
// Extra fields (className, createdAt, confirmedAt, cancelledAt) are additive, which
// the brief explicitly allows; they let the UI show a timeline without extra calls.

public sealed record CreatedHoldResponse(
    string HoldId,
    string ClassId,
    string StudentId,
    string Status,
    DateTimeOffset ExpiresAt);

public sealed record HoldStatusResponse(
    string HoldId,
    string ClassId,
    string Status,
    DateTimeOffset ExpiresAt,
    string ClassName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt,
    DateTimeOffset? CancelledAt);

public sealed record ConfirmedHoldResponse(string HoldId, string Status);

public sealed record StudentHoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt,
    DateTimeOffset? CancelledAt);
