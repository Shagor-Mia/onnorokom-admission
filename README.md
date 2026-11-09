# School Admission System

A full-stack school admission application built for the **Assistant Software Engineer take-home assignment**.

> **Assignment stack:** .NET 8+ · PostgreSQL · React 18+ · Docker  
> **Expected startup:** `docker compose up --build`  
> **Backend URL:** `http://localhost:8080`

This repository is designed to be built and maintained with an AI coding agent such as **Antigravity, Claude Code, Cursor, or another agent**. Read `AGENTS.md` first; it is the shared instruction contract for all agents.

## 1. Project goal

Build a first-come-first-served admission system. Each school class/shift has a fixed seat capacity. A guardian identifies a student using the 17-digit birth registration number. Creating an application temporarily holds one seat. If the guardian confirms the simulated admission fee before the hold expires, the application becomes confirmed. Otherwise, the seat is released automatically.

This is an assignment/demo system, not a production payment or identity-verification platform.

## 2. Main capabilities

### Parent / guardian
- Enter a student's 17-digit birth registration number; no login or password flow.
- Browse classes/shifts and see total, held, confirmed, and available seats.
- Create an admission hold for a class with available seats.
- View the current hold status and expiry time.
- Confirm admission using the simulated **“ভর্তি ফি দিন”** action.
- Cancel an active hold.
- View the student's applications.
- See expired applications after refresh/reopen; an expired hold cannot be confirmed.

### School admin
- Create a class/shift and configure its seat capacity.
- View all classes and their seat counts.
- Use the UI for all operations; no Postman or direct database interaction is required for normal evaluation.

> The assignment does not define admin authentication. Keep the admin interface clearly separated in the UI, and document the chosen demo assumption in `docs/ASSUMPTIONS.md`. Do not invent a complex authentication requirement.

## 3. Technology decisions

| Layer | Required / recommended |
|---|---|
| Backend | C# with .NET 8 or newer, ASP.NET Core Web API |
| Database | PostgreSQL |
| ORM | Entity Framework Core with Npgsql |
| Frontend | React 18+ with TypeScript |
| Frontend tooling | Vite |
| UI | Tailwind CSS and a consistent component system (agent may choose) |
| Runtime | Docker and Docker Compose |
| Tests | xUnit for backend; React Testing Library/Vitest for frontend where useful |

Use stable, mutually compatible package versions. Do not add unnecessary services or infrastructure.

## 4. Repository layout

```text
school-admission-system/
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── PROJECT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── DATABASE_AND_CONCURRENCY.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── TESTING_AND_ACCEPTANCE.md
│   ├── ASSUMPTIONS.md
│   └── AI_USAGE.md
├── prompts/
│   └── STITCH_MASTER_PROMPT.md
├── backend/
│   ├── SchoolAdmission.Api/
│   ├── SchoolAdmission.Application/
│   ├── SchoolAdmission.Domain/
│   ├── SchoolAdmission.Infrastructure/
│   ├── SchoolAdmission.Tests/
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── app/
    │   ├── components/
    │   ├── features/
    │   ├── hooks/
    │   ├── lib/
    │   ├── pages/
    │   └── types/
    ├── public/
    ├── Dockerfile
    └── ...
```

This is a recommended structure, not a requirement to preserve every folder if a simpler, well-organized implementation is more appropriate. Keep backend and frontend separate.

## 5. Run with Docker

### Prerequisites
- Docker Desktop or Docker Engine with the Compose plugin.
- No local .NET SDK, Node.js, or PostgreSQL installation should be required to run the complete application.

### Start

```bash
cp .env.example .env
docker compose up --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Swagger/OpenAPI (if enabled): `http://localhost:8080/swagger`

The assignment explicitly requires the backend to be reachable at `http://localhost:8080`. The frontend port above is a recommended development/demo port; document any different chosen port.

### Stop

```bash
docker compose down
```

To verify persistence, start again:

```bash
docker compose up --build
```

Do **not** use `docker compose down -v` when checking persistence; `-v` deletes the database volume.

## 6. Environment variables

The exact variable names may be extended, but these must be supported:

| Variable | Purpose | Default |
|---|---|---|
| `HOLD_DURATION_SECONDS` | Duration of a seat hold | `600` |
| `ConnectionStrings__DefaultConnection` or `DATABASE_URL` | PostgreSQL connection | Compose internal DB |
| `VITE_API_BASE_URL` | Frontend API base URL | `http://localhost:8080` |
| `POSTGRES_DB` | Database name | `school_admission` |
| `POSTGRES_USER` | Database user | `app` |
| `POSTGRES_PASSWORD` | Local development password | Set in `.env` |

