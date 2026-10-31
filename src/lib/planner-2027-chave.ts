/**
 * As chaves do PLANNER 2027 versão B (31/10), num arquivo sem dependência: o app (src/lib/planner-2027.ts) e a oferta da
 * /organizar (src/landing/upsell-2027.ts) leem a MESMA direção de cara sem a landing baixar o planner inteiro.
 *
 *   PLANNER_2027   "off" (padrão) = o app fica na versão A (planner antigo, byte a byte). "on" = prévia + dados dela + PNG no iPhone.
 *   PLANNER_ESTILO "core" (padrão) | "codex" — as 2 direções de cara, mesmo layout (BRIEF.md).
 * QA neste aparelho: ?planner27=on|off|auto · ?planner-estilo=codex|core|auto (guardados em localStorage; "auto" volta pra chave).
 */
export type ModoPlanner = "off" | "on";
export type EstiloPlanner = "codex" | "core";
/** A versão B do planner no app. "off" = a versão A (rollback). */
export const PLANNER_2027: ModoPlanner = "off";
/** A direção de cara. "core" = a cara dos módulos (padrão, BRIEF.md: o planner pago tem que parecer o app que ela comprou). */
export const PLANNER_ESTILO: EstiloPlanner = "core";

export const PARAM_QA_PLANNER = "planner27";
export const PARAM_QA_ESTILO = "planner-estilo";
export const CHAVE_FORCA_PLANNER = "planner27-force";
export const CHAVE_FORCA_ESTILO = "planner27-estilo";

export function forca<T extends string>(param: string, chave: string, validos: readonly T[], busca: string): T | null {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get(param); } catch { v = null; }
  try {
    if (v === "auto") { localStorage.removeItem(chave); return null; }
    if (v && (validos as readonly string[]).includes(v)) { localStorage.setItem(chave, v); return v as T; }
    const salvo = localStorage.getItem(chave);
    return salvo && (validos as readonly string[]).includes(salvo) ? (salvo as T) : null;
  } catch {
    return v && (validos as readonly string[]).includes(v) ? (v as T) : null;
  }
}
const buscaAtual = () => (typeof window === "undefined" ? "" : window.location.search);

/** A versão B está ligada neste aparelho? (a chave, ou o QA) */
export const plannerNovoLigado = (busca: string = buscaAtual()): boolean =>
  (forca<ModoPlanner>(PARAM_QA_PLANNER, CHAVE_FORCA_PLANNER, ["on", "off"], busca) ?? PLANNER_2027) === "on";
export const estiloDoPlanner = (busca: string = buscaAtual()): EstiloPlanner =>
  forca<EstiloPlanner>(PARAM_QA_ESTILO, CHAVE_FORCA_ESTILO, ["codex", "core"], busca) ?? PLANNER_ESTILO;


/* ── a OFERTA do 2027 com as folhas do planner (a /organizar e o Fluxo2027 do /hoje e /inicio) ── */
export type ModoU27Planner = "off" | "on";
/** "off" (padrão) = a oferta da versão A, igual. QA: ?u27planner=on|off|auto. */
export const U27_PLANNER: ModoU27Planner = "off";
export const u27PlannerLigado = (busca: string = buscaAtual()): boolean =>
  (forca<ModoU27Planner>("u27planner", "u27planner-force", ["on", "off"], busca) ?? U27_PLANNER) === "on";
export const DESC_U2027_PLANNER = "Um planner 2027 pra imprimir, montado com as suas metas, o seu dinheiro e as suas datas. E 12 revisões do mês no app.";
export const LEGENDA_U2027_PLANNER = "Exemplo. O seu sai com o que você planejar.";
/** 2 folhas reais (capa + "Meu ano") com dados de exemplo, na direção do app: scripts/planner-2027-miniaturas.ts */
export const imagemDoPlanner = (estilo: EstiloPlanner = estiloDoPlanner()) => `/landing/planner-2027-${estilo}.webp`;
