/**
 * LOGIN GOOGLE/APPLE NO `login_completed` (05/11). O /entrar só registrava senha e código: quem entrava pelo Google ou
 * pela Apple sumia da conta de logins. O OAuth sai do site e a sessão nasce em outro lugar (/auth/callback, volta do
 * core://auth, folha nativa da Apple), então o /entrar guarda o método antes de sair e quem recebe a sessão registra.
 * Só o /entrar guarda: os funis seguem medindo pelo `signup_completed` de sempre. Vence em 15 min, pra um login
 * abandonado não ser atribuído a um link de e-mail aberto depois.
 */
import { trackEvent } from "@/lib/analytics";

type MetodoOAuth = "google" | "apple";
const CHAVE = "core-auth-metodo";
const VALIDADE_MS = 15 * 60_000;

export function guardarMetodoLogin(method: MetodoOAuth, next: string | null): void {
  try { localStorage.setItem(CHAVE, JSON.stringify({ method, next, em: Date.now() })); } catch { /* noop */ }
}

/** Lê e apaga. `null` = não veio do /entrar, ou o login foi abandonado há tempo demais. */
export function pegarMetodoLogin(): { method: MetodoOAuth; next: string | null } | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    localStorage.removeItem(CHAVE);
    const v = bruto ? JSON.parse(bruto) : null;
    if ((v?.method !== "google" && v?.method !== "apple") || !(Date.now() - Number(v.em) < VALIDADE_MS)) return null;
    return { method: v.method, next: typeof v.next === "string" ? v.next : null };
  } catch {
    return null;
  }
}

/** A sessão entrou: registra uma vez, se o login saiu do /entrar. */
export function registrarLoginOAuth(extra: Record<string, unknown> = {}): void {
  const m = pegarMetodoLogin();
  if (m) trackEvent("login_completed", { method: m.method, source: "email_access", ...(m.next ? { next: m.next } : {}), ...extra });
}
