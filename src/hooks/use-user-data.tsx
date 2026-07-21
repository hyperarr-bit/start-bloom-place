import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markActivation } from "@/lib/analytics";

// Map user_data keys → activation action_key. Triggered first time a key is written
// with non-empty value.
const ACTIVATION_RULES: Array<{ match: RegExp; action: string; meaningful?: (v: any) => boolean }> = [
  { match: /finance-incomes/i, action: "first_income" },
  { match: /finance-fixed-expenses/i, action: "first_fixed_expense" },
  { match: /finance-dueDays/i, action: "first_bill", meaningful: (v) => Array.isArray(v) && v.some((d: any) => Array.isArray(d?.bills) && d.bills.length > 0) },
  { match: /finance-notes/i, action: "first_note" },
  { match: /finance-expenses/i, action: "first_transaction" },
  { match: /finance-installments/i, action: "first_installment" },
  { match: /finance-investments/i, action: "first_investment" },
  { match: /finance-wishlist/i, action: "first_wish" },
  { match: /transac|financ/i, action: "first_transaction" },
  { match: /rotina-habits|^habit/i, action: "first_habit" },
  { match: /rotina-schedule/i, action: "first_schedule" },
  { match: /month-goals/i, action: "first_month_goal" },
  { match: /todo-list/i, action: "first_task" },
  { match: /water-log|hidrat/i, action: "first_water_log" },
  { match: /sleep-log/i, action: "first_sleep_log" },
  { match: /workout|treino|exercise/i, action: "first_workout" },
  { match: /saude-meals|dieta-diary|dieta-recipes|meal/i, action: "first_meal" },
  { match: /dieta-smart-list/i, action: "first_grocery" },
  { match: /task|rotina/i, action: "first_task" },
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
  if (key.startsWith("spotlight-") || key.startsWith("quickstart-") || key.startsWith("core-")) return;
  for (const rule of ACTIVATION_RULES) {
    if (rule.match.test(key)) {
      if (rule.meaningful && !rule.meaningful(value)) return;
      markActivation(rule.action, { source_key: key });
      try {
        window.dispatchEvent(new CustomEvent("core:activation", { detail: { action: rule.action, key } }));
      } catch {}
      break;
    }
  }
};

const GLOBAL_KEY_ALLOWLIST = new Set<string>([
  "core-welcome-done",
  "theme",
  "vite-ui-theme",
  "finance-keys-migrated-v2",
  // Marca "este aparelho é o app instalado" — é do DISPOSITIVO, não do
  // usuário: sem ela aqui, trocar de conta/logar mandava o PWA pro funil.
  "core-pwa",
  // Braço sorteado do A/B de gateway (abacate × pagarme): também é do
  // dispositivo. Varrer isso faria a pessoa trocar de gateway entre sessões.
  "core-gw-arm",
]);

const userKey = (userId: string, key: string) => `u:${userId}:${key}`;
// Guest (pre-signup) keys — survive across reloads, migrated on signup/login.
const GUEST_PREFIX = "guest:";
const guestKey = (key: string) => `${GUEST_PREFIX}${key}`;
// Tutorial-related keys where the guest flow should win over an existing
// account value (so a user that signs in mid-tutorial doesn't have to redo it).
const GUEST_WINS_KEYS = new Set<string>([
  "core-onboarding-done",
  "core-all-modules-celebrated",
  "spotlight-done-financas",
  "spotlight-done-rotina",
  "spotlight-done-dieta",
  "spotlight-done-treino",
]);

const safeGetItem = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const safeSetItem = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch {}
};
const safeRemoveItem = (k: string) => {
  try { localStorage.removeItem(k); } catch {}
};

const readAllGuestData = (): Record<string, any> => {
  const out: Record<string, any> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(GUEST_PREFIX)) continue;
      const real = k.slice(GUEST_PREFIX.length);
      const raw = safeGetItem(k);
      if (!raw) continue;
      try { out[real] = JSON.parse(raw); } catch {}
    }
  } catch {}
  return out;
};

