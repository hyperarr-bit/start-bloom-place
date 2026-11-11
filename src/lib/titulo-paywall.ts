/**
 * TESTE DE TÍTULO NO PAYWALL MINIMALISTA DO iPHONE (06/11) — só a chave e o texto; a tela é o PaywallIOS.
 * Hoje, com teste grátis: "Experimente / 3 dias grátis". No braço "com": "Organize seu dinheiro / 3 dias grátis".
 *
 * CHAVE REMOTA `titulo_paywall` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `sino_paywall` (lib/sino-paywall):
 *   · "off" (ou ausente, ou RevenueCat sem resposta) → o título e os eventos de hoje, byte a byte;
 *   · "on"                                            → quem escolheu a área vê o título novo (braço "com");
 *   · "ab"                                            → 50/50 pelo id do aparelho, sorteado 1x e gravado
 *                                                       (`core-titulo-braco`): estável entre aberturas.
 * A última resposta fica no aparelho (`core-titulo-paywall`). QA: `?titulo-paywall=on|off|ab|auto`.
 *
 * QUEM ENTRA: só quem ESCOLHEU a área na porta do funil. O `area` que o PaywallIOS recebe NÃO diz isso: o funil e o
 * gate caem em "dinheiro" sem área, e a porta "Tudo, sinceramente" é `area: "dinheiro"` (35 % de quem chega ao
 * paywall, 30/10–06/11). Quem manda é a resposta da porta, em `answers` (`areaDoTitulo`). O gate (answers vazio)
 * fica de fora. "corpo" fica de fora: "Organize seu corpo" não soa natural.
 *
 * O CAMPO `titulo_area: "com"|"sem"` (o braço SORTEADO — intenção de tratar) vai em `funnel_view step=offer`,
 * `paywall_oferta_vista`, no toque (`funnel_click app_paywall_cta`), em `app_sheet_success` e em
 * `folha_apple_resultado` — só quando o título em teste está mesmo na tela: layout minimalista e com teste grátis.
 * No modo 1.0.12 (paywall longo, sem este título) a chave é sempre "off".
 */
import { idDoAparelho } from "@/lib/dia1-cheio";
import { modo1012 } from "@/lib/modo-1012";
import { portaTudo } from "@/lib/funil-numeros";
import type { AreaKey } from "@/lib/funnel";

export type ModoTitulo = "off" | "on" | "ab";
export type BracoTitulo = "com" | "sem";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_TITULO = "titulo_paywall";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho). */
export const CHAVE_TITULO_APARELHO = "core-titulo-paywall";
/** O braço sorteado no modo "ab" (chave do aparelho: estável entre aberturas e ao logout). */
export const CHAVE_BRACO_TITULO = "core-titulo-braco";
/** Força de QA (fora dos prefixos que as vassouras do cache apagam). */
export const CHAVE_FORCA_TITULO = "titulo-paywall-force";
export const PARAM_TITULO = "titulo-paywall";

/** A 1ª linha do título por área. Área fora daqui = o título de hoje. */
const TITULO_DA_AREA: Partial<Record<AreaKey, string>> = {
  dinheiro: "Organize seu dinheiro",
  rotina: "Organize sua rotina",
  saude: "Organize sua saúde",
  metas: "Organize suas metas",
};
export const tituloDaArea = (area: AreaKey): string | null => TITULO_DA_AREA[area] ?? null;

/** "Organize seu dinheiro" mede 10,3× o tamanho da letra: a 32,5 px (375×812) ia pra 3 linhas e a 33,8 px (390×844)
 *  sobravam 2 px. Só ele ganha um teto pela largura da tela (coluna = 100vw − os 2 × 20 px do funil), −1 a −2 %;
 *  no 375×667 e nas áreas mais curtas vale o tamanho de sempre. */
export const estiloDoTituloDaArea = (titulo: string): { fontSize: string } | undefined =>
  titulo === TITULO_DA_AREA.dinheiro ? { fontSize: "min(var(--mini-titulo), calc((100vw - 40px) / 10.5))" } : undefined;

/** A área que a pessoa ESCOLHEU na porta e tem título, ou null (sem porta, "Tudo", gate, "corpo"). */
export function areaDoTitulo(area: AreaKey, respostas: Record<string, string> | null | undefined): AreaKey | null {
  if (respostas?.area !== area || portaTudo(respostas)) return null;
  return tituloDaArea(area) ? area : null;
}

let remoto: ModoTitulo | undefined;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoTitulo | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "off" || t === "on" || t === "ab" ? t : null;
};
const bracoDe = (v: unknown): BracoTitulo | null => (v === "com" || v === "sem" ? v : null);

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente/estranha em todas = "off". */
export function lerTituloRemoto(offerings: unknown): ModoTitulo {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoTitulo | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_TITULO]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_TITULO]) ?? lido;
  return lido ?? "off";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu. */
export function registrarTituloRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    remoto = lerTituloRemoto(offerings);
    ls.set(CHAVE_TITULO_APARELHO, remoto);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarTituloRemoto = (): void => { remoto = undefined; bracoDaFolha = null; };

/** Guarda `?titulo-paywall=on|off|ab|auto` (QA). */
export function guardarForcaTitulo(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_TITULO); } catch { return; }
  const t = (v ?? "").toLowerCase();
  if (modoDe(t)) ls.set(CHAVE_FORCA_TITULO, t);
  else if (t === "auto") ls.del(CHAVE_FORCA_TITULO);
}

/** O modo que vale AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > "off". */
export function modoTitulo(): ModoTitulo {
  if (modo1012()) return "off"; // modo 1.0.12: paywall longo, este título nem aparece
  const f = modoDe(ls.get(CHAVE_FORCA_TITULO));
  if (f) return f;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_TITULO_APARELHO)) ?? "off";
}

/** Sorteio 50/50 determinístico pelo id do aparelho (FNV-1a 32 bits, bit 16 — como o do sino, sal próprio). */
export function sortearBracoTitulo(id: string): BracoTitulo {
  let h = 0x811c9dc5;
  const s = `titulo:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "com" : "sem";
}

/** O braço desta pessoa, ou null (chave desligada ou fora do teste). No "ab", o gravado ou o sorteio (gravado na 1ª vez). */
export function bracoTitulo(area: AreaKey, respostas: Record<string, string> | null | undefined): BracoTitulo | null {
  try {
    if (!areaDoTitulo(area, respostas)) return null;
    const modo = modoTitulo();
    if (modo === "off") return null;
    if (modo === "on") return "com";
    const gravado = bracoDe(ls.get(CHAVE_BRACO_TITULO));
    if (gravado) return gravado;
    const sorteado = sortearBracoTitulo(idDoAparelho());
    ls.set(CHAVE_BRACO_TITULO, sorteado);
    return sorteado;
  } catch { return null; }
}

/* `folha_apple_resultado` nasce no revenuecat.ts, sem saber de paywall: o PaywallIOS anota aqui o braço em exposição. */
let bracoDaFolha: BracoTitulo | null = null;
export const anotarBracoDaFolha = (b: BracoTitulo | null): void => { bracoDaFolha = b; };
export const camposDoTituloNaFolha = (): { titulo_area?: BracoTitulo } => (bracoDaFolha ? { titulo_area: bracoDaFolha } : {});
