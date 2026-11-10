import { API_URL } from './helpers';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

async function waitFor(url: string, label: string, timeoutMs = 180_000): Promise<void> {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} (${url}) did not become ready: ${lastError}`);
}

/** Waits until the backend and the frontend answer, so the first test does not race the start-up. */
export default async function globalSetup(): Promise<void> {
  await waitFor(`${API_URL}/health/ready`, 'Backend');
  await waitFor(BASE_URL, 'Frontend');
  console.log(`E2E: frontend ${BASE_URL}, backend ${API_URL}`);
}
