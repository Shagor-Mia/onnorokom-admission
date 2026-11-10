import { useEffect, useState } from 'react';
import { serverClock } from '../lib/serverClock';

/** Server-adjusted current time, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => serverClock.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverClock.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
