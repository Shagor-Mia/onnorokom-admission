# Assumptions and Design Decisions

> The assignment asks candidates to document reasonable assumptions. These are
> the selected project decisions; update them if delivered behavior changes.
> Do not claim a behavior is implemented until it is verified.

## 1. Admin access

**Decision:** The demo admin screen is accessible without authentication.

**Reason:** The assignment requires school-admin UI actions but does not define admin authentication or credentials. Avoid silently inventing a full authentication system.

**Limitation:** This is a demo-only access model, not an authorization boundary suitable for production.

## 2. Student identity

**Decision:** The 17-digit birth registration number is supplied through `X-Student-Id`. The frontend remembers the current value for continuity.

**Reason:** The assignment explicitly says no login is required and uses the birth registration number as the student's identity.

**Limitation:** A client-supplied identifier is not secure identity verification. This is a take-home demo behavior, not production authentication.

## 3. Duplicate applications and class/shift scope

**Decision:** Each class/shift is a separate class record. A student may apply to different classes, but may have at most one active `HELD` or `CONFIRMED` application for a given class. A new hold is allowed for that class after an earlier hold expires or is cancelled, unless the student already has a confirmed admission for it.

**Reason:** The assignment explicitly treats each shift as a separate class and prohibits multiple active applications or confirmed admissions for the same student in the same class. It does not impose a one-class-only restriction across the whole school.

## 4. Cancel behavior

**Decision:** Only an unexpired `HELD` application can be cancelled. Cancelling an already `CANCELLED` application is idempotent and returns `204 No Content`; cancelling a `CONFIRMED` or `EXPIRED` application returns `409 Conflict`. An expired hold remains `EXPIRED` and does not consume a seat.

**Reason:** Cancellation should release only a temporary reservation, not undo a completed admission or change an expired application's history. Idempotent cancellation makes safe client retries possible.

## 5. Expiry processing

**Decision:** Use a database-backed background worker and lazy expiry during relevant reads/writes. Seat counts only include `HELD` rows whose expiry is later than the current UTC time, even if a worker has not yet changed their persisted status.

**Reason:** The assignment requires automatic release without a special API call. The worker updates visible lifecycle state; database-time-aware queries and transactional expiry prevent a delayed worker from blocking seat allocation.

## 6. Time zone

**Decision:** Store UTC instants and return UTC ISO-8601 timestamps. The UI may display the equivalent local time if it labels the timezone clearly; all expiry decisions remain server-side.

**Reason:** UTC avoids server/browser timezone ambiguity.

## 7. Class editing

**Decision:** Class editing and deletion are out of scope; the required admin actions are class creation and viewing seat counts. Do not add edit/delete endpoints or UI in the initial implementation.

**Reason:** The assignment does not require editing or deletion. Omitting these avoids introducing unspecified behavior around reducing capacity below held or confirmed seats.

## 8. Historical applications

**Decision:** Retain application history, including `EXPIRED`, `CANCELLED`, and `CONFIRMED` records, and return the student's records from `/me/holds`.

**Reason:** The UI must show expired applications after reload; retaining history makes this reliable.

## 9. Error response format

**Decision:** Return consistent RFC 7807-style Problem Details for API errors. Preserve the required success response shapes and status codes. The frontend maps known validation and business-conflict responses to clear Bengali user messages and shows a useful fallback for network/server errors.

**Reason:** The brief requires invalid inputs to receive 4xx responses and errors to be understandable, but does not prescribe an error JSON shape. Problem Details provides a consistent machine-readable envelope.

## 10. Identifiers and hold duration

**Decision:** Use opaque IDs with `c_` for class records and `h_` for holds, while treating the exact suffix format as an implementation detail. Read `HOLD_DURATION_SECONDS` from environment-backed configuration and default to `600` seconds.

**Reason:** The API examples explicitly say their ID values are illustrative and allow any ID format. The duration variable name and default are specified by the assignment.

## 11. Multiple backend processes

**Decision:** Capacity safety must be enforced by PostgreSQL transactions/locking and database constraints, not process-local locks. This invariant applies if multiple backend instances connect to the same database.

**Reason:** The assignment's bonus asks how to preserve the capacity invariant across backend processes sharing a database. Database-level serialization also protects the required single-instance deployment.
