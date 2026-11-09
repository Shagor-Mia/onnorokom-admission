# Assumptions and Design Decisions

> Keep this file updated. The assignment explicitly asks candidates to document reasonable assumptions. Replace the `PENDING` values with the actual decisions made in code. Do not leave a decision here that the implementation does not follow.

## 1. Admin access

**Decision:** PENDING — describe how the demo admin screen is accessed.

**Reason:** The assignment requires school-admin UI actions but does not define admin authentication or credentials. Avoid silently inventing a full authentication system.

## 2. Student identity

**Decision:** The 17-digit birth registration number is supplied through `X-Student-Id`. The frontend remembers the current value for continuity.

**Reason:** The assignment explicitly says no login is required and uses the birth registration number as the student's identity.

**Limitation:** A client-supplied identifier is not secure identity verification. This is a take-home demo behavior, not production authentication.

## 3. Duplicate applications

**Decision:** PENDING — recommended behavior: one active `HELD` or `CONFIRMED` application per student per class/shift. A new application is allowed after expiry/cancellation if there is no confirmed admission.

**Reason:** The brief prohibits multiple active applications/confirmed admissions for the same student in the same class context. State whether the implementation applies a broader restriction.

## 4. Cancel behavior

**Decision:** PENDING — define behavior for cancellation after `CONFIRMED`, `EXPIRED`, or `CANCELLED`.

**Reason:** The brief specifies cancellation but does not define every terminal-state edge case.

## 5. Expiry processing

**Decision:** Recommended: background worker plus lazy expiry in transactional operations/queries.

**Reason:** Expired seats must be released without a manual API call. The database remains the source of truth after restarts.

## 6. Time zone

**Decision:** Store and return UTC timestamps. The UI may display the time in the browser's local timezone and label it clearly.

**Reason:** UTC avoids server/browser timezone ambiguity.

## 7. Class editing

**Decision:** PENDING — if class editing is implemented, specify whether seat capacity can be reduced below current occupied seats.

**Reason:** The brief explicitly requires class creation and viewing, but does not require editing/deleting.

## 8. Historical applications

**Decision:** Recommended: retain `EXPIRED`, `CANCELLED`, and `CONFIRMED` records and show them in the student's application history.

**Reason:** The UI must show expired applications after reload; retaining history makes this reliable.

## 9. Error response format

**Decision:** PENDING — document whether ASP.NET ProblemDetails is used and how the frontend maps error codes to Bengali messages.

**Reason:** The brief requires appropriate 4xx responses, but does not prescribe an error JSON shape.
