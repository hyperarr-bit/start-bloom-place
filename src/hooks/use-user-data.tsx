import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface UserDataContextType {
  get: <T>(key: string, fallback: T) => T;
  set: (key: string, value: any) => void;
  loaded: boolean;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

const DEBOUNCE_MS = 250;

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [store, setStore] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const pendingWrites = useRef<Record<string, any>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  // Load all data from Supabase on auth
  useEffect(() => {
    if (!user) {
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
          try { localStorage.setItem(row.key, JSON.stringify(row.value)); } catch {}
        });
        setStore(map);
      } else if (error) {
        console.error("[user-data] failed to load:", error);
      }
      setLoaded(true);
    };

    loadFromSupabase();
  }, [user]);

  // Persist a single key (with retry on failure).
  const persistKey = useCallback(async (userId: string, key: string, value: any, attempt = 0) => {
    const { error } = await (supabase as any)
      .from("user_data")
      .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
    if (error) {
      console.error(`[user-data] upsert failed for "${key}" (attempt ${attempt + 1}):`, error);
      if (attempt < 2) {
        // Re-queue with exponential backoff
        setTimeout(() => persistKey(userId, key, value, attempt + 1), 500 * Math.pow(2, attempt));
      }
    }
  }, []);

  // Flush all pending writes to Supabase.
  const flush = useCallback(() => {
    const userId = userRef.current?.id;
    if (!userId) return;
    const writes = { ...pendingWrites.current };
    pendingWrites.current = {};
    const entries = Object.entries(writes);
    if (entries.length === 0) return;
    entries.forEach(([key, value]) => {
      persistKey(userId, key, value);
    });
  }, [persistKey]);

  const get = useCallback(<T,>(key: string, fallback: T): T => {
    if (key in store) return store[key] as T;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }, [store]);

  const set = useCallback((key: string, value: any) => {
    setStore(prev => ({ ...prev, [key]: value }));
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}

    if (userRef.current) {
      pendingWrites.current[key] = value;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, DEBOUNCE_MS);
    }
  }, [flush]);

  // Force flush on tab hide / page unload (mobile-safe).
  useEffect(() => {
    const forceFlush = () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") forceFlush();
    };
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", forceFlush);
    window.addEventListener("beforeunload", forceFlush);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", forceFlush);
      window.removeEventListener("beforeunload", forceFlush);
      forceFlush();
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
