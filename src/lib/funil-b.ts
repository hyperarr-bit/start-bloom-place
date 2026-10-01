/**
 * FUNIL B — "O app é o funil" (30/09/2026). A chave, o braço e o que viaja na URL.
 *
 * A decisão do dono (30/09): "a oferta na web não tá aguentando escala. Vou
 * testar amanhã aquele funil diferente, só na kenny g." O plano inteiro está
 * em scratchpad/funil-novo-plano/plano.md (seção 2). Em uma frase: a porta
 * abre o app de verdade; o que ela toca vira registro dela; o preço vem antes
 * de qualquer formulário; a conta nasce depois do Pix — a ordem do app do
 * iPhone (produto → preço → paga → conta). 5 telas no lugar de 11:
 *   1. porta (a de hoje);
 *   2. demo com a Missão, onde as 2 respostas do quiz viram registros dela
 *      (quanto sai por mês → 1 gasto → a vitória da semana);
 *   3. "Guardando… ligando os 16" (aquece o Pix sem criar pedido);
 *   4. paywall ROI 2 SEM conta, com "O que você já construiu";
 *   5. Pix na hora, e-mail acima do QR (copiar exige e-mail; escanear não)
 *      → Pronto + senha DEPOIS de pagar.
 * O que sustenta: na web 23–32% de quem termina a demo nunca vê o preço;
 * cadastro antes do preço já perdeu 2×; Pix anônimo a 27,90 pagou 46%.
 *
 * DESLIGADO POR PADRÃO: `FUNIL_B = "off"` é o funil de hoje, byte a byte
 * (nenhum evento ganha campo novo, nenhum link muda — travado nos testes
 * demo-guiada-off, quiz-curto, funil-roi2, seta-da-demo e funil-b).
 *   · "kenny": só sessões cuja campanha é a kenny g — o id chega em
 *     `utm_campaign=120250474048320041` (conferido nos eventos reais de 30/09:
 *     566 `funnel_view start` com utm_source=ig, utm_medium=paid; o
 *     `utm_content` é o id do anúncio). As outras campanhas seguem no funil de
 *     hoje.
 *   · "on": todo mundo.
 * O BRAÇO VAI NA URL (`f=b`), como a demo guiada faz com `guia=`: o navegador
 * do Instagram zera o storage entre páginas (30/09: 1.448 demos chegaram sem
 * utm nenhum em 36 h) e a porta → demo é navegação completa. A decisão é
 * tomada na PORTA (pela campanha) e a partir dali só a URL manda: demo,
 * pílulas, "Quase lá", "Guardando", paywall e Pronto carregam `f=b`.
 * ROLLBACK = "off" + push: quem estiver no meio (`?step=guardando&f=b`) cai no
 * cadastro de hoje — o `f=b` só é lido com a chave ligada.
 * QA sem mexer em ninguém: localStorage `funil-b-force` = "on" | "off", ou o
 * link `/inicio?funil-b=on` (`auto` desfaz).
 */
import { GASTO_ANCHOR, VICTORY_PHRASE, AREA_PROOF, type AreaKey } from "@/lib/funnel";

export type ModoFunilB = "off" | "kenny" | "on";

export const FUNIL_B: ModoFunilB = "kenny";

/** A campanha kenny g (Meta, id da campanha — é o que vem em utm_campaign). */
export const CAMPANHA_KENNY_G = "120250474048320041";

export const CHAVE_FORCA_FUNIL_B = "funil-b-force";
/** O braço na URL: `f=b`. */
export const PARAM_FUNIL_B = "f";
export const VALOR_FUNIL_B = "b";
/** As respostas do quiz que viram registros na demo, na URL da volta. */
export const PARAM_GASTO = "qg";
export const PARAM_VITORIA = "qv";
export const PARAM_CONSISTENCIA = "qc";
/** Os passos do /inicio que só existem no B. */
export const STEP_GUARDANDO = "guardando";
export const STEP_PRONTO = "pronto";

/**
 * A força de QA pelo LINK (o dono testa no celular, sem console):
 * `/inicio?funil-b=on` liga o B só neste navegador; `off` força o de hoje;
 * `auto` apaga a força e volta a valer a chave. Fica gravada no aparelho,
 * porque a porta → demo é navegação completa e o link não vai junto.
 */
export const PARAM_QA_FUNIL_B = "funil-b";
export function guardarForcaDaUrl(busca?: string | URLSearchParams): void {
  try {
    const v = (busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? window.location.search)).get(PARAM_QA_FUNIL_B);
    if (v === "on" || v === "off") localStorage.setItem(CHAVE_FORCA_FUNIL_B, v);
    else if (v === "auto") localStorage.removeItem(CHAVE_FORCA_FUNIL_B);
  } catch { /* sem window ou storage: vale a chave */ }
}

export const forcaDoFunilB = (): "on" | "off" | null => {
  guardarForcaDaUrl();
  try {
    const f = localStorage.getItem(CHAVE_FORCA_FUNIL_B);
    return f === "on" || f === "off" ? f : null;
  } catch {
    return null; // storage bloqueado (webview): vale a chave
  }
};

export const campanhaEhKennyG = (campanha: string | null | undefined): boolean =>
  String(campanha ?? "").trim() === CAMPANHA_KENNY_G;

