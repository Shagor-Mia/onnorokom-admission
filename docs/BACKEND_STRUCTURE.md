# Backend Structure — Implementation Guide

> এই ফাইলটি ASP.NET Core backend এর সম্পূর্ণ implementation guide।
> API contract: `docs/API_CONTRACT.md`
> Database/Concurrency strategy: `docs/DATABASE_AND_CONCURRENCY.md`
> Project spec: `docs/PROJECT_SPEC.md`

---

## Tech Stack

```
Language:    C# 12
Framework:   ASP.NET Core Web API (.NET 8)
Database:    PostgreSQL 15+
ORM:         Entity Framework Core 8 + Npgsql
Tests:       xUnit + FluentAssertions + Testcontainers
Port:        8080 (host-facing)
```

---

## Solution Structure

```
backend/
├── SchoolAdmission.sln
├── SchoolAdmission.Api/
│   ├── Controllers/
│   │   ├── ClassesController.cs
│   │   └── HoldsController.cs
│   ├── Middleware/
│   │   └── ExceptionMiddleware.cs
│   ├── Extensions/
│   │   └── ServiceCollectionExtensions.cs
│   ├── Program.cs
│   └── SchoolAdmission.Api.csproj
├── SchoolAdmission.Application/
│   ├── DTOs/
│   │   ├── ClassDto.cs
│   │   ├── CreateClassRequest.cs
│   │   ├── HoldDto.cs
│   │   ├── MyHoldDto.cs
│   │   └── ConfirmHoldResponse.cs
│   ├── Interfaces/
│   │   ├── IClassService.cs
│   │   └── IHoldService.cs
│   ├── Services/
│   │   ├── ClassService.cs
│   │   └── HoldService.cs
│   └── SchoolAdmission.Application.csproj
├── SchoolAdmission.Domain/
│   ├── Entities/
│   │   ├── AdmissionClass.cs
│   │   └── AdmissionHold.cs
│   ├── Enums/
│   │   └── HoldStatus.cs
│   └── SchoolAdmission.Domain.csproj
├── SchoolAdmission.Infrastructure/
│   ├── Persistence/
│   │   ├── AppDbContext.cs
│   │   └── Migrations/   (EF Core generated)
│   ├── Repositories/
│   │   ├── ClassRepository.cs
│   │   └── HoldRepository.cs
│   ├── BackgroundServices/
│   │   └── HoldExpiryWorker.cs
│   ├── DependencyInjection.cs
│   └── SchoolAdmission.Infrastructure.csproj
└── SchoolAdmission.Tests/
    ├── Integration/
    │   ├── ClassApiTests.cs
    │   ├── HoldApiTests.cs
    │   ├── ConcurrencyTests.cs
    │   └── ExpiryTests.cs
    ├── Unit/
    │   └── HoldStatusTests.cs
    └── SchoolAdmission.Tests.csproj
```

---

## Configuration

