using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Domain.Entities;

public sealed class AdmissionHold
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public HoldStatus Status { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? ConfirmedAtUtc { get; set; }
    public DateTimeOffset? CancelledAtUtc { get; set; }

    public AdmissionClass? Class { get; set; }
}
