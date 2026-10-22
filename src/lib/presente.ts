/**
 * UPSELL DE PRESENTE (21/10) — a chave, as copies e as regras puras do lado do site.
 *
 * Depois do "pagamento confirmado" do vitalício (R$ 27,90) no /inicio e no /hoje: "Dê o CORE pra sempre pra quem você
 * ama por R$ 14,90" (Pix Asaas `pv149`). Pago → um cartão com o link /presente/<código> pra mandar no WhatsApp. Quem
 * abre o link cria a conta e ganha o vitalício (função presente-resgatar). "Agora não" → o DOWNSELL "Seu plano de 30
 * dias pra organizar a vida" (R$ 9,90, `pk99` — o conteúdo do Kit Primeiro Mês), só pra área Dinheiro por enquanto.
 * Servidor: supabase/functions/_shared/presente.ts.
 *
 * LIGA PELA CHAVE CENTRAL: OFERTAS_POS_COMPRA = "presente" (src/lib/ofertas-pos-compra.ts; padrão "off" = os funis
 * /inicio e /hoje ficam exatamente como estão, travado nos testes). Com "2027" o presente NÃO aparece.
 * QA sem mexer em ninguém: `?ofertas=presente` (ou o antigo `?presente=on`; `?ofertas=off` tira).
 * O downsell do plano de 30 dias também roda depois do "Agora não" do 2027 (FluxoPresente com `so30Dias`).
 */
import type { AreaKey } from "@/lib/funnel";
import { FORCA_PRESENTE, OFERTAS_POS_COMPRA, _zerarForcaOfertas, modoOfertas } from "@/lib/ofertas-pos-compra";
import { AREAS_DO_PLANO, areaDoPlano, type AreaDoPlano } from "@/lib/plano-30-areas";

export type ModoChavePresente = "on" | "off";
/** 21/10 (integração): sai da chave central OFERTAS_POS_COMPRA (src/lib/ofertas-pos-compra.ts) — "presente" liga. */
export const UPSELL_PRESENTE: ModoChavePresente = OFERTAS_POS_COMPRA === "presente" ? "on" : "off";
export const PARAM_QA_PRESENTE = FORCA_PRESENTE.param;
export const CHAVE_FORCA_PRESENTE = FORCA_PRESENTE.chave;
/** O downsell do "Agora não" (plano de 30 dias, R$ 9,90). Só vale com o presente ligado (ou depois do "Agora não" do 2027). */
export const DOWNSELL_PLANO30: boolean = true;

/** Só testes. */
export const _zerarForcaPresente = (): void => { _zerarForcaOfertas(); };

/** O upsell de presente está ligado AQUI? = a chave central em "presente" (QA `?ofertas=presente` ou `?presente=on|off`).
 *  Com o 2027 ligado, o presente NUNCA liga (no máximo 2 ofertas depois do Pix). */
export function presenteLigado(busca: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  return modoOfertas(busca) === "presente";
}

/* ───────────────────────── ofertas e valores ───────────────────────── */

export const OFERTA_PRESENTE = "pv149" as const;
export const VALOR_PRESENTE = 14.9;
export const VALOR_VITALICIO_CHEIO = 27.9;
export const OFERTA_PLANO30 = "pk99" as const;
export const VALOR_PLANO30 = 9.9;

/* ───────────────────────── copy (o dono escolhe 1 das 2) ───────────────────────── */

export const COPIES_PRESENTE = {
  1: { titulo: "Leve alguém", destaque: "junto", emoji: "💛", sub: "Dê o CORE pra sempre pra quem você ama por" },
  2: { titulo: "Um presente que dura", destaque: "pra sempre", emoji: "", sub: "O CORE vitalício pra alguém especial por" },
} as const;
export type CopyPresente = keyof typeof COPIES_PRESENTE;
export const COPY_PRESENTE: CopyPresente = 1;

/** As 2 versões do downsell (mockups k-visual-* e k-curta-*). */
export type VersaoPlano30 = "visual" | "curta";
export const VERSAO_PLANO30: VersaoPlano30 = "visual";

