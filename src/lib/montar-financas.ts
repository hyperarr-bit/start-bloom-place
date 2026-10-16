/**
 * "VAMOS MONTAR SUAS FINANÇAS" (1.0.16, 16/10) — a régua, a chave e as contas, sem tela.
 *
 * Ideia do dono (13/10, mockup scratchpad/app-simples/setup-financas): a conta nova abre
 * Finanças e, em vez de um módulo vazio, responde 2 perguntas — quanto entra por mês e quais
 * contas chegam todo mês — e já vê o número DELA: "você pode gastar R$ X por dia". Nada de
 * "IA": é a conta do próprio módulo (`computeDailyBudget`, lib/finance-totals), a mesma que o
 * card "QUANTO POSSO GASTAR HOJE" do Dashboard mostra depois — o número da tela final tem que
 * ser o número do Dashboard, senão a primeira coisa que a pessoa vê é o app se contradizendo.
 *
 * O que se grava é DADO DE VERDADE do módulo, nas chaves de sempre (sobem pro user_data):
 *   · `finance-incomes`        ← 1 receita "Renda do mês" (data de hoje, como o "+" da tabela);
 *   · `finance-fixed-expenses` ← 1 custo fixo por conta marcada (categoria dos fixos, boleto).
 * Sem perfil (= Pessoal) — conta nova não tem empresa.
 *
 * ── A CHAVE ─────────────────────────────────────────────────────────────────────────────────
 *   `MONTAR_FINANCAS`      — app das lojas (iPhone e Android). LIGADA nesta build.
 *   `MONTAR_FINANCAS_WEB`  — site. Desligada (a venda/funil da web não muda sem pedido).
 *   Metadata do RevenueCat `montar_financas: "on" | "off"` em QUALQUER offering (a `current`
 *   vence) manda no app sem versão nova — é o interruptor de emergência (revenuecat.ts registra).
 *   QA só no navegador: `?montar-financas=on|off|auto|recomecar` (recomecar apaga o "já vi" do
 *   aparelho e libera a régua de conta nova; a conta precisa estar VAZIA de Finanças).
 *   Ordem: força de QA (navegador) > metadata remota (app) > constante.
 *
 * ── QUEM VÊ ─────────────────────────────────────────────────────────────────────────────────
 *   chave ligada · conta logada (não convidado, não demo /preview) · conta NOVA (< 48 h, a mesma
 *   régua do tour e da missão; a força de QA pula só esta) · Finanças sem NENHUM dado (receita,
 *   gasto, fixo, parcela, investimento ou conta no MEU MÊS) · ainda não terminou nem pulou.
 *   Quem já usa Finanças nunca vê — nem se a chave for ligada pra todo mundo.
 *
 * ── UMA VEZ SÓ (chamado de 14/10: "toda vez que eu entro aparece o tutorial") ────────────────
 *   O "feito/pulou" fica em DOIS lugares: no aparelho (`core-montar-financas`, em
 *   CHAVES_DO_APARELHO — nenhuma vassoura leva) e na conta (mesma chave via useUserData, volta
 *   no login em outro aparelho). Fechar o app NO MEIO (sem Pular nem Pronto) deixa ver de novo,
 *   mas no máximo 2 aberturas (1 vista por abertura do app): a 2ª vista sem decisão é a última —
 *   e ela volta com o que já tinha sido respondido (rascunho na mesma chave do aparelho).
 *
 * ── UMA TELA POR VEZ ────────────────────────────────────────────────────────────────────────
 *   A tela pode abrir pelo módulo (1ª abertura de Finanças) ou pela missão (dose 1 de Finanças).
 *   `registrarTelaAberta` conta as abertas; a do módulo cede pra da missão e não abre por cima dela.
 */
import { isNativeShell } from "@/lib/native-shell";
import { computeDailyBudget } from "@/lib/finance-totals";
import { localDayKey } from "@/lib/utils";