### `appsettings.json`
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=school_admission;Username=app;Password=change_this_local_password"
  },
  "HoldDurationSeconds": 600,
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  }
}
```

### Environment Variable Overrides (Docker)
```
ConnectionStrings__DefaultConnection   → full Npgsql connection string
HOLD_DURATION_SECONDS                  → integer (default 600)
```

---

## Domain Layer (`SchoolAdmission.Domain`)

### `HoldStatus` Enum
```csharp
// Domain/Enums/HoldStatus.cs
public enum HoldStatus
{
    Held,
    Confirmed,
    Expired,
    Cancelled
}
```
Stored as string in DB ("HELD", "CONFIRMED", "EXPIRED", "CANCELLED").

### `AdmissionClass` Entity
```csharp
// Domain/Entities/AdmissionClass.cs
public class AdmissionClass
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalSeats { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    
    // Navigation
    public ICollection<AdmissionHold> Holds { get; set; } = new List<AdmissionHold>();
}
```

### `AdmissionHold` Entity
```csharp
// Domain/Entities/AdmissionHold.cs
public class AdmissionHold
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string StudentId { get; set; } = string.Empty;  // 17-char BRN
    public HoldStatus Status { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? ConfirmedAtUtc { get; set; }
    public DateTimeOffset? CancelledAtUtc { get; set; }
    
    // Navigation
    public AdmissionClass? Class { get; set; }
}
```

---

## Infrastructure Layer

### `AppDbContext.cs`
```csharp
public class AppDbContext : DbContext
{
    public DbSet<AdmissionClass> Classes { get; set; }
    public DbSet<AdmissionHold> Holds { get; set; }

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // admission_classes table
        mb.Entity<AdmissionClass>(e => {
            e.ToTable("admission_classes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).IsRequired().HasMaxLength(200);
            e.Property(x => x.TotalSeats).IsRequired();
            e.Property(x => x.CreatedAtUtc).IsRequired();
        });

        // admission_holds table
        mb.Entity<AdmissionHold>(e => {
            e.ToTable("admission_holds");
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).IsRequired().HasMaxLength(17);
            e.Property(x => x.Status)
                .HasConversion<string>()   // store as "HELD" etc.
                .IsRequired();
            e.Property(x => x.ExpiresAtUtc).IsRequired();
            
            // FK
            e.HasOne(x => x.Class)
                .WithMany(c => c.Holds)
                .HasForeignKey(x => x.ClassId);

            // Indexes
            e.HasIndex(x => new { x.ClassId, x.Status, x.ExpiresAtUtc })
                .HasDatabaseName("ix_holds_class_status_expiry");
            e.HasIndex(x => new { x.StudentId, x.CreatedAtUtc })
                .HasDatabaseName("ix_holds_student_created");
            e.HasIndex(x => new { x.StudentId, x.ClassId, x.Status })
                .HasDatabaseName("ix_holds_student_class_status");
        });
    }
}
```

### `HoldExpiryWorker.cs`
```csharp
// Infrastructure/BackgroundServices/HoldExpiryWorker.cs
// Runs every 30 seconds
// Transitions HELD rows where ExpiresAtUtc <= UtcNow to EXPIRED
// Uses a scoped DbContext (IServiceScopeFactory)
public class HoldExpiryWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            var now = DateTimeOffset.UtcNow;
            await db.Holds
                .Where(h => h.Status == HoldStatus.Held && h.ExpiresAtUtc <= now)
                .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);
        }
    }
}
```

---

## Application Layer — DTOs

### `ClassDto.cs`
```csharp
public record ClassDto(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats
);
```

### `HoldDto.cs`
```csharp
public record HoldDto(
    string HoldId,
    string ClassId,
    string? StudentId,
    string Status,         // "HELD" / "CONFIRMED" / "EXPIRED" / "CANCELLED"
    DateTimeOffset ExpiresAt
);
```

### `MyHoldDto.cs`
```csharp
public record MyHoldDto(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTimeOffset ExpiresAt
);
```

### `CreateClassRequest.cs`
```csharp
public record CreateClassRequest(
    [Required][MinLength(1)] string Name,
    [Range(1, int.MaxValue)] int TotalSeats
);
```

---

## Application Layer — Services

### `IClassService.cs`
```csharp
public interface IClassService
{
    Task<ClassDto> CreateClassAsync(CreateClassRequest req, CancellationToken ct = default);
    Task<IReadOnlyList<ClassDto>> ListClassesAsync(CancellationToken ct = default);
    Task<ClassDto?> GetClassAsync(Guid classId, CancellationToken ct = default);
}
```

### `IHoldService.cs`
```csharp
public interface IHoldService
{
    Task<HoldDto> CreateHoldAsync(Guid classId, string studentId, CancellationToken ct = default);
    Task<HoldDto?> GetHoldAsync(Guid holdId, CancellationToken ct = default);
    Task<ConfirmHoldResponse> ConfirmHoldAsync(Guid holdId, string studentId, CancellationToken ct = default);
    Task CancelHoldAsync(Guid holdId, string studentId, CancellationToken ct = default);
    Task<IReadOnlyList<MyHoldDto>> GetStudentHoldsAsync(string studentId, CancellationToken ct = default);
}
```

### `ClassService.cs` — Seat Count Calculation
```csharp
// Seat counts are calculated as aggregates — NOT stored columns.
// heldSeats    = COUNT of HELD rows WHERE ExpiresAtUtc > UtcNow
// confirmedSeats = COUNT of CONFIRMED rows
// availableSeats = totalSeats - heldSeats - confirmedSeats

