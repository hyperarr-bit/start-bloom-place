/**
 * O AVISO DO PRESENTE NO APP (31/10, PLANO.md §c2 — novidades-guardadas/2026-10-31/upsell-2027-presente).
 *
 * Uma linha discreta na página VOCÊ (ou no menu do avatar, que é a página Você do site com a Home clássica), logo abaixo da conta/plano: "🎁 Leve alguém junto · R$ 14,90" com um ×. Nunca
 * na Home (regra do dono: nada de card novo no topo da Home). O toque pede o link da própria conta (presente-resgatar
 * `dia3_token`) e abre /presente/dar — a mesma página do e-mail do dia 3, Pix de 1 toque.
 *
 * Pra quem: vitalício pago na WEB (linha Pix ativa, vitalícia, com valor), 5 dias ou mais depois da compra (crítica r2: no
 * dia 3 já sai o e-mail "Leve alguém junto" — 2 cutucadas do mesmo presente na mesma tarde; com o aviso no dia 5, são dias
 * diferentes).
 * Quando some (crítica r2: o pedido era "1 vez, fechável"): no × ou no toque (pra sempre: `core-presente-aviso-v1` na conta +
 * no aparelho), ou na próxima visita — a marca guarda a SESSÃO em que apareceu (sessionStorage, por aba); outra sessão (outra
 * aba, outro dia, outro aparelho) não mostra de novo. Sem gênero, sem brinde, sem prazo falso.
 *
 * Chave PRESENTE_AVISO: "off" (padrão) | "web". Rollback = "off". QA: ?presente-aviso=on|off (guardado neste aparelho em
 * `presente-aviso-force`; ?presente-aviso=auto volta pra chave). Só o SITE mostra: o iPhone NUNCA (só numa build nova e
 * com o link externo da Apple BR) e o Android da loja também não (crítica r1: o modo "web+android" saiu — abrir o Pix no
 * navegador a partir do app da Play bate na regra de pagamentos da Play; volta só depois de conferir a regra), nem com o QA.
 */
import { plataformaApp, type PlataformaApp } from "@/lib/native-shell";

export type ModoAvisoPresente = "off" | "web";
export const PRESENTE_AVISO: ModoAvisoPresente = "off";

export const PARAM_QA_AVISO = "presente-aviso";
export const CHAVE_FORCA_AVISO = "presente-aviso-force";
/** Na conta (useUserData) e espelhada no aparelho (lib/chaves-do-aparelho): { fechado?: ISO, vistoEm?: ISO }. */
export const CHAVE_AVISO_PRESENTE = "core-presente-aviso-v1";
export const DIAS_PRA_AVISO = 5;
/** Rede de segurança pra marca sem sessão (não deveria existir): some 7 dias depois da 1ª vista. */
export const DIAS_VISIVEL = 7;
export const VALOR_AVISO = "R$ 14,90";
/** A 2ª linha do aviso (crítica r1: "O CORE pra sempre · R$ 14,90" logo abaixo de "Meu plano" parecia cobrança do plano dela). */
export const SUB_AVISO = `De presente pra alguém · ${VALOR_AVISO}`;
export const SITE_AVISO = "https://www.coreaplicativo.com.br";

const DIA = 86_400_000;

export type MarcaAviso = { fechado?: string | null; vistoEm?: string | null; via?: string | null; /** a sessão (aba) em que apareceu */ sessao?: string | null };

/** A sessão desta aba (sessionStorage; sem ele, a da página — uma recarga conta como outra visita, o que só esconde mais cedo). */
const CHAVE_SESSAO_AVISO = "presente-aviso-sessao";
let sessaoDaPagina: string | null = null;
export function sessaoDoAviso(): string {
  try {
    const s = sessionStorage.getItem(CHAVE_SESSAO_AVISO);
    if (s) return s;
    const novo = Math.random().toString(36).slice(2, 12);
    sessionStorage.setItem(CHAVE_SESSAO_AVISO, novo);
    return novo;
  } catch {
    if (!sessaoDaPagina) sessaoDaPagina = Math.random().toString(36).slice(2, 12);
    return sessaoDaPagina;
  }
}

/** A força do QA (?presente-aviso=on|off|auto), lida da URL e guardada no aparelho. */
export function forcaDoAviso(busca: string = typeof window === "undefined" ? "" : window.location.search): "on" | "off" | null {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get(PARAM_QA_AVISO); } catch { v = null; }
  try {
    if (v === "on" || v === "off") localStorage.setItem(CHAVE_FORCA_AVISO, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA_AVISO);
    const g = v === "on" || v === "off" ? v : localStorage.getItem(CHAVE_FORCA_AVISO);
    return g === "on" || g === "off" ? g : null;
  } catch {
    return v === "on" || v === "off" ? v : null;
  }
}

/** O aviso pode aparecer NESTA plataforma? (só o site: iPhone e Android da loja nunca, nem com o QA) */
export function avisoLigadoAqui(a: { modo?: ModoAvisoPresente; plataforma?: PlataformaApp; forca?: "on" | "off" | null } = {}): boolean {
  const plataforma = a.plataforma ?? plataformaApp();
  if (plataforma !== "web") return false;
  const forca = a.forca === undefined ? forcaDoAviso() : a.forca;
  if (forca === "off") return false;
  if (forca === "on") return true;
  return (a.modo ?? PRESENTE_AVISO) === "web";
}

export type LinhaDoAviso = { status?: string | null; payment_method?: string | null; billing_period?: string | null; plan?: string | null; amount_cents?: number | null; created_at?: string | null };

/** Vitalício pago na web há 3 dias ou mais? (o presente recebido vem como "presente", a loja como "play_store"/RC) */
export function compraQueLiberaAviso(linhas: LinhaDoAviso[], agora: number = Date.now()): boolean {
  return linhas.some((l) => {
    if (l.payment_method !== "pix" || l.status !== "active") return false;
    if (l.billing_period !== "lifetime" && l.plan !== "lifetime") return false;
    if (!(Number(l.amount_cents) > 0)) return false;
    const t = Date.parse(String(l.created_at ?? ""));
    return Number.isFinite(t) && agora - t >= DIAS_PRA_AVISO * DIA;
  });
}

/** A marca da conta ou do aparelho já esconde o aviso? (× / toque = pra sempre; já apareceu numa OUTRA sessão = some) */
export function avisoEscondido(marca: MarcaAviso | null | undefined, agora: number = Date.now(), sessao: string | null = null): boolean {
  if (!marca) return false;
  if (marca.fechado) return true;
  if (marca.vistoEm && marca.sessao && sessao && marca.sessao !== sessao) return true;
  const visto = Date.parse(String(marca.vistoEm ?? ""));
  return Number.isFinite(visto) && agora - visto >= DIAS_VISIVEL * DIA;
}

/** A marca do aparelho (o espelho: o aviso não pisca de volta antes da conta hidratar). */
export function lerMarcaDoAparelho(): MarcaAviso | null {
  try { const raw = localStorage.getItem(CHAVE_AVISO_PRESENTE); return raw ? JSON.parse(raw) as MarcaAviso : null; } catch { return null; }
}
export function gravarMarcaDoAparelho(m: MarcaAviso): void {
  try { localStorage.setItem(CHAVE_AVISO_PRESENTE, JSON.stringify(m)); } catch { /* fica a da conta */ }
}
