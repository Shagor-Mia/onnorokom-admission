# Architecture

## 1. Recommended solution layout

```text
backend/
├── SchoolAdmission.Api/
│   ├── Controllers/
│   ├── Middleware/
│   ├── Extensions/
│   └── Program.cs
├── SchoolAdmission.Application/
│   ├── DTOs/
│   ├── Interfaces/
│   ├── Services/
│   └── Validators/
├── SchoolAdmission.Domain/
│   ├── Entities/
│   ├── Enums/
│   └── Exceptions/
├── SchoolAdmission.Infrastructure/
│   ├── Persistence/
│   ├── Repositories/
│   ├── BackgroundServices/
│   └── DependencyInjection.cs
└── SchoolAdmission.Tests/

frontend/
└── src/
    ├── app/
    ├── components/
    ├── features/
    │   ├── classes/
    │   ├── holds/
    │   ├── student/
    │   └── admin/
    ├── hooks/
    ├── lib/
    ├── pages/
    └── types/
```

This is a practical separation of concerns. Avoid overengineering; a smaller structure is acceptable if responsibilities remain clear.

## 2. Backend responsibilities

### API layer
- Maps HTTP routes to application services.
- Validates transport-level input and headers.
- Returns the exact response shapes/status codes in `API_CONTRACT.md`.

### Application layer
- Owns use cases: create class, list classes, create hold, get hold, confirm, cancel, list student holds.
- Enforces business rules.
- Coordinates transactions through abstractions.

### Domain layer
- Defines `AdmissionClass`, `AdmissionHold`, and `HoldStatus`.
- Keeps domain transitions explicit and testable.

### Infrastructure layer
- EF Core DbContext and PostgreSQL mappings.
- Repositories/queries.
- Atomic seat allocation and transaction/locking implementation.
- Background expiration worker.

## 3. Frontend pages

Recommended page structure:
- `/` — guardian admission portal: student ID entry, class list, seat availability.
- `/my-applications` — student's hold/application history.
- `/admin` — create class/shift and view seat counts.

A single-page layout with tabs is also acceptable if navigation stays obvious.

## 4. Frontend feature responsibilities

- `classes`: class list, class detail, seat availability.
- `holds`: create, view, confirm, cancel, expiry countdown.
- `student`: current student ID context and application history.
- `admin`: create class and admin dashboard.
- `lib/api`: configured API client using `VITE_API_BASE_URL`.
- `types`: API DTOs and status unions.

## 5. API client behavior

- Set `X-Student-Id` only on student-specific calls.
- Do not attach the header to public class list or admin class creation unless the backend contract requires it.
- Normalize errors into user-friendly messages.
- Handle `409 Conflict` as a normal business outcome, not a fatal blank-screen error.
- Refresh class data after hold, confirm, and cancel actions.

## 6. Data flow

Guardian:
1. Student ID is entered and validated in the UI.
2. UI stores it locally for reload continuity.
3. UI calls `GET /classes`.
4. Guardian requests a hold.
5. Backend atomically reserves a seat and returns `holdId`, status, expiry.
6. UI polls hold status or calculates display countdown while periodically reconciling with the API.
7. Guardian confirms or cancels.
8. UI refreshes class availability and the student's history.

Admin:
1. Admin opens the admin view.
2. Admin submits class name and seat count.
3. UI calls `POST /classes`.
4. UI refreshes the class list.

## 7. Docker topology

Services:
- `db`: PostgreSQL with named persistent volume and health check.
- `backend`: ASP.NET Core API, host port 8080, depends on healthy database.
- `frontend`: React/Vite build served from a lightweight web server (recommended) or a documented dev server.

Important:
- Inside Docker, backend connects to the DB service hostname, not `localhost`.
- Frontend browser requests use a host-accessible API base URL; configure it through build/runtime environment correctly.
- Add health checks and wait for database readiness.
- Do not assume `depends_on` alone means PostgreSQL is ready.
