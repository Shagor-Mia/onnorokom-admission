import { getApiBaseUrl } from './config';
import { serverClock } from './serverClock';
import type {
  AdmissionClass,
  ConfirmedHold,
  CreateClassRequest,
  CreatedClass,
  CreatedHold,
  HoldDetails,
  ProblemDetails,
  StudentHold,
} from '../types/api';

/** Every failed API call becomes an ApiError. status 0 means the server was unreachable. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem?.code;
    this.problem = problem;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  studentId?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.studentId) {
    headers['X-Student-Id'] = options.studentId;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'Network error');
  }

  serverClock.observe(response.headers.get('Date'));

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const problem =
      payload && typeof payload === 'object' ? (payload as ProblemDetails) : { status: response.status };
    throw new ApiError(response.status, problem.detail ?? problem.title ?? `HTTP ${response.status}`, problem);
  }

  return payload as T;
}

export const api = {
  listClasses: (signal?: AbortSignal) => request<AdmissionClass[]>('/classes', { signal }),
  getClass: (classId: string, signal?: AbortSignal) =>
    request<AdmissionClass>(`/classes/${encodeURIComponent(classId)}`, { signal }),
  createClass: (body: CreateClassRequest) =>
    request<CreatedClass>('/classes', { method: 'POST', body }),
  createHold: (classId: string, studentId: string) =>
    request<CreatedHold>(`/classes/${encodeURIComponent(classId)}/holds`, { method: 'POST', studentId }),
  getHold: (holdId: string, signal?: AbortSignal) =>
    request<HoldDetails>(`/holds/${encodeURIComponent(holdId)}`, { signal }),
  confirmHold: (holdId: string, studentId: string) =>
    request<ConfirmedHold>(`/holds/${encodeURIComponent(holdId)}/confirm`, { method: 'POST', studentId }),
  cancelHold: (holdId: string, studentId: string) =>
    request<void>(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE', studentId }),
  myHolds: (studentId: string, signal?: AbortSignal) =>
    request<StudentHold[]>('/me/holds', { studentId, signal }),
};