export type ModoChave = "on" | "off";
/** App das lojas. ROLLBACK = "off" aqui (ou metadata `montar_financas: "off"` no RevenueCat, sem build). */
export const MONTAR_FINANCAS: ModoChave = "on";
/** Site (Vercel). */
export const MONTAR_FINANCAS_WEB: ModoChave = "off";

/** Nome da chave no metadata das offerings do RevenueCat. */
export const CHAVE_REMOTA_MONTAR_FINANCAS = "montar_financas";
/** Força de QA (só navegador) — sem prefixo varrido, sobrevive às vassouras. */
export const CHAVE_FORCA_MONTAR_FINANCAS = "montar-financas-force";
export const PARAM_QA_MONTAR_FINANCAS = "montar-financas";

/** "Já vi / feito" — no aparelho (localStorage direto) E na conta (useUserData). Ver chaves-do-aparelho.ts. */
export const CHAVE_MONTAR_FINANCAS = "core-montar-financas";

/** Eventos de analytics (dados sem valor em reais — só contagens e passo). */
export const EV_VIEW = "montar_financas_view";
export const EV_PASSO = "montar_financas_passo";
export const EV_PRONTO = "montar_financas_pronto";
export const EV_PULAR = "montar_financas_pular";

/** Disparado na window quando a pessoa termina ou pula. `detail: { resultado: "pronto" | "pulou", contas: number }` */
export const EVENTO_MONTAR_FINANCAS_FIM = "montar-financas:fim";
/** Atributo no <html> enquanto a tela está aberta (a missão/anel espera ele sair pra procurar o "+ Novo gasto"). */
export const ATRIBUTO_NA_TELA = "data-montar-financas";

export type Resultado = "pronto" | "pulou";
export type OrigemMontar = "modulo" | "missao";
/** O que já foi respondido e ainda não virou dado (fechou o app no meio): volta preenchido. */
export interface RascunhoMontar { etapa: "renda" | "contas"; faixa: string | null; renda: number; contas: ContaEscolhida[] }
export interface MarcaMontar { r?: Resultado; em?: string; vistas?: number; rascunho?: RascunhoMontar }

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage bloqueado */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } },
};

/* ───────────────────────── chave ───────────────────────── */

let remota: ModoChave | null = null;
const modoDe = (v: unknown): ModoChave | null => {
  const s = String(v ?? "").toLowerCase();
  return s === "on" ? "on" : s === "off" ? "off" : null;
};

/** Decisão pura: o `montar_financas` do metadata das offerings (a `current` vence). */
export function lerChaveRemotaMontar(offerings: unknown): ModoChave | null {
  type Off = { metadata?: Record<string, unknown> } | null | undefined;
  const o = offerings as { current?: Off; all?: Record<string, Off> } | null | undefined;
  let lido: ModoChave | null = null;
  for (const off of Object.values(o?.all ?? {})) {
    if (off === o?.current) continue;
    const m = modoDe(off?.metadata?.[CHAVE_REMOTA_MONTAR_FINANCAS]);
    if (m) lido = m;
  }
  const c = modoDe(o?.current?.metadata?.[CHAVE_REMOTA_MONTAR_FINANCAS]);
  return c ?? lido;
}
/** revenuecat.ts chama a cada getOfferings(). */
export function registrarChaveMontarFinancas(offerings: unknown): void {
  try { remota = lerChaveRemotaMontar(offerings); } catch { /* metadata estranha: fica como estava */ }
}
/** Só testes. */
export const _zerarRemotaMontar = (): void => { remota = null; };

const forcaQa = (): ModoChave | null => {
  if (isNativeShell()) return null;
  const f = ls.get(CHAVE_FORCA_MONTAR_FINANCAS);
  return f === "on" || f === "off" ? f : null;
};
/** A força de QA está ligada neste navegador (pula a régua de conta nova). */
export const montarForcadoPorQa = (): boolean => forcaQa() === "on";

/**
 * Lê `?montar-financas=` uma vez por busca e guarda neste navegador. Devolve true quando pediu
 * `recomecar` (quem chama também apaga a marca da CONTA — aqui só existe o aparelho).
 */
