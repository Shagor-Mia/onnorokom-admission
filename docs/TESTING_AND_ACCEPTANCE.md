# Testing and Acceptance Checklist

Use this checklist before calling the assignment complete.

## 1. Backend functional tests

- [ ] Create a class with valid name and positive capacity returns `201`.
- [ ] Invalid class payload returns 4xx, not 500.
- [ ] List classes returns correct seat metrics.
- [ ] Get class returns correct metrics.
- [ ] Unknown class returns 404.
- [ ] Hold request with missing/invalid `X-Student-Id` returns 4xx.
- [ ] Valid hold returns `201` and `HELD`.
- [ ] Hold expiry is based on `HOLD_DURATION_SECONDS`.
- [ ] No-seat request returns `409`.
- [ ] Student cannot create a duplicate active hold for same class.
- [ ] Student cannot create a new hold for a class already confirmed by that student.
- [ ] Hold status endpoint reports all four statuses correctly.
- [ ] Only owner can confirm.
- [ ] Confirming before expiry returns `200` and `CONFIRMED`.
- [ ] Confirming an already confirmed hold is idempotent.
- [ ] Confirming an expired/cancelled hold fails with 4xx/409.
- [ ] Only owner can cancel.
- [ ] Successful cancellation returns `204`.
- [ ] `/me/holds` returns only the supplied student's records.

## 2. Critical concurrency test

- [ ] Create a class with 10 seats.
- [ ] Send 100 concurrent hold requests with distinct valid student IDs.
- [ ] Exactly 10 requests succeed with `201`.
- [ ] The remaining requests fail with `409` (not 500).
- [ ] Database occupancy never exceeds 10.
- [ ] Repeat the test enough times to catch race conditions.
- [ ] Run against PostgreSQL.

## 3. Expiry and idempotency

- [ ] Set a short hold duration in a test environment.
- [ ] Create a hold and allow it to expire.
- [ ] Verify the seat becomes available without a manual expiry API call.
- [ ] Verify status becomes `EXPIRED`.
- [ ] Verify the frontend disables confirmation.
- [ ] Confirm the same hold twice; confirmed occupancy increases once only.
- [ ] Race confirm against expiry and verify only one valid terminal outcome.

## 4. Frontend tests / manual checks

- [ ] Student ID accepts exactly 17 digits and gives a clear validation message.
- [ ] Current student identity survives page refresh/reopen.
- [ ] Class list shows total, held, confirmed, and available seats.
- [ ] Seat data refreshes every few seconds.
- [ ] Guardian can create a hold from UI.
- [ ] Guardian can see expiry/status.
- [ ] Guardian can confirm from UI.
- [ ] Guardian can cancel from UI.
- [ ] Guardian can see their application history.
- [ ] Expired hold remains visible as `EXPIRED`.
- [ ] Confirm button is disabled for expired/cancelled holds.
- [ ] 409 no-seat and duplicate messages are understandable.
- [ ] Loading, empty, error, and success states are present.
- [ ] No blank page or console-only error.
- [ ] Admin can create a class from UI.
- [ ] Admin can view seat counts from UI.
- [ ] UI is usable on mobile, tablet, and desktop.
- [ ] Keyboard focus and labels are usable.

## 5. Docker and persistence

- [ ] Root `docker-compose.yml` exists.
- [ ] `docker compose up --build` starts DB, backend, and frontend.
- [ ] Backend is reachable at `http://localhost:8080`.
- [ ] Frontend can call backend using configurable API base URL.
- [ ] Database health check/readiness is handled.
- [ ] PostgreSQL uses a named volume.
- [ ] Create a class/application, run `docker compose down`, then `docker compose up`.
- [ ] Previously stored data still exists.
- [ ] No host-installed .NET/Node/PostgreSQL is needed for the evaluator's normal run.

## 6. Documentation and submission

- [ ] README has setup, run, test, and usage instructions.
- [ ] `ASSUMPTIONS.md` explains decisions and reasons.
- [ ] `AI_USAGE.md` accurately lists AI assistance and verification.
- [ ] No credentials/secrets are committed.
- [ ] No generated code is falsely described as tested.
- [ ] Git history contains incremental commits.
- [ ] Public GitHub repository is accessible.
