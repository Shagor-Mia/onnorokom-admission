# Assumptions

Where the brief is not explicit, this is what the system does and why.

## Identity and access

1. **Student identity = `X-Student-Id`.** The 17-digit birth registration number (ASCII digits only on
   the API; the UI also accepts Bengali digits and strips spaces/dashes) identifies the student. The UI
   keeps it in `localStorage`, so it survives refresh and browser restarts, and shows it masked
   (`2015••••••••••890`). *Why:* the brief says no login. *Limitation:* anyone who knows a number can act
   for that student — a demo identity, not verification.
2. **Admin has no login.** The "School admin" screen is open. *Why:* the brief defines no admin
   authentication; inventing one would add unrequested scope. Not suitable for production.
3. **Ownership errors are `403`.** Confirming or cancelling another student's hold returns `403
   HOLD_NOT_OWNED`; nothing is changed. `GET /holds/{holdId}` needs no header (the brief lists none), and
   it does not return the student ID.

## Applications (holds)

4. **"One active application per class" is per class, not per school.** A student may hold or confirm
   seats in different classes (e.g. Morning and Day shift are different classes), but in one class may have
   at most one `HELD` (unexpired) or `CONFIRMED` application. After a hold expires or is cancelled the
   student may apply again, unless already confirmed there. *Why:* the brief says "একটা class-এ" and treats
   each shift as a separate class.
5. **Cancel.** Only an unexpired `HELD` hold can be cancelled (`204`). Cancelling an already cancelled hold
   is idempotent (`204`). Cancelling a `CONFIRMED` (`409 HOLD_NOT_ACTIVE`) or expired (`409
   HOLD_EXPIRED`) hold is refused — cancel releases a temporary reservation, it does not undo an admission.
6. **Confirm.** Only the owner's unexpired `HELD` hold can be confirmed. Repeating the confirm returns the
   same `200 CONFIRMED` and changes nothing. Confirming an expired hold returns `409 HOLD_EXPIRED`; a
   cancelled one `409 HOLD_NOT_ACTIVE`.
7. **History is kept.** Expired, cancelled and confirmed holds stay in the database and in `/me/holds`
   (newest first), so the UI can show `EXPIRED` after a reload.
8. **Payment is simulated.** "ভর্তি ফি দিন" asks for confirmation in a dialog that says no real money
   moves, then calls `POST /holds/{holdId}/confirm`.

## Expiry and time

9. **Expiry never depends on a request or on the worker.** A hold occupies a seat only while
   `status = HELD AND expires_at > now`. So an expired hold stops counting the moment its time passes, even
   if nothing has updated its row yet. In addition, a background worker (every 5 s) and every relevant
   read/write move such rows to `EXPIRED`. "now" is the backend server's UTC clock
   (`DateTimeOffset.UtcNow`); several backend instances should run with synchronized clocks (NTP), as
   containers on one host do.
10. **Expiry time is whole seconds**: `expiresAt = creation time + HOLD_DURATION_SECONDS` (default 600),
    truncated to the second, so it is identical in every response.
11. **Timestamps are UTC ISO-8601 with `Z`** (e.g. `2026-11-01T04:10:00Z`). The UI shows them in
    Bangladesh time, labelled, and runs the countdown against the server clock (estimated from the HTTP
    `Date` header) so a wrong device clock does not mislead. When the countdown reaches zero the UI shows
    `EXPIRED` and disables payment at once, then re-reads the server's status.

## API details

12. **IDs** look like `c_<32 hex>` and `h_<32 hex>` (the brief leaves the format free). An ID in any other
    format cannot exist, so it gets `404` like any unknown ID.
13. **Extra response fields** (allowed by the brief): `className`, `createdAt`, `confirmedAt`,
    `cancelledAt` on `GET /holds/{holdId}` and `GET /me/holds`. All contract fields are unchanged.
14. **Errors** are RFC 7807 Problem Details with a stable `code` (e.g. `NO_SEATS_AVAILABLE`,
    `HOLD_EXPIRED`) that the UI maps to Bengali messages. Bad input is always `400`, never `500`.
15. **Classes cannot be edited or deleted** (not required). This avoids undefined behaviour such as
    reducing seats below the number already held or confirmed. `GET /classes` is ordered by creation time.

## Deployment

16. **Frontend → backend URL** comes from `VITE_API_BASE_URL`, written into `/config.js` when the frontend
    container starts, so it can be changed without rebuilding. It must be reachable from the browser
    (default `http://localhost:8080`). The backend allows the UI origin via `CORS_ALLOWED_ORIGINS`.
17. **Schema** is applied by EF Core migrations at backend start-up (with retry while PostgreSQL starts,
    and a PostgreSQL advisory lock so two instances never migrate at the same time).

## Bonus: two backend processes on one database

The capacity rule is enforced only by PostgreSQL, never by memory inside a process:

- **Hold creation** runs in one transaction that first takes a row lock on the class
  (`SELECT … FROM admission_classes WHERE id = … FOR UPDATE`). Every other request for that class — from
  the same or any other backend process — waits at this lock. Inside the lock the transaction expires stale
  holds, checks the student's existing application, counts unexpired `HELD` + `CONFIRMED`, and inserts
  only if the count is below `total_seats`. The lock is released at commit, so the next request sees the
  new row. `held + confirmed` therefore cannot exceed `totalSeats`.
- **Confirm/cancel** lock the hold row (`FOR UPDATE`), so a confirm and an expiry/cancel cannot both win,
  and a repeated confirm sees `CONFIRMED` and changes nothing.
- **A partial unique index** `(student_id, class_id) WHERE status IN ('HELD','CONFIRMED')` is a second,
  database-level guard against duplicate active applications.

Verified by the test `TwoBackendInstancesSharingDatabase_NeverExceedCapacity` (two in-process API hosts,
80 concurrent requests, 10 seats → exactly 10 succeed) and manually with
`docker compose --profile multi up` (backends on :8080 and :8081): 80 concurrent requests split across
both → 10 × `201`, 70 × `409`.
