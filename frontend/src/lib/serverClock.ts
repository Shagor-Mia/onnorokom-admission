/**
 * Estimates the offset between the browser clock and the server clock from the
 * HTTP Date header, so countdowns stay accurate even if the guardian's device
 * clock is wrong. The backend remains the authority on expiry.
 */
let offsetMs = 0;

export const serverClock = {
  observe(dateHeader: string | null): void {
    if (!dateHeader) return;
    const serverMs = Date.parse(dateHeader);
    if (Number.isNaN(serverMs)) return;
    const candidate = serverMs - Date.now();
    // Date has 1-second resolution; ignore sub-second noise.
    if (Math.abs(candidate - offsetMs) > 1500) {
      offsetMs = candidate;
    }
  },
  now(): number {
    return Date.now() + offsetMs;
  },
  reset(): void {
    offsetMs = 0;
  },
};