private static ClassDto ToDto(AdmissionClass cls, DateTimeOffset now) =>
{
    var held = cls.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAtUtc > now);
    var confirmed = cls.Holds.Count(h => h.Status == HoldStatus.Confirmed);
    var available = Math.Max(0, cls.TotalSeats - held - confirmed);
    return new ClassDto($"c_{cls.Id:N}", cls.Name, cls.TotalSeats, held, confirmed, available);
};
```

### `HoldService.cs` — CreateHold Transaction
```csharp
// Implements the atomic hold strategy from DATABASE_AND_CONCURRENCY.md §3
public async Task<HoldDto> CreateHoldAsync(Guid classId, string studentId, CancellationToken ct)
{
    await using var tx = await _db.Database.BeginTransactionAsync(ct);
    
    // 1. Lock the class row (SELECT FOR UPDATE)
    var cls = await _db.Classes
        .FromSqlRaw("SELECT * FROM admission_classes WHERE id = {0} FOR UPDATE", classId)
        .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Class not found");

    // 2. Expire stale holds for this class inside the same transaction
    var now = DateTimeOffset.UtcNow;
    await _db.Holds
        .Where(h => h.ClassId == classId && h.Status == HoldStatus.Held && h.ExpiresAtUtc <= now)
        .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);

    // 3. Check duplicate active application
    var hasActive = await _db.Holds.AnyAsync(h =>
        h.ClassId == classId && h.StudentId == studentId &&
        (h.Status == HoldStatus.Held || h.Status == HoldStatus.Confirmed), ct);
    if (hasActive) throw new ConflictException("Student already has an active application for this class.");

    // 4. Count active seats (held unexpired + confirmed)
    var heldCount = await _db.Holds.CountAsync(h =>
        h.ClassId == classId && h.Status == HoldStatus.Held && h.ExpiresAtUtc > now, ct);
    var confirmedCount = await _db.Holds.CountAsync(h =>
        h.ClassId == classId && h.Status == HoldStatus.Confirmed, ct);
    if (heldCount + confirmedCount >= cls.TotalSeats)
        throw new ConflictException("No seats are currently available for this class.");

    // 5. Insert new hold
    var hold = new AdmissionHold
    {
        Id = Guid.NewGuid(),
        ClassId = classId,
        StudentId = studentId,
        Status = HoldStatus.Held,
        CreatedAtUtc = now,
        ExpiresAtUtc = now.AddSeconds(_holdDurationSeconds),
    };
    _db.Holds.Add(hold);
    await _db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);

    return MapToDto(hold);
}
```

### `HoldService.cs` — ConfirmHold Transaction
```csharp
// Implements DATABASE_AND_CONCURRENCY.md §5
public async Task<ConfirmHoldResponse> ConfirmHoldAsync(Guid holdId, string studentId, CancellationToken ct)
{
    await using var tx = await _db.Database.BeginTransactionAsync(ct);
    
    var hold = await _db.Holds
        .FromSqlRaw("SELECT * FROM admission_holds WHERE id = {0} FOR UPDATE", holdId)
        .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Hold not found");

    // Verify ownership
    if (hold.StudentId != studentId)
        throw new ForbiddenException("You do not own this hold.");

    var now = DateTimeOffset.UtcNow;

    // Idempotent: already confirmed
    if (hold.Status == HoldStatus.Confirmed)
    {
        await tx.CommitAsync(ct);
        return new ConfirmHoldResponse($"h_{hold.Id:N}", "CONFIRMED");
    }

    // Check expiry
    if (hold.ExpiresAtUtc <= now)
    {
        hold.Status = HoldStatus.Expired;
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        throw new ConflictException("Hold has expired and cannot be confirmed.");
    }

    // Must be HELD to confirm
    if (hold.Status != HoldStatus.Held)
        throw new ConflictException($"Cannot confirm a hold in '{hold.Status}' status.");

    // Transition HELD → CONFIRMED
    hold.Status = HoldStatus.Confirmed;
    hold.ConfirmedAtUtc = now;
    await _db.SaveChangesAsync(ct);
    await tx.CommitAsync(ct);

    return new ConfirmHoldResponse($"h_{hold.Id:N}", "CONFIRMED");
}
```

### `HoldService.cs` — CancelHold
```csharp
// DATABASE_AND_CONCURRENCY.md §6
public async Task CancelHoldAsync(Guid holdId, string studentId, CancellationToken ct)
{
    await using var tx = await _db.Database.BeginTransactionAsync(ct);
    
    var hold = await _db.Holds
        .FromSqlRaw("SELECT * FROM admission_holds WHERE id = {0} FOR UPDATE", holdId)
        .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Hold not found");

    if (hold.StudentId != studentId)
        throw new ForbiddenException("You do not own this hold.");

    if (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc > DateTimeOffset.UtcNow)
    {
        hold.Status = HoldStatus.Cancelled;
        hold.CancelledAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
    // For terminal states (CONFIRMED, EXPIRED, already CANCELLED):
    // Return 409 Conflict with descriptive message.
    // See ASSUMPTIONS.md §4 for the chosen behavior.
    else if (hold.Status != HoldStatus.Cancelled)
    {
        throw new ConflictException($"Cannot cancel a hold in '{hold.Status}' status.");
    }

    await tx.CommitAsync(ct);
}
```

---

## API Layer — Controllers

### `ClassesController.cs`
```csharp
[ApiController]
[Route("classes")]
public class ClassesController : ControllerBase
{
    // POST /classes
    [HttpPost]
    [ProducesResponseType(typeof(ClassDto), 201)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreateClassRequest req) { ... }

    // GET /classes
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ClassDto>), 200)]
    public async Task<IActionResult> List() { ... }

    // GET /classes/{classId}
    [HttpGet("{classId}")]
    [ProducesResponseType(typeof(ClassDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Get(string classId) { ... }

    // POST /classes/{classId}/holds
    [HttpPost("{classId}/holds")]
    [ProducesResponseType(typeof(HoldDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> CreateHold(string classId,
        [FromHeader(Name = "X-Student-Id")] string? studentId) { ... }
}
```

### `HoldsController.cs`
```csharp
[ApiController]
[Route("holds")]
public class HoldsController : ControllerBase
{
    // GET /holds/{holdId}
    [HttpGet("{holdId}")]
    [ProducesResponseType(typeof(HoldDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Get(string holdId) { ... }

    // POST /holds/{holdId}/confirm
    [HttpPost("{holdId}/confirm")]
    [ProducesResponseType(typeof(ConfirmHoldResponse), 200)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> Confirm(string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId) { ... }

    // DELETE /holds/{holdId}
    [HttpDelete("{holdId}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> Cancel(string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentId) { ... }
}

// Separate controller for /me prefix
[ApiController]
[Route("me")]
public class MeController : ControllerBase
{
    // GET /me/holds
    [HttpGet("holds")]
    [ProducesResponseType(typeof(IReadOnlyList<MyHoldDto>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> MyHolds(
        [FromHeader(Name = "X-Student-Id")] string? studentId) { ... }
}
```

---

## ID Format Convention

```
Classes:  id = "c_{Guid:N}"  (e.g., "c_123abc...")
Holds:    id = "h_{Guid:N}"  (e.g., "h_789xyz...")
```

When parsing from route params (e.g., `GET /classes/{classId}`):
```csharp
private static bool TryParseClassId(string raw, out Guid id)
{
    var prefix = raw.StartsWith("c_") ? raw[2..] : raw;
    return Guid.TryParseExact(prefix, "N", out id);
}
```

---

## Student ID Validation

```csharp
// Validate X-Student-Id header in controllers
private static bool IsValidStudentId(string? id) =>
    !string.IsNullOrEmpty(id) && id.Length == 17 && id.All(char.IsDigit);
```

If invalid: return `400 Bad Request` with ProblemDetails detail "Student ID must be a 17-digit number."

---

## Error Response Format

All error responses use `ProblemDetails` (RFC 7807):

```json
{
  "type": "https://httpstatuses.com/409",
  "title": "Conflict",
  "status": 409,
  "detail": "No seats are currently available for this class."
}
```

Custom exceptions:
```csharp
public class NotFoundException(string msg) : Exception(msg);
public class ConflictException(string msg) : Exception(msg);
public class ForbiddenException(string msg) : Exception(msg);
```

`ExceptionMiddleware.cs` maps:
- `NotFoundException` → 404
- `ConflictException` → 409
- `ForbiddenException` → 403
- `ValidationException` → 422
- Unhandled → 500 (log full stack, return generic message)

---

## CORS Configuration

```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(
            "http://localhost:5173",  // Vite dev
            "http://localhost:80"      // Docker nginx
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
    );
});
```

---

## Swagger / OpenAPI

```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "School Admission API", Version = "v1" });
    c.AddSecurityDefinition("StudentId", new OpenApiSecurityScheme
    {
        Name = "X-Student-Id",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Description = "17-digit student birth registration number"
    });
});

// In app middleware:
app.UseSwagger();
app.UseSwaggerUI();  // accessible at /swagger
```

---

## `Program.cs` Startup

```csharp
var builder = WebApplication.CreateBuilder(args);

// Config
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var holdSeconds = builder.Configuration.GetValue<int>("HoldDurationSeconds", 600);

// Services
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddScoped<IClassService, ClassService>();
builder.Services.AddScoped<IHoldService, HoldService>();
builder.Services.AddSingleton(new HoldConfiguration(holdSeconds));
builder.Services.AddHostedService<HoldExpiryWorker>();
builder.Services.AddControllers();
builder.Services.AddCors(...);
builder.Services.AddSwaggerGen(...);

var app = builder.Build();

// Migrate DB on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();  // safe: idempotent
}

app.UseCors();
app.UseSwagger(); app.UseSwaggerUI();
app.UseMiddleware<ExceptionMiddleware>();
app.MapControllers();
app.Run();
```

---

## Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SchoolAdmission.sln .
COPY SchoolAdmission.Api/*.csproj SchoolAdmission.Api/
COPY SchoolAdmission.Application/*.csproj SchoolAdmission.Application/
COPY SchoolAdmission.Domain/*.csproj SchoolAdmission.Domain/
COPY SchoolAdmission.Infrastructure/*.csproj SchoolAdmission.Infrastructure/
RUN dotnet restore
COPY . .
RUN dotnet publish SchoolAdmission.Api -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
```

---

## Tests (`SchoolAdmission.Tests`)

### Required Test Cases

**1. Concurrency Test** (`ConcurrencyTests.cs`)
```csharp
// Create 1 class with 10 seats
// Fire 100 concurrent POST /classes/{id}/holds with distinct student IDs
// Assert: exactly 10 succeed (201), remaining 90 get 409
// Assert: DB has no more than 10 occupied (held+confirmed) seats
// Use Testcontainers<PostgreSqlContainer> for real PostgreSQL
```

**2. Expiry Test** (`ExpiryTests.cs`)
```csharp
// Set HOLD_DURATION_SECONDS = 2 (via config override)
// Create a hold
// Wait 3 seconds
// Assert: GET /holds/{id} returns EXPIRED
// Assert: class availableSeats increases by 1
```

**3. Idempotent Confirmation Test** (`HoldApiTests.cs`)
```csharp
// Create a hold, confirm it
// Confirm again → still 200, status still CONFIRMED
// Assert: confirmedSeats count = 1 (not 2)
```

**4. Ownership Tests**
```csharp
// Create hold with studentId A
// Try to confirm with studentId B → 403
// Try to cancel with studentId B → 403
```

**5. Duplicate Application Test**
```csharp
// Create hold for student A in class X
// Try to create another hold for student A in class X → 409
```

---

## EF Core Migration Commands

```bash
# From backend/ directory
dotnet ef migrations add InitialCreate \
  --project SchoolAdmission.Infrastructure \
  --startup-project SchoolAdmission.Api

dotnet ef database update \
  --project SchoolAdmission.Infrastructure \
  --startup-project SchoolAdmission.Api
```

> [!NOTE]
> Migrations run automatically on startup via `db.Database.MigrateAsync()`. No manual migration step needed in Docker.

---

## Health Check (Optional but Recommended)

```csharp
builder.Services.AddHealthChecks()
    .AddNpgsql(connectionString);

app.MapHealthChecks("/health");
```

Used in Docker Compose healthcheck.
