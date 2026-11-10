using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using SchoolAdmission.Application.Exceptions;

namespace SchoolAdmission.Api.Middleware;

public sealed class AdmissionExceptionHandler(
    IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not AdmissionException admissionException)
        {
            return false;
        }

        var problemDetails = new ProblemDetails
        {
            Type = $"https://httpstatuses.com/{admissionException.StatusCode}",
            Title = admissionException.Title,
            Status = admissionException.StatusCode,
            Detail = admissionException.Message
        };

        httpContext.Response.StatusCode = admissionException.StatusCode;
        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problemDetails
        });

        return true;
    }
}
