/**
 * A/B DO RESUMO DOS 3 DIAS (dono 29/10 — mockups em novidades-guardadas/2026-10-29/construiu-3-dias/): a tela
 * "Você construiu isso em 3 dias" virou duas — A "página do planner" (semana em quadradinhos, o que montou, figurinhas
 * coladas, post-it do próximo passo) e B "colagem" (as figurinhas dela espalhadas + o nome, 3 linhas e o próximo
 * passo). As duas sem score, com título pelos números e, no dia 3 (aoAbrir), o botão leva direto pra dose de hoje.
 *
 * O BRAÇO é da CONTA: 50/50 pelo hash do id do usuário (FNV-1a 32 bits, sal "construiu:", bit 16 — a mesma conta dos
 * outros A/B do app, sal próprio), gravado no aparelho por conta (`core-construiu-braco`, {hash da conta: braço})
 * na 1ª vez que a tela pergunta — não troca de braço depois. Sem conta (não deveria acontecer: a missão é do teste)
 * o id do aparelho.
 *
 * CHAVE REMOTA `construiu_ab` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `sino_paywall` / `fluxo_enxuto`:
 *   · "ab" (ou ausente/estranha, ou RevenueCat sem resposta) → o teste 50/50;
 *   · "a" / "b"                                              → todo mundo naquele braço (desliga o teste sem build).
 * A última resposta válida fica no aparelho (`core-construiu-ab`).
 * QA: `?construiu=a|b|ab|auto` grava uma força neste aparelho (`construiu-force`, fora dos prefixos varridos); "auto"
 * desfaz. Eventos da tela levam `braco_construiu: "a" | "b"`.
 */
import { idDoAparelho } from "@/lib/dia1-cheio";

export type ModoConstruiu = "ab" | "a" | "b";
export type BracoConstruiu = "a" | "b";

export const CHAVE_REMOTA_CONSTRUIU = "construiu_ab";
export const CHAVE_CONSTRUIU_APARELHO = "core-construiu-ab";
export const CHAVE_BRACO_CONSTRUIU = "core-construiu-braco";
export const CHAVE_FORCA_CONSTRUIU = "construiu-force";
export const PARAM_CONSTRUIU = "construiu";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoConstruiu | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "ab" || t === "a" || t === "b" ? t : null;
};
const bracoDe = (v: unknown): BracoConstruiu | null => (v === "a" || v === "b" ? v : null);

let remoto: ModoConstruiu | undefined;

/** Decisão pura: o valor explícito em qualquer offering (a `current` vence); nenhum = null. */
export function lerConstruiuRemoto(offerings: unknown): ModoConstruiu | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoConstruiu | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_CONSTRUIU]) ?? lido;
  return modoDe(o?.current?.metadata?.[CHAVE_REMOTA_CONSTRUIU]) ?? lido;
}

/** O revenuecat.ts chama isto a cada getOfferings() que respondeu. Só um valor válido muda algo. */
export function registrarConstruiuRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerConstruiuRemoto(offerings);
    if (!lido) return;
    remoto = lido;
    ls.set(CHAVE_CONSTRUIU_APARELHO, lido);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarConstruiuRemoto = (): void => { remoto = undefined; };

/** Grava `?construiu=a|b|ab|auto` deste aparelho. */
export function guardarForcaConstruiu(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_CONSTRUIU);
  } catch { return; }
  if (v === null) return;
  const t = v.trim().toLowerCase();
  if (t === "auto") ls.del(CHAVE_FORCA_CONSTRUIU);
  else if (modoDe(t)) ls.set(CHAVE_FORCA_CONSTRUIU, t);
}

/** O modo AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > "ab". */
export function modoConstruiu(): ModoConstruiu {
  return modoDe(ls.get(CHAVE_FORCA_CONSTRUIU)) ?? remoto ?? modoDe(ls.get(CHAVE_CONSTRUIU_APARELHO)) ?? "ab";
}

const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
};

/** Sorteio 50/50 determinístico pelo id da conta (sal próprio — não compartilha braço com outro teste). */
export function sortearBracoConstruiu(id: string): BracoConstruiu {
  return ((fnv(`construiu:${id}`) >>> 16) & 1) === 0 ? "a" : "b";
}

const lerGravados = (): Record<string, BracoConstruiu> => {
  try {
    const o = JSON.parse(ls.get(CHAVE_BRACO_CONSTRUIU) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => bracoDe(v))) as Record<string, BracoConstruiu>;
  } catch { return {}; }
};

/** O braço desta conta: fixo pela chave/força, senão o gravado, senão o sorteio (gravado na 1ª vez). */
export function bracoConstruiu(userId?: string | null): BracoConstruiu {
  const modo = modoConstruiu();
  if (modo !== "ab") return modo;
  const id = String(userId ?? "").trim() || idDoAparelho();
  const chave = fnv(`conta:${id}`).toString(36);
  const gravados = lerGravados();
  const gravado = gravados[chave];
  if (gravado) return gravado;
  const sorteado = sortearBracoConstruiu(id);
  ls.set(CHAVE_BRACO_CONSTRUIU, JSON.stringify({ ...gravados, [chave]: sorteado }));
  return sorteado;
}
