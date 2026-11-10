namespace SchoolAdmission.Application.Exceptions;

/// <summary>
/// A business or validation failure that maps to a 4xx Problem Details response.
/// <see cref="Code"/> is a stable machine-readable identifier the frontend can map
/// to user-facing messages without parsing English text.
/// </summary>
public sealed class AdmissionException(int statusCode, string code, string title, string detail)
    : Exception(detail)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
    public string Title { get; } = title;
}

public static class AdmissionErrorCodes
{
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string InvalidStudentId = "INVALID_STUDENT_ID";
    public const string ClassNotFound = "CLASS_NOT_FOUND";
    public const string HoldNotFound = "HOLD_NOT_FOUND";
    public const string NoSeatsAvailable = "NO_SEATS_AVAILABLE";
    public const string DuplicateActiveApplication = "DUPLICATE_ACTIVE_APPLICATION";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string HoldNotActive = "HOLD_NOT_ACTIVE";
    public const string HoldNotOwned = "HOLD_NOT_OWNED";
}