const clearAllGuestData = () => {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GUEST_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach(safeRemoveItem);
  } catch {}
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
      // Never purge guest data here — it belongs to a separate, pre-signup session.
      if (k.startsWith(GUEST_PREFIX)) continue;
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
  /** True when running without an authenticated user (data is local-only). */
  isGuest: boolean;
  /** Lazy fetch a single heavy key from Supabase on demand. */
  fetchKey: <T>(key: string) => Promise<T | null>;
}

export const UserDataContext = createContext<UserDataContextType | undefined>(undefined);
export type { UserDataContextType };

const DEBOUNCE_MS = 250;
const HEAVY_KEY_BYTES = 50_000;
const WRITE_WARN_BYTES = 100_000;

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
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
      // On switch/logout we wipe per-user cache, but NOT guest data.
      purgeUserLocalCache();
      lastUserIdRef.current = nextUserId;
    }
  }, [user]);

  // Hydration effect — runs whenever auth state finishes resolving.
  useEffect(() => {
    if (authLoading) return;

    // -------- GUEST MODE --------
    if (!user) {
      const guestData = readAllGuestData();
      setStore(guestData);
      setLoaded(true);
      return;
    }

    // -------- AUTHENTICATED --------
    const ac = new AbortController();

    const run = async () => {
      // Step 0: migrate any guest data into this account before we hydrate.
      const guestData = readAllGuestData();
      const guestKeys = Object.keys(guestData);
      if (guestKeys.length > 0) {
        try {
          const { data: existing } = await (supabase as any)
            .from("user_data")
            .select("key")
            .eq("user_id", user.id)
            .in("key", guestKeys);
          const existingSet = new Set<string>((existing ?? []).map((r: any) => r.key));

          const toUpsert = guestKeys
            .filter(k => !existingSet.has(k) || GUEST_WINS_KEYS.has(k))
            .map(k => ({ user_id: user.id, key: k, value: guestData[k] }));

          if (toUpsert.length > 0) {
            // Chunk to avoid huge payloads.
            const CHUNK = 50;
            for (let i = 0; i < toUpsert.length; i += CHUNK) {
              await (supabase as any)
                .from("user_data")
                .upsert(toUpsert.slice(i, i + CHUNK), { onConflict: "user_id,key" });
            }
          }
        } catch (e) {
          console.error("[user-data] guest→account migration failed:", e);
        } finally {
          clearAllGuestData();
        }
      }

      // Step 1: instant hydration from per-user localStorage cache.
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

      // Step 2: refresh from Supabase (server wins for non-heavy keys).
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
          if (size >= HEAVY_KEY_BYTES) return;
          map[row.key] = row.value;
          safeSetItem(userKey(user.id, row.key), JSON.stringify(row.value));
        });
        setStore(prev => {
          const next = { ...prev };
          Object.assign(next, map);
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

    run();
    return () => { ac.abort(); };
  }, [user, authLoading]);

  // Lazy fetch a single key (used for heavy entries like dream board).
  const fetchKey = useCallback(async <T,>(key: string): Promise<T | null> => {
    const userId = userRef.current?.id;
    if (!userId) {
      // Guest: just return whatever is in store (no remote storage).
      return (store[key] ?? null) as T | null;
    }

    if (key in store) return store[key] as T;

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
    if (!userId) return; // guest writes are sync to localStorage, nothing to flush
    const writes = { ...pendingWrites.current };
    pendingWrites.current = {};
    Object.entries(writes).forEach(([key, value]) => persistKey(userId, key, value));
  }, [persistKey]);

  const get = useCallback(<T,>(key: string, fallback: T): T => {
    if (key in store) return store[key] as T;
    if (!loaded) return fallback;
    const userId = userRef.current?.id;
    if (userId) {
      const raw = safeGetItem(userKey(userId, key));
      if (!raw) return fallback;
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    }
    // guest
    const raw = safeGetItem(guestKey(key));
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }, [store, loaded]);

  const set = useCallback((key: string, value: any) => {
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
    } else {
      // Guest: persist to guest:* — survives reload, migrated on signup/login.
      safeSetItem(guestKey(key), JSON.stringify(value));
    }
    // Activation events fire for both guests and authed users so the
    // spotlight tutorial can advance during the pre-signup flow.
    checkActivation(key, value);
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
    <UserDataContext.Provider value={{ get, set, loaded, fetchKey, isGuest: !user }}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
};
