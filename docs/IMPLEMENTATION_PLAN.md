# Implementation Plan — School Admission System

This plan turns the assignment brief and the repository guides into reviewable,
testable delivery phases. The assignment contract in `PROJECT_SPEC.md`,
`API_CONTRACT.md`, `DATABASE_AND_CONCURRENCY.md`, and `TESTING_AND_ACCEPTANCE.md`
is authoritative; the implementation guides and UI mockups support that
contract but do not override it.

## Starting repository baseline (before implementation)

- The repository currently contains instructions, specifications, design
  references, and static HTML mockups; it does not yet contain `backend/`,
  `frontend/`, a root `docker-compose.yml`, Dockerfiles, or an automated test
  project.
- `docs/ASSUMPTIONS.md` still has decisions marked `PENDING`.
- `docs/AI_USAGE.md` still has verification details marked `PENDING`.
- `README.md` has a build-and-test heading without the corresponding run/test
  instructions.
- `docs/BACKEND_STRUCTURE.md` and `docs/FRONTEND_PAGES.md` are present locally
  as untracked files. Preserve them; do not discard or stage them as part of
  unrelated work.
- The UI HTML files are visual prototypes, not a running React application or
  an API implementation.

No phase may claim application behavior is implemented or tested based only on
these documents or mockups.

## Implementation progress

- **Phase 0 — Decisions:** Complete. Selected behaviors are documented in
  `ASSUMPTIONS.md`.
- **Phase 1 — Backend foundation:** Complete. The backend image builds, the
  existing unit test passes, and PostgreSQL migration startup was verified.
- **Phase 2 — Backend API and lifecycle:** Complete for the documented routes.
  An isolated PostgreSQL smoke run covered class creation/list/detail, hold
  creation, ownership, duplicate handling, confirmation idempotency,
  cancellation idempotency, seat metrics, validation, and expiry.
- **Phase 3 — Automated backend/concurrency tests:** Complete. The full
  PostgreSQL-backed suite passed all five tests, including 100 simultaneous
  distinct-student requests (exactly 10 successes and 90 capacity conflicts),
  same-student duplicate prevention, and hold lifecycle coverage.
- **Phases 4–7 — Frontend, Docker Compose, and acceptance:** Pending.

## Delivery rules

1. Implement one phase at a time. Before each phase, state its goal, exact
   expected files, risks, and validation command(s).
2. Do not start a later phase while a required earlier-phase check is failing.
   Report blockers and actual command output; never infer a passing test.
3. Keep the public API JSON field names, HTTP methods/status codes, status
   casing, and `X-Student-Id` behavior aligned with `API_CONTRACT.md`.
4. PostgreSQL is the source of truth for capacity and expiry. Frontend checks
   are presentation only and never grant a seat.
5. Keep changes focused. Do not overwrite the supplied HTML/UI references or
   unrelated user files.
6. Document any agreed interpretation of an unspecified behavior in
   `docs/ASSUMPTIONS.md` before implementing that behavior.
7. Preserve the assignment document's confidentiality when preparing any
   public submission. Do not publish it; ask before removing or untracking an
   existing tracked copy.

## Phase 0 — Decisions and implementation readiness

**Goal:** Resolve the few behavioral decisions that affect data and API
semantics, and make the documentation internally consistent before writing
application code.

**Files:** `docs/ASSUMPTIONS.md`. Update `docs/AI_USAGE.md` only when there is
verifiable information to record; keep README run/test instructions for Phase 7.

**Work:**

- Confirm demo admin access; the proposed minimal behavior is an openly
  accessible admin UI, explicitly documented as unauthenticated.
- Confirm that a student may apply to different classes, but may have at most
  one active hold or confirmed admission per student/class.
- Define retries after `EXPIRED` or `CANCELLED`, and cancellation of terminal
  states.
- Confirm that IDs may use the documented `c_` / `h_` prefixes, while accepting
  only the selected canonical route format consistently.
- Define UTC storage/response behavior and choose one documented configuration
  name for `HOLD_DURATION_SECONDS`.
- Keep the client-supplied student ID described as a demo identity, not secure
  authentication.

**Risks:** An undocumented choice can cause contract drift, duplicate
applications, or UI/API disagreement. Changing the assignment PDF or publishing
it would violate its confidentiality instruction.

**Exit criteria:** No relevant `PENDING` assumption remains; the API shapes and
error/terminal-state behavior are mutually consistent; the implementation
scope is approved. No application source code is written in this phase.

## Phase 1 — Backend solution and PostgreSQL persistence

**Goal:** Establish a buildable .NET 8+ backend with a predictable PostgreSQL
schema and configuration, without exposing incomplete business endpoints.

