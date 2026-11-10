import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { StudentProvider } from '../context/StudentContext';

export interface MockCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

type Handler = (call: MockCall) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

/** Replaces global fetch with a router-like mock and records every call. */
export function mockFetch(handler: Handler) {
  const calls: MockCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: MockCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const result = await handler(call);
    return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export function renderAt(path: string, routePath: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <StudentProvider>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={<p>other page</p>} />
        </Routes>
      </StudentProvider>
    </MemoryRouter>,
  );
}

export const STUDENT_ID = '20152691234567890';

export function rememberStudent(id = STUDENT_ID) {
  window.localStorage.setItem('admission.studentId', id);
}
