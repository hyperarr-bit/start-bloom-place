import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markActivation } from "@/lib/analytics";

// Map user_data keys → activation action_key. Triggered first time a key is written
// with non-empty value.
const ACTIVATION_RULES: Array<{ match: RegExp; action: string }> = [
  { match: /transac|financ/i, action: "first_transaction" },
  { match: /habit/i, action: "first_habit" },
  { match: /workout|treino/i, action: "first_workout" },
  { match: /meal|dieta/i, action: "first_meal" },
  { match: /task|rotina/i, action: "first_task" },
  { match: /water|hidrat/i, action: "first_water_log" },
  { match: /note/i, action: "first_note" },
];

const isMeaningful = (value: any): boolean => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  return Boolean(value);
};

const checkActivation = (key: string, value: any) => {
  if (!isMeaningful(value)) return;
  for (const rule of ACTIVATION_RULES) {
    if (rule.match.test(key)) {
      markActivation(rule.action, { source_key: key });
      break;
    }
  }
};

// ---------------------------------------------------------------------------
// Per-user localStorage helpers.
// All app data is namespaced under `u:{userId}:{key}` so that two accounts on
// the same browser cannot read each other's cached values.
//
// Keys that are intentionally global (i.e. not user data) and should NOT be
// purged on logout/user switch:
//   - "core-welcome-done"        (one-time onboarding splash)
//   - "theme"                    (light/dark preference)
//   - "vite-ui-theme"            (theme persistence by ui lib)
//   - "finance-keys-migrated-v2" (one-time legacy migration flag)
// ---------------------------------------------------------------------------
const GLOBAL_KEY_ALLOWLIST = new Set<string>([
  "core-welcome-done",
  "theme",
  "vite-ui-theme",
  "finance-keys-migrated-v2",
]);

const userKey = (userId: string, key: string) => `u:${userId}:${key}`;

const safeGetItem = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const safeSetItem = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch {}
};
const safeRemoveItem = (k: string) => {
  try { localStorage.removeItem(k); } catch {}
};

/**
 * Read a value from the current user's namespaced localStorage cache.
 * Exported so non-React code (e.g. finance helpers) can stay in sync.
 */
export const readUserLocal = (userId: string | null | undefined, key: string): any => {
  if (!userId) return null;
  const raw = safeGetItem(userKey(userId, key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

/**
 * Write a value to the current user's namespaced localStorage cache.
 * Used by helpers that mutate user data outside the React tree.
 */
export const writeUserLocal = (userId: string | null | undefined, key: string, value: any) => {
  if (!userId) return;
  safeSetItem(userKey(userId, key), JSON.stringify(value));
};

/**
 * Purge every cached entry that belongs to a user namespace, plus any legacy
 * non-prefixed app data keys left over from before the multi-user fix.
 * Global preferences (see GLOBAL_KEY_ALLOWLIST) are preserved.
 */
export const purgeUserLocalCache = () => {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (GLOBAL_KEY_ALLOWLIST.has(k)) continue;
      // Per-user namespace, OR legacy app keys (anything that looks like our
      // historical data: finance-*, home-*, core-*, life-*, etc.).
      if (
        k.startsWith("u:") ||
        k.startsWith("finance-") ||
        k.startsWith("home-") ||
        k.startsWith("core-") ||
        k.startsWith("life-") ||
        k.startsWith("module-") ||
        k.startsWith("daily-") ||
        k.startsWith("offline-") ||
        k.startsWith("nudge-")
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(safeRemoveItem);
  } catch {}
};

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
  const lastUserIdRef = useRef<string | null>(null);

  // Keep the ref in sync AND react to user changes (login, logout, switch).
  useEffect(() => {
    const prevUserId = lastUserIdRef.current;
    const nextUserId = user?.id ?? null;
    userRef.current = user;

    // First mount with a user: nothing to clear.
    // User switched (incl. logout): wipe in-memory store and the previous
    // user's local cache so nothing leaks into the next session.
    if (prevUserId !== nextUserId) {
      // Cancel any pending writes from the previous user — those would otherwise
      // get re-attributed to the new one.
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      pendingWrites.current = {};
      setStore({});
      setLoaded(false);
      // Always purge to be safe (also clears legacy non-prefixed keys).
      purgeUserLocalCache();
      lastUserIdRef.current = nextUserId;
    }
  }, [user]);

  // Load all data from Supabase whenever the active user changes.
  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const loadFromSupabase = async () => {
      const { data, error } = await (supabase as any)
        .from("user_data")
        .select("key, value")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (!error && data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => {
          map[row.key] = row.value;
          safeSetItem(userKey(user.id, row.key), JSON.stringify(row.value));
        });
        setStore(map);
      } else if (error) {
        console.error("[user-data] failed to load:", error);
      }
      setLoaded(true);
    };

    loadFromSupabase();
    return () => { cancelled = true; };
  }, [user]);

  // Persist a single key (with retry on failure).
  const persistKey = useCallback(async (userId: string, key: string, value: any, attempt = 0) => {
    // Defensive: if the active user changed mid-flight, drop the write rather
    // than attribute it to the new user.
    if (userRef.current?.id !== userId) return;
    const { error } = await (supabase as any)
      .from("user_data")
      .upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
    if (error) {
      console.error(`[user-data] upsert failed for "${key}" (attempt ${attempt + 1}):`, error);
      if (attempt < 2) {
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
    // Only fall back to localStorage when we have a user AND we've already
    // loaded from Supabase at least once. Otherwise we risk returning stale
    // data from a previous session/account before hydration completes.
    const userId = userRef.current?.id;
    if (!userId || !loaded) return fallback;
    const raw = safeGetItem(userKey(userId, key));
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }, [store, loaded]);

  const set = useCallback((key: string, value: any) => {
    setStore(prev => ({ ...prev, [key]: value }));
    const userId = userRef.current?.id;
    if (userId) {
      safeSetItem(userKey(userId, key), JSON.stringify(value));
      pendingWrites.current[key] = value;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, DEBOUNCE_MS);
      checkActivation(key, value);
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
