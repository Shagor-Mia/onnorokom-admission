# API Contract

Implement these routes and JSON shapes as the external contract. Preserve property names and status casing.

Base URL: `http://localhost:8080`

All timestamps must be UTC ISO-8601 strings.

## 1. Create class

`POST /classes`

Request:

```json
{
  "name": "Class 6 - Morning Shift",
  "totalSeats": 120
}
```

Success: `201 Created`

```json
{
  "id": "c_123",
  "name": "Class 6 - Morning Shift",
  "totalSeats": 120
}
```

Validation:
- `name` is required and non-empty.
- `totalSeats` must be a positive integer.
- Invalid payload: suitable `400 Bad Request` or `422 Unprocessable Entity`.

## 2. List classes and seat counts

`GET /classes`

Success: `200 OK`

```json
[
  {
    "id": "c_123",
    "name": "Class 6 - Morning Shift",
    "totalSeats": 120,
    "heldSeats": 15,
    "confirmedSeats": 80,
    "availableSeats": 25
  }
]
```

Definitions:
- `heldSeats`: unexpired `HELD` records only.
- `confirmedSeats`: `CONFIRMED` records.
- `availableSeats = totalSeats - heldSeats - confirmedSeats`.

## 3. Get one class

`GET /classes/{classId}`

Success: `200 OK`

```json
{
  "id": "c_123",
  "name": "Class 6 - Morning Shift",
  "totalSeats": 120,
  "heldSeats": 15,
  "confirmedSeats": 80,
  "availableSeats": 25
}
```

Unknown class: `404 Not Found`.

## 4. Create a seat hold

`POST /classes/{classId}/holds`

Required header:

```http
X-Student-Id: 20152691234567890
```

No request body is specified by the brief.

Success: `201 Created`

```json
{
  "holdId": "h_789",
  "classId": "c_123",
  "studentId": "20152691234567890",
  "status": "HELD",
  "expiresAt": "2026-11-01T04:10:00Z"
}
```

Business behavior:
- Allocate exactly one seat atomically.
- If no seat is available, return `409 Conflict`.
- Validate the header as a 17-digit student identifier.
- Enforce the one-active-application rule for the same student and class.

## 5. Get hold status

`GET /holds/{holdId}`

Success: `200 OK`

```json
{
  "holdId": "h_789",
  "classId": "c_123",
  "status": "HELD",
  "expiresAt": "2026-11-01T04:10:00Z"
}
```

Possible `status` values:
- `HELD`
- `CONFIRMED`
- `EXPIRED`
- `CANCELLED`

Unknown hold: `404 Not Found`.

## 6. Confirm admission

`POST /holds/{holdId}/confirm`

Required header: `X-Student-Id`.

Success: `200 OK`

```json
{
  "holdId": "h_789",
  "status": "CONFIRMED"
}
```

Behavior:
- Only the owner may confirm.
- Only an unexpired `HELD` record can transition to `CONFIRMED`.
- If already `CONFIRMED`, return the same successful result (idempotent).
- If expired/cancelled, return a suitable conflict response; do not confirm.
- The confirmed seat count must increase exactly once.

## 7. Cancel a hold

`DELETE /holds/{holdId}`

Required header: `X-Student-Id`.

Success: `204 No Content`.

Behavior:
- Only the owner may cancel.
- A currently `HELD` record transitions to `CANCELLED`.
- A repeated cancellation may return `204` if implemented idempotently, or a documented conflict for a non-active hold.
- Never cancel another student's hold.

## 8. List the current student's applications

`GET /me/holds`

Required header: `X-Student-Id`.

Success: `200 OK`

```json
[
  {
    "holdId": "h_789",
    "classId": "c_123",
    "className": "Class 6 - Morning Shift",
    "status": "HELD",
    "expiresAt": "2026-11-01T04:10:00Z"
  }
]
```

Return only records belonging to the supplied student ID. Include useful historical statuses so the UI can show `EXPIRED`, `CANCELLED`, and `CONFIRMED` applications.

## Common response guidance

- `400` / `422`: malformed or invalid input.
- `401` is not required by the brief; do not introduce a login requirement.
- `403`: authenticated/identified student does not own the hold (or use a consistent non-disclosing `404` policy; document it).
- `404`: class or hold does not exist.
- `409`: no available seat, duplicate active application, expired hold confirmation, or invalid state transition.
- `500`: unexpected server faults only; do not use it for validation/business-rule errors.

Use a consistent problem-details response for errors, for example:

```json
{
  "type": "https://httpstatuses.com/409",
  "title": "Conflict",
  "status": 409,
  "detail": "No seats are currently available for this class."
}
```

The error format is implementation guidance; the success response shapes above are the required contract.
