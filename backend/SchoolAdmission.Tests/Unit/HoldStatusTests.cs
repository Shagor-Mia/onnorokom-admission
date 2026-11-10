using SchoolAdmission.Domain.Enums;
using Xunit;

namespace SchoolAdmission.Tests.Unit;

public sealed class HoldStatusTests
{
    [Fact]
    public void HoldStatus_ContainsAllDocumentedLifecycleStates()
    {
        Assert.Equal(
            new[] { "Held", "Confirmed", "Expired", "Cancelled" },
            Enum.GetNames<HoldStatus>());
    }
}
