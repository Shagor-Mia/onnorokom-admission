using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Application.DTOs;
using SchoolAdmission.Application.Exceptions;
using SchoolAdmission.Application.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
public sealed class ClassesController(IAdmissionService admissionService) : ApiControllerBase
{
    [HttpPost]
    [ProducesResponseType<CreatedClassResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateClass(
        [FromBody] CreateClassRequest request,
        CancellationToken cancellationToken)
    {
        var response = await admissionService.CreateClassAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetClass), new { classId = response.Id }, response);
    }

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ClassMetricsResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ClassMetricsResponse>>> ListClasses(
        CancellationToken cancellationToken) =>
        Ok(await admissionService.ListClassesAsync(cancellationToken));

    [HttpGet("{classId}")]
    [ProducesResponseType<ClassMetricsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClass(string classId, CancellationToken cancellationToken)
    {
        if (!TryParseClassId(classId, out var parsedClassId))
        {
            return NotFoundProblem(AdmissionErrorCodes.ClassNotFound, "Class");
        }

        var response = await admissionService.GetClassAsync(parsedClassId, cancellationToken);
        return response is null
            ? NotFoundProblem(AdmissionErrorCodes.ClassNotFound, "Class")
            : Ok(response);
    }
}
