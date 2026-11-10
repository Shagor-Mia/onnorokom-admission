# AI Usage

## Tools and where they were used

I built this project with three AI coding assistants: **Claude Opus 5.5**, **Antigravity** and
**GitHub Copilot**. Claude Opus 5.5 was used the most by far, above all for debugging, fixing and verifying
that everything works as the assignment PDF requires.

| Tool | Used for |
|---|---|
| **Claude Opus 5.5** (in Claude Code, VS Code) — *used the most* | Debugging and fixing; checking the code against the assignment PDF; backend fixes (CORS, worker resilience, error codes, timestamps, migration lock, connection pool for two backends, configurable connection string); HTTP contract and concurrency tests; the whole React frontend and its tests; Dockerfiles and `docker-compose.yml`; walking through every screen in real Chrome with Playwright and fixing what it found; the Playwright end-to-end test suite (`e2e/`); README, ASSUMPTIONS and this file |
| **Antigravity** | AI coding agent used alongside the others while building the project (the shared agent rules are in `AGENTS.md`) |
| **GitHub Copilot** (VS Code agent) | First backend version: requirement breakdown, phased plan, .NET solution, EF Core schema/migration, hold lifecycle, first PostgreSQL tests |
| Google Stitch | Visual mock-ups in `UI/` (used only as a style reference) |

Every claim of "passing" below comes from commands that were actually run (Docker: `dotnet test`,
`npm test`, Playwright, `docker compose up`, curl checks).

## Mistakes the AI made and how they were caught

1. **"All tests pass" was not true everywhere.** The first test setup used a connection pool of 100 —
   equal to PostgreSQL's default `max_connections` — and failed with `53300 too many clients` on a fresh
   database. *Caught* by re-running the suite in a clean Docker PostgreSQL. *Fixed* with a smaller test pool,
   pool cleanup, and a test database with a higher limit.
2. **No CORS.** The backend would have rejected every call from the React UI on another port; the API-only
   tests could not notice. *Caught* in the PDF audit ("সব কাজ UI থেকেই"). *Fixed* + a CORS preflight test.
3. **Background worker could stop the whole API.** An unhandled database error in a .NET 8
   `BackgroundService` stops the host. *Caught* in code review. *Fixed* with try/catch + logging.
4. **Contract details:** malformed IDs returned `400` instead of `404`; timestamps were `…+00:00` with
   7 fraction digits instead of `…Z`, and the create and read responses showed different precision.
   *Caught* while comparing responses with the PDF examples. *Fixed* + tests that assert the format.
5. **Handled `409`s were logged as "unhandled exception" with stack traces** (the .NET 8 exception
   middleware logs before custom handlers). *Caught* by reading the test logs. *Fixed* by mapping business
   errors in an MVC exception filter.
6. **Test-only migration conflict:** running migrations twice in a non-`public` schema failed because
   Npgsql looks for the history table in `public`. *Caught* from the test log. *Fixed* by letting the tests
   prepare the schema and skip start-up migration.
7. **AI-written UI guide contained invented content** (a government-approval banner, a school name, a
   helpline number, a "PDF download" button, and the label "আসন বুক করুন" instead of the PDF's
   "আবেদন করুন"). *Caught* by checking it against the PDF. Not implemented; the UI follows the PDF.
8. **A false alarm from the AI's own check script:** a shell-quoting bug in the curl concurrency check reported
   0 successes. *Caught* because it contradicted the passing automated tests; re-run correctly it showed
   exactly 10 × `201` and 50 × `409`.
9. **Admin dashboard overflowed on phones** (300 px horizontal scroll at 390 px width: a grid item without
   `min-width: 0` was stretched by the wide seat table), and the "Day Shift" option produced the Bengali name
   "Class 6 - দিবা শিফট" instead of the PDF's "Class 6 - Day Shift". Unit tests could not notice either.
   *Caught* in a manual walkthrough in real Chrome driven by Playwright (every PDF screen/rule, at 390/768/1280 px).
   *Fixed*; field errors on the create-class form now also clear as soon as the field is edited.
10. **Two backends could return a `500`** under a burst (each Npgsql pool may open 100 connections, PostgreSQL
    allows 100 in total). Capacity was still respected. *Caught* by sending 100 parallel holds across :8080
    and :8081. *Fixed* with `DB_MAX_POOL_SIZE` (40 per process); 3 × 200 parallel requests → no `500`.
11. **The database connection string could not really be replaced**: compose hard-coded host `db`, so only
    the database name and credentials were configurable. *Caught* by running `docker compose config` with an
    override. *Fixed*: `ConnectionStrings__DefaultConnection` now replaces the whole string, verified by a
    backend connecting with `Application Name=env-override-check`.
12. **The AI's own Playwright tests were wrong in three places** (expected a space in "CONFIRMED• …", read seat
    numbers before the list had loaded, and expected React `autoFocus` to work inside a `<dialog>` opened
    later). *Caught* because the failures contradicted screenshots of a working UI. The tests were corrected
    (retrying assertions; focus must be inside the dialog), not the app.

## Responsibility

The AI output was reviewed and tested before being kept; the candidate remains responsible for the
correctness of the submission.
