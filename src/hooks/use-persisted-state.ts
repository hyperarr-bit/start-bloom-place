import { useState, useEffect, useCallback, useRef } from "react";
import { useUserData } from "@/hooks/use-user-data";

export const usePersistedState = <T,>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const { get, set: setData } = useUserData();

  const [state, setState] = useState<T>(() => get(key, initial));
  const internalUpdate = useRef(false);

  // Sync from external changes (e.g. QuickActions writing to the same key)
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    const latest = get(key, initial);
    if (JSON.stringify(latest) !== JSON.stringify(state)) {
      setState(latest);
    }
  }, [get, key]); // re-runs when the useUserData store changes (get is recreated)

  const setPersistedState = useCallback((v: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      internalUpdate.current = true;
      setData(key, next);
      return next;
    });
  }, [key, setData]);

  return [state, setPersistedState];
};
