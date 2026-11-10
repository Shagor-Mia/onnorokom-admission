using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using SchoolAdmission.Domain.Enums;

namespace SchoolAdmission.Infrastructure.Persistence;

public sealed class HoldStatusConverter : ValueConverter<HoldStatus, string>
{
    public HoldStatusConverter()
        : base(
            status => ToDatabase(status),
            value => FromDatabase(value))
    {
    }

    private static string ToDatabase(HoldStatus status) => status switch
    {
        HoldStatus.Held => "HELD",
        HoldStatus.Confirmed => "CONFIRMED",
        HoldStatus.Expired => "EXPIRED",
        HoldStatus.Cancelled => "CANCELLED",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown hold status.")
    };

    private static HoldStatus FromDatabase(string value) => value switch
    {
        "HELD" => HoldStatus.Held,
        "CONFIRMED" => HoldStatus.Confirmed,
        "EXPIRED" => HoldStatus.Expired,
        "CANCELLED" => HoldStatus.Cancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown stored hold status.")
    };
}
