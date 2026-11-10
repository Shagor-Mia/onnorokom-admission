using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Application.Exceptions;

namespace SchoolAdmission.Api.Middleware;

/// <summary>Maps known exceptions to RFC 7807 Problem Details with a stable <c>code</c>.</summary>
public static class AdmissionProblemMapper
{
    private const string UniqueViolation = "23505";

    /// <summary>Returns the 4xx mapping for a known exception, or null for a real server fault.</summary>
    public static AdmissionException? Map(Exception exception) => exception switch
    {
        AdmissionException known => known,
        // Defence in depth: the partial unique index rejected a duplicate active application.
        DbUpdateException { InnerException: PostgresException { SqlState: UniqueViolation } } =>
            new AdmissionException(
                StatusCodes.Status409Conflict,
                AdmissionErrorCodes.DuplicateActiveApplication,
                "Conflict",
                "This student already has an active application or confirmed admission for this class."),
        BadHttpRequestException badRequest =>
            new AdmissionException(
                badRequest.StatusCode,
                AdmissionErrorCodes.ValidationFailed,
                "Invalid request",
                badRequest.Message),
        _ => null
    };

    public static ProblemDetails ToProblemDetails(AdmissionException exception)
    {
        var problemDetails = new ProblemDetails
        {
            Type = $"https://httpstatuses.com/{exception.StatusCode}",
            Title = exception.Title,
            Status = exception.StatusCode,
            Detail = exception.Message
        };
        problemDetails.Extensions["code"] = exception.Code;
        return problemDetails;
    }
}

/// <summary>
/// Converts business exceptions thrown by controllers into 4xx responses. Running as an
/// MVC filter means expected outcomes such as "no seats" (409) are not logged as errors.
/// </summary>
public sealed class AdmissionExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var mapped = AdmissionProblemMapper.Map(context.Exception);
        if (mapped is null)
        {
            return;
        }

        context.Result = new ObjectResult(AdmissionProblemMapper.ToProblemDetails(mapped))
        {
            StatusCode = mapped.StatusCode,
            ContentTypes = { "application/problem+json" }
        };
        context.ExceptionHandled = true;
    }
}

/// <summary>Fallback for known exceptions raised outside MVC (e.g. request body reading).</summary>
public sealed class AdmissionExceptionHandler(
    IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var mapped = AdmissionProblemMapper.Map(exception);
        if (mapped is null)
        {
            return false;
        }

        httpContext.Response.StatusCode = mapped.StatusCode;
        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = AdmissionProblemMapper.ToProblemDetails(mapped)
        });

        return true;
    }
}