**Files to create:** `backend/SchoolAdmission.sln`,
`backend/SchoolAdmission.Api/`, `backend/SchoolAdmission.Application/`,
`backend/SchoolAdmission.Domain/`, `backend/SchoolAdmission.Infrastructure/`,
`backend/SchoolAdmission.Tests/`, EF Core migration files, and
`backend/Dockerfile`.

**Work:**

- Follow the responsibilities in `docs/ARCHITECTURE.md` and
  `docs/BACKEND_STRUCTURE.md`; keep controllers thin and DTOs separate from EF
  entities.
- Model classes, holds, and the four lifecycle states. Persist UTC
  `DateTimeOffset` values and configure PostgreSQL constraints, foreign keys,
  and query indexes.
- Configure Npgsql through environment-backed settings and validate the
  positive hold duration (default 600 seconds).
- Add a health/readiness endpoint and a repeatable migration/startup approach.
- Do not add authentication or a real payment integration.

**Risks:** A schema that does not represent per-shift capacity, mismatched enum
serialization, missing indexes, or startup migration races.

**Validation:** `dotnet build backend/SchoolAdmission.sln` and a PostgreSQL
startup/migration smoke check using the database setup available at this phase.

**Exit criteria:** The solution builds, schema migration is reproducible, the
API can connect to PostgreSQL, and no secret is committed.

## Phase 2 — Backend API, seat allocation, and hold lifecycle

**Goal:** Implement the complete contract and enforce admission invariants in
PostgreSQL transactions.

**Files:** Backend API controllers, DTOs, validators, application services,
domain transitions, persistence queries/configuration, expiry background
service, and any directly related API documentation.

**Work, in contract order:**

1. `POST /classes`
2. `GET /classes`
3. `GET /classes/{classId}`
4. `POST /classes/{classId}/holds`
5. `GET /holds/{holdId}`
6. `POST /holds/{holdId}/confirm`
7. `DELETE /holds/{holdId}`
8. `GET /me/holds`

- Validate required inputs, route IDs, and a 17-digit ASCII `X-Student-Id`;
  return useful 4xx responses rather than validation-shaped 500s.
- Allocate holds in a database transaction that serializes requests on the
  relevant class row, expires stale holds, checks duplicates and capacity, and
  commits the new hold atomically.
- Count only unexpired `HELD` records and `CONFIRMED` records as occupied.
- Implement both background expiry and lazy expiry where needed; expiration
  must not depend on a particular user request or process-local timer.
- Lock the hold row for confirm/cancel transitions. Verify ownership, ensure
  confirmation is idempotent, and ensure expiry and confirmation cannot both
  win for the same hold.
- Keep error responses consistent and never log an unmasked full student ID.

**Risks:** Over-allocation under concurrent requests, stale holds consuming
capacity, simultaneous duplicate holds, confirm/expiry races, and leaking a
student's application through ownership checks.

**Validation:** Run focused backend API/domain tests as they are added. Exercise
the routes against PostgreSQL and compare every response to
`docs/API_CONTRACT.md`.

**Exit criteria:** All eight routes have the specified response fields and
statuses; the capacity, ownership, idempotency, duplicate, and expiry rules
are enforced by database-backed code.

## Phase 3 — Backend automated and PostgreSQL concurrency tests

**Goal:** Demonstrate the required behavior with repeatable tests, especially
under simultaneous load.

**Files:** `backend/SchoolAdmission.Tests/` unit and integration test files,
test configuration, and only directly related test documentation.

**Minimum tests:**

- At least three meaningful automated backend tests, including a
  PostgreSQL-backed concurrency test.
- Create 10 seats, submit 100 simultaneous valid requests with distinct
  students, and verify exactly 10 successes and 90 capacity conflicts.
- Submit simultaneous requests for the same student/class and verify no
  duplicate active admission is created.
- Cover invalid input, owner-only confirm/cancel, hold expiry and released
  capacity, cancelled/expired confirmation rejection, and repeated
  confirmation counting once.
- Use PostgreSQL for transaction/concurrency claims; an in-memory provider is
  not sufficient evidence.

**Risks:** A test double can hide PostgreSQL locking behavior; timing-only tests
can be flaky or miss races.

**Validation:** `dotnet test backend/SchoolAdmission.sln` against PostgreSQL
(for example, an isolated test database or the documented test container).

**Exit criteria:** Met. All five tests passed against PostgreSQL; the
100-request test verified exactly 10 successes, 90 capacity conflicts, and
10 occupied seats. Do not proceed to frontend integration with a failing
critical concurrency test.

## Phase 4 — Frontend foundation and guardian journey

**Goal:** Build the React 18+ TypeScript application and complete the
student-facing flow against the real API.

**Files to create:** `frontend/package.json`, Vite/TypeScript configuration,
`frontend/index.html`, `frontend/src/` routes, components, hooks, API client,
types, styles, and `frontend/Dockerfile`.

**Work:**

