// Explicit types for the API contract (docs/API_CONTRACT.md).
// Fields marked optional are additive extras returned by this backend.

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface CreateClassRequest {
  name: string;
  totalSeats: number;
}

export interface CreatedClass {
  id: string;
  name: string;
  totalSeats: number;
}

export interface AdmissionClass extends CreatedClass {
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreatedHold {
  holdId: string;
  classId: string;
  studentId: string;
  status: HoldStatus;
  expiresAt: string;
}

export interface HoldDetails {
  holdId: string;
  classId: string;
  status: HoldStatus;
  expiresAt: string;
  className?: string;
  createdAt?: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
}

export interface ConfirmedHold {
  holdId: string;
  status: HoldStatus;
}

export interface StudentHold {
  holdId: string;
  classId: string;
  className: string;
  status: HoldStatus;
  expiresAt: string;
  createdAt?: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
}

/** RFC 7807 problem details returned by the backend for 4xx/5xx responses. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}
