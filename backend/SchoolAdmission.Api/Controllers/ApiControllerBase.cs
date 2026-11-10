using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace SchoolAdmission.Api.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    private static readonly Regex StudentIdPattern = new("^[0-9]{17}$", RegexOptions.Compiled);

    protected static bool TryParseClassId(string value, out Guid id) =>
        TryParsePrefixedId(value, "c_", out id);

    protected static bool TryParseHoldId(string value, out Guid id) =>
        TryParsePrefixedId(value, "h_", out id);

    protected IActionResult InvalidRouteId(string parameterName) =>
        BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
        {
            [parameterName] = ["The identifier has an invalid format."]
        }));

    protected IActionResult InvalidStudentId() =>
        BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
        {
            ["X-Student-Id"] = ["The student ID must contain exactly 17 ASCII digits."]
        }));

    protected static bool IsValidStudentId(string? value) =>
        value is not null && StudentIdPattern.IsMatch(value);

    private static bool TryParsePrefixedId(string value, string prefix, out Guid id)
    {
        id = Guid.Empty;
        return value.StartsWith(prefix, StringComparison.Ordinal) &&
               Guid.TryParseExact(value.AsSpan(prefix.Length), "N", out id);
    }
}
