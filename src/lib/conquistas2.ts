/**
 * CONQUISTAS 2 (16/10) — A CHAVE.
 *
 * A tela de Conquistas nova (direção B "Fogo & trilha" + o ÁLBUM como herói:
 * components/conquistas/nova) mora atrás desta chave. Com ela ligada, a rota
 * /conquistas monta a tela nova; desligada, a de hoje (TelaConquistas) — byte
 * a byte. Nada de dado muda entre as duas: as duas leem as MESMAS chaves
 * (`core-dias-anotados`, `conquistas-desbloqueadas`, `conquistas-album-visto`).
 *
 * QUEM DECIDE, nesta ordem (a primeira que responder vale) — o mesmo padrão
 * das ofertas de saída (lib/ofertas-saida.ts):
 *   1. força de QA deste aparelho, gravada pelo link `?conquistas2=on|off|auto`
 *      (chave `conquistas2-force`, sem prefixo varrido: a vassoura não leva);
 *   2. metadata remota do RevenueCat: QUALQUER offering pode carregar
 *      `conquistas2: "on" | "off"` (a `current` vence) — ligar/desligar SEM versão nova;
 *   3. a constante local: "on" no APP das lojas, "off" no site.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoConquistas2 = "on" | "off";

/** Constantes locais. ROLLBACK sem RevenueCat = trocar aqui + build. */
export const CONQUISTAS2_APP: ModoConquistas2 = "on";
export const CONQUISTAS2_WEB: ModoConquistas2 = "off";

/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_CONQUISTAS2 = "conquistas2";
export const CHAVE_FORCA_CONQUISTAS2 = "conquistas2-force";
export const PARAM_QA_CONQUISTAS2 = "conquistas2";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoConquistas2 | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

let remota: ModoConquistas2 | null = null;

/** Decisão pura: lê `conquistas2` do metadata de todas as offerings (a `current` vence). */
export function lerChaveRemotaConquistas2(offerings: unknown): ModoConquistas2 | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lida: ModoConquistas2 | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lida = modoDe(off?.metadata?.[CHAVE_REMOTA_CONQUISTAS2]) ?? lida;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_CONQUISTAS2]) ?? lida;
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings(). */
export function registrarChaveRemotaConquistas2(offerings: unknown): void {
  try { remota = lerChaveRemotaConquistas2(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarChaveRemotaConquistas2 = (): void => { remota = null; };

/** `?conquistas2=on|off` liga/desliga neste aparelho; `auto` apaga a força. */
export function guardarForcaConquistas2(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_QA_CONQUISTAS2);
  } catch { return; }
  if (v === null) return;
  if (v === "auto") { ls.del(CHAVE_FORCA_CONQUISTAS2); return; }
  const m = modoDe(v);
  if (m) ls.set(CHAVE_FORCA_CONQUISTAS2, m);
}

/** A tela nova está ligada AQUI, agora? força de QA > metadata do RevenueCat > constante (app × site). */
export function conquistas2Ligada(): boolean {
  const f = modoDe(ls.get(CHAVE_FORCA_CONQUISTAS2));
  if (f) return f === "on";
  if (remota) return remota === "on";
  return (isNativeShell() ? CONQUISTAS2_APP : CONQUISTAS2_WEB) === "on";
}
