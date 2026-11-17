/**
 * INDIQUE E GANHE — a ENTRADA FIXA no app NA WEB (17/11, dono: onde a pessoa acha o convite depois do "Agora não").
 *
 * Uma linha discreta "💗 Indique e ganhe" na página Você do SITE (as 2 caras da aba Você e o menu do avatar), logo abaixo do
 * presente — nunca na Home. 17/11 (subida): pra QUALQUER cliente pagante logado (web, Pix, cartão ou loja — regra `ehPagante`,
 * a mesma do servidor), não só pra quem comprou na /oferta. O toque pede à função `afiliados` (indique_conta, com o login) o
 * painel da pessoa (o link nasce na hora, sem senha) e abre /indique/<token>.
 *
 * iPhone e Android da loja NUNCA, nem com o QA: é dinheiro por indicação de uma compra feita fora da loja (regras da Apple e da Play).
 *
 * Chave INDIQUE_ENTRADA: "off" (padrão) | "web". QA: ?indique-entrada=on|off (guardado neste aparelho; ?indique-entrada=auto volta
 * pra chave). Precisa do servidor ligado (env INDIQUE_WEB=on); sem ele, o toque mostra "não abriu agora".
 *
 * ENSINAR O CAMINHO (17/11, subida): o "Novo" de 1 vez só (src/components/indique/AvisoNovoIndique) — um balão na aba Você (Home
 * nova) ou na sua inicial do topo (Home clássica), um pontinho no mesmo lugar e o selo "Novo" na própria linha. Nunca card na Home.
 * O estado mora NESTE aparelho (localStorage, por conta): é só conveniência — sem storage, nada aparece (nunca repete).
 */
import { plataformaApp, type PlataformaApp } from "@/lib/native-shell";
import { ehPagante, type LinhaAssinatura } from "../../supabase/functions/_shared/indique";

export type ModoEntradaIndique = "off" | "web";
export const INDIQUE_ENTRADA: ModoEntradaIndique = "web";
export const TEXTO_ENTRADA_INDIQUE = "Indique e ganhe";
const CHAVE_FORCA = "indique-entrada-force";

export function forcaDaEntradaIndique(busca: string = typeof window === "undefined" ? "" : window.location.search): "on" | "off" | null {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get("indique-entrada"); } catch { v = null; }
  try {
    if (v === "on" || v === "off") localStorage.setItem(CHAVE_FORCA, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA);
    const g = v === "on" || v === "off" ? v : localStorage.getItem(CHAVE_FORCA);
    return g === "on" || g === "off" ? g : null;
  } catch {
    return v === "on" || v === "off" ? v : null;
  }
}

/** A entrada aparece NESTA plataforma? (só o site) */
export function entradaIndiqueAqui(a: { modo?: ModoEntradaIndique; plataforma?: PlataformaApp; forca?: "on" | "off" | null } = {}): boolean {
  const plataforma = a.plataforma ?? plataformaApp();
  if (plataforma !== "web") return false;
  const forca = a.forca === undefined ? forcaDaEntradaIndique() : a.forca;
  if (forca === "off") return false;
  if (forca === "on") return true;
  return (a.modo ?? INDIQUE_ENTRADA) === "web";
}

export type LinhaCompra = LinhaAssinatura;
/** Cliente pagante? (a MESMA regra do servidor: _shared/indique.ts, ehPagante) */
export const clientePagante = (linhas: LinhaCompra[] | null | undefined, agora?: Date): boolean => ehPagante(linhas, agora);
/** as colunas que a regra lê (a pessoa lê as próprias linhas de `subscriptions` pela RLS) */
export const COLUNAS_PAGANTE = "status, payment_method, billing_period, plan, amount_cents, current_period_start, current_period_end";

/* ───────── o "Novo" de 1 vez só ───────── */

/** balao = o balão já apareceu · voce = a pessoa já viu a linha na página Você (em ms) · aberto = já tocou na linha */
export type MarcaNovoIndique = { balao?: boolean; voce?: number; aberto?: boolean };
export const EVENTO_NOVO_INDIQUE = "indique-novo";
/** o selo "Novo" da linha some ao tocar, ou 10 dias depois de ela ter visto a linha */
export const DIAS_SELO_NOVO = 10;
const chaveNovo = (uid: string) => `indique-novo:${uid}`;

export function lerMarcaNovo(uid: string): MarcaNovoIndique | null {
  try {
    const s = localStorage.getItem(chaveNovo(uid));
    if (!s) return {};
    const j = JSON.parse(s) as MarcaNovoIndique;
    return j && typeof j === "object" ? j : {};
  } catch { return null; } // sem storage = não sabemos se já viu: nada aparece
}
export function gravarMarcaNovo(uid: string, parcial: MarcaNovoIndique): void {
  try {
    const atual = lerMarcaNovo(uid) ?? {};
    localStorage.setItem(chaveNovo(uid), JSON.stringify({ ...atual, ...parcial }));
  } catch { /* storage opcional */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_NOVO_INDIQUE)); } catch { /* noop */ }
}

/** o balão "Novo: Indique e ganhe" — 1 vez só, só se ela ainda não achou a linha sozinha */
export const balaoIndiqueDevido = (m: MarcaNovoIndique | null): boolean => !!m && !m.balao && !m.voce && !m.aberto;
/** o pontinho na aba Você / na inicial do topo — até ela ver a linha */
export const pontoIndiqueDevido = (m: MarcaNovoIndique | null): boolean => !!m && !m.voce && !m.aberto;
/** o selo "Novo" na própria linha — até tocar (ou DIAS_SELO_NOVO depois de ver) */
export const seloNovoNaLinha = (m: MarcaNovoIndique | null, agora: number = Date.now()): boolean =>
  !!m && !m.aberto && (!m.voce || agora - m.voce < DIAS_SELO_NOVO * 86400e3);
