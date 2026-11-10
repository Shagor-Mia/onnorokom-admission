using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SchoolAdmission.Domain.Enums;
using SchoolAdmission.Infrastructure.Persistence;

namespace SchoolAdmission.Infrastructure.BackgroundServices;

/// <summary>
/// Periodically moves expired HELD rows to EXPIRED so the persisted status matches
/// reality even when nobody reads the hold. Seat counts never depend on this worker:
/// capacity queries already ignore HELD rows whose expiry has passed.
/// </summary>
public sealed class HoldExpiryBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<HoldExpiryBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTimeOffset.UtcNow;

                var expired = await dbContext.Holds
                    .Where(hold =>
                        hold.Status == HoldStatus.Held &&
                        hold.ExpiresAtUtc <= now)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(hold => hold.Status, HoldStatus.Expired),
                        stoppingToken);

                if (expired > 0)
                {
                    logger.LogInformation("Expired {Count} stale hold(s).", expired);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // A transient database failure must not stop the whole API host.
                logger.LogWarning(exception, "Hold expiry sweep failed; retrying on the next tick.");
            }
        }
        while (await WaitForNextTickAsync(timer, stoppingToken));
    }

    private static async Task<bool> WaitForNextTickAsync(PeriodicTimer timer, CancellationToken token)
    {
        try
        {
            return await timer.WaitForNextTickAsync(token);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