let ultimaBusca: string | null = null;
export function guardarForcaMontarDaUrl(busca?: string): boolean {
  if (isNativeShell()) return false;
  let v: string | null;
  try {
    const texto = busca ?? window.location.search;
    if (texto === ultimaBusca) return false;
    ultimaBusca = texto;
    v = new URLSearchParams(texto).get(PARAM_QA_MONTAR_FINANCAS);
  } catch { return false; }
  if (v === "on" || v === "off") ls.set(CHAVE_FORCA_MONTAR_FINANCAS, v);
  else if (v === "auto") ls.del(CHAVE_FORCA_MONTAR_FINANCAS);
  else if (v === "recomecar") { ls.set(CHAVE_FORCA_MONTAR_FINANCAS, "on"); ls.del(CHAVE_MONTAR_FINANCAS); return true; }
  return false;
}

/** Está ligado AQUI? força de QA (navegador) > metadata do RevenueCat (app) > constante. */
export function montarFinancasLigado(): boolean {
  const f = forcaQa();
  if (f) return f === "on";
  if (isNativeShell()) return (remota ?? MONTAR_FINANCAS) === "on";
  return MONTAR_FINANCAS_WEB === "on";
}

/* ───────────────────────── marca de uma vez só ───────────────────────── */

const lerMarcaJson = (raw: unknown): MarcaMontar | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as MarcaMontar;
  try { const v = JSON.parse(String(raw)); return v && typeof v === "object" ? (v as MarcaMontar) : null; } catch { return null; }
};
export const marcaDoAparelho = (): MarcaMontar | null => lerMarcaJson(ls.get(CHAVE_MONTAR_FINANCAS));

/** Terminou ou pulou — no aparelho OU na conta (o `get` do useUserData). */
export function montarJaDecidido(get?: <T>(k: string, f: T) => T): boolean {
  if (marcaDoAparelho()?.r) return true;
  try { return !!lerMarcaJson(get?.(CHAVE_MONTAR_FINANCAS, null))?.r; } catch { return false; }
}
/** Vista sem decisão (o app fechou no meio): a 2ª é a última. Conta 1 por abertura do app —
 *  a tela do módulo cedendo pra da missão (ou remontando) não gasta a 2ª vista. */
export const MAX_VISTAS_SEM_DECISAO = 2;
let vistaNestaAbertura = false;
export function registrarVistaMontar(): void {
  if (vistaNestaAbertura) return;
  vistaNestaAbertura = true;
  const m = marcaDoAparelho() ?? {};
  ls.set(CHAVE_MONTAR_FINANCAS, JSON.stringify({ ...m, vistas: (m.vistas ?? 0) + 1 }));
}
/** Só testes: simula fechar e abrir o app de novo (a vista volta a contar). */
export const _novaAberturaMontar = (): void => { vistaNestaAbertura = false; };

export function guardarRascunhoMontar(r: RascunhoMontar): void {
  const m = marcaDoAparelho() ?? {};
  if (m.r) return;
  ls.set(CHAVE_MONTAR_FINANCAS, JSON.stringify({ ...m, rascunho: r }));
}
export function lerRascunhoMontar(): RascunhoMontar | null {
  const r = marcaDoAparelho()?.rascunho;
  if (!r || (r.etapa !== "renda" && r.etapa !== "contas")) return null;
  return { etapa: r.etapa, faixa: typeof r.faixa === "string" ? r.faixa : null, renda: Number(r.renda) || 0, contas: Array.isArray(r.contas) ? r.contas : [] };
}

/* ───────────────────────── uma tela por vez (módulo × missão) ───────────────────────── */