Never commit real secrets. The frontend API URL must be configurable through an environment variable.

## 7. API overview

The required API contract is documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/classes` | Create a class/shift |
| `GET` | `/classes` | List classes with seat counts |
| `GET` | `/classes/{classId}` | Get one class with seat counts |
| `POST` | `/classes/{classId}/holds` | Hold one seat |
| `GET` | `/holds/{holdId}` | Get hold status |
| `POST` | `/holds/{holdId}/confirm` | Confirm admission |
| `DELETE` | `/holds/{holdId}` | Cancel a hold |
| `GET` | `/me/holds` | List the current student's applications |

Student-specific operations use the `X-Student-Id` header containing the 17-digit birth registration number.

## 8. Critical business rules

1. `heldSeats + confirmedSeats` must never exceed `totalSeats`, even under concurrent requests.
2. A new hold reserves one seat until its expiry.
3. `HOLD_DURATION_SECONDS` controls the hold duration; default is 600 seconds.
4. Expired holds must release seats automatically without requiring a guardian to call an API.
5. A student cannot have more than one active hold or confirmed admission for the same class at a time. Record any interpretation of edge cases in `docs/ASSUMPTIONS.md`.
6. A student can only confirm or cancel their own hold.
7. Confirming the same hold repeatedly must be idempotent; `confirmedSeats` increments only once.
8. Persist all data across container restarts.
9. Invalid input must return a suitable 4xx response, never an avoidable 500.
10. The UI must show `EXPIRED` after expiry and disable the payment/confirmation action.
11. Seat counts should refresh every few seconds.
12. All core operations must be possible from the UI.

The concurrency and expiry design is more important than decorative UI details. See `docs/DATABASE_AND_CONCURRENCY.md`.

## 9. Build and test

Backend (run inside the backend container or local SDK environment):

```bash
dotnet test
```

Frontend (run inside the frontend container or local Node environment):

```bash
npm run test
npm run build
```

At minimum, add automated tests for:
- Concurrent hold attempts against a limited number of seats.
- Expired holds releasing capacity.
- Repeated confirmation being idempotent.

The complete acceptance checklist is in [`docs/TESTING_AND_ACCEPTANCE.md`](docs/TESTING_AND_ACCEPTANCE.md).

## 10. AI-agent workflow

1. Open the repository root in Antigravity, Claude Code, Cursor, or another coding agent.
2. Ask the agent to read `AGENTS.md` and every relevant file under `docs/`.
3. Ask it to inspect the current repository before changing files.
4. Have it implement one phase at a time from `docs/IMPLEMENTATION_PLAN.md`.
5. Require it to run tests/builds and report actual results after each phase.
6. Review all generated code, migrations, and concurrency behavior yourself.
7. Keep commits small and incremental.

Suggested first prompt:

> Read `AGENTS.md`, `README.md`, and all files in `docs/`. Do not write code yet. First summarize the requirements, identify ambiguities, propose the database schema and concurrency strategy, and list the implementation phases. Wait for my approval before implementation.

## 11. Submission checklist

- [ ] Public GitHub repository.
- [ ] Root-level `docker-compose.yml`.
- [ ] Backend and frontend in separate folders.
- [ ] `docker compose up --build` starts PostgreSQL, backend, and frontend.
- [ ] Backend reachable at `http://localhost:8080`.
- [ ] Database volume persists after `docker compose down` and a subsequent `up`.
- [ ] Required API endpoints and response shapes implemented.
- [ ] All guardian/admin operations work from the UI.
- [ ] At least three meaningful automated tests.
- [ ] `docs/ASSUMPTIONS.md` explains important decisions.
- [ ] `docs/AI_USAGE.md` honestly documents AI assistance, mistakes, and verification.
- [ ] README includes run, test, and usage instructions.
- [ ] Incremental Git commit history; avoid one giant final commit.

## 12. Scope and disclaimer

The assignment brief is the source of truth. If a detail is not specified, choose a minimal, defensible behavior and record it in `docs/ASSUMPTIONS.md`. Do not silently turn assumptions into requirements. Do not claim production-grade security or real payment processing.
