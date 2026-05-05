import { useState, useEffect, useCallback, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { normalizeForKey } from "@/lib/data-normalizers";

/**
 * Persisted state hook backed by useUserData (Supabase + localStorage).
 *
 * Design:
 * - On first mount, reads the latest value from the store (or `initial`).
 * - Writes update local state immediately and queue a debounced upsert.
 * - External changes to the same key (e.g. another component writing to it)
 *   are picked up via the `loaded` flag and a per-key version counter, NOT
 *   by re-running on every store mutation (which previously caused unrelated
 *   key updates to revert local state with stale closures).
 */
export const usePersistedState = <T,>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const { get, set: setData, loaded } = useUserData();

  const [state, setState] = useState<T>(() => normalizeForKey(key, get(key, initial)));
  const lastWrittenJson = useRef<string>(JSON.stringify(state));
  const hydratedRef = useRef(false);

  // Hydrate once after Supabase finishes its initial load.
  useEffect(() => {
    if (!loaded || hydratedRef.current) return;
    hydratedRef.current = true;
    const latest = normalizeForKey(key, get(key, initial));
    const latestJson = JSON.stringify(latest);
    if (latestJson !== lastWrittenJson.current) {
      lastWrittenJson.current = latestJson;
      setState(latest);
    }
    // We only want this to fire once when `loaded` becomes true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const setPersistedState = useCallback((v: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      lastWrittenJson.current = JSON.stringify(next);
      setData(key, next);
      return next;
    });
  }, [key, setData]);

  return [state, setPersistedState];
};
