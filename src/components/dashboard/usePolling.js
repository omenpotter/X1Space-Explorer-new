import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Poll an async loader. Skips ticks while the tab is hidden, keeps the last good data when a refresh
 * fails (`stale`), never overlaps requests and clears its timers on unmount.
 * `deps` restarts the loop (and reloads) when they change; `paused` stops the interval.
 */
export default function usePolling(load, intervalMs, { paused = false, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, error: null, loadedAt: null });
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const busy = useRef(false);
  const alive = useRef(true);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const data = await loadRef.current();
      if (alive.current) setState({ data, error: null, loadedAt: Date.now() });
    } catch (error) {
      if (alive.current) setState((s) => ({ ...s, error }));
    } finally {
      busy.current = false;
      if (alive.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setState({ data: null, error: null, loadedAt: null });
    run();
    return () => { alive.current = false; };
  }, deps);

  useEffect(() => {
    if (paused || !intervalMs) return undefined;
    const id = setInterval(() => { if (!document.hidden) run(); }, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, run]);

  const hasData = state.data !== null && state.data !== undefined;
  return {
    data: state.data,
    error: state.error,
    loadedAt: state.loadedAt,
    status: hasData ? 'ready' : state.error ? 'error' : 'loading',
    stale: hasData && !!state.error,
    refreshing,
    reload: run,
  };
}
