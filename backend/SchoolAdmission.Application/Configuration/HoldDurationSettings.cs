namespace SchoolAdmission.Application.Configuration;

public sealed record HoldDurationSettings(int Seconds)
{
    public static HoldDurationSettings Create(int seconds)
    {
        if (seconds <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(seconds), "Hold duration must be positive.");
        }

        return new HoldDurationSettings(seconds);
    }
}
