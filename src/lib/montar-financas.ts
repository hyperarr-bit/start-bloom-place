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
 * ── O 3º PASSO, OPCIONAL: CARTÃO DE CRÉDITO (16/10, aprovado pelo dono) ──────────────────────
 *   "Você usa cartão de crédito?" → qual cartão (opcional) + a fatura deste mês, mais ou menos +
 *   o dia do vencimento. Vira dado das estruturas DE CARTÃO do módulo (as mesmas do TOTAL POR
 *   CARTÃO NO MÊS, da linha "Fatura Nubank · R$ X" do MEU MÊS e dos ALERTAS INTELIGENTES):
 *     · `finance-card-config[cartão]` ← { dueDay, mesDoVencimento: true } (o que a engrenagem do
 *       TOTAL POR CARTÃO grava pra cartão novo; quem já tinha fechamento continua com ele);
 *     · `finance-custom-cards`        ← só sem banco escolhido / "Outro": cartão "Cartão" (renomeia
 *       na engrenagem);
 *     · `finance-fixed-expenses`      ← 1 custo fixo "Fatura do cartão" NO CRÉDITO desse cartão,
 *       categoria Fatura Cartão, SEM dia, marcado `faturaDoCartao` (lib/finance-faturas
 *       `ehEstimativaDaFatura`) — a linha da fatura do MEU MÊS é a conta dele;
 *     · `finance-faturas-pagas`       ← se o vencimento DESTE mês já passou: a de agora entra paga.
 *   POR QUE CUSTO FIXO, e não parcela 1x nem gasto: a fatura volta todo mês (o aviso de véspera
 *   volta junto — é ele que puxa a pessoa de volta), entra inteira no "quanto posso gastar" como
 *   todo fixo, não infla o ritmo de gasto variável (previsão, alerta de ritmo, desafio da semana)
 *   e não é dívida (parcela 1x virava "Dívidas R$ X" e destravava "Livre de Dívidas"/"Quitador").
 *   CONTA DUAS VEZES? Não com as contas fixas: o chip "💳 Cartão" saiu do 2º passo (o cartão tem
 *   o passo dele). Nem com as compras anotadas daqui pra frente neste mês: o cartão nasce com
 *   "conta no mês do vencimento", então a compra de hoje vai pra fatura do mês que vem. Quem passa a
 *   anotar TODA compra do cartão vê, a partir do mês seguinte, a estimativa + as compras — o TOTAL
 *   POR CARTÃO avisa pra apagar a estimativa (components/finance/TotalPorCartao).
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
 * ── QUEM ABRE (17/10, regra do dono) ────────────────────────────────────────────────────────
 *   SÓ A MISSÃO do teste, na 1ª dose de quem escolheu dinheiro/"tudo" (`<MontarFinancas origem="missao">`).
 *   "Não quero que a pessoa clique em um módulo e apareça um quiz — é só se a pessoa escolher primeiro":
 *   entrar em Finanças NÃO abre a tela (`MONTAR_FINANCAS_NO_MODULO = false`, abaixo); quem entra por
 *   curiosidade ganha o tutorial guiado do 1º gasto (outro ramo). O hook do módulo e a tela "modulo"
 *   continuam no código, desligados — `true` religa sem mais nada.
 *
 * ── QUEM VÊ (quando a missão pergunta `deveMostrarMontarFinancas`) ─────────────────────────────────
 *   chave ligada · conta logada (não convidado, não demo /preview) · conta NOVA (< 48 h, a mesma
 *   régua do tour e da missão; a força de QA pula só esta) · Finanças sem NENHUM dado (receita,
 *   gasto, fixo, parcela, investimento ou conta no MEU MÊS) · ainda não terminou nem pulou.
 *   Quem já usa Finanças nunca vê — nem se a chave for ligada pra todo mundo.
 *
 * ── A TELA DO NÚMERO É SÓ O NÚMERO (17/10, revisão do dono no Simulador) ─────────────────────────
 *   "Quando mostra o 'quanto posso gastar hoje' ele deveria ser o foco, só que ele é dividido pelo 'já
 *   gastou alguma coisa hoje?'. Isso deveria aparecer no tutorial em si, não no montar o plano." A tela
 *   final (origem "missao") é o número como herói — "VOCÊ PODE GASTAR HOJE / R$ X por dia" (sobe de 0 em
 *   ~0,6 s), a linha curta e A CONTA DO SEU MÊS — e o botão "Continuar →". O 1º gasto ("Já gastou com
 *   alguma coisa hoje?", os chips, "Ainda não gastei nada hoje") saiu daqui: é o tutorial guiado no
 *   formulário de verdade de Finanças, que a missão abre em seguida (missao-doses/PassoDoDia).
 *   FECHAR O APP ANTES DE VER O NÚMERO (B11): o Montar já está decidido ("pronto" grava na entrada do
 *   "Montando"); se o app morre no "Montando…", a tela volta NO NÚMERO, no mesmo dia e na mesma conta
 *   (`numero` na marca do aparelho; `deveMostrarMontarFinancas` responde sim enquanto ela existir). O número
 *   VISTO é tela de uma vez: sai da marca assim que aparece — reabrir depois disso leva direto pro
 *   tutorial do 1º gasto (a missão retoma o passo do gasto), nunca de novo pra tela do número.
 *   Evento do passo inteiro (número → tutorial → 1º gasto): `missao_doses_primeiro_gasto` (EV_PRIMEIRO_GASTO).
 *
 * ── UMA VEZ SÓ (chamado de 14/10: "toda vez que eu entro aparece o tutorial") ────────────────
 *   O "feito/pulou" fica em DOIS lugares: no aparelho (`core-montar-financas`, em
 *   CHAVES_DO_APARELHO — nenhuma vassoura leva) e na conta (mesma chave via useUserData, volta
 *   no login em outro aparelho). Fechar o app NO MEIO (sem Pular nem Pronto) deixa ver de novo,
 *   mas no máximo 2 aberturas (1 vista por abertura do app): a 2ª vista sem decisão é a última —
 *   e ela volta com o que já tinha sido respondido (rascunho na mesma chave do aparelho).
 *
 * ── UMA TELA POR VEZ ────────────────────────────────────────────────────────────────────────
 *   A tela abria pelo módulo (1ª abertura de Finanças) ou pela missão (dose 1 de Finanças); desde
 *   17/10 só pela missão. `registrarTelaAberta` conta as abertas; se a do módulo for religada, ela
 *   cede pra da missão e não abre por cima dela.
 */
import { isNativeShell } from "@/lib/native-shell";
import { computeDailyBudget } from "@/lib/finance-totals";
import { localDayKey } from "@/lib/utils";

export type ModoChave = "on" | "off";
/** App das lojas. ROLLBACK = "off" aqui (ou metadata `montar_financas: "off"` no RevenueCat, sem build). */
export const MONTAR_FINANCAS: ModoChave = "on";
/** Site (Vercel). */
export const MONTAR_FINANCAS_WEB: ModoChave = "off";
/**
 * A tela abre SOZINHA quando a pessoa entra em Finanças? DESLIGADO (17/10, dono: "não quero que a
 * pessoa clique em um módulo e apareça um quiz — é só se a pessoa escolher primeiro"). Quem abre é a
 * missão do teste, na 1ª dose de quem escolheu dinheiro/"tudo" (origem "missao"); quem abre Finanças
 * por curiosidade ganha o tutorial guiado do 1º gasto (outro ramo). Com `false`, pages/Index nunca
 * mostra a tela nem espera em branco pelo dado da conta. `true` religa a abertura pelo módulo.
 */
export const MONTAR_FINANCAS_NO_MODULO: boolean = false;

/** Nome da chave no metadata das offerings do RevenueCat. */
export const CHAVE_REMOTA_MONTAR_FINANCAS = "montar_financas";
/** Força de QA (só navegador) — sem prefixo varrido, sobrevive às vassouras. */
export const CHAVE_FORCA_MONTAR_FINANCAS = "montar-financas-force";
export const PARAM_QA_MONTAR_FINANCAS = "montar-financas";

/** "Já vi / feito" — no aparelho (localStorage direto) E na conta (useUserData). Ver chaves-do-aparelho.ts. */
export const CHAVE_MONTAR_FINANCAS = "core-montar-financas";

/** Eventos de analytics (dados sem valor em reais — só contagens e passo).
 *  `montar_financas_passo.n`: 1 renda · 2 contas · 3 cartão · 4 resultado. */
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
export interface RascunhoMontar { etapa: EtapaComRascunho; faixa: string | null; renda: number; contas: ContaEscolhida[]; cartao?: RespostaCartao }
export type EtapaComRascunho = "renda" | "contas" | "cartao";
/** A resposta do passo do cartão. `usa: null` = ainda não respondeu; `banco: null` = não escolheu. */
export interface RespostaCartao { usa: boolean | null; banco: string | null; valor: number; dia: number | null }
export const CARTAO_VAZIO: RespostaCartao = { usa: null, banco: null, valor: 0, dia: null };
export interface MarcaMontar { r?: Resultado; em?: string; vistas?: number; rascunho?: RascunhoMontar; numero?: TelaDoNumero }
/**
 * A tela do número AINDA NÃO VISTA (B11): o que ela respondeu, pra refazer a conta igual. `conta` é o
 * `created_at` da conta — a marca do aparelho não é por conta, e outra pessoa que entrar neste celular nunca
 * pode ver o número de quem saiu. `dia`: só volta no mesmo dia.
 */
export interface TelaDoNumero {
  conta: string;
  dia: string;
  renda: number;
  faixa: string | null;
  contas: ContaEscolhida[];
  cartao: RespostaCartao;
}

/**
 * O PASSO 1 DE FINANÇAS DA MISSÃO, do número ao 1º gasto, num evento só (17/10):
 *   `missao_doses_primeiro_gasto {acao, ms, ...}` — acao: "resultado" (a tela do número apareceu) · "continuar"
 *   (tocou "Continuar →") · "tutorial" (o post-it do 1º gasto apareceu no formulário de verdade) · "chip" (tocou
 *   um pronto, com o nome do chip) · "escrever" ("✎ escrever o meu") · "gasto" (o gasto entrou, `via` chip |
 *   digitado) · "nao_gastei" ("Ainda não gastei nada hoje") · "olha" (o balão do MEU MÊS apareceu).
 *   `ms` = desde a tela do número aparecer NESTA abertura do app (null depois de reabrir); os do tutorial levam
 *   também `ms_tutorial` (desde o post-it). Nunca valor em reais. Vai no envelope da missão (eventoDaMissao).
 */
export const EV_PRIMEIRO_GASTO = "missao_doses_primeiro_gasto";
let resultadoVistoEm: number | null = null;
/** A tela do número acabou de aparecer (o relógio do passo 1 começa aqui). */
export const marcarResultadoVisto = (agora: number = Date.now()): void => { resultadoVistoEm = agora; };
/** ms desde a tela do número (nesta abertura do app), ou null. */
export const msDesdeOResultado = (agora: number = Date.now()): number | null => (resultadoVistoEm === null ? null : Math.max(0, agora - resultadoVistoEm));
/** Só testes. */
export const _zerarResultadoVisto = (): void => { resultadoVistoEm = null; };

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
  if (!r || (r.etapa !== "renda" && r.etapa !== "contas" && r.etapa !== "cartao")) return null;
  let contas: ContaEscolhida[] = Array.isArray(r.contas) ? r.contas : [];
  let cartao = lerRespostaCartao(r.cartao);
  // rascunho de antes do passo do cartão: o chip "💳 Cartão" das contas fixas vira a resposta do cartão
  const antigo = contas.find((c) => c?.id === "cartao");
  if (antigo) {
    contas = contas.filter((c) => c?.id !== "cartao");
    if (cartao.usa === null) cartao = { ...cartao, usa: true, valor: Number(antigo.valor) || 0 };
  }
  return { etapa: r.etapa, faixa: typeof r.faixa === "string" ? r.faixa : null, renda: Number(r.renda) || 0, contas, cartao };
}
const lerRespostaCartao = (v: unknown): RespostaCartao => {
  const c = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof RespostaCartao, unknown>>;
  const dia = Number(c.dia);
  return {
    usa: c.usa === true ? true : c.usa === false ? false : null,
    banco: typeof c.banco === "string" && (c.banco === BANCO_OUTRO || BANCOS_DO_CARTAO.some((b) => b.value === c.banco)) ? c.banco : null,
    valor: Math.max(0, Math.round(Number(c.valor) || 0)),
    dia: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
  };
};

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
  const { rascunho: _r, numero: _n, ...sem } = marcaDoAparelho() ?? {};
  const marca: MarcaMontar = { ...sem, r, em: new Date().toISOString() };
  ls.set(CHAVE_MONTAR_FINANCAS, JSON.stringify(marca));
  return marca;
}

