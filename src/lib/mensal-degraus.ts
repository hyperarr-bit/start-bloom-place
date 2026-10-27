/**
 * O 2º DEGRAU DA RECUSA E A FOLHA "O QUE TE FEZ PARAR?" (1.0.18, dono 22/10) — as CHAVES e as marcas de "já vi".
 * A tela do mensal (2º degrau e o "Achei caro") mora em components/paywall/MensalHeroi.tsx.
 *
 * O mensal 19,90 só existe com a offering `mensal_19` no RevenueCat (core_mensal_19 — hoje NÃO existe na Apple): sem ela,
 * carregarOfertaMensal19 devolve null e nada aparece, com a chave ligada ou não. Só iPhone.
 *
 * ── 1) 2º DEGRAU DA RECUSA — `recusa_degrau2` ("off" | "on", padrão OFF) ──────────────────────────────────────────
 *   Quem continua com o cartão recusado (billing retry) depois do card da recusa (lib/card-recusa):
 *     · COM acesso (carência): só 7+ dias depois de o card ter aparecido (`core-card-recusa-visto-em`) — sem o card
 *       visto, nada (o card é o 1º degrau);
 *     · SEM acesso (a carência acabou e a Apple segue tentando = o bloqueio do cartão recusado): na abertura seguinte,
 *       com ou sem card antes.
 *   Nunca na mesma abertura do card (o card ganha), nunca por cima de uma guia. 1x POR RECUSA (marca
 *   `core-recusa-degrau2-visto` = o billingIssueDetectedAt, gravada na hora em que a tela aparece: reabrir nunca
 *   repete; uma recusa nova, outra data, pode mostrar de novo). Quem trocou pro mensal no card não vê.
 *   É a MESMA troca do card: core_mensal_19 é DOWNGRADE no grupo (nível 2, abaixo dos anuais) e vale na próxima
 *   renovação = a próxima tentativa da Apple. NADA libera na hora — nos dois casos. Quem saiu do billing retry de vez
 *   (a Apple desistiu; o RevenueCat marca unsubscribeDetectedAt) não tem mais "problema de cobrança": cai no bloqueio
 *   de sempre (PresenteNoBloqueio → 69,90 → escada do 19,90 "Cobrado hoje", acesso na hora). Ver lib/card-recusa.
 *   QA: `?recusa-degrau2=on|off|auto|agora[,recomecar]` — `agora` liga e dispensa a espera de 7 dias e o card visto.
 *
 * ── 2) "O QUE TE FEZ PARAR?" — `motivos_folha` ("off" | "on" | "ab", padrão OFF) ────────────────────────────────────
 *   (Dono 22/10, estilo Enxovaly/Cal AI; substitui o "3º back mensal".) No paywall do FUNIL (não no gate): fechou a
 *   folha da Apple do anual com teste → ANTES do presente 69,90, uma folha de baixo com o motivo (1 toque), cada um
 *   com a sua resposta (components/paywall/FolhaMotivos.tsx):
 *     · "Achei caro"                         → o presente 69,90 com os dias grátis (o fluxo de hoje); recusou e a
 *                                              offering `mensal_19` existe → o mensal 19,90 (MensalHeroi);
 *     · "Tenho medo de esquecer de cancelar" → o aviso 1 dia antes (só se ele vai mesmo sair) + cancelar nos Ajustes,
 *                                              e o botão volta pro teste do anual (a MESMA compra do paywall). Sem desconto;
 *     · "Quero conhecer o app antes"         → "São N dias grátis pra conhecer tudo" + o mesmo teste;
 *     · "Não tenho cartão na conta Apple"    → o passo a passo dos Ajustes + "Tentar de novo" (nada de Pix/site);
 *     · "Outro motivo"                       → o presente 69,90;
 *     · "Voltar ao plano"                    → o paywall.
 *   1x por sessão do paywall (a folha do anual fechada de novo cai no cartão de sempre). "off" = hoje (o 69,90 direto).
 *   "ab" = 50/50 pelo id do aparelho, sorteado 1x e gravado (`core-motivos-braco`); o braço ("com"|"sem") vai nos
 *   eventos do paywall do funil (`motivos`) e nos motivo_*.
 *   QA: `?motivos-folha=on|off|ab|auto`.
 *
 * As duas: metadata de QUALQUER offering do RevenueCat (a `current` vence), a última resposta guardada no aparelho
 * (o app pode precisar antes do getOfferings desta abertura responder). Força de QA > RevenueCat > aparelho > "off".
 */
