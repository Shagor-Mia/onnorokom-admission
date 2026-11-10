using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Infrastructure.BackgroundServices;

public sealed class HoldExpiryBackgroundService(
    IServiceScopeFactory scopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTimeOffset.UtcNow;

            await dbContext.Holds
                .Where(hold =>
                    hold.Status == HoldStatus.Held &&
                    hold.ExpiresAtUtc <= now)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(hold => hold.Status, HoldStatus.Expired),
                    stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