/* ───────────────────────── a tela do número ainda não vista (B11) ───────────────────────── */

/** Guarda a tela do número por ver — só depois do "pronto" (na entrada do "Montando…"). */
export function guardarTelaDoNumero(t: TelaDoNumero): void {
  const m = marcaDoAparelho();
  if (m?.r !== "pronto") return;
  ls.set(CHAVE_MONTAR_FINANCAS, JSON.stringify({ ...m, numero: t }));
}
/** A tela do número desta conta, de hoje, ainda não vista — ou null. */
export function lerTelaDoNumero(criadoEm: string | null | undefined, agora: Date = new Date()): TelaDoNumero | null {
  const m = marcaDoAparelho();
  const t = m?.numero;
  if (m?.r !== "pronto" || !t || typeof t !== "object") return null;
  if (!criadoEm || t.conta !== criadoEm || t.dia !== localDayKey(agora)) return null;
  return {
    conta: t.conta, dia: t.dia, renda: Number(t.renda) || 0, faixa: typeof t.faixa === "string" ? t.faixa : null,
    contas: Array.isArray(t.contas) ? t.contas : [], cartao: lerRespostaCartao(t.cartao),
  };
}
/** A tela do número apareceu (ou ela saiu dela): não volta mais. */
export function fecharTelaDoNumero(): void {
  const m = marcaDoAparelho();
  if (!m?.numero) return;
  const { numero: _n, ...sem } = m;
  ls.set(CHAVE_MONTAR_FINANCAS, JSON.stringify(sem));
}

