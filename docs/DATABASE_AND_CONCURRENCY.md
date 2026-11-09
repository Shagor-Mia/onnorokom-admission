# Database Design, Hold Expiry, and Concurrency

This document describes the highest-risk part of the assignment. A visually correct application that oversells seats is incorrect.

## 1. Suggested relational model

### `admission_classes`
- `id` — UUID primary key (API may serialize as `c_<short-id>` if desired; do not expose database internals accidentally).
- `name` — required text.
- `total_seats` — positive integer.
- `created_at_utc` — timestamp with time zone.

### `admission_holds`
- `id` — UUID primary key.
- `class_id` — FK to `admission_classes`.
- `student_id` — 17-character student birth registration identifier.
- `status` — enum/string: `HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`.
- `created_at_utc` — timestamp with time zone.
- `expires_at_utc` — timestamp with time zone; nullable only if the implementation has a clear reason (recommended non-null).
- `confirmed_at_utc` — nullable timestamp.
- `cancelled_at_utc` — nullable timestamp.

Indexes:
- `(class_id, status, expires_at_utc)` for capacity calculations.
- `(student_id, created_at_utc)` for `/me/holds`.
- `(student_id, class_id, status)` for duplicate active application checks.

Consider a partial unique index for one active `HELD` or `CONFIRMED` row per `(student_id, class_id)`. Since expired `HELD` rows must first transition to `EXPIRED`, design the expiry transaction consistently. PostgreSQL partial indexes can enforce uniqueness for statuses, but the exact index predicate and status transition strategy must be tested.

## 2. Capacity invariant

For every class:

```text
unexpired HELD count + CONFIRMED count <= total_seats
```

Do not use a frontend check, a preflight `SELECT` without a lock, or a process-local mutex as the only protection. Multiple API instances/processes can receive requests at once.

## 3. Recommended atomic hold transaction

One viable PostgreSQL strategy:

1. Begin a database transaction.
2. Lock the relevant class row using `SELECT ... FOR UPDATE`.
3. Mark expired holds for that class as `EXPIRED` inside the same transaction.
4. Check whether the student already has a `HELD` (unexpired) or `CONFIRMED` hold for this class.
5. Count currently `HELD` and `CONFIRMED` holds.
6. If count is at capacity, roll back and return `409`.
7. Insert the new `HELD` record with `expires_at_utc = now_utc + HOLD_DURATION_SECONDS`.
8. Commit.
9. Return `201`.

Locking the class row serializes hold allocation for that class. It is simple and defensible for this assignment. Make sure every code path that changes capacity uses a compatible transaction/locking strategy.

Alternative designs such as atomic conditional updates, advisory locks, or serializable transactions are acceptable if correctness is demonstrated with concurrent tests.

## 4. Expiry

The brief requires expired seats to become available without a guardian calling a special endpoint.

Implement both:
- A hosted background service that periodically transitions expired `HELD` rows to `EXPIRED`.
- Lazy expiry inside relevant transactional operations/queries, so correctness does not depend on the worker running at an exact moment.

The effective occupied-seat query must count only `HELD` rows where `expires_at_utc > now_utc`, plus `CONFIRMED` rows. Prefer to transition expired rows to `EXPIRED` as part of the transaction that processes the class.

Do not use in-memory timers as the only expiry mechanism. The database is the source of truth.

## 5. Confirmation transaction

1. Begin transaction.
2. Load/lock the hold row.
3. Verify the supplied `X-Student-Id` matches the hold owner.
4. If status is already `CONFIRMED`, return successful confirmed response without changing counts.
5. If status is not `HELD`, return conflict.
6. If `expires_at_utc <= now_utc`, transition to `EXPIRED`, commit that transition, and return conflict.
7. Transition `HELD -> CONFIRMED`, set `confirmed_at_utc`.
8. Commit.

A confirmed admission occupies one seat. The transition must happen once only.

## 6. Cancellation transaction

1. Begin transaction.
2. Load/lock hold.
3. Verify owner.
4. If status is `HELD` and unexpired, transition to `CANCELLED`.
5. Commit.
6. Return `204`.

A cancelled hold no longer occupies a seat. Document the behavior for cancellation of already terminal holds.

## 7. Duplicate application rule

The brief says a student cannot keep multiple active applications/confirmed admissions for the same class. Implement at least:
- Reject a second active `HELD` for the same `(student_id, class_id)`.
- Reject a new `HELD` if the student already has a `CONFIRMED` admission for that class.
- Allow a new application after a previous hold expired or was cancelled, unless a confirmed admission exists.

If you interpret the rule more broadly (e.g., one active application across all classes), state that clearly in `ASSUMPTIONS.md` and keep behavior consistent.

## 8. Time handling

- Use UTC in the backend and database.
- Use `DateTimeOffset` in .NET.
- Compare expiry using a single server-side UTC clock value per transaction.
- Format API timestamps as ISO-8601 UTC, e.g. `2026-11-01T04:10:00Z`.
- Browser countdown is informational; the backend decides whether a hold is still valid.

## 9. Required concurrency test

Example:
- Create one class with 10 seats.
- Launch 100 hold requests concurrently, using distinct student IDs.
- Exactly 10 should return `201`.
- The remaining 90 should return `409` (assuming no other validation errors).
- Verify the database has no more than 10 occupied seats.
- Run the test against PostgreSQL, not only an in-memory provider.

Also test simultaneous duplicate requests from the same student and class.
