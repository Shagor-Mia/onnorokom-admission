using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Application.Services;
using SchoolAdmission.Infrastructure.BackgroundServices;
using SchoolAdmission.Infrastructure.Persistence;
using SchoolAdmission.Infrastructure.Services;

namespace SchoolAdmission.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection must be configured.");
        }

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));
        services.AddScoped<IAdmissionService, AdmissionService>();
        services.AddHostedService<HoldExpiryBackgroundService>();

        return services;
    }
}
