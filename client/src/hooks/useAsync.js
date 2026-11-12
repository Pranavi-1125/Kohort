import { useCallback, useEffect, useRef, useState } from 'react';

// Small data-loading helper: { data, loading, error, reload, setData }
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async (silent) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: '' }));
    try { const data = await fn(); if (alive.current) setState({ data, loading: false, error: '' }); }
    catch (e) { if (alive.current) setState((s) => ({ ...s, loading: false, error: e.message })); }
  }, deps);
  useEffect(() => { run(false); }, [run]);
  return { ...state, reload: () => run(true), retry: () => run(false), setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}
