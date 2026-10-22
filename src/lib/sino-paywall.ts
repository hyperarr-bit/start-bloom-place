/**
 * A TELA DO SINO ANTES DO PAYWALL DO iPHONE (1.0.18, dono 22/10 — inspirada no Cal AI: "We'll send a reminder
 * before your trial ends"). Tela em pages/funis/ios/SinoIOS.tsx; o funil (ComecarW, passo "offer" no iPhone)
 * mostra ela UMA vez antes do PaywallIOS.
 *
 * A PROMESSA É VERDADEIRA: o aviso "Seu teste grátis termina amanhã" (lib/notificacoes, copyDoLembreteDoTeste,
 * id 920001) é pedido logo depois da compra em teste (PaywallIOS → pedirLembreteDoTeste) e armado se a permissão
 * de notificação estiver dada — por isso o botão da tela pede a permissão (se ainda não foi decidida).
 *
 * CHAVE REMOTA `sino_paywall` na metadata de QUALQUER offering do RevenueCat (a `current` vence), no padrão de
 * `att_momento` (lib/att-momento):
 *   · "off" (ou ausente, ou RevenueCat sem resposta) → o funil de hoje, byte a byte (nenhum evento muda);
 *   · "on"                                            → todo mundo vê o sino (braço "com");
 *   · "ab"                                            → 50/50 pelo id do aparelho, sorteado 1x e gravado
 *                                                       (`core-sino-braco`): estável entre aberturas.
 * A última resposta fica no aparelho (`core-sino-paywall`). Com "on"/"ab", `funnel_view step=offer`,
 * `paywall_oferta_vista` e `app_sheet_success` do paywall do funil levam `sino: "com"|"sem"` (o braço
 * SORTEADO — intenção de tratar) — compara paywall→folha→teste por braço.
 *
 * NADA REPETE: `core-sino-visto` é gravado na hora em que a tela aparece — o Voltar do paywall, a retomada
 * depois de reabrir o app e o deep link do resgate caem direto no paywall.
 *
 * QA: `?sino-paywall=on|off|ab|auto` (guarda neste aparelho, como `?paywall-minimalista=`).
 */
import { idDoAparelho } from "@/lib/dia1-cheio";

export type ModoSino = "off" | "on" | "ab";
export type BracoSino = "com" | "sem";
/** O nome da chave no metadata da offering do RevenueCat. */
export const CHAVE_REMOTA_SINO = "sino_paywall";
/** A última resposta do RevenueCat neste aparelho (chave do aparelho). */
export const CHAVE_SINO_APARELHO = "core-sino-paywall";
/** O braço sorteado no modo "ab" (chave do aparelho: estável entre aberturas e ao logout). */
export const CHAVE_BRACO_SINO = "core-sino-braco";
/** A tela do sino já apareceu neste aparelho (nunca mais aparece). */
export const CHAVE_SINO_VISTO = "core-sino-visto";
/** Força de QA (fora dos prefixos que as vassouras do cache apagam). */
export const CHAVE_FORCA_SINO = "sino-paywall-force";
export const PARAM_SINO = "sino-paywall";

let remoto: ModoSino | undefined;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

const modoDe = (v: unknown): ModoSino | null => {
  const t = String(v ?? "").trim().toLowerCase();
  return t === "off" || t === "on" || t === "ab" ? t : null;
};
const bracoDe = (v: unknown): BracoSino | null => (v === "com" || v === "sem" ? v : null);

/** Decisão pura: a chave em qualquer offering (a `current` vence); ausente/estranha em todas = "off". */
export function lerSinoRemoto(offerings: unknown): ModoSino {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoSino | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = modoDe(off?.metadata?.[CHAVE_REMOTA_SINO]) ?? lido;
  lido = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_SINO]) ?? lido;
  return lido ?? "off";
}

/** O revenuecat.ts chama isto com o resultado de cada getOfferings() que respondeu. */
export function registrarSinoRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    remoto = lerSinoRemoto(offerings);
    ls.set(CHAVE_SINO_APARELHO, remoto);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarSinoRemoto = (): void => { remoto = undefined; };

/** Guarda `?sino-paywall=on|off|ab|auto` (QA). */
export function guardarForcaSino(busca?: string): void {
  let v: string | null;
  try { v = new URLSearchParams(busca ?? window.location.search).get(PARAM_SINO); } catch { return; }
  const t = (v ?? "").toLowerCase();
  if (modoDe(t)) ls.set(CHAVE_FORCA_SINO, t);
  else if (t === "auto") ls.del(CHAVE_FORCA_SINO);
}

/** O modo que vale AQUI: força de QA > RevenueCat desta abertura > última resposta do aparelho > "off". */
export function modoSino(): ModoSino {
  const f = modoDe(ls.get(CHAVE_FORCA_SINO));
  if (f) return f;
  if (remoto) return remoto;
  return modoDe(ls.get(CHAVE_SINO_APARELHO)) ?? "off";
}

/** Sorteio 50/50 determinístico pelo id do aparelho (FNV-1a 32 bits, bit 16 — como o do att_momento, sal próprio). */
export function sortearBracoSino(id: string): BracoSino {
  let h = 0x811c9dc5;
  const s = `sino:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "com" : "sem";
}

/** O braço desta pessoa, ou null com a chave desligada. No "ab", o gravado ou o sorteio (gravado na 1ª vez). */
export function bracoSino(): BracoSino | null {
  const modo = modoSino();
  if (modo === "off") return null;
  if (modo === "on") return "com";
  const gravado = bracoDe(ls.get(CHAVE_BRACO_SINO));
  if (gravado) return gravado;
  const sorteado = sortearBracoSino(idDoAparelho());
  ls.set(CHAVE_BRACO_SINO, sorteado);
  return sorteado;
}

/** Os campos que vão nos eventos do paywall do funil: {} com a chave desligada (eventos de hoje, byte a byte). */
export function camposDoSino(): { sino?: BracoSino } {
  try { const b = bracoSino(); return b ? { sino: b } : {}; } catch { return {}; }
}

export const sinoJaVisto = (): boolean => ls.get(CHAVE_SINO_VISTO) != null;
export const marcarSinoVisto = (): void => ls.set(CHAVE_SINO_VISTO, "1");

/** A tela do sino aparece agora? Braço "com" e nunca vista neste aparelho. */
export function deveMostrarSino(): boolean {
  try { return bracoSino() === "com" && !sinoJaVisto(); } catch { return false; }
}
