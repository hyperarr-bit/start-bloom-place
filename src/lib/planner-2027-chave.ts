/**
 * As chaves do PLANNER 2027 versão B (31/10), num arquivo sem dependência: o app (src/lib/planner-2027.ts) e a oferta da
 * /organizar (src/landing/upsell-2027.ts) leem a MESMA direção de cara sem a landing baixar o planner inteiro.
 *
 *   PLANNER_2027   "off" (padrão) = o app fica na versão A (planner antigo, byte a byte). "on" = prévia + dados dela + PNG no iPhone.
 *   PLANNER_ESTILO "ab" (padrão, 31/10) = teste A/B meio a meio pelo e-mail (./planner-2027-braco.ts) | "core" | "codex" fixo.
 * QA neste aparelho: ?planner27=on|off|auto · ?planner-estilo=codex|core|auto (guardados em localStorage; "auto" volta pra chave).
 */
import { sortearEstilo, type EstiloDoBraco, type ViaDoSorteio } from "./planner-2027-braco";
export type ModoPlanner = "off" | "on";
export type EstiloPlanner = EstiloDoBraco;
/** "ab" = cada compradora cai em "codex" ou "core" (50%), pelo e-mail; "core"/"codex" = todo mundo no mesmo (como antes). */
export type ModoEstilo = EstiloPlanner | "ab";
/** A versão B do planner no app. "off" = a versão A (rollback). */
export const PLANNER_2027: ModoPlanner = "off";
/**
 * A direção de cara. 31/10 (pedido do dono): "ab" = teste dos 2 desenhos, meio a meio, pelo e-mail da compradora (a oferta
 * e o app calculam o mesmo braço sem dividir armazenamento). Desligar o teste = "core" ou "codex" (todo mundo no mesmo).
 */
export const PLANNER_ESTILO: ModoEstilo = "ab";

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

/** De onde veio o braço: "forca" (QA: ?planner-estilo= / a chave guardada) · "fixo" (PLANNER_ESTILO core/codex) · o sorteio. */
export type ViaDoBraco = "forca" | "fixo" | ViaDoSorteio;
export type BracoDoPlanner = { estilo: EstiloPlanner; via: ViaDoBraco };
/**
 * O braço do teste A/B dos desenhos. A força de QA vence; com PLANNER_ESTILO fixo, todo mundo no fixo (como antes); com "ab",
 * o sorteio pelo e-mail (sem e-mail: a reserva — o id da compra na oferta, o id da conta no app).
 */
export function bracoDoPlanner(quem: { email?: string | null; reserva?: string | null } = {}, busca: string = buscaAtual(), modo: ModoEstilo = PLANNER_ESTILO): BracoDoPlanner {
  const f = forca<EstiloPlanner>(PARAM_QA_ESTILO, CHAVE_FORCA_ESTILO, ["codex", "core"], busca);
  if (f) return { estilo: f, via: "forca" };
  if (modo !== "ab") return { estilo: modo, via: "fixo" };
  return sortearEstilo(quem);
}
/** Os campos que os eventos levam (o nome que a análise lê: braco_planner, como braco_lp/braco_checkout). */
export const camposDoBraco = (b: BracoDoPlanner) => ({ braco_planner: b.estilo, braco_planner_via: b.via });
export const estiloDoPlanner = (busca: string = buscaAtual(), quem: { email?: string | null; reserva?: string | null } = {}): EstiloPlanner =>
  bracoDoPlanner(quem, busca).estilo;


/* ── a OFERTA do 2027 com as folhas do planner (a /organizar e o Fluxo2027 do /hoje e /inicio) ── */
export type ModoU27Planner = "off" | "on";
/** "off" (padrão) = a oferta da versão A, igual. QA: ?u27planner=on|off|auto. */
export const U27_PLANNER: ModoU27Planner = "off";
/**
 * crítica r2 (compradora MEDIA 4 / técnico MEDIA 3): a oferta B promete "com os seus dados" — só pode valer se a ENTREGA B
 * (PLANNER_2027) também estiver ligada. Ligar só a U27_PLANNER não faz nada (a oferta fica na A). QA: ?u27planner=on&planner27=on.
 */
export const u27PlannerLigado = (busca: string = buscaAtual()): boolean =>
  (forca<ModoU27Planner>("u27planner", "u27planner-force", ["on", "off"], busca) ?? U27_PLANNER) === "on" && plannerNovoLigado(busca);