- Centralize HTTP calls and explicit API types; use the configured
  `VITE_API_BASE_URL`, send `X-Student-Id` only where required, and display
  backend errors meaningfully.
- Implement the guardian catalogue, exact 17-digit input validation, and
  session/local persistence of the current student's ID.
- Implement hold creation, application history, current status, countdown,
  confirm, and cancel; reconcile status with the server and disable confirm
  for terminal/expired holds.
- Refresh class availability every few seconds and clear polling timers when
  views unmount.
- Provide visible loading, empty, network-error, validation, success, and
  conflict states. Never imply a hold/payment succeeded if the API did not.
- Use the supplied guardian desktop/mobile mockups as visual references, not
  substitutes for the API contract.

**Risks:** Incorrect browser storage/header behavior, stale client countdowns,
polling leaks, API casing mismatch, or UI errors visible only in the console.

**Validation:** Frontend unit/component tests where configured, production
build, and manual browser checks against the running backend for hold,
confirm, cancel, expiry, refresh, and student history.

**Exit criteria:** A guardian can complete and revisit the full journey in the
browser, and every state shown is backed by API data.

## Phase 5 — Admin UI and responsive/accessibility pass

**Goal:** Make class creation and seat monitoring usable entirely through the
browser and finish essential responsive/accessibility behavior.

**Files:** `frontend/src/` admin route/forms/dashboard, shared layout and
components/styles, and related tests; update `docs/FRONTEND_PAGES.md` only if
the implemented behavior intentionally differs from its guide.

**Work:**

- Create classes/shifts with name and positive integer seat capacity.
- Show total, held, confirmed, and available counts; refresh counts
  periodically.
- Show validation, server, and duplicate/conflict errors to the user.
- Check keyboard operation, associated labels, visible focus, contrast, and
  desktop/tablet/mobile layouts.
- Avoid decorative claims that cannot be verified from the API.

**Risks:** An unprotected admin route is a documented assignment-demo
limitation, not an authenticated administrative system. Visual refinements
must not break core flows.

**Validation:** Frontend build/tests plus manual guardian/admin checks at
desktop and mobile widths.

**Exit criteria:** Class creation and monitoring work from the UI; the core
flows remain usable with keyboard navigation and on mobile.

## Phase 6 — Docker Compose integration and persistence

**Goal:** Make the complete project start with Docker Compose without requiring
host-installed .NET, Node.js, or PostgreSQL.

**Files to create/update:** Root `docker-compose.yml`, `backend/Dockerfile`,
`frontend/Dockerfile`, `.env.example`, `.gitignore`, and root `README.md`.

**Work:**

- Define PostgreSQL, backend, and frontend services with readiness/health
  handling and correct service-to-service networking.
- Publish the backend at `http://localhost:8080`; document the frontend URL.
- Use a named PostgreSQL volume and environment-based configuration. Never
  commit credentials beyond clearly local example placeholders.
- Ensure browser requests use a host-accessible API URL rather than the
  container-only database/backend hostname.

**Risks:** Compose startup ordering without database readiness, an incorrect
frontend build-time API URL, or accidentally using an ephemeral database.

**Validation:** `docker compose config`, `docker compose up --build`, HTTP
smoke checks for the UI/API, then `docker compose down` followed by
`docker compose up --build` and verification that created data remains.
Do not use `docker compose down -v` for the persistence check.

**Exit criteria:** The documented Compose command starts all three services,
the backend is reachable on port 8080, and data survives `down`/`up`.

## Phase 7 — Acceptance audit and submission readiness

**Goal:** Verify the deliverable against the assignment PDF and repository
checklist, document truthful results, and leave changes reviewable.

**Files:** Update `README.md`, `docs/ASSUMPTIONS.md`,
`docs/AI_USAGE.md`, and `docs/TESTING_AND_ACCEPTANCE.md` with actual outcomes;
make code changes only to fix verified in-scope failures.

**Work:**

- Run backend tests, frontend tests/build, PostgreSQL concurrency/expiry tests,
  and the full Docker persistence check.
- Check exact route/method/JSON/status contract and all user journeys from the
  UI.
- Mark acceptance items PASS/FAIL with evidence; list remaining limitations.
- Check Git status for secrets, local paths, unintended generated files, and
  the assignment document's confidentiality restriction. Ask before deleting
  or untracking any existing user file.
- Keep meaningful incremental commits; never amend, reset, or rewrite existing
  user commits.

**Exit criteria:** Every mandatory acceptance item has an honest result, all
critical checks pass or are explicitly reported as blockers, and the repository
is ready for the user to review before any publication/submission.

## Approval gate

This file is a plan, not authorization to implement every phase. After the
plan is reviewed and approved, implement **Phase 0 only**, report its decisions
and validation (documentation review), then request/confirm the next phase as
required by `AGENTS.md`. Do not silently begin a later phase.