/** A decisão NA PORTA: esta sessão entra no Funil B? Força de QA > chave × campanha. */
export function decidirFunilB(campanha: string | null | undefined, modo: ModoFunilB = FUNIL_B): boolean {
  const f = forcaDoFunilB();
  if (f === "on") return true;
  if (f === "off") return false;
  if (modo === "on") return true;
  if (modo === "kenny") return campanhaEhKennyG(campanha);
  return false;
}

const paramsDe = (busca: string | URLSearchParams | undefined): URLSearchParams =>
  busca instanceof URLSearchParams ? busca : new URLSearchParams(busca ?? (typeof window !== "undefined" ? window.location.search : ""));

/**
 * O braço desta página. Depois da porta, quem manda é a URL (`f=b`) — mas só
 * com a chave ligada (ou a força de QA): com a chave "off", `f=b` é ignorado
 * e o funil é o de hoje (rollback total).
 */
export function ehFunilB(busca?: string | URLSearchParams, modo: ModoFunilB = FUNIL_B): boolean {
  const f = forcaDoFunilB();
  if (f === "on") return true;
  if (f === "off" || modo === "off") return false;
  try {
    return paramsDe(busca).get(PARAM_FUNIL_B) === VALOR_FUNIL_B;
  } catch {
    return false;
  }
}

/** `{ funil: "b" }` pros eventos, ou nada. */
export const marcaDoFunilB = (ligado: boolean): { funil?: "b" } => (ligado ? { funil: "b" } : {});

const mexerNaUrl = (url: string, mudar: (p: URLSearchParams) => void): string => {
  const [semHash, hash = ""] = url.split("#");
  const [caminho, busca = ""] = semHash.split("?");
  const p = new URLSearchParams(busca);
  mudar(p);
  const q = p.toString();
  return `${caminho}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
};

/**
 * Carimba o braço na URL. A volta da demo do funil de hoje é `?step=signup`
 * (o cadastro); no B ela vira `?step=guardando` — o preço vem antes da conta.
 */
export const comFunilB = (url: string): string =>
  mexerNaUrl(url, (p) => {
    p.set(PARAM_FUNIL_B, VALOR_FUNIL_B);
    if (p.get("step") === "signup") p.set("step", STEP_GUARDANDO);
  });

/* ------------------------------------------------ as respostas na URL */

export type RespostasDoFunilB = { gasto?: string; vitoria?: string; consistencia?: string };

const CONSISTENCIAS = new Set(Object.values(AREA_PROOF).flatMap((p) => Object.keys(p.echo)));
const RESPOSTA_MAX = 60;

/** Só resposta de uma lista fechada entra (nada inventado vira âncora do paywall). */
export function normalizarRespostas(x: unknown): RespostasDoFunilB {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, RESPOSTA_MAX) : "");
  const out: RespostasDoFunilB = {};
  const gasto = s(o.gasto);
  if (gasto && gasto in GASTO_ANCHOR) out.gasto = gasto;
  const vitoria = s(o.vitoria);
  if (vitoria && vitoria in VICTORY_PHRASE) out.vitoria = vitoria;
  const consistencia = s(o.consistencia);
  if (consistencia && CONSISTENCIAS.has(consistencia)) out.consistencia = consistencia;
  return out;
}

export const respostasDaUrl = (busca?: string | URLSearchParams): RespostasDoFunilB => {
  try {
    const p = paramsDe(busca);
    return normalizarRespostas({ gasto: p.get(PARAM_GASTO), vitoria: p.get(PARAM_VITORIA), consistencia: p.get(PARAM_CONSISTENCIA) });
  } catch {
    return {};
  }
};

/** Leva as respostas junto na URL. Sem resposta, a MESMA string. */
export const comRespostas = (url: string, r: RespostasDoFunilB | null | undefined): string => {
  const ok = normalizarRespostas(r);
  if (!ok.gasto && !ok.vitoria && !ok.consistencia) return url;
  return mexerNaUrl(url, (p) => {
    if (ok.gasto) p.set(PARAM_GASTO, ok.gasto);
    if (ok.vitoria) p.set(PARAM_VITORIA, ok.vitoria);
    if (ok.consistencia) p.set(PARAM_CONSISTENCIA, ok.consistencia);
  });
};

/**
 * As respostas guardadas no aparelho (`funnel-quiz-answers`, a mesma chave que
 * o quiz de hoje grava e que o paywall lê) — reserva da URL.
 */
export const RESPOSTAS_NO_APARELHO = "funnel-quiz-answers";
export function guardarRespostasNoAparelho(area: AreaKey | null, r: RespostasDoFunilB): void {
  try {
    const atual = JSON.parse(localStorage.getItem(RESPOSTAS_NO_APARELHO) || "{}") as Record<string, string>;
    localStorage.setItem(RESPOSTAS_NO_APARELHO, JSON.stringify({ ...atual, ...(area ? { area } : {}), ...normalizarRespostas(r) }));
  } catch { /* a URL segura */ }
}

/** A porta abre a demo por navegação COMPLETA (a demo é outra página, como hoje). Função à parte pra o teste ver a URL. */
export const abrirUrl = (url: string): void => { window.location.href = url; };

/** A pergunta do quiz que vira o 1º toque da missão, por área (a mesma chave que o paywall lê). */
export const CHAVE_DA_PERGUNTA_1: Record<AreaKey, "gasto" | "consistencia"> = {
  dinheiro: "gasto", rotina: "consistencia", corpo: "consistencia", saude: "consistencia", metas: "consistencia",
};