const abertas: Record<OrigemMontar, number> = { modulo: 0, missao: 0 };
/** Disparado na window quando uma tela abre. `detail: { origem }` — a do módulo cede pra da missão. */
export const EVENTO_MONTAR_ABERTA = "montar-financas:aberta";
const pintarAtributo = () => {
  try {
    const html = document.documentElement;
    if (abertas.missao > 0) html.setAttribute(ATRIBUTO_NA_TELA, "missao");
    else if (abertas.modulo > 0) html.setAttribute(ATRIBUTO_NA_TELA, "modulo");
    else html.removeAttribute(ATRIBUTO_NA_TELA);
  } catch { /* sem document */ }
};
/** A tela montou; devolve o "desmontou". */
export function registrarTelaAberta(origem: OrigemMontar): () => void {
  abertas[origem] += 1;
  pintarAtributo();
  try { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_ABERTA, { detail: { origem } })); } catch { /* sem window */ }
  return () => { abertas[origem] = Math.max(0, abertas[origem] - 1); pintarAtributo(); };
}
/** A missão está com a tela aberta agora (a do módulo não aparece). */
export const montarAbertoPelaMissao = (): boolean => abertas.missao > 0;

/** Grava a decisão no aparelho; devolve a marca pra quem também grava na conta. */
export function marcarMontarDecidido(r: Resultado): MarcaMontar {
  const { rascunho: _r, ...sem } = marcaDoAparelho() ?? {};
  const marca: MarcaMontar = { ...sem, r, em: new Date().toISOString() };
  ls.set(CHAVE_MONTAR_FINANCAS, JSON.stringify(marca));
  return marca;
}

/* ───────────────────────── régua ───────────────────────── */

const cheia = (v: unknown) => Array.isArray(v) && v.length > 0;
/** Finanças já tem QUALQUER dado da pessoa? (as listas do mês + contas no MEU MÊS) */
export function temDadosDeFinancas(get: <T>(k: string, f: T) => T): boolean {
  for (const k of ["finance-incomes", "finance-expenses", "finance-fixed-expenses", "finance-installments", "finance-investments"]) {
    if (cheia(get<unknown>(k, null))) return true;
  }
  const dias = get<unknown>("finance-dueDays", null);
  if (Array.isArray(dias) && dias.some((d) => cheia((d as { bills?: unknown })?.bills))) return true;
  return false;
}

/* A mesma régua de `contaNova` (lib/missao-doses), copiada pra não puxar a missão inteira pro
   grafo do revenuecat.ts (que registra a chave remota daqui). */
const contaNova = (criadoEm: string | null | undefined, agora: number): boolean =>
  !!criadoEm && agora - new Date(criadoEm).getTime() < 48 * 3600e3;
/** Conta nova (< 48 h) — ou a força de QA ligada neste navegador. */
export const contaNovaParaMontar = (criadoEm: string | null | undefined, agora: number = Date.now()): boolean =>
  montarForcadoPorQa() || contaNova(criadoEm, agora);

export interface ContextoMontar {
  criadoEm: string | null | undefined;
  get: <T>(k: string, f: T) => T;
  isGuest: boolean;
  isPreview?: boolean;
  agora?: number;
}
/**
 * A tela aparece? Uma resposta só pro módulo (1ª abertura de Finanças) e pra missão
 * (o passo de Finanças pode perguntar antes de abrir a tela).
 */
export function deveMostrarMontarFinancas({ criadoEm, get, isGuest, isPreview, agora = Date.now() }: ContextoMontar): boolean {
  if (!montarFinancasLigado()) return false;
  if (isGuest || isPreview) return false;
  if (montarJaDecidido(get)) return false;
  if ((marcaDoAparelho()?.vistas ?? 0) >= MAX_VISTAS_SEM_DECISAO) return false;
  if (!contaNovaParaMontar(criadoEm, agora)) return false;
  if (temDadosDeFinancas(get)) return false;
  return true;
}

/* ───────────────────────── as respostas → dado do módulo ───────────────────────── */

