# AI Usage Disclosure

> Complete this honestly before submission. Do not claim that AI-generated code was fully verified unless you personally ran the checks.

## 1. AI tools used

| Tool | Purpose | Parts assisted |
|---|---|---|
| Copilot SDK in VS Code | Requirements analysis, phased planning, implementation, and validation | Backend foundation and API/lifecycle phases |

## 2. How AI assistance was used

Describe the actual assistance received. Examples:
- Requirement breakdown and architecture planning.
- Initial code scaffolding.
- API/controller/service implementation suggestions.
- React component and styling assistance.
- Test-case generation.
- Docker and README drafting.

This session used the project specifications to plan and implement the .NET
backend foundation, PostgreSQL model, API routes, transactional hold lifecycle,
expiry worker, and PostgreSQL-backed tests. Frontend and Compose implementation
remain pending.

## 3. Important AI mistakes or limitations

The first build found an expression-tree-incompatible enum converter and a
missing hosting framework reference; both were corrected. PostgreSQL smoke
checks also found invalid validation metadata on a positional record and an
EF Core ordering-after-projection translation error; both were corrected and
the route checks were rerun. Initial concurrency-test runs hit PostgreSQL
connection timeouts under load; the focused rerun and full suite passed after
the test-only connection and command timeouts were increased.

## 4. Verification performed

| Area | Verification performed | Result |
|---|---|---|
| API contract | Manual route smoke checks against an isolated PostgreSQL instance | Tested routes and response shapes passed; full acceptance remains pending |
| Concurrent seat allocation | Full PostgreSQL-backed test suite, including 100 simultaneous requests for 10 seats | Passed: exactly 10 successes, 90 capacity conflicts, and 10 occupied seats |
| Expiry behavior | PostgreSQL-backed hold lifecycle test and manual smoke check | Passed for the exercised lifecycle; background-worker timing races remain untested |
| Idempotent confirmation | Repeated confirmation of a confirmed hold | Passed |
| UI flows | Not run | Frontend is pending |
| Docker startup | Built and ran the backend image with isolated PostgreSQL; startup migrations and readiness passed | Passed for backend only; Compose remains pending |
| Data persistence | Not run across container restart | Pending Docker/acceptance phase |

## 5. Final responsibility

The candidate remains responsible for reviewing and testing the final
submission. AI assistance does not replace responsibility for correctness,
security, and honest reporting.
