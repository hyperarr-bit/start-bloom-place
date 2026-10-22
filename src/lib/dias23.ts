/**
 * DIAS 2 E 3 DO TESTE (1.0.18, dono 22/10 — plano novidades-guardadas/2026-10-21/trial-plano/RELATORIO.md).
 *
 * O dado (806 testes fechados): o teste de hoje é "dia 1 cheio, dias 2 e 3 vazios". A dose "Dia 2: Rotina" é feita
 * por 2–4%; "O que você construiu" só aparece depois da 3ª dose (4% veem); quem volta no dia 2 dá uma olhada de
 * 0,9 min e sai. O que paga é a SEQUÊNCIA de voltas. Então cada dia ganha uma coisa que só existe nele:
 *   · M1 (dia 1) — a folha "Dia 1 feito" promete: "Amanhã fica pronto · quanto dá pra gastar amanhã";
 *   · M1 (dia 2) — ao abrir, o número novo ("Hoje dá pra gastar R$ 58", recalculado) é o que "ficou pronto";
 *   · M3 (dia 2) — a pessoa ESCOLHE o 2º módulo dela (pessoais: Beleza, Casa, Estudos, Dieta, Metas, Detox) em vez
 *     de receber Rotina; a dose do dia 2 É a intro (tutorial) do módulo escolhido — a regra "nenhum módulo abre a
 *     1ª vez sem tutorial" fica inteira; Rotina passa pro dia 3;
 *   · M1b (dia 3) — "Você construiu isso em 3 dias" AO ABRIR (pela data, não pela 3ª dose).
 * Tudo só no braço A ("uma dose por dia", metadata `missao_1_por_dia`), tudo 1x por dia gravado na missão
 * (`missao-doses`, que nenhuma vassoura leva).
 *
 * CHAVE REMOTA `dias23` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `tour_home_quando` (lib/dia1-cheio):
 *   · "off" (ou ausente, ou RevenueCat que nunca respondeu) → o teste de hoje, byte a byte;
 *   · "on" → os dias 2 e 3 novos.
 * A última resposta fica no aparelho (`core-dias23`, chave do aparelho).
 * QA: `?dias23=on|off|auto` (guarda em `dias23-force` neste aparelho/navegador; "auto" desfaz).
 */

export type ModoDias23 = "off" | "on";
export const CHAVE_REMOTA_DIAS23 = "dias23";
export const CHAVE_DIAS23_APARELHO = "core-dias23";
export const PARAM_DIAS23 = "dias23";
export const CHAVE_FORCA_DIAS23 = "dias23-force";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoDias23 | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "on" || t === "off" ? t : null;
};

/** Em memória: o que o getOfferings DESTA abertura disse (undefined = ainda não respondeu). */
let remoto: ModoDias23 | undefined;

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente/estranha em todas = "off". */
export function lerDias23Remoto(offerings: unknown): ModoDias23 {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoDias23 | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_DIAS23]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_DIAS23]) ?? lido;
  return lido ?? "off";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu (registrarChavesDasOfferings). */
export function registrarDias23Remoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    remoto = lerDias23Remoto(offerings);
    ls.set(CHAVE_DIAS23_APARELHO, remoto);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarDias23Remoto = (): void => { remoto = undefined; };

/** Guarda `?dias23=` (on|off grava a força; auto desfaz). */
export function guardarForcaDias23(busca?: string | URLSearchParams): void {
  let p: URLSearchParams;
  try { p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search); } catch { return; }
  const v = (p.get(PARAM_DIAS23) ?? "").toLowerCase();
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_DIAS23, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_DIAS23);
}

/** O modo AQUI: força de QA > o que o RevenueCat disse nesta abertura > a última resposta do aparelho > "off". */
export function modoDias23(): ModoDias23 {
  const f = modoDe(ls.get(CHAVE_FORCA_DIAS23));
  if (f) return f;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_DIAS23_APARELHO)) ?? "off";
}
export const dias23Ligado = (): boolean => modoDias23() === "on";
