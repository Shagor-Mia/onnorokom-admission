namespace SchoolAdmission.Domain.Entities;

public sealed class AdmissionClass
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalSeats { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }

    public ICollection<AdmissionHold> Holds { get; set; } = new List<AdmissionHold>();
}
