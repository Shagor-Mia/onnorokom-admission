using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Application.DTOs;
using SchoolAdmission.Application.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("me/holds")]
public sealed class StudentHoldsController(IAdmissionService admissionService) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<StudentHoldResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ListStudentHolds(
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!IsValidStudentId(studentId))
        {
            return InvalidStudentId();
        }

        return Ok(await admissionService.ListStudentHoldsAsync(studentId!, cancellationToken));
    }
}
