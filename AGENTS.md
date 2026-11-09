# Instructions for AI Coding Agents

You are working inside the repository for the **School Admission System** take-home assignment. These instructions apply to Antigravity, Claude Code, Cursor, and any other coding agent.

## 1. Read before acting

Before modifying files:
1. Read this file completely.
2. Read `README.md`.
3. Read all relevant files in `docs/`, especially `PROJECT_SPEC.md`, `API_CONTRACT.md`, `DATABASE_AND_CONCURRENCY.md`, and `TESTING_AND_ACCEPTANCE.md`.
4. Inspect the existing repository and identify what already exists.
5. Do not overwrite working code or configuration without explaining why.

## 2. Source of truth and scope

- The assignment requirements in `docs/PROJECT_SPEC.md` and `docs/API_CONTRACT.md` are the source of truth.
- Do not add features that are not required unless they are small, useful, and do not threaten delivery.
- Do not replace PostgreSQL, .NET 8+, React 18+, or Docker with another stack.
- Do not add a real payment gateway. Confirmation is simulated.
- Do not add a mandatory parent login/password flow. Student identity is passed through `X-Student-Id`.
- Admin authentication is not defined by the assignment. Follow the documented assumption; do not invent a large auth subsystem.
- When the brief is ambiguous, write the chosen behavior and reason in `docs/ASSUMPTIONS.md`.

## 3. Work in controlled phases

- Follow `docs/IMPLEMENTATION_PLAN.md`.
- Work in small, reviewable phases.
- Before a phase, state the goal, files to create/change, and risks.
- After a phase, run the relevant tests/build and report exact commands and outcomes.
- Do not claim a test passed unless you actually ran it and saw it pass.
- Do not proceed to the next major phase if a critical test is failing.
- Ask before destructive actions, deleting user files, resetting databases, or rewriting substantial existing work.

## 4. Architecture and code quality

### Backend
- Use C# and ASP.NET Core Web API on .NET 8+.
- Use PostgreSQL and Entity Framework Core with Npgsql unless the repository already has an equally suitable documented ORM choice.
- Keep controllers thin. Put business rules in application/service classes.
- Keep persistence concerns in infrastructure/repository classes.
- Use DTOs; do not expose EF entities directly.
- Validate request bodies, route IDs, and `X-Student-Id`.
- Use UTC timestamps and `DateTimeOffset`.
- Return consistent, useful 4xx errors for invalid input and business conflicts.
- Never rely on frontend checks to enforce seat capacity.
- Use database transactions and concurrency-safe locking/conditional updates for seat allocation.
- Ensure repeated confirmation cannot increment confirmed seats more than once.
- Ensure expiry is processed both by a background worker and safely during relevant reads/writes, so a delayed worker cannot leave expired seats unavailable.
- Avoid N+1 database queries.

### Frontend
- Use React 18+ with TypeScript and Vite.
- Build accessible, responsive pages for guardians and school admin.
- Keep API calls in a centralized client/service layer.
- Keep API types explicit; avoid `any` unless justified.
- Handle loading, empty, success, validation, network, and conflict states.
- Do not leave errors only in the browser console.
- Persist the current student's 17-digit ID in session/local storage so refresh/reopen works. Do not store passwords because there is no password flow.
- Refresh seat counts every few seconds and clean up polling timers on unmount.
- Disable confirmation for expired/cancelled holds and show clear status.
- Do not fake seat counts or successful API actions.

### Database
- Persist PostgreSQL data using a named Docker volume.
- Add migrations and ensure the application can initialize/update the schema predictably.
- Add appropriate constraints and indexes.
- Document any non-obvious transaction/locking strategy.

## 5. Non-negotiable business invariants

1. For every class: `activeHeldCount + confirmedCount <= totalSeats`.
2. An expired hold must not consume a seat.
3. A hold can only be confirmed by its owner (`X-Student-Id`).
4. A hold can only be cancelled by its owner.
5. Confirmation is idempotent.
6. One student must not have multiple active holds or confirmed admissions for the same class at once.
7. All core flows must work from the UI.
8. Data must survive `docker compose down` followed by `docker compose up` (without `-v`).

## 6. API compatibility

Implement the exact routes and JSON fields in `docs/API_CONTRACT.md`. Do not rename fields, change casing, or return a different response envelope without a documented reason and explicit approval.

- Keep status values uppercase: `HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`.
- Keep `X-Student-Id` header semantics.
- Use the specified HTTP status codes.
- Use UTC ISO-8601 timestamps.

## 7. UI design direction

Use the Stitch output, if supplied, as a visual reference, not as permission to weaken functionality. Follow `prompts/STITCH_MASTER_PROMPT.md` for the screen design. The result should feel like a trustworthy school admission portal:
- Calm, clean, education-focused visual language.
- Bengali-first interface, with clear English technical labels only where useful.
- Strong readability and visible seat availability.
- Responsive desktop/tablet/mobile layouts.
- Clear confirmation dialogs and status indicators.
- Accessible contrast, keyboard focus, and form labels.

Do not spend excessive time on animation or decorative effects.

## 8. Security and honest limitations

- Validate the student ID format (17 digits) consistently.
- Do not log full birth registration numbers. Mask them in logs and UI where practical.
- Do not expose secrets in source control.
- Because the assignment uses a client-supplied identity header and does not specify authentication, document that this is a demo limitation. Do not describe it as production-secure identity verification.
- Never claim the simulated payment is a real transaction.

## 9. Git and delivery

- Keep commits incremental and meaningful.
- Do not amend/reset/rewrite existing user commits without asking.
- Keep `README.md`, `docs/ASSUMPTIONS.md`, and `docs/AI_USAGE.md` updated.
- Before completion, run the acceptance checklist and report anything not implemented.
- Do not fabricate screenshots, test output, coverage numbers, or deployment URLs.

## 10. Required response format after each task

When you finish a task, report:
1. What changed.
2. Important design/implementation decisions.
3. Commands actually run and their results.
4. Tests still missing or failing.
5. Next recommended phase.

If you are unsure about a requirement, stop and ask one focused question rather than silently inventing behavior.
