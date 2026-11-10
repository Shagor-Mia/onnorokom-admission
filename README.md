# School Admission System

A first-come-first-served school admission system: **ASP.NET Core (.NET 8) + PostgreSQL + React 18 (TypeScript, Vite) + Docker**.

Each class/shift (e.g. `Class 6 - Morning Shift`) has a fixed number of seats. A guardian enters the
student's 17-digit birth registration number, applies for a class (the seat is **held** for a limited
time), and pays the admission fee (simulated) to **confirm** it. If the fee is not paid in time the hold
**expires** and the seat is released automatically. School admins create classes and watch seat counts.
Everything is done from the UI.

> Demo limitations: the payment is simulated (no real transaction), the birth registration number is a
> client-supplied identifier (not secure identity verification), and the admin screen has no login.
> See [ASSUMPTIONS.md](ASSUMPTIONS.md).

## 1. Run with Docker

The only requirement is Docker (Docker Desktop or Docker Engine with the Compose plugin).
No .NET SDK, Node.js or PostgreSQL installation is needed.

```bash
docker compose up
```

The first start builds the images (a few minutes). Then open:

| What | URL |
|---|---|
| **Frontend (UI)** | **http://localhost:5173** |
| Backend API | http://localhost:8080 |
| Backend health | http://localhost:8080/health/ready |

No `.env` file is needed — every setting has a default. To change a value, copy `.env.example` to `.env`
and edit it (or set the variable in the shell).

> **Windows:** run the commands from PowerShell or Command Prompt. With Docker Compose v5, Git Bash
> (MSYS) can fail the build with `additional privileges requested: pass "--allow=fs.read=…Dockerfile"`
> because of its path conversion; PowerShell/cmd (and macOS/Linux shells) are not affected.

Stop with `Ctrl+C` or `docker compose down`. Data is stored in the named volume `pgdata`, so it survives
`docker compose down` followed by `docker compose up`. (`docker compose down -v` deletes the volume and
therefore all data.)

## 2. Using the app

> Step-by-step guide in Bengali for school admins and guardians (every screen and button):
> **[USER_GUIDE.md](USER_GUIDE.md)**

1. Open http://localhost:5173. At the top of every page there is a box for the student's
   **জন্ম নিবন্ধন নম্বর** (17 digits; Bengali digits are accepted). Save it — it is remembered after a page
   refresh or browser restart. There is no login.
