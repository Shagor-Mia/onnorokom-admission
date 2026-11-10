namespace SchoolAdmission.Application.DTOs;

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
    DateTimeOffset ExpiresAt);

public sealed record ConfirmedHoldResponse(string HoldId, string Status);

public sealed record StudentHoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTimeOffset ExpiresAt);
