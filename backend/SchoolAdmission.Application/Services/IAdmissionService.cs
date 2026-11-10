using SchoolAdmission.Application.DTOs;

namespace SchoolAdmission.Application.Services;

public interface IAdmissionService
{
    Task<CreatedClassResponse> CreateClassAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ClassMetricsResponse>> ListClassesAsync(
        CancellationToken cancellationToken);

    Task<ClassMetricsResponse?> GetClassAsync(
        Guid classId,
        CancellationToken cancellationToken);

    Task<CreatedHoldResponse> CreateHoldAsync(
        Guid classId,
        string studentId,
        CancellationToken cancellationToken);

    Task<HoldStatusResponse?> GetHoldAsync(
        Guid holdId,
        CancellationToken cancellationToken);

    Task<ConfirmedHoldResponse> ConfirmHoldAsync(
        Guid holdId,
        string studentId,
        CancellationToken cancellationToken);

    Task CancelHoldAsync(
        Guid holdId,
        string studentId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<StudentHoldResponse>> ListStudentHoldsAsync(
        string studentId,
        CancellationToken cancellationToken);
}
