import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Fetch immediately (e.g. after a mutation). */
  refresh: () => Promise<void>;
}

/**
 * Fetches immediately, then every `intervalMs` while `enabled`. Timers and
 * in-flight requests are cleaned up on unmount or when inputs change. Data from
 * the last successful fetch is kept while a later poll fails, so a brief
 * network blip shows an error banner instead of blanking the page.
 */
export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  enabled = true,
  deps: unknown[] = [],
): PollingState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState<boolean>(enabled);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await fetcherRef.current(controller.signal);
      if (!controller.signal.aborted && mountedRef.current) {
        setData(result);
        setError(undefined);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (!controller.signal.aborted && mountedRef.current) {
        setError(caught);
      }
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    setLoading(true);
    void run();
    const timer = window.setInterval(() => void run(), intervalMs);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, run, ...deps]);

  return { data, error, loading, refresh: run };
}
