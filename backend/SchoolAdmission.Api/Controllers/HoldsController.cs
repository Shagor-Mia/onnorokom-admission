using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Application.DTOs;
using SchoolAdmission.Application.Exceptions;
using SchoolAdmission.Application.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
public sealed class HoldsController(IAdmissionService admissionService) : ApiControllerBase
{
    [HttpPost("/classes/{classId}/holds")]
    [ProducesResponseType<CreatedHoldResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateHold(
        string classId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!IsValidStudentId(studentId))
        {
            return InvalidStudentId();
        }

        if (!TryParseClassId(classId, out var parsedClassId))
        {
            return NotFoundProblem(AdmissionErrorCodes.ClassNotFound, "Class");
        }

        var response = await admissionService.CreateHoldAsync(
            parsedClassId,
            studentId!,
            cancellationToken);
        return CreatedAtAction(nameof(GetHold), new { holdId = response.HoldId }, response);
    }

    [HttpGet("/holds/{holdId}")]
    [ProducesResponseType<HoldStatusResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHold(string holdId, CancellationToken cancellationToken)
    {
        if (!TryParseHoldId(holdId, out var parsedHoldId))
        {
            return NotFoundProblem(AdmissionErrorCodes.HoldNotFound, "Hold");
        }

        var response = await admissionService.GetHoldAsync(parsedHoldId, cancellationToken);
        return response is null
            ? NotFoundProblem(AdmissionErrorCodes.HoldNotFound, "Hold")
            : Ok(response);
    }

    [HttpPost("/holds/{holdId}/confirm")]
    [ProducesResponseType<ConfirmedHoldResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmHold(
        string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!IsValidStudentId(studentId))
        {
            return InvalidStudentId();
        }

        if (!TryParseHoldId(holdId, out var parsedHoldId))
        {
            return NotFoundProblem(AdmissionErrorCodes.HoldNotFound, "Hold");
        }

        return Ok(await admissionService.ConfirmHoldAsync(
            parsedHoldId,
            studentId!,
            cancellationToken));
    }

    [HttpDelete("/holds/{holdId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelHold(
        string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId,
        CancellationToken cancellationToken)
    {
        if (!IsValidStudentId(studentId))
        {
            return InvalidStudentId();
        }

        if (!TryParseHoldId(holdId, out var parsedHoldId))
        {
            return NotFoundProblem(AdmissionErrorCodes.HoldNotFound, "Hold");
        }

        await admissionService.CancelHoldAsync(parsedHoldId, studentId!, cancellationToken);
        return NoContent();
    }
}