/** "Pra hoje": o que dá por dia menos o que ela já gastou hoje (pode passar: negativo). Hoje só a linha "Sobram R$ X
 *  pra hoje" do painel limpo (Dashboard, desligado na 1.0.16) usa — o Dashboard de sempre mostra a média do mês refeita. */
export const sobraPraHoje = (porDia: number, gastoHoje: number): number => Math.round((Math.round(porDia) - (Number(gastoHoje) || 0)) * 100) / 100;

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
  // fechou o app NA tela do número (já decidido, já com dado no módulo): a tela volta lá, hoje (B11)
  if (lerTelaDoNumero(criadoEm, new Date(agora))) return true;
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
/** Contas fixas mais comuns, com valor típico (ajustável) e a categoria de FIXED_CATEGORIES.
 *  Sem "Cartão" (saiu em 16/10): a fatura tem o passo dela — nos dois lugares, contava duas vezes. */
export const CONTAS_SUGERIDAS: ContaSugerida[] = [
  { id: "aluguel", nome: "Aluguel", emoji: "🏠", valor: 900, categoria: "moradia" },
  { id: "luz", nome: "Luz", emoji: "💡", valor: 150, categoria: "contas_casa" },
  { id: "agua", nome: "Água", emoji: "💧", valor: 80, categoria: "contas_casa" },
  { id: "internet", nome: "Internet", emoji: "📶", valor: 100, categoria: "internet_telefone" },
  { id: "celular", nome: "Celular", emoji: "📱", valor: 60, categoria: "internet_telefone" },
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

/* ───────────────────────── o cartão ───────────────────────── */

/** Os bancos do chip "Qual cartão?" — MESMOS `value`/rótulo das bandeiras de DEFAULT_CARDS
 *  (lib/finance-cards; o teste confere). Copiados pra não puxar o hook do useUserData pro grafo do
 *  revenuecat.ts. `de` é a contração certa: "Fatura do Nubank", "Fatura da Caixa". */
export interface BancoDoCartao { value: string; label: string; de: "do" | "da" }
export const BANCOS_DO_CARTAO: BancoDoCartao[] = [
  { value: "nubank", label: "Nubank", de: "do" },
  { value: "itau", label: "Itaú", de: "do" },
  { value: "bradesco", label: "Bradesco", de: "do" },
  { value: "santander", label: "Santander", de: "do" },
  { value: "bb", label: "Banco do Brasil", de: "do" },
  { value: "caixa", label: "Caixa", de: "da" },
  { value: "inter", label: "Inter", de: "do" },
  { value: "c6", label: "C6 Bank", de: "do" },
  { value: "picpay", label: "PicPay", de: "do" },
  { value: "neon", label: "Neon", de: "do" },
];
/** Chip "Outro" (cartão de loja, Mercado Pago…) e quem não escolhe: cartão personalizado com este nome. */
export const BANCO_OUTRO = "outro";
export const NOME_DO_CARTAO_SEM_BANCO = "Cartão";
/** A descrição do custo fixo — genérica de propósito: renomear o cartão não deixa o nome velho. */
export const DESCRICAO_DA_FATURA = "Fatura do cartão";

const bancoDe = (v: string | null | undefined) => BANCOS_DO_CARTAO.find((b) => b.value === v) ?? null;
/** "Fatura do Nubank" / "Fatura da Caixa" / "Fatura do cartão". */
export const nomeDaFaturaNaTela = (banco: string | null | undefined): string => {
  const b = bancoDe(banco);
  return b ? `Fatura ${b.de} ${b.label}` : "Fatura do cartão";
};

/** Respondeu "uso" e deu valor e dia: o cartão entra. */
export const cartaoCompleto = (r: RespostaCartao | null | undefined): r is RespostaCartao & { usa: true; dia: number } =>
  !!r && r.usa === true && r.valor > 0 && Number.isInteger(r.dia) && (r.dia as number) >= 1 && (r.dia as number) <= 31;

const diasNoMes = (agora: Date) => new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
/** O dia em que vence NESTE mês: "dia 31" em novembro é o dia 30 (como o MEU MÊS e o aviso de véspera). */
export const diaDoVencimentoNoMes = (dia: number, agora: Date = new Date()): number => Math.min(dia, diasNoMes(agora));
/** A fatura deste mês já venceu? (então ela entra como paga — ninguém quer ver "atrasada" no 1º dia) */
export const faturaJaVenceu = (dia: number, agora: Date = new Date()): boolean => diaDoVencimentoNoMes(dia, agora) < agora.getDate();
/** "YYYY-MM" de uma data local (a chave do "paguei" da fatura). */
export const mesDe = (agora: Date): string => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

/** O custo fixo da fatura, no formato do FixedExpensesTable (+ o carimbo de paga, se já venceu). */
export function fixoDaFatura(r: RespostaCartao & { dia: number }, card: string, agora: Date = new Date()) {
  return {
    id: `mf-${agora.getTime()}-cartao`,
    description: DESCRICAO_DA_FATURA,
    category: "fatura_cartao",
    value: r.valor,
    paymentMethod: "credito",
    cardName: card,
    faturaDoCartao: true as const,
    ...(faturaJaVenceu(r.dia, agora) ? { pagoEm: mesDe(agora) } : {}),
  };
}

/** O vencimento no cartão: o que a engrenagem do TOTAL POR CARTÃO grava pra cartão novo (só o
 *  vencimento + "conta no mês do vencimento"). Quem já tinha FECHAMENTO fica com ele (a regra do
 *  fechamento é mais precisa e o `mesDoVencimento` só vale sem ele — finance-cards `setConfig`). */
export const configDoCartao = (dia: number, atual?: { closingDay?: number } | null) =>
  ({ closingDay: atual?.closingDay, dueDay: dia, mesDoVencimento: true });

/** O número da tela final — a MESMA função do card "QUANTO POSSO GASTAR HOJE" do Dashboard.
 *  Com o cartão, a fatura é mais um fixo (é o que ela vira no módulo): sai do mês inteira. */
export function calcularMontar(renda: number, contas: ContaEscolhida[], agora: Date = new Date(), cartao?: RespostaCartao | null) {
  const validas = contasValidas(contas);
  const fixos = validas.reduce((s, c) => s + c.valor, 0);
  const fatura = cartaoCompleto(cartao) ? cartao.valor : 0;
  const fixosComoNoModulo = [...validas.map((c) => ({ id: c.id, value: c.valor })), ...(fatura ? [{ id: "fatura", value: fatura }] : [])];
  const base = computeDailyBudget(renda, fixos + fatura, [], fixosComoNoModulo, agora);
  return {
    renda, fixos, contas: validas.length, fatura, cartao: fatura > 0,
    livre: base.availableReal, porDia: base.cantSpend ? 0 : Math.round(base.perDay), dias: base.remainingDays, semFolga: base.cantSpend,
  };
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
