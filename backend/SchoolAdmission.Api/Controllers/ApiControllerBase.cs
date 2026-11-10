using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Application.Exceptions;

namespace SchoolAdmission.Api.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    private static readonly Regex StudentIdPattern = new("^[0-9]{17}$", RegexOptions.Compiled);

    protected static bool TryParseClassId(string value, out Guid id) =>
        TryParsePrefixedId(value, "c_", out id);

    protected static bool TryParseHoldId(string value, out Guid id) =>
        TryParsePrefixedId(value, "h_", out id);

    /// <summary>
    /// An identifier that is not in our format cannot refer to an existing record,
    /// so it is reported as 404 Not Found (the same as any other unknown ID).
    /// </summary>
    protected IActionResult NotFoundProblem(string code, string resource)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(
            HttpContext,
            statusCode: StatusCodes.Status404NotFound,
            title: "Not Found",
            type: "https://httpstatuses.com/404",
            detail: $"{resource} was not found.");
        problem.Extensions["code"] = code;
        return new ObjectResult(problem) { StatusCode = StatusCodes.Status404NotFound };
    }

    protected IActionResult InvalidStudentId()
    {
        var problem = ProblemDetailsFactory.CreateValidationProblemDetails(
            HttpContext,
            new Microsoft.AspNetCore.Mvc.ModelBinding.ModelStateDictionary(),
            statusCode: StatusCodes.Status400BadRequest,
            title: "Invalid request",
            type: "https://httpstatuses.com/400",
            detail: "The X-Student-Id header must contain exactly 17 digits (birth registration number).");
        problem.Errors["X-Student-Id"] = ["The student ID must contain exactly 17 ASCII digits."];
        problem.Extensions["code"] = AdmissionErrorCodes.InvalidStudentId;
        return new BadRequestObjectResult(problem);
    }

    protected static bool IsValidStudentId(string? value) =>
        value is not null && StudentIdPattern.IsMatch(value);

    private static bool TryParsePrefixedId(string value, string prefix, out Guid id)
    {
        id = Guid.Empty;
        return value.StartsWith(prefix, StringComparison.Ordinal) &&
               Guid.TryParseExact(value.AsSpan(prefix.Length), "N", out id);
    }
}
