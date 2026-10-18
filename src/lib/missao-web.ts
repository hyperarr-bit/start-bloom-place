/**
 * FUNIL DA MISSÃO NA WEB (protótipo 18/10) — o app de verdade, sem cadastro, direto no tutorial da missão.
 *
 *   /missao (missao.html, HTML puro) → "O que mais atrapalha você hoje?" → tela da dor → o CORE monta NO MESMO
 *   documento em /missao/app?area=… → esta lib liga o modo CONVIDADO DA MISSÃO e leva pro módulo da área → a dose 1
 *   real (MissaoDosesNaWeb/PassoDoDia, braço A da 1.0.16) → festa → oferta (src/missao/OfertaMissao.tsx).
 *
 * O modo convidado da missão é uma marca NESTE navegador (localStorage `core-missao-web`). Com ela:
 *   · ProtectedRoute deixa o convidado da WEB entrar nas rotas do app (os dados caem em guest:* — use-user-data —,
 *     que migram sozinhos pra conta quando a sessão do pagamento nasce);
 *   · missaoDosesLigada() = true; MissaoDosesNaWeb renderiza sem `user`; PassoDoDia não trata como convidado
 *     (senão os quizzes "Montar …" não abrem);
 *   · as forças que a v1016 já tem pra QA ficam ligadas (Montar Finanças/Rotina na web, braço A, intro do módulo).
 * Nunca no app da loja (isNativeShell) — lá a missão já é a do teste grátis.
 *
 * Chave: FUNIL_MISSAO (padrão OFF). QA: `?funil-missao=on`. No servidor de desenvolvimento, sempre ligado.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoChave = "on" | "off";
export const FUNIL_MISSAO: ModoChave = "off";
export const PARAM_QA_MISSAO = "funil-missao";
export const CHAVE_FORCA_MISSAO = "funil-missao-force";
export const CHAVE_MISSAO_WEB = "core-missao-web";

export type AreaMissaoWeb = "dinheiro" | "rotina" | "corpo" | "metas" | "tudo";
export const AREAS_MISSAO_WEB: AreaMissaoWeb[] = ["dinheiro", "rotina", "corpo", "metas", "tudo"];

export type EstadoMissaoWeb = {
  v: 1;
  area: AreaMissaoWeb;
  /** quando o app abriu (ms) */
  em: number;
  /** a sessão do funil (a mesma do HTML leve) */
  sessao: string;
  /** a dose 1 foi contada (o app conta no número do Montar) */
  dose1?: number;
  /** a festa "Dia 1 de 3 feito" apareceu (o "aha") e o texto dela (o recibo da oferta usa) */
  festa?: { em: number; texto: string } | null;
  /** pagou (ms) e o que pagou */
  pago?: { em: number; ofertas: string[] } | null;
  /** o e-mail salvo depois de pagar */
  email?: string | null;
};

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

let memoria: EstadoMissaoWeb | null = null;
let forcaMemoria: ModoChave | null = null;

export function funilMissaoLigado(busca: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  if (isNativeShell()) return false;
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get(PARAM_QA_MISSAO); } catch { /* noop */ }
  if (v === "on" || v === "off") { forcaMemoria = v; ls.set(CHAVE_FORCA_MISSAO, v); }
  const f = forcaMemoria ?? (ls.get(CHAVE_FORCA_MISSAO) as ModoChave | null);
  if (f === "on" || f === "off") return f === "on";
  if (import.meta.env.DEV) return true;
  return FUNIL_MISSAO === "on";
}

export function lerMissaoWeb(): EstadoMissaoWeb | null {
  if (memoria) return memoria;
  try {
    const raw = ls.get(CHAVE_MISSAO_WEB);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoMissaoWeb;
    if (e && e.v === 1 && AREAS_MISSAO_WEB.includes(e.area)) { memoria = e; return e; }
  } catch { /* noop */ }
  return null;
}

export const EVENTO_MISSAO_WEB = "missao-web:mudou";
export function gravarMissaoWeb(e: EstadoMissaoWeb): EstadoMissaoWeb {
  memoria = e;
  ls.set(CHAVE_MISSAO_WEB, JSON.stringify(e));
  try { window.dispatchEvent(new Event(EVENTO_MISSAO_WEB)); } catch { /* noop */ }
  return e;
}
export function apagarMissaoWeb(): void { memoria = null; ls.del(CHAVE_MISSAO_WEB); }

/** O convidado da missão está ativo NESTE navegador (e o funil ligado). */
export function missaoWebConvidada(): boolean {
  if (isNativeShell()) return false;
  if (!lerMissaoWeb()) return false;
  return funilMissaoLigado();
}

/** As forças da v1016 que o tutorial precisa na web (as mesmas chaves dos links de QA). */
export function ligarForcasDaMissao(): void {
  ls.set("montar-financas-force", "on");
  ls.set("montar-rotina-force", "on");
  ls.set("intro-modulo-force", "on");
  ls.set("dia1-cheio-force", "ab");
  ls.set("core-dia1-braco", "A");
}

/** A área do funil → a área do funil do app (a mesma lista que a missão lê: core-funnel-area). */
export const AREA_DO_APP: Record<AreaMissaoWeb, string> = {
  dinheiro: "dinheiro", rotina: "rotina", corpo: "corpo", metas: "metas", tudo: "dinheiro",
};
