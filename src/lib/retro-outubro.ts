/**
 * RETROSPECTIVA DE OUTUBRO (23/10, estreia 1º/11) — A CHAVE E A DATA.
 *
 * A retrospectiva de outubro troca o "wrapped" de setembro (MonthlyWrapped,
 * os 3 temas de planner) pela SEQUÊNCIA DE CARDS animados de compartilhar
 * (src/components/compartilhar): abertura → um card por módulo com dado →
 * resumo, cada um com "Postar nos Stories" (vídeo) e "Salvar".
 *
 * É CÓDIGO DO BUNDLE: o app das lojas embarca o build web (capacitor
 * webDir "dist"), então no iPhone/Android ela só existe na build que levar
 * este código. A chave só LIGA o que já está no aparelho.
 *
 * QUEM DECIDE, nesta ordem (o mesmo padrão de lib/desafios-rodizio.ts):
 *   1. força de QA deste navegador, gravada pelo link `?retro=outubro`
 *      (liga e abre direto, MESMO ANTES de 01/11, com os dados até hoje) —
 *      `?retro=off` força desligado, `?retro=auto` apaga a força. Chave
 *      `retro-outubro-force`. Ignorada no app das lojas;
 *   2. metadata remota do RevenueCat: QUALQUER offering pode carregar
 *      `retro_outubro: "on" | "off"` (a `current` vence) — lida pelo
 *      `registrarChavesDasOfferings` de lib/revenuecat.ts (só no app);
 *   3. a constante local: "off" no app E na web.
 *
 * E A DATA: mesmo ligada, outubro só abre a partir de 01/11/2026 no relógio
 * (fuso) do aparelho da pessoa — antes disso o mês não acabou.
 */
import { isNativeShell } from "@/lib/native-shell";
import { localDayKey } from "@/lib/utils";

export type ModoRetroOutubro = "on" | "off";

/** Constantes locais. Ligar no site = trocar aqui + deploy; no app, pelo RevenueCat (ou aqui + build). */
export const RETRO_OUTUBRO_APP: ModoRetroOutubro = "off";
export const RETRO_OUTUBRO_WEB: ModoRetroOutubro = "off";

export const CHAVE_REMOTA_RETRO_OUTUBRO = "retro_outubro";
export const CHAVE_FORCA_RETRO_OUTUBRO = "retro-outubro-force";
export const PARAM_QA_RETRO = "retro";

/** O mês e o dia em que ele abre (o 1º dia DEPOIS de 31/10, no fuso do aparelho). */
export const RETRO_OUTUBRO = { ano: 2026, mesIdx: 9, libera: "2026-11-01" } as const;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoRetroOutubro | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

let remota: ModoRetroOutubro | null = null;

/** Decisão pura: lê `retro_outubro` do metadata de todas as offerings (a `current` vence). */
export function lerChaveRemotaRetroOutubro(offerings: unknown): ModoRetroOutubro | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lida: ModoRetroOutubro | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lida = modoDe(off?.metadata?.[CHAVE_REMOTA_RETRO_OUTUBRO]) ?? lida;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_RETRO_OUTUBRO]) ?? lida;
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings(). */
export function registrarRetroOutubroRemoto(offerings: unknown): void {
  try { remota = lerChaveRemotaRetroOutubro(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarRetroOutubroRemoto = (): void => { remota = null; };

/** `?retro=outubro` liga neste navegador; `?retro=off` desliga; `?retro=auto` apaga a força. Nunca no app das lojas. */
export function guardarForcaRetroOutubro(busca?: string | URLSearchParams): void {
  if (isNativeShell()) return;
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = p.get(PARAM_QA_RETRO);
  if (v === "outubro" || v === "on") ls.set(CHAVE_FORCA_RETRO_OUTUBRO, "on");
  else if (v === "off") ls.set(CHAVE_FORCA_RETRO_OUTUBRO, "off");
  else if (v === "auto") ls.del(CHAVE_FORCA_RETRO_OUTUBRO);
}

/** A força de QA deste navegador (null = nenhuma; sempre null no app das lojas). */
export function forcaRetroOutubro(): ModoRetroOutubro | null {
  if (isNativeShell()) return null;
  return modoDe(ls.get(CHAVE_FORCA_RETRO_OUTUBRO));
}

/** A chave (sem a data): força de QA (web) > metadata do RevenueCat > constante (app × web). */
export function retroOutubroLigada(): boolean {
  const f = forcaRetroOutubro();
  if (f) return f === "on";
  if (remota) return remota === "on";
  return (isNativeShell() ? RETRO_OUTUBRO_APP : RETRO_OUTUBRO_WEB) === "on";
}

/** Outubro já acabou no relógio do aparelho? (01/11 00:00 local em diante.) */
export const outubroJaAcabou = (agora: Date = new Date()): boolean => localDayKey(agora) >= RETRO_OUTUBRO.libera;

/**
 * A retrospectiva de outubro NOVA vale pra este mês, aqui, agora?
 * Chave ligada E (outubro acabou OU a força de QA está ligada — o QA vê antes, com os dados até hoje).
 */
export function retroOutubroAtiva(ano: number, mesIdx: number, agora: Date = new Date()): boolean {
  if (ano !== RETRO_OUTUBRO.ano || mesIdx !== RETRO_OUTUBRO.mesIdx) return false;
  if (!retroOutubroLigada()) return false;
  return outubroJaAcabou(agora) || forcaRetroOutubro() === "on";
}
