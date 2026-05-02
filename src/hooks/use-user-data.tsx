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
// Per-user localStorage cache (instant hydration on app open). We KEEP this
// as a fast cache layer — Supabase remains the source of truth, but reading
// from localStorage first means UI is interactive immediately on reload.
//
// Keys that are intentionally global (i.e. not user data) and should NOT be
// purged on logout/user switch:
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

export const readUserLocal = (userId: string | null | undefined, key: string): any => {
  if (!userId) return null;
  const raw = safeGetItem(userKey(userId, key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const writeUserLocal = (userId: string | null | undefined, key: string, value: any) => {
  if (!userId) return;
  safeSetItem(userKey(userId, key), JSON.stringify(value));
};

export const purgeUserLocalCache = () => {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (GLOBAL_KEY_ALLOWLIST.has(k)) continue;
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
  /** Lazy fetch a single heavy key from Supabase on demand. */
  fetchKey: <T>(key: string) => Promise<T | null>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

const DEBOUNCE_MS = 250;
// Keys above this size (in serialized JSON bytes) are NOT loaded in the
// initial bulk fetch — they're loaded lazily by the modules that need them.
// 50 KB is a sweet spot: it keeps all "normal" app state in the warm path
// while sparing the home/launch from waiting on bloated entries.
const HEAVY_KEY_BYTES = 50_000;
// Anything bigger than this is logged as a warning when written.
const WRITE_WARN_BYTES = 100_000;

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [store, setStore] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const pendingWrites = useRef<Record<string, any>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  const lastUserIdRef = useRef<string | null>(null);
  const inFlightFetches = useRef<Map<string, Promise<any>>>(new Map());

  // Sync ref + react to user changes (login/logout/switch).
  useEffect(() => {
    const prevUserId = lastUserIdRef.current;
    const nextUserId = user?.id ?? null;
    userRef.current = user;

    if (prevUserId !== nextUserId) {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      pendingWrites.current = {};
      inFlightFetches.current.clear();
      setStore({});
      setLoaded(false);
      purgeUserLocalCache();
      lastUserIdRef.current = nextUserId;
    }
  }, [user]);

  // Load user_data: instant from localStorage cache, then refresh light keys
  // from Supabase. Heavy keys are loaded on demand via fetchKey().
  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }

    // 1) Instant hydration from per-user localStorage cache (visual only).
    //    NOTE: do NOT mark `loaded=true` here — Supabase is the source of truth
    //    and must overwrite the cache before the rest of the app reads values,
    //    otherwise stale data (e.g. a previous user name) sticks around.
    try {
      const prefix = `u:${user.id}:`;
      const cached: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const realKey = k.slice(prefix.length);
        const raw = safeGetItem(k);
        if (!raw) continue;
        try { cached[realKey] = JSON.parse(raw); } catch {}
      }
      if (Object.keys(cached).length > 0) {
        setStore(cached);
      }
    } catch {}

    // 2) Refresh from Supabase. We fetch ALL light keys and let server values
    //    overwrite the cache. Heavy keys (>HEAVY_KEY_BYTES) are filtered
    //    client-side to keep memory low while still letting modules lazy-load
    //    them via fetchKey().
    const ac = new AbortController();
    const loadFromSupabase = async () => {
      const { data, error } = await (supabase as any)
        .from("user_data")
        .select("key, value")
        .eq("user_id", user.id)
        .abortSignal(ac.signal);

      if (ac.signal.aborted) return;

      if (!error && data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => {
          if (row.value === null || row.value === undefined) return;
          const size = JSON.stringify(row.value).length;
          if (size >= HEAVY_KEY_BYTES) return; // lazy-load heavy keys via fetchKey
          map[row.key] = row.value;
          safeSetItem(userKey(user.id, row.key), JSON.stringify(row.value));
        });
        // Server wins: also drop any cached keys that no longer exist server-side.
        setStore(prev => {
          const next = { ...prev };
          // overwrite/insert server values
          Object.assign(next, map);
          // remove client-only stale keys that the server doesn't have
          for (const k of Object.keys(prev)) {
            if (!(k in map)) {
              const prevSize = JSON.stringify(prev[k] ?? "").length;
              if (prevSize < HEAVY_KEY_BYTES) {
                delete next[k];
                safeRemoveItem(userKey(user.id, k));
              }
            }
          }
          return next;
        });
      } else if (error && error.message && !error.message.includes("aborted")) {
        console.error("[user-data] failed to load:", error);
      }
      setLoaded(true);
    };

    loadFromSupabase();
    return () => { ac.abort(); };
  }, [user]);

  // Lazy fetch a single key (used for heavy entries like dream board).
  const fetchKey = useCallback(async <T,>(key: string): Promise<T | null> => {
    const userId = userRef.current?.id;
    if (!userId) return null;

    // Already in store? return it.
    if (key in store) return store[key] as T;

    // Coalesce concurrent fetches for the same key.
    const cached = inFlightFetches.current.get(key);
    if (cached) return cached as Promise<T | null>;

    const p = (async () => {
      const { data, error } = await (supabase as any)
        .from("user_data")
        .select("value")
        .eq("user_id", userId)
        .eq("key", key)
        .maybeSingle();

      if (error) {
        console.error(`[user-data] fetchKey "${key}" failed:`, error);
        inFlightFetches.current.delete(key);
        return null;
      }
      const value = data?.value ?? null;
      if (value !== null && userRef.current?.id === userId) {
        setStore(prev => ({ ...prev, [key]: value }));
        safeSetItem(userKey(userId, key), JSON.stringify(value));
      }
      inFlightFetches.current.delete(key);
      return value;
    })();

    inFlightFetches.current.set(key, p);
    return p;
  }, [store]);

  const persistKey = useCallback(async (userId: string, key: string, value: any, attempt = 0) => {
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

  const flush = useCallback(() => {
    const userId = userRef.current?.id;
    if (!userId) return;
    const writes = { ...pendingWrites.current };
    pendingWrites.current = {};
    Object.entries(writes).forEach(([key, value]) => persistKey(userId, key, value));
  }, [persistKey]);

  const get = useCallback(<T,>(key: string, fallback: T): T => {
    if (key in store) return store[key] as T;
    const userId = userRef.current?.id;
    if (!userId || !loaded) return fallback;
    const raw = safeGetItem(userKey(userId, key));
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }, [store, loaded]);

  const set = useCallback((key: string, value: any) => {
    // Size guard — warn if a write would create an oversized entry.
    if (process.env.NODE_ENV !== "production") {
      try {
        const size = JSON.stringify(value ?? "").length;
        if (size > WRITE_WARN_BYTES) {
          console.warn(
            `[user-data] key "${key}" is ${(size / 1024).toFixed(0)} KB — ` +
            `consider uploading binary data to Supabase Storage instead of inlining base64.`
          );
        }
      } catch {}
    }

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

  // Force flush on tab hide / unload.
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
    <UserDataContext.Provider value={{ get, set, loaded, fetchKey }}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
};
