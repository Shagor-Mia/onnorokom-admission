# Testing and Acceptance

## How to run

```bash
docker compose --profile test run --rm backend-tests    # 18 backend tests (unit + PostgreSQL)
docker compose --profile test run --rm frontend-tests   # 21 frontend tests (Vitest)
docker compose --profile e2e run --rm --build e2e-tests  # 27 Playwright UI tests in Chromium (isolated stack)
docker compose --profile test rm -sf test-db            # remove the throwaway test database
docker compose --profile e2e rm -sf e2e-db e2e-backend e2e-frontend   # remove the throwaway e2e stack
```

Without Docker: set `TEST_DATABASE_CONNECTION` and run `dotnet test backend/SchoolAdmission.sln`
(the integration tests are skipped when the variable is missing); `cd frontend && npm ci && npm test`.
Each backend integration test uses its own temporary PostgreSQL schema and drops it afterwards.

## Results (last run: 2026-11-10, Docker Desktop on Windows)

Evidence key: **BT** = backend automated test, **FT** = frontend automated test,
**E2E** = curl/PowerShell checks against the running `docker compose` stack, **PW** = Playwright UI test (`e2e/tests/`),
**—** = not verified yet.

### Mandatory backend rules (PDF §1.5)

| Rule | Result | Evidence |
|---|---|---|
| `held + confirmed` never exceeds `totalSeats`, however many concurrent requests | PASS | BT: 100 concurrent → 10 × success / 90 × 409; 60 concurrent HTTP → 5 / 55. E2E: 60 parallel curl → 10 × 201 / 50 × 409 |
| Hold duration from `HOLD_DURATION_SECONDS` (default 600) | PASS | BT: `expiresAt` ≈ now + 600 s; 2 s override. E2E: `HOLD_DURATION_SECONDS=5` → `expiresAt` = now + 5 s |
| Expired seat returns by itself, no API call needed | PASS | BT: worker marks `EXPIRED` with no request. E2E: after 12 s the DB row was `EXPIRED`, seat available, next student got `HELD` |
| One active application / confirmed admission per student per class | PASS | BT: 20 concurrent same-student requests → 1 hold; duplicate → 409; confirmed student re-apply → 409 |
| Only own, unexpired `HELD` can be confirmed | PASS | BT + E2E: other student → 403; expired → 409 `HOLD_EXPIRED`; cancelled → 409 |
| Repeated confirm increments `confirmedSeats` once | PASS | BT: 3 sequential + 20 concurrent confirms → `confirmedSeats` = 1. E2E: confirm twice → 1 |
| No data loss on restart / `docker compose down` + `up` | PASS | E2E: class list and counts identical before and after `down`/`up` (volume `pgdata`) |
| Invalid input → 4xx, not 500 | PASS | BT: 11 bad `POST /classes` bodies → 400; 6 bad `X-Student-Id` values × 4 routes → 400; unknown/malformed IDs → 404 |

### API contract (PDF §1.4)

| Check | Result | Evidence |
|---|---|---|
| All 8 routes, methods, status codes (201/200/204/404/409) | PASS | BT `ApiContractTests`, E2E smoke |
| Exact field names (`id,name,totalSeats`; `holdId,classId,studentId,status,expiresAt`; …) | PASS | BT asserts the exact key set for responses 1, 2, 4, 6 and required keys for 3, 5, 8 |
| Status values `HELD/CONFIRMED/EXPIRED/CANCELLED` | PASS | BT |
| Timestamps UTC ISO-8601 with `Z` | PASS | BT + E2E (`2026-11-10T11:30:31Z`) |

### UI rules (PDF §1.3, §1.5)

| Rule | Result | Evidence |
|---|---|---|
| Everything works from the UI (no Postman/DB) | PASS (automated) / — (browser) | FT covers create class, apply, pay, history; every API call needed by the UI was checked E2E incl. CORS. A manual walkthrough in a real browser has **not** been done here. |
| Student ID box at the top of the page, no login | PASS | FT `StudentIdBar` (17-digit validation, saved) |
| Expired → `EXPIRED` without reload, "ভর্তি ফি দিন" disabled | PASS (automated) | FT: hold expiring in 1.5 s flips to EXPIRED and disables both buttons |
| Seat counts refresh every few seconds without reload | PASS (automated) | PW: holds made elsewhere appear on Class তালিকা and the admin table within a few seconds, no reload |
| Refresh / reopen browser → student still sees their applications | PASS (automated) | FT: ID restored from `localStorage`, `/me/holds` sent with it |
| Errors in plain language (no seats, expired, bad input, server down), no blank page | PASS (automated) | FT: 409 → Bengali message, server down → connection message; unit tests for every error code; error boundary |
| Responsive / keyboard / labels | PASS (automated) | PW: no sideways scroll on any page at 390/768/1280 px; skip link, Enter in the ID box, Escape closes dialogs, focus moves into dialogs; elements found by their labels. Not checked on physical devices |

### Docker and submission (PDF §1.2, §1.7)

| Check | Result | Evidence |
|---|---|---|
| Root `docker-compose.yml`; `docker compose up` starts PostgreSQL, backend, frontend | PASS | E2E (no `.env` file present) |
| Backend on `http://localhost:8080` | PASS | E2E |
| DB connection and frontend→backend URL via environment variables | PASS | `ConnectionStrings__DefaultConnection`; `VITE_API_BASE_URL` → `/config.js` at start (E2E read it back) |
| Dockerfiles for backend and frontend | PASS | `backend/Dockerfile`, `frontend/Dockerfile` |
| ≥ 3 backend automated tests incl. a concurrency test | PASS | 18 tests, 5 of them concurrency tests |
| Bonus: two backend processes, one database | PASS | BT (two hosts) + E2E (`--profile multi`: 80 requests over :8080/:8081 → 10 × 201, 70 × 409) |
| Bonus: frontend automated tests | PASS | 21 Vitest tests + 27 Playwright UI tests (every screen, button, form, filter and dialog) |
| README, ASSUMPTIONS.md, AI_USAGE.md | PASS | Updated |
| Incremental commit history | PASS | One commit per step |
| Assignment PDF not public | **OPEN** | `onno.pdf` is committed in history (commit `7fb1852`); must be removed before the repository is made public |

### Known environment note

On Windows, Docker Compose v5 run from **Git Bash** fails the image build with
`additional privileges requested: pass "--allow=fs.read=…Dockerfile"` (MSYS path conversion).
The same command works in PowerShell and Command Prompt.