import { idDoAparelho } from "@/lib/dia1-cheio";
import { modo1012 } from "@/lib/modo-1012";
import { isNativeShell, plataformaApp } from "@/lib/native-shell";
import { CHAVE_CARD_RECUSA_VISTO_EM, cardRecusaJaVisto, marcaDaRecusa } from "@/lib/card-recusa";

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};
type Off = { metadata?: Record<string, unknown> } | null | undefined;
/** Lê uma chave em todas as offerings (a `current` vence); null = nenhuma disse um valor válido. */
function lerDaMetadata<T extends string>(offerings: unknown, chave: string, valido: (v: unknown) => T | null): T | null {
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: T | null = null;
  for (const off of Object.values(o?.all ?? {})) if (off !== o?.current) lido = valido(off?.metadata?.[chave]) ?? lido;
  return valido(o?.current?.metadata?.[chave]) ?? lido;
}
const texto = (v: unknown) => String(v ?? "").trim().toLowerCase();

/* ═════════════════════════════ 1) 2º DEGRAU DA RECUSA ═════════════════════════════ */
export type ModoDegrau2 = "off" | "on";
/** A constante local. LIGAR/ROLLBACK sem RevenueCat = trocar aqui + build. Padrão OFF. */
export const RECUSA_DEGRAU2: ModoDegrau2 = "off";
export const CHAVE_REMOTA_DEGRAU2 = "recusa_degrau2";
export const CHAVE_DEGRAU2_APARELHO = "core-recusa-degrau2";
/** A recusa (billingIssueDetectedAt) cujo 2º degrau já apareceu (chave do aparelho). */
export const CHAVE_DEGRAU2_VISTO = "core-recusa-degrau2-visto";
export const CHAVE_FORCA_DEGRAU2 = "recusa-degrau2-force";
export const PARAM_DEGRAU2 = "recusa-degrau2";
/** Quanto tempo depois do card da recusa (com acesso) o 2º degrau pode aparecer. */
export const DIAS_DEPOIS_DO_CARD = 7;

const modoDegrau2De = (v: unknown): ModoDegrau2 | null => { const t = texto(v); return t === "on" || t === "off" ? t : null; };
let remotoDegrau2: ModoDegrau2 | undefined;

export const lerDegrau2Remoto = (offerings: unknown): ModoDegrau2 | null => lerDaMetadata(offerings, CHAVE_REMOTA_DEGRAU2, modoDegrau2De);
export function registrarDegrau2Remoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerDegrau2Remoto(offerings);
    remotoDegrau2 = lido ?? RECUSA_DEGRAU2;
    if (lido) ls.set(CHAVE_DEGRAU2_APARELHO, lido);
    else ls.del(CHAVE_DEGRAU2_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarDegrau2Remoto = (): void => { remotoDegrau2 = undefined; };

/** Grava `?recusa-degrau2=on|off|auto|agora[,recomecar]` deste aparelho. */
export function guardarForcaDegrau2(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_DEGRAU2);
  } catch { return; }
  if (v === null) return;
  const partes = v.toLowerCase().split(",").map((s) => s.trim());
  if (partes.includes("recomecar")) ls.del(CHAVE_DEGRAU2_VISTO);
  if (partes.includes("agora")) ls.set(CHAVE_FORCA_DEGRAU2, "agora");
  else if (partes.includes("on")) ls.set(CHAVE_FORCA_DEGRAU2, "on");
  else if (partes.includes("off")) ls.set(CHAVE_FORCA_DEGRAU2, "off");
  else if (partes.includes("auto")) ls.del(CHAVE_FORCA_DEGRAU2);
}

export function modoDegrau2(): ModoDegrau2 {
  const f = ls.get(CHAVE_FORCA_DEGRAU2);
  if (f === "agora") return "on";
  const fm = modoDegrau2De(f);
  if (fm) return fm;
  if (remotoDegrau2) return remotoDegrau2;
  return modoDegrau2De(ls.get(CHAVE_DEGRAU2_APARELHO)) ?? RECUSA_DEGRAU2;
}
/** Só iPhone (o mensal 19 só existe na App Store). */
export const degrau2Ligado = (): boolean => isNativeShell() && plataformaApp() === "ios" && modoDegrau2() === "on";

export const degrau2JaVisto = (detectadoEm: string | null | undefined): boolean => ls.get(CHAVE_DEGRAU2_VISTO) === marcaDaRecusa(detectadoEm);
/** Gravado na hora em que a tela APARECE (e quando a pessoa troca pro mensal no card): reabrir nunca repete. */
export const marcarDegrau2Visto = (detectadoEm: string | null | undefined): void => ls.set(CHAVE_DEGRAU2_VISTO, marcaDaRecusa(detectadoEm));

/**
 * A recusa está no ponto do 2º degrau? (só a régua do tempo/card — a chave, a tela livre e a offering são conferidas
 * por quem chama). Sem acesso: sim. Com acesso: o card desta recusa apareceu há 7+ dias.
 */