2. **School admin:** click **স্কুল অ্যাডমিন** in the top menu (on a phone: **অ্যাডমিন** in the bottom bar),
   or open **http://localhost:5173/admin** directly. There is no admin login (see ASSUMPTIONS.md). Click
   **নতুন শ্রেণি/শিফট যোগ** (http://localhost:5173/admin/classes/new) to create classes, e.g.
   `Class 6 - Morning Shift` with 120 seats and `Class 6 - Day Shift` with 100 seats. The dashboard table
   shows total / held / confirmed / available seats and refreshes automatically.
3. **Class তালিকা** → every class with total, held, confirmed and available seats (refreshes every few
   seconds) → **আবেদন করুন**.
4. **আবেদন** screen → status, time left before the hold expires, **ভর্তি ফি দিন** (simulated payment →
   `CONFIRMED`) and **বাতিল** (cancel → seat released). When time runs out the screen switches to
   `EXPIRED` and the pay button is disabled, without reloading the page.
5. **আমার আবেদন** → all applications of the current student with their status.

Tip: to see expiry quickly, start with a short hold time: `HOLD_DURATION_SECONDS=60 docker compose up`.

## 3. Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays held |
| `DB_MAX_POOL_SIZE` | backend | `40` | Database connections per backend process (2 backends × 40 stay under PostgreSQL's 100) |
| `ConnectionStrings__DefaultConnection` | backend | built from the `POSTGRES_*` values, host `db` | Full PostgreSQL connection string; set it to use any other database, e.g. `Host=my-db;Port=5432;Database=admission;Username=me;Password=secret` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | db, backend | `school_admission` / `app` / `app_local_password` | Database (local demo credentials) |
| `VITE_API_BASE_URL` | frontend | `http://localhost:8080` | Backend URL used by the browser; read when the frontend container starts, so no rebuild is needed |
| `CORS_ALLOWED_ORIGINS` | backend | `http://localhost:5173,http://127.0.0.1:5173` | Origins allowed to call the API (comma-separated or `*`) |
| `FRONTEND_PORT` | compose | `5173` | Host port of the UI (add the new origin to `CORS_ALLOWED_ORIGINS` too) |

## 4. Running the tests

All tests run in Docker (nothing else to install):

```bash
# Backend: unit + PostgreSQL integration tests, including the concurrency tests
docker compose --profile test run --rm backend-tests

# Frontend: Vitest + Testing Library
docker compose --profile test run --rm frontend-tests

# Remove the throwaway test database afterwards (the app and its data are untouched)
docker compose --profile test rm -sf test-db
```

The backend tests use a separate throwaway PostgreSQL (`test-db`, in memory) and never touch the app
data. They cover, among others:

- **Concurrency:** 100 simultaneous hold requests for 10 seats → exactly 10 `201`, 90 `409`;
  60 simultaneous HTTP requests for 5 seats; 20 simultaneous requests by the same student → one hold;
  20 simultaneous confirmations → `confirmedSeats` increases once.
- **Two backend instances** sharing one database (bonus) → capacity is never exceeded.
- The exact JSON fields and status codes of all 8 routes, invalid input → `400`, unknown IDs → `404`.
- Expiry: the seat is released and confirmation is rejected after `HOLD_DURATION_SECONDS`; the background
  worker marks holds `EXPIRED` without any request.

Without Docker (needs .NET 8 SDK / Node 20): `dotnet test backend/SchoolAdmission.sln` (set
`TEST_DATABASE_CONNECTION` to a PostgreSQL connection string, otherwise the integration tests are
skipped) and `cd frontend && npm ci && npm test`.

### End-to-end UI tests (Playwright)

These click through the real UI in Chromium, the way a guardian and a school admin would, against a
separate stack (its own in-memory database, 30-second holds, no host ports). Your app and its data are not
touched, and the app does not need to be running.

```bash
docker compose --profile e2e run --rm --build e2e-tests

# Afterwards: remove the throwaway e2e stack
docker compose --profile e2e rm -sf e2e-db e2e-backend e2e-frontend
```

The first run downloads the Playwright image (about 800 MB). Results are printed in the terminal; the HTML
report (with screenshots and traces of any failure) is written to `e2e/playwright-report/index.html`.

What they cover (`e2e/tests/`):

- **Every screen of the brief:** Class তৈরি, Class তালিকা, আবেদন, আমার আবেদন, plus the admin dashboard,
  the header/menus, the phone bottom menu, the skip link and the 404 page.
- **Every button, link and form:** student ID box (empty / short / letters / Bengali digits / Enter key /
  পরিবর্তন করুন / ফিরে যান), create-class form (all validation messages, quick picks, shift radios, seat
  +/- buttons, live preview, duplicate name), shift and free-seat filters, admin search / shift dropdown /
  status filters / রিফ্রেশ, payment and cancel dialogs (ফিরে যান, Escape, হ্যাঁ…), print buttons, status
  filters and search on আমার আবেদন and every row action.
- **The rules:** seat counts update without reload; a hold turns `EXPIRED` without reload, the pay button is
  disabled and the seat comes back; only the owner can pay or cancel; the last seat taken by someone else
  shows "seat খালি নেই"; the ID and the applications survive refresh and reopening the browser.
- **Errors in plain Bengali:** server unreachable on every page (and "আবার চেষ্টা করুন" recovers), a
  server error while applying, unknown application. Any uncaught JavaScript error fails the test.
- **Layout:** no page scrolls sideways at 390, 768 and 1280 px.

To run them against an app you started yourself (`docker compose up`) with Node 20 installed:
`cd e2e && npm ci && npx playwright install chromium && npx playwright test` (add
`PW_CHANNEL=chrome` to use your installed Chrome, `--headed` to watch). Note that this adds test classes to
that app's database, and the expiry test is skipped there because holds last 600 seconds.

## 5. API

Base URL `http://localhost:8080`, JSON in and out, timestamps in UTC ISO-8601 (`2026-11-01T04:10:00Z`).
Student-specific calls use the `X-Student-Id` header (17 digits).

| # | Method & path | Purpose | Success |
|---|---|---|---|
| 1 | `POST /classes` | Create a class `{ "name", "totalSeats" }` | `201` |
| 2 | `GET /classes` | All classes with seat counts | `200` |
| 3 | `GET /classes/{classId}` | One class with seat counts | `200` |
| 4 | `POST /classes/{classId}/holds` | Apply (hold a seat) — `409` if no seat | `201` |
| 5 | `GET /holds/{holdId}` | Hold status | `200` |
| 6 | `POST /holds/{holdId}/confirm` | Pay fee (simulated) and confirm; idempotent | `200` |
| 7 | `DELETE /holds/{holdId}` | Cancel | `204` |
| 8 | `GET /me/holds` | All applications of the student | `200` |

Response fields follow [docs/API_CONTRACT.md](docs/API_CONTRACT.md) exactly; a few extra fields
(`className`, `createdAt`, `confirmedAt`, `cancelledAt`) are added to hold responses 5 and 8.

Errors are RFC 7807 Problem Details with a machine-readable `code`:

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED`, `INVALID_STUDENT_ID` | Bad body / missing or non-17-digit `X-Student-Id` |
| 403 | `HOLD_NOT_OWNED` | Confirm/cancel someone else's hold |
| 404 | `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND` | Unknown (or malformed) ID |
| 409 | `NO_SEATS_AVAILABLE`, `DUPLICATE_ACTIVE_APPLICATION`, `HOLD_EXPIRED`, `HOLD_NOT_ACTIVE` | Business rule conflicts |

## 6. How seat safety works (short)

- Creating a hold runs in one PostgreSQL transaction that locks the class row (`SELECT … FOR UPDATE`),
  expires stale holds, checks duplicates and capacity, and inserts the hold. All requests for a class —
  from any number of backend processes — are therefore serialized by the database.
- Only unexpired `HELD` + `CONFIRMED` rows count as occupied, so an expired hold never blocks a seat, even
  before the background worker (every 5 s) marks it `EXPIRED`.
- Confirm/cancel lock the hold row; repeated confirmation returns the same result without counting again.
- A partial unique index allows only one active (`HELD`/`CONFIRMED`) application per student and class.

Bonus demo — a second backend on port 8081 using the same database:

```bash
docker compose --profile multi up
```

Details: [docs/DATABASE_AND_CONCURRENCY.md](docs/DATABASE_AND_CONCURRENCY.md) and
[ASSUMPTIONS.md](ASSUMPTIONS.md).

## 7. Repository layout

```text
backend/                 ASP.NET Core solution (Api, Application, Domain, Infrastructure, Tests) + Dockerfile
frontend/                React + TypeScript + Vite app + Dockerfile (nginx)
docker-compose.yml       db, backend, frontend (+ test and multi profiles)
USER_GUIDE.md            Step-by-step guide for admins and guardians (Bengali)
ASSUMPTIONS.md           Decisions where the brief is not explicit, and why
AI_USAGE.md              Which AI tools were used, where, and the mistakes they made
docs/                    Specification, API contract, concurrency design, test checklist
```
