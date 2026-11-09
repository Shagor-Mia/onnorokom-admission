# Project Specification — School Admission System

## 1. Purpose

Build a full-stack online school admission system for a new academic year. Admission is first-come-first-served; there is no lottery. Each class/shift has a limited number of seats. Many guardians may submit applications simultaneously, so seat allocation must be correct under concurrency.

## 2. User roles and identity

### Guardian / parent
- No account registration, password, or login is required by the brief.
- A guardian enters the student's 17-digit birth registration number.
- The frontend sends this identifier in the `X-Student-Id` request header for student-specific operations.
- The student can see their own applications and operate only on their own holds.

### School admin
- Creates class/shift entries and sets total seats.
- Views all class/shift entries and their seat counts.
- Admin UI must be usable without direct API tools.

**Unspecified:** Admin authentication/authorization is not described. Record the selected demo approach in `ASSUMPTIONS.md`. Do not add a complex auth service without approval.

## 3. Core user journeys

### Guardian journey
1. Open the admission portal.
2. Enter a valid 17-digit student birth registration number.
3. Browse available classes/shifts and seat availability.
4. Select a class/shift and request a seat hold.
5. If successful, show the hold ID, `HELD` status, and expiry countdown/time.
6. Before expiry, select “ভর্তি ফি দিন” (simulated payment).
7. On success, show `CONFIRMED`.
8. If the hold expires, show `EXPIRED`, release the seat, and disable confirmation.
9. Guardian can cancel an active hold.
10. Guardian can revisit the portal and see their applications after refresh/reopen.

### Admin journey
1. Open admin section.
2. Create a class/shift with a name and positive seat capacity.
3. View classes and seat utilization.
4. See held, confirmed, and available seat counts update periodically.

## 4. Class/shift data

Minimum fields:
- ID
- Name (example: `Class 6 - Morning Shift`)
- Total seats
- Created timestamp (recommended)

Seat metrics:
- `heldSeats`: number of unexpired holds in `HELD` status.
- `confirmedSeats`: number of `CONFIRMED` admissions.
- `availableSeats = totalSeats - heldSeats - confirmedSeats`.

Expired and cancelled holds do not count as occupied seats.

## 5. Hold lifecycle

Allowed states:
- `HELD`
- `CONFIRMED`
- `EXPIRED`
- `CANCELLED`

Expected transitions:
- `HELD -> CONFIRMED` when confirmed before expiry.
- `HELD -> EXPIRED` when expiry time is reached.
- `HELD -> CANCELLED` when the owner cancels before expiry.
- Terminal states do not transition back to `HELD`.
- A repeated confirm request for an already `CONFIRMED` hold returns the same successful confirmed result and must not count another seat.
- A confirmation after expiry must not succeed.

## 6. Required technology

- Backend: C# / ASP.NET Core, .NET 8 or newer.
- Database: PostgreSQL.
- ORM: implementation choice; EF Core + Npgsql is recommended.
- Frontend: React 18 or newer, JavaScript or TypeScript; TypeScript is recommended.
- Vite is recommended.
- Docker Compose must run PostgreSQL, backend, and frontend together.

## 7. Required operational behavior

- Backend listens on `http://localhost:8080` from the host.
- PostgreSQL connection string is configurable through environment variables.
- Frontend API base URL is configurable through an environment variable.
- `HOLD_DURATION_SECONDS` controls hold duration; default is 600.
- The whole app runs with Docker Compose; no separate host installs should be necessary.
- Data persists after `docker compose down` and `docker compose up`.
- Class seat counts refresh every few seconds.
- Expired status must be visible after a page reload even if no one manually requests expiry processing.

## 8. Out of scope

- Real payment gateway.
- Lottery or merit-based selection.
- Parent password/account registration.
- SMS/email OTP unless explicitly approved as an optional enhancement.
- Production-grade identity verification.
- Multi-school/tenant management.
- Complex role management not stated in the brief.

## 9. Ambiguities to record

Record decisions for:
- Admin access in this demo.
- Whether one student can have holds in different classes simultaneously.
- What happens when an admin tries to reduce total seats below currently occupied seats (if editing is implemented).
- Whether cancelled/expired applications remain visible in history (recommended: yes).
- Exact UI language and timezone presentation.
