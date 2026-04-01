import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface UserDataContextType {
  get: <T>(key: string, fallback: T) => T;
  set: (key: string, value: any) => void;
  loaded: boolean;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [store, setStore] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const pendingWrites = useRef<Record<string, any>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all data from Supabase on auth
  useEffect(() => {
    if (!user) {
      // Load from localStorage as fallback
      setLoaded(true);
      return;
    }

    const loadFromSupabase = async () => {
      const { data, error } = await (supabase as any)
        .from("user_data")
        .select("key, value")
        .eq("user_id", user.id);

      if (!error && data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => {
          map[row.key] = row.value;
          // Also cache in localStorage for instant reads
          try { localStorage.setItem(row.key, JSON.stringify(row.value)); } catch {}
        });
        setStore(map);
      }
      setLoaded(true);
    };

    loadFromSupabase();
  }, [user]);

  // Flush pending writes to Supabase (debounced)
  const flush = useCallback(() => {
    if (!user) return;
    const writes = { ...pendingWrites.current };
    pendingWrites.current = {};

    const entries = Object.entries(writes);
    if (entries.length === 0) return;

    // Upsert each key
    entries.forEach(async ([key, value]) => {
      await (supabase as any)
        .from("user_data")
        .upsert(
          { user_id: user.id, key, value },
          { onConflict: "user_id,key" }
        );
    });
  }, [user]);

  const get = useCallback(<T,>(key: string, fallback: T): T => {
    // First check in-memory store (Supabase data)
    if (key in store) return store[key] as T;
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }, [store]);

  const set = useCallback((key: string, value: any) => {
    // Update in-memory
    setStore(prev => ({ ...prev, [key]: value }));
    // Cache in localStorage for instant reads
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}

    // Queue Supabase write (debounced)
    if (user) {
      pendingWrites.current[key] = value;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, 500);
    }
  }, [user, flush]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flush();
    };
  }, [flush]);

  return (
    <UserDataContext.Provider value={{ get, set, loaded }}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
};
