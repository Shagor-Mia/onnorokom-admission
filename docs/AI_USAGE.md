# AI Usage

## Tools and where they were used

| Tool | Used for |
|---|---|
| GitHub Copilot (VS Code agent) | First backend version: requirement breakdown, phased plan, .NET solution, EF Core schema/migration, hold lifecycle, first PostgreSQL tests |
| Claude Code (VS Code) | Audit of the code against the assignment PDF; backend fixes (CORS, worker resilience, error codes, timestamps, migration lock); HTTP contract/concurrency tests; the whole React frontend and its tests; Dockerfiles and `docker-compose.yml`; README/ASSUMPTIONS |
| Google Stitch | Visual mock-ups in `UI/` (used only as a style reference) |

Every claim of "passing" below comes from commands that were actually run (Docker: `dotnet test`,
`npm test`, `docker compose up`, curl checks).

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

## Responsibility

The AI output was reviewed and tested before being kept; the candidate remains responsible for the
correctness of the submission.