export function recusaNoPontoDoDegrau2(p: { comAcesso: boolean; detectadoEm?: string | null }, agora: number = Date.now()): boolean {
  if (ls.get(CHAVE_FORCA_DEGRAU2) === "agora") return true;
  if (!p.comAcesso) return true;
  if (!cardRecusaJaVisto(p.detectadoEm)) return false;
  const em = Number(ls.get(CHAVE_CARD_RECUSA_VISTO_EM) || 0);
  return em > 0 && agora - em >= DIAS_DEPOIS_DO_CARD * 86_400_000;
}

/* ═════════════════════════════ 2) "O QUE TE FEZ PARAR?" ═════════════════════════════ */
export type ModoMotivos = "off" | "on" | "ab";
export type BracoMotivos = "com" | "sem";
/** A constante local. Padrão OFF. */
export const MOTIVOS_FOLHA: ModoMotivos = "off";
export const CHAVE_REMOTA_MOTIVOS = "motivos_folha";
export const CHAVE_MOTIVOS_APARELHO = "core-motivos-folha";
/** O braço sorteado no modo "ab" (chave do aparelho: estável entre aberturas e ao logout). */
export const CHAVE_BRACO_MOTIVOS = "core-motivos-braco";
export const CHAVE_FORCA_MOTIVOS = "motivos-folha-force";
export const PARAM_MOTIVOS = "motivos-folha";

const modoMotivosDe = (v: unknown): ModoMotivos | null => { const t = texto(v); return t === "off" || t === "on" || t === "ab" ? t : null; };
const bracoDe = (v: unknown): BracoMotivos | null => (v === "com" || v === "sem" ? v : null);
let remotoMotivos: ModoMotivos | undefined;

export const lerMotivosRemoto = (offerings: unknown): ModoMotivos | null => lerDaMetadata(offerings, CHAVE_REMOTA_MOTIVOS, modoMotivosDe);
export function registrarMotivosRemoto(offerings: unknown): void {
  try {
    if (!offerings || typeof offerings !== "object") return;
    const lido = lerMotivosRemoto(offerings);
    remotoMotivos = lido ?? MOTIVOS_FOLHA;
    if (lido) ls.set(CHAVE_MOTIVOS_APARELHO, lido);
    else ls.del(CHAVE_MOTIVOS_APARELHO);
  } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarMotivosRemoto = (): void => { remotoMotivos = undefined; };

/** Grava `?motivos-folha=on|off|ab|auto` deste aparelho. */
export function guardarForcaMotivos(busca?: string | URLSearchParams): void {
  let v: string | null;
  try {
    const p = busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search);
    v = p.get(PARAM_MOTIVOS);
  } catch { return; }
  if (v === null) return;
  const t = texto(v);
  if (modoMotivosDe(t)) ls.set(CHAVE_FORCA_MOTIVOS, t);
  else if (t === "auto") ls.del(CHAVE_FORCA_MOTIVOS);
}

export function modoMotivos(): ModoMotivos {
  if (modo1012()) return "off"; // 1.0.21 modo 1.0.12: folha fechada → 2ª chance, sem "O que te fez parar?"
  const f = modoMotivosDe(ls.get(CHAVE_FORCA_MOTIVOS));
  if (f) return f;
  if (remotoMotivos) return remotoMotivos;
  return modoMotivosDe(ls.get(CHAVE_MOTIVOS_APARELHO)) ?? MOTIVOS_FOLHA;
}

/** Sorteio 50/50 determinístico pelo id do aparelho (FNV-1a 32 bits, bit 16 — como o do sino, sal próprio). */
export function sortearBracoMotivos(id: string): BracoMotivos {
  let h = 0x811c9dc5;
  const s = `motivos:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 16) & 1) === 0 ? "com" : "sem";
}

/** O braço desta pessoa, ou null com a chave desligada. No "ab", o gravado ou o sorteio (gravado na 1ª vez). */
export function bracoMotivos(): BracoMotivos | null {
  const modo = modoMotivos();
  if (modo === "off") return null;
  if (modo === "on") return "com";
  const gravado = bracoDe(ls.get(CHAVE_BRACO_MOTIVOS));
  if (gravado) return gravado;
  const sorteado = sortearBracoMotivos(idDoAparelho());
  ls.set(CHAVE_BRACO_MOTIVOS, sorteado);
  return sorteado;
}

/** Os campos que vão nos eventos do paywall do funil: {} com a chave desligada (eventos de hoje, byte a byte). */
export function camposDosMotivos(): { motivos?: BracoMotivos } {
  try { const b = bracoMotivos(); return b ? { motivos: b } : {}; } catch { return {}; }
}
