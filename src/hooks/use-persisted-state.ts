import { useState, useEffect, useCallback } from "react";
import { useUserData } from "@/hooks/use-user-data";

export const usePersistedState = <T,>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const { get, set: setData } = useUserData();

  const [state, setState] = useState<T>(() => get(key, initial));

  const setPersistedState = useCallback((v: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      setData(key, next);
      return next;
    });
  }, [key, setData]);

  return [state, setPersistedState];
};
