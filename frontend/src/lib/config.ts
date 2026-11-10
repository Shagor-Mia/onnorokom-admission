declare global {
  interface Window {
    __APP_CONFIG__?: { apiBaseUrl?: string };
  }
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080';

/**
 * Backend base URL. Resolution order:
 *  1. window.__APP_CONFIG__.apiBaseUrl — written at container start from VITE_API_BASE_URL,
 *     so the URL can change through an environment variable without rebuilding;
 *  2. import.meta.env.VITE_API_BASE_URL — build-time value (local `npm run dev`);
 *  3. http://localhost:8080 — the URL required by the assignment.
 */
export function getApiBaseUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiBaseUrl : undefined;
  const buildTime = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const value = (runtime && runtime.trim()) || (buildTime && buildTime.trim()) || DEFAULT_API_BASE_URL;
  return value.replace(/\/+$/, '');
}