/** crítica r1 (compradora BAIXA 1): "pra imprimir" afastava quem não tem impressora */
export const DESC_U2027_PLANNER = "Um planner 2027 pra imprimir ou guardar no celular, com as suas metas, o seu dinheiro e as suas datas. E 12 revisões do mês no app.";
export const LEGENDA_U2027_PLANNER = "Exemplo. O seu sai com o que você planejar.";
/** o "toque pra ver" sobre a imagem da oferta */
export const ZOOM_U2027_PLANNER = "Toque pra ver uma folha";

/**
 * crítica r1 (compradora MEDIA 4): o app do iPhone roda o bundle da build da loja — o planner B (PLANNER_2027) só chega
 * lá com uma build nova. Enquanto a build com o PLANNER_2027 "on" NÃO estiver na loja, isto fica false (registro pra
 * ordem de ligar, BUILD.md). Desde a crítica r2 a nota da oferta não fala de site × app: só o que ela recebe.
 */
export const PLANNER_B_NO_APP_IPHONE = false;
/* crítica r2 (compradora MEDIA 3): "sai pelo site" confundia quem já está no site — agora diz o que ela recebe. */
export const NOTA_U2027_PLANNER = "É separado do CORE que você já pagou. O planner sai em 12 folhas pra salvar no celular ou imprimir.";

/** O "Pronto" com a versão B: o 4º item e o link que abre o Planejar direto (Pacote2027 lê ?planejar=1). */
export const ITEM_PLANNER_U2027 = "Seu planner 2027, com os seus dados";
export const CTA_PRONTO_U2027_PLANNER = "Planejar meu 2027 · 5 min";
export const LINK_PLANEJAR_2027 = "/desenvolvimento?tab=2027&planejar=1";
/** O link que abre direto o planner (o "Copiar o link" do navegador do Instagram copia a porta /entrar com ele). */
export const LINK_DO_PLANNER = "/desenvolvimento?tab=2027&planner=1";
/**
 * crítica r2 (compradora ALTAS 1–2 / técnico MEDIA 2): sem sessão, /desenvolvimento caía no /auth de SENHA (a compradora
 * da web nunca criou senha) e perdia o destino. Os links do 2027 B passam pela porta /entrar (código por e-mail, Google,
 * Apple), que respeita ?next= (destino-seguro: /desenvolvimento entra na lista) e, com sessão viva, vai direto pro destino.
 * Mesma forma do urlEntrar (destino-seguro.ts), sem importar nada aqui (a landing lê este arquivo).
 */
export const portaDoLink = (destino: string, email?: string | null): string => {
  const q = new URLSearchParams();
  if (email && /\S+@\S+\.\S+/.test(email)) q.set("e", email);
  q.set("next", destino);
  return `/entrar?${q.toString()}`;
};
/** Os 2 links do 2027 B que o ProtectedRoute manda pra porta /entrar (em vez do /auth) quando não há sessão. */
export const ehLinkDoPlannerB = (pathname: string, search: string): boolean => {
  if (pathname !== "/desenvolvimento") return false;
  try { const q = new URLSearchParams(search); return q.get("tab") === "2027" && (q.get("planner") === "1" || q.get("planejar") === "1"); } catch { return false; }
};

/** 2 folhas reais (capa + "Meu ano") com dados de exemplo, na direção do app: scripts/planner-2027-miniaturas.ts */
export const imagemDoPlanner = (estilo: EstiloPlanner = estiloDoPlanner()) => `/landing/planner-2027-${estilo}.webp`;
/** crítica r1 (compradora MEDIA 2): 640 px borrava no iPhone (DPR 3) — 1x/2x/3x */
export const srcsetDoPlanner = (estilo: EstiloPlanner = estiloDoPlanner()) =>
  `/landing/planner-2027-${estilo}.webp 1x, /landing/planner-2027-${estilo}@2x.webp 2x, /landing/planner-2027-${estilo}@3x.webp 3x`;
/** a folha "Meu ano" sozinha, grande (abre no toque, legível) */
export const folhaAnoDoPlanner = (estilo: EstiloPlanner = estiloDoPlanner()) => `/landing/planner-2027-${estilo}-ano.webp`;
