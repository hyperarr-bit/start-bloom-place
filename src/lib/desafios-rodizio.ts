/**
 * DESAFIOS DA SEMANA EM RODÍZIO (17/10) — A CHAVE.
 *
 * O card DESAFIO DA SEMANA (Finanças › Painel) troca as 4 opções fixas por 3 que
 * mudam toda segunda (components/challenges/rodizio.ts). Esta chave liga/desliga
 * o rodízio SEM versão nova. Desligado = o card de sempre, byte a byte (as 4
 * opções e a regra antiga).
 *
 * QUEM DECIDE, nesta ordem (a primeira que responder vale) — o mesmo padrão de
 * Conquistas 2 (lib/conquistas2.ts):
 *   1. força de QA deste navegador, gravada pelo link `?desafios-rodizio=on|off|auto`
 *      (chave `desafios-rodizio-force`, sem prefixo varrido: a vassoura não leva;
 *      ignorada no app das lojas);
 *   2. metadata remota do RevenueCat: QUALQUER offering pode carregar
 *      `desafios_rodizio: "on" | "off"` (a `current` vence) — lida pelo
 *      `registrarChavesDasOfferings` de lib/revenuecat.ts;
 *   3. a constante local: "on" no app E na web.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoDesafiosRodizio = "on" | "off";

/** Constantes locais. ROLLBACK sem RevenueCat = trocar aqui + build/deploy. */
export const DESAFIOS_RODIZIO_APP: ModoDesafiosRodizio = "on";
export const DESAFIOS_RODIZIO_WEB: ModoDesafiosRodizio = "on";

/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_DESAFIOS_RODIZIO = "desafios_rodizio";
export const CHAVE_FORCA_DESAFIOS_RODIZIO = "desafios-rodizio-force";
export const PARAM_QA_DESAFIOS_RODIZIO = "desafios-rodizio";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoDesafiosRodizio | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

let remota: ModoDesafiosRodizio | null = null;

/** Decisão pura: lê `desafios_rodizio` do metadata de todas as offerings (a `current` vence). */
export function lerChaveRemotaDesafiosRodizio(offerings: unknown): ModoDesafiosRodizio | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lida: ModoDesafiosRodizio | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lida = modoDe(off?.metadata?.[CHAVE_REMOTA_DESAFIOS_RODIZIO]) ?? lida;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_DESAFIOS_RODIZIO]) ?? lida;
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings(). */
export function registrarDesafiosRodizioRemoto(offerings: unknown): void {
  try { remota = lerChaveRemotaDesafiosRodizio(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarDesafiosRodizioRemoto = (): void => { remota = null; };

/** `?desafios-rodizio=on|off` liga/desliga neste navegador; `auto` apaga a força. Nunca no app das lojas. */
export function guardarForcaDesafiosRodizio(busca?: string | URLSearchParams): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = p.get(PARAM_QA_DESAFIOS_RODIZIO);
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_DESAFIOS_RODIZIO, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_DESAFIOS_RODIZIO);
}

/** O rodízio está ligado AQUI, agora? força de QA (web) > metadata do RevenueCat > constante (app × web). */
export function desafiosRodizioLigado(): boolean {
  if (!isNativeShell()) {
    const f = ls.get(CHAVE_FORCA_DESAFIOS_RODIZIO);
    if (f === "on" || f === "off") return f === "on";
  }
  if (remota) return remota === "on";
  return (isNativeShell() ? DESAFIOS_RODIZIO_APP : DESAFIOS_RODIZIO_WEB) === "on";
}
