# Implementation Plan for AI Coding Agents

Implement in phases. Do not ask the agent to generate the entire application in one giant response.

## Phase 0 — Repository reconnaissance and decisions
- Inspect existing files and tooling.
- Read `AGENTS.md` and all docs.
- List ambiguities and proposed assumptions.
- Propose database entities, indexes, and transaction strategy.
- Do not write application code until the plan is approved.

**Exit criteria:** agreed architecture, assumptions, API contract, and phase plan.

## Phase 1 — Backend skeleton and persistence
- Create .NET 8+ solution/projects.
- Configure ASP.NET Core, EF Core, Npgsql, dependency injection.
- Add entities, enum, DbContext, migrations.
- Add configuration for PostgreSQL and `HOLD_DURATION_SECONDS`.
- Add health endpoint if useful.
- Add Dockerfile.

**Exit criteria:** backend starts and connects to PostgreSQL; migrations apply; no business endpoints required yet.

## Phase 2 — Backend API and business rules
Implement in this order:
1. `POST /classes`
2. `GET /classes`
3. `GET /classes/{classId}`
4. `POST /classes/{classId}/holds`
5. `GET /holds/{holdId}`
6. `POST /holds/{holdId}/confirm`
7. `DELETE /holds/{holdId}`
8. `GET /me/holds`

Add validation, ownership checks, expiry, conflict handling, and exact JSON response contracts.

**Exit criteria:** all API routes work against PostgreSQL; errors are appropriate 4xx; no overbooking path is known.

## Phase 3 — Backend tests
- Unit tests for domain transitions and validation.
- Integration tests against PostgreSQL.
- Concurrency test: 10 seats / 100 simultaneous distinct students.
- Expiry test.
- Idempotent confirmation test.
- Ownership and duplicate application tests.

**Exit criteria:** critical tests pass and the agent reports actual test output.

## Phase 4 — Frontend foundation and guardian flow
- Create React 18+ TypeScript Vite app.
- Add routing/layout and API client.
- Implement student ID entry and persistence.
- Implement class list and seat status.
- Implement hold, status, countdown, confirm, cancel.
- Implement application history.
- Add loading, empty, validation, conflict, and network states.

**Exit criteria:** guardian can complete the full journey from UI.

## Phase 5 — Admin UI
- Create class/shift form.
- Show classes and capacity metrics.
- Refresh seat metrics periodically.
- Ensure admin operations are UI-driven.

**Exit criteria:** class creation and overview work from browser UI.

## Phase 6 — Visual refinement and accessibility
- Apply the Stitch design reference if available.
- Check responsive breakpoints.
- Check keyboard navigation, form labels, focus states, contrast, and readable Bengali typography.
- Do not compromise API behavior for visual fidelity.

**Exit criteria:** usable at desktop and mobile widths.

## Phase 7 — Docker Compose
- Add root `docker-compose.yml`.
- Add PostgreSQL service, named volume, health check.
- Add backend and frontend Dockerfiles/services.
- Configure backend host port 8080.
- Configure frontend API URL correctly for browser access.
- Verify clean startup from Docker only.
- Verify data persistence after `down` then `up`.

**Exit criteria:** evaluator can run the system using the documented Docker command without installing SDKs or databases.

## Phase 8 — Final audit and submission
- Run all backend/frontend tests and builds.
- Follow `TESTING_AND_ACCEPTANCE.md`.
- Check exact API response fields and status codes.
- Check no secrets or local-only paths are committed.
- Update README, ASSUMPTIONS, AI_USAGE.
- Add incremental Git commits.
- Verify public GitHub repository and README instructions.

**Exit criteria:** all checklist items marked PASS/FAIL honestly, with known limitations disclosed.

## Suggested agent prompts

### Planning only
“Read `AGENTS.md`, `README.md`, and every file under `docs/`. Inspect the repository. Do not write code. Return an architecture proposal, database schema, concurrency strategy, ambiguity list, and phased plan.”

### Implement one phase
“Implement Phase N from `docs/IMPLEMENTATION_PLAN.md` only. Follow `AGENTS.md` and the API contract. First list intended changes. Then implement, run relevant tests, and report exact command output. Do not start the next phase.”

### Review
“Review the current implementation against `docs/PROJECT_SPEC.md`, `docs/API_CONTRACT.md`, and `docs/TESTING_AND_ACCEPTANCE.md`. Do not change code yet. Identify correctness bugs, especially concurrency, expiry, idempotency, ownership, persistence, and Docker startup. Rank findings by severity and cite file/line locations.”
