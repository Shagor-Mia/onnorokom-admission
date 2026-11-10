using System.ComponentModel.DataAnnotations;

namespace SchoolAdmission.Application.DTOs;

public sealed record CreateClassRequest(
    [param: Required]
    [param: StringLength(200, MinimumLength = 1)]
    string Name,
    [param: Range(1, int.MaxValue)]
    int TotalSeats);

public sealed record CreatedClassResponse(string Id, string Name, int TotalSeats);

public sealed record ClassMetricsResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);
