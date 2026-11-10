namespace SchoolAdmission.Application.Exceptions;

public sealed class AdmissionException(int statusCode, string title, string detail)
    : Exception(detail)
{
    public int StatusCode { get; } = statusCode;
    public string Title { get; } = title;
}