/* ───────────────────────── o link e a mensagem ───────────────────────── */

export const SITE = "https://www.coreaplicativo.com.br";
export const linkDoPresente = (codigo: string): string => `${SITE}/presente/${codigo}`;
/** O link curto que aparece no cartão (sem https://www.). */
export const linkCurto = (codigo: string): string => `coreaplicativo.com.br/presente/${codigo}`;

/** A mensagem do WhatsApp — sem "ele/ela": serve pra amigo, amiga, namorado, namorada. */
export function mensagemDoPresente(codigo: string, de: string | null): string {
  const quem = (de ?? "").trim();
  return `${quem ? `${quem} te deu` : "Ganhei pra você"} o CORE pra sempre 💛\nAbre aqui pra ativar o seu: ${linkDoPresente(codigo)}`;
}
export const urlWhatsApp = (texto: string): string => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/** O nome no cartão (o mesmo limite do servidor: 40 letras, sem tag). */
export const nomeLimpo = (v: string): string => v.replace(/[<>{}\\]/g, "").replace(/\s+/g, " ").trimStart().slice(0, 40);
/** 1º nome pra pré-preencher o cartão. */
export const primeiroNome = (v: string | null | undefined): string => String(v ?? "").trim().split(/\s+/)[0] ?? "";

/* ───────────────────────── o downsell por área ───────────────────────── */

/** 21/10 (tarde, dono: "faz tudo hoje"): TODAS as áreas têm plano (src/lib/plano-30-areas.ts) — sem área = "Tudo". */
export const AREAS_COM_PLANO30: readonly AreaDoPlano[] = AREAS_DO_PLANO;
export const temPlano30 = (area: AreaKey | null | undefined): boolean => AREAS_COM_PLANO30.includes(areaDoPlano(area));

/* ───────────────────────── o fluxo (estado puro) ───────────────────────── */

export type EtapaPresente = "oferta" | "pix" | "cartao" | "plano30" | "plano30pix" | "fim";
export type PixDoFluxo = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string | null; criadoEm: number; oferta: string };
export type EstadoPresente = {
  v: 1;
  /** o pedido do vitalício que abriu o fluxo (um fluxo por compra) */
  compra: string;
  etapa: EtapaPresente;
  pix: PixDoFluxo | null;
  /** o pedido do presente pago */
  pedido: string | null;
  codigo: string | null;
  de: string | null;
  /** o pedido do plano de 30 dias pago */
  plano30: string | null;
};
export const novoEstadoPresente = (compra: string): EstadoPresente =>
  ({ v: 1, compra, etapa: "oferta", pix: null, pedido: null, codigo: null, de: null, plano30: null });

/** "Agora não": o downsell (se houver pra área) ou o fim. */
export const depoisDoAgoraNao = (area: AreaKey | null | undefined, downsell: boolean = DOWNSELL_PLANO30): EtapaPresente =>
  downsell && temPlano30(area) ? "plano30" : "fim";

/** Fora do prefixo core-* de propósito: a vassoura do cache não pode apagar o fluxo na volta do app do banco (como o hoje-estado-v1). */
export const CHAVE_ESTADO_PRESENTE = "presente-fluxo-v1";
let memoria: EstadoPresente | null = null;
/** Só testes. */
export const _zerarEstadoPresente = (): void => { memoria = null; };
export function lerEstadoPresente(compra: string): EstadoPresente {
  let e: EstadoPresente | null = memoria;
  if (!e) {
    try { const raw = localStorage.getItem(CHAVE_ESTADO_PRESENTE); if (raw) e = JSON.parse(raw) as EstadoPresente; } catch { e = null; }
  }
  return e && e.v === 1 && e.compra === compra ? e : novoEstadoPresente(compra);
}
export function gravarEstadoPresente(e: EstadoPresente): void {
  memoria = e;
  try { localStorage.setItem(CHAVE_ESTADO_PRESENTE, JSON.stringify(e)); } catch { /* fica o heap */ }
}