export interface FaixaDeRenda { id: string; rotulo: string; valor: number }
/** Faixas da 1ª pergunta. O valor é só o ponto de partida do campo — a pessoa ajusta. */
export const FAIXAS_DE_RENDA: FaixaDeRenda[] = [
  { id: "ate2", rotulo: "Até R$ 2 mil", valor: 1500 },
  { id: "2a4", rotulo: "R$ 2 a 4 mil", valor: 3000 },
  { id: "4a7", rotulo: "R$ 4 a 7 mil", valor: 5500 },
  { id: "7mais", rotulo: "Mais de R$ 7 mil", valor: 8000 },
];

export interface ContaSugerida { id: string; nome: string; emoji: string; valor: number; categoria: string }
/** Contas fixas mais comuns, com valor típico (ajustável) e a categoria de FIXED_CATEGORIES. */
export const CONTAS_SUGERIDAS: ContaSugerida[] = [
  { id: "aluguel", nome: "Aluguel", emoji: "🏠", valor: 900, categoria: "moradia" },
  { id: "luz", nome: "Luz", emoji: "💡", valor: 150, categoria: "contas_casa" },
  { id: "agua", nome: "Água", emoji: "💧", valor: 80, categoria: "contas_casa" },
  { id: "internet", nome: "Internet", emoji: "📶", valor: 100, categoria: "internet_telefone" },
  { id: "celular", nome: "Celular", emoji: "📱", valor: 60, categoria: "internet_telefone" },
  { id: "cartao", nome: "Cartão", emoji: "💳", valor: 500, categoria: "fatura_cartao" },
  { id: "streaming", nome: "Streaming", emoji: "🎬", valor: 45, categoria: "assinaturas" },
  { id: "academia", nome: "Academia", emoji: "🏋️", valor: 100, categoria: "academia" },
  { id: "condominio", nome: "Condomínio", emoji: "🏢", valor: 400, categoria: "condominio" },
  { id: "saude", nome: "Plano de saúde", emoji: "🩺", valor: 300, categoria: "plano_saude" },
  { id: "carro", nome: "Carro", emoji: "🚗", valor: 400, categoria: "transporte_fixo" },
];

export interface ContaEscolhida { id: string; nome: string; emoji: string; valor: number; categoria: string }

/** Inteiro em reais a partir do que a pessoa digitou ("3.000", "3000", "R$ 3.000,50" → 3000). */
export const reaisDigitados = (texto: string): number => {
  const so = String(texto ?? "").split(",")[0].replace(/\D/g, "").slice(0, 7);
  return so ? parseInt(so, 10) : 0;
};

/** As contas que valem (nome e valor > 0). */
export const contasValidas = (contas: ContaEscolhida[]): ContaEscolhida[] =>
  contas.filter((c) => c.nome.trim().length > 0 && c.valor > 0);

/** O número da tela final — a MESMA função do card "QUANTO POSSO GASTAR HOJE" do Dashboard. */
export function calcularMontar(renda: number, contas: ContaEscolhida[], agora: Date = new Date()) {
  const validas = contasValidas(contas);
  const fixos = validas.reduce((s, c) => s + c.valor, 0);
  const fixosComoNoModulo = validas.map((c) => ({ id: c.id, value: c.valor }));
  const base = computeDailyBudget(renda, fixos, [], fixosComoNoModulo, agora);
  return { renda, fixos, contas: validas.length, livre: base.availableReal, porDia: base.cantSpend ? 0 : Math.round(base.perDay), dias: base.remainingDays, semFolga: base.cantSpend };
}

/** Os itens exatamente no formato que IncomeTable/FixedExpensesTable gravam. */
export function itensParaGravar(renda: number, contas: ContaEscolhida[], agora: Date = new Date()) {
  const base = agora.getTime();
  const receita = renda > 0 ? [{ id: `mf-${base}`, description: "Renda do mês", value: renda, date: localDayKey(agora) }] : [];
  const fixos = contasValidas(contas).map((c, i) => ({
    id: `mf-${base}-${i + 1}`,
    description: c.nome.trim(),
    category: c.categoria || "outros",
    value: c.valor,
    paymentMethod: "boleto",
  }));
  return { receita, fixos };
}
