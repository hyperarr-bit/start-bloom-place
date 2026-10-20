/**
 * FUNIL WEB NOVO — coreaplicativo.com.br/hoje (18/10). As regras puras (sem React): a chave, os planos, as faixas e
 * contas, a conta do número e o que vira dado de Finanças. Testado em src/test/funil-hoje.test.tsx.
 *
 * Desenho aprovado pelo dono (ramo funil-web-zero, /dev/funil-novo) + decisões de 18/10:
 *   · gateway ASAAS (Pix na página, QR estático sem CPF); a Cakto está com problema e não entra;
 *   · ANUAL "1º ano R$ 27,90 no Pix": 365 dias, NÃO renova sozinho ("daqui a 1 ano você decide se renova");
 *     MENSAL R$ 14,90 no Pix: 30 dias, sem renovação (fica como comparação);
 *   · sem o aviso "o Pix aparece em nome de…": no lugar, só "CORE · CNPJ …" (lib/empresa) na tela do Pix;
 *   · order bump (Kit Primeiro Mês Organizado +R$ 9,90, no MESMO Pix) e upsells depois do pagamento (pra sempre +R$ 47
 *     → se recusar, pra sempre por R$ 27 → vida a dois +R$ 19,90), cada um com "Não, obrigado" e chave própria aqui.
 *   · 20/10: OFERTA_HOJE = "vitalicio" (padrão) troca tudo isso pela oferta do /inicio — vitalício R$ 27,90, 1 Pix, sem
 *     upsells (ver a chave abaixo); "anual" volta pro desenho acima.
 * As ofertas do servidor (centavos e o que cada uma concede) moram em supabase/functions/_shared/ofertas-hoje.ts —
 * o teste confere que os valores daqui batem com os de lá.
 */
import { computeDailyBudget } from "@/lib/finance-totals";
import { localDayKey } from "@/lib/utils";

/* ───────────────────────── a chave ───────────────────────── */

export type ModoChave = "on" | "off";
/** O funil inteiro. Padrão OFF no build até o dono ligar (ROLLBACK = "off" + push). Desligado, /hoje leva pra landing
 *  "/" com a mesma query (utm/fbclid). QA: `?funil-hoje=on` (fica neste navegador; `?funil-hoje=off` tira). */
export const FUNIL_HOJE: ModoChave = "on";
export const PARAM_QA_HOJE = "funil-hoje";
export const CHAVE_FORCA_HOJE = "funil-hoje-force";

/** Cada oferta extra tem a SUA chave (o dono pode tirar uma sem mexer nas outras). */
export const BUMP_KIT: boolean = false; // 19/10: dono tirou ("tá confundindo"); vira upsell depois
export const UPSELL_PRA_SEMPRE: boolean = true;
export const DOWNSELL_PRA_SEMPRE_27: boolean = true;
/** "Organize a vida a dois" (hc199): DESLIGADO no lançamento (dono, 18/10) — ele quer um espaço COMPARTILHADO de
 *  verdade (finanças da casa, mercado, metas do casal, quem pagou o quê e acerto no fim do mês), que ainda não existe;
 *  não vender o que não existe. O código, a oferta e a ação `parceiro` continuam; `true` religa. */
export const UPSELL_A_DOIS: boolean = false;

/**
 * O QUE O /hoje VENDE (dono, 20/10): a MESMA oferta do /inicio — VITALÍCIO R$ 27,90, um Pix só ("Pague 1x. Seu pra
 * sempre.") — pra comparar os dois funis com justiça.
 *   "vitalicio" (padrão): oferta `hv279` (2790, vitalício, conta como PLANO do /hoje no servidor: crédito, Finanças,
 *                boas-vindas, CAPI Purchase 27,90, UTMify e reconcile iguais ao h279). Tela com UMA opção, sem a escolha
 *                anual × mensal e sem a linha "renova por R$ 97,90"; depois de pagar NÃO tem o upsell pra sempre 47 nem o
 *                downsell 27 (seriam o mesmo produto) — vai direto pro pós-compra (e-mail + lojas).
 *   "anual":     o de 18–19/10 — 1º ano R$ 27,90 (h279) × mensal R$ 14,90 (h149) → upsell pra sempre 47 → downsell 27.
 * ROLLBACK = "anual" + push (as ofertas e as telas do anual continuam no código e nos testes).
 * Todo evento do /hoje leva `oferta_hoje: "vitalicio" | "anual"`.
 */
export type ModoOfertaHoje = "vitalicio" | "anual";
export const OFERTA_HOJE: ModoOfertaHoje = "vitalicio";
let ofertaForcada: ModoOfertaHoje | null = null;
/** Só testes (roda as suítes do anual com a chave no vitalício). `null` volta pro OFERTA_HOJE. */
export const _forcarOfertaHoje = (m: ModoOfertaHoje | null): void => { ofertaForcada = m; };
export const modoOfertaHoje = (): ModoOfertaHoje => ofertaForcada ?? OFERTA_HOJE;

let forcaNaMemoria: ModoChave | null = null;
/** Só testes. */
export const _zerarForcaHoje = (): void => { forcaNaMemoria = null; };

/** Lê `?funil-hoje=` e responde se o funil está ligado AQUI. A força fica no heap também (o Instagram zera o storage). */
export function funilHojeLigado(busca: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(busca).get(PARAM_QA_HOJE); } catch { /* noop */ }
  if (v === "on" || v === "off") {
    forcaNaMemoria = v;
    try { localStorage.setItem(CHAVE_FORCA_HOJE, v); } catch { /* storage bloqueado: fica o heap */ }
  }
  let f: string | null = forcaNaMemoria;
  if (!f) { try { f = localStorage.getItem(CHAVE_FORCA_HOJE); } catch { f = null; } }
  if (f === "on") return true;
  if (f === "off") return false;
  return FUNIL_HOJE === "on";
}

/* ───────────────────────── planos e ofertas ───────────────────────── */

export type PlanoHoje = "anual" | "mensal";
export type OfertaHoje = "h279" | "h149" | "h279k" | "h149k" | "hv279" | "hv47" | "hv27" | "hc199";

/** O preço de cada oferta em REAIS (o servidor guarda em centavos: ofertas-hoje.ts PRECOS_HOJE). */
export const VALOR_OFERTA: Record<OfertaHoje, number> = {
  h279: 27.9, h149: 14.9, h279k: 37.8, h149k: 24.8, hv279: 27.9, hv47: 47, hv27: 27, hc199: 19.9,
};
/** 20/10: o vitalício como PLANO do /hoje (OFERTA_HOJE = "vitalicio") — o mesmo produto/preço do /inicio (w27). */
export const PLANO_VITALICIO = { oferta: "hv279" as const, valor: 27.9, conteudo: "core_vitalicio_hoje" };
/** As ofertas que deixam a conta VITALÍCIA (o plano vitalício ou um upsell pra sempre). */
export const OFERTAS_PRA_SEMPRE: readonly OfertaHoje[] = ["hv279", "hv47", "hv27"];
export const ehPraSempre = (o: OfertaHoje | null | undefined): boolean => !!o && OFERTAS_PRA_SEMPRE.includes(o);
/** A compra PRINCIPAL (o plano: anual/mês/kit ou o vitalício) — não um upsell. */
export const ehPlanoDoHoje = (o: OfertaHoje | null | undefined): boolean => !!o && ["h279", "h149", "h279k", "h149k", "hv279"].includes(o);
export const PRECO_KIT = 9.9;
export const PRECO_ANUAL_DEPOIS = 97.9;

export const PLANOS: Record<PlanoHoje, { oferta: OfertaHoje; comKit: OfertaHoje; valor: number; dias: number; conteudo: string; conteudoKit: string }> = {
  anual: { oferta: "h279", comKit: "h279k", valor: 27.9, dias: 365, conteudo: "core_anual_hoje", conteudoKit: "core_anual_kit_hoje" },
  mensal: { oferta: "h149", comKit: "h149k", valor: 14.9, dias: 30, conteudo: "core_mensal_hoje", conteudoKit: "core_mensal_kit_hoje" },
};
/** A oferta do Pix principal: o plano, com ou sem o kit (o bump vai no MESMO Pix). */
export const ofertaDoPlano = (plano: PlanoHoje, kit: boolean): OfertaHoje => (kit && BUMP_KIT ? PLANOS[plano].comKit : PLANOS[plano].oferta);
export const temKit = (o: OfertaHoje | null | undefined): boolean => o === "h279k" || o === "h149k";

export const reais = (v: number, casas = 0): string =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
/** "R$ 47" / "R$ 27,90": centavos só quando existem. */
export const preco = (v: number): string => reais(v, Number.isInteger(v) ? 0 : 2);

/** O texto da linha pequena embaixo do botão (a renovação aparece UMA vez, aqui). */
export const LINHA_RENOVACAO: Record<PlanoHoje, string> = {
  anual: `Pagamento único. Nada é cobrado sozinho: daqui a 1 ano você decide se renova por ${reais(PRECO_ANUAL_DEPOIS, 2)}.`,
  mensal: "Pagamento único. Nada é cobrado sozinho: são 30 dias de acesso, sem renovação automática.",
};

/* ───────────────────────── as perguntas ───────────────────────── */
/* Faixas e contas = as do "Vamos montar suas Finanças" da 1.0.16 (lib/montar-financas no ramo v1016, ainda fora do
 * main), com as MESMAS categorias de FIXED_CATEGORIES — o número do funil é o número do app. O chip "Cartão" fica
 * (desenho aprovado) e vira o custo fixo "Fatura do cartão" na categoria Fatura Cartão. */

export interface Faixa { id: string; rotulo: string; valor: number }
export const FAIXAS: Faixa[] = [
  { id: "ate2", rotulo: "Até R$ 2 mil", valor: 1500 },
  { id: "2a4", rotulo: "R$ 2 a 4 mil", valor: 3000 },
  { id: "4a7", rotulo: "R$ 4 a 7 mil", valor: 5500 },
  { id: "7mais", rotulo: "Mais de R$ 7 mil", valor: 8000 },
];

export interface Conta { id: string; nome: string; emoji: string; valor: number; categoria: string }
export const CONTAS: Conta[] = [
  { id: "aluguel", nome: "Aluguel", emoji: "🏠", valor: 900, categoria: "moradia" },
  { id: "luz", nome: "Luz", emoji: "💡", valor: 150, categoria: "contas_casa" },
  { id: "internet", nome: "Internet", emoji: "📶", valor: 100, categoria: "internet_telefone" },
  { id: "celular", nome: "Celular", emoji: "📱", valor: 60, categoria: "internet_telefone" },
  { id: "streaming", nome: "Streaming", emoji: "🎬", valor: 45, categoria: "assinaturas" },
  { id: "cartao", nome: "Cartão", emoji: "💳", valor: 600, categoria: "fatura_cartao" },
  { id: "agua", nome: "Água", emoji: "💧", valor: 80, categoria: "contas_casa" },
  { id: "condominio", nome: "Condomínio", emoji: "🏢", valor: 400, categoria: "condominio" },
  { id: "academia", nome: "Academia", emoji: "🏋️", valor: 100, categoria: "academia" },
  { id: "saude", nome: "Plano de saúde", emoji: "🩺", valor: 300, categoria: "plano_saude" },
  { id: "carro", nome: "Carro", emoji: "🚗", valor: 400, categoria: "transporte_fixo" },
];
/** O nome que a conta ganha DENTRO de Finanças (o chip diz "Cartão"; no módulo é a fatura). */
const NOME_NO_MODULO: Record<string, string> = { cartao: "Fatura do cartão" };

/** Inteiro em reais a partir do que a pessoa digitou ("3.000", "R$ 3.000,50" → 3000). */
export const reaisDigitados = (t: string): number => {
  const so = String(t ?? "").split(",")[0].replace(/\D/g, "").slice(0, 7);
  return so ? parseInt(so, 10) : 0;
};

/** As contas escolhidas (id → valor) na ordem da lista, com o valor digitado. */
export const contasEscolhidas = (m: Record<string, number>): Conta[] =>
  CONTAS.filter((c) => c.id in m).map((c) => ({ ...c, valor: Math.max(0, Math.round(Number(m[c.id]) || 0)) }));

export interface Resultado { renda: number; fixos: number; n: number; livre: number; porDia: number; dias: number; aperto: boolean }
/** O número da tela 3 — a MESMA função do card QUANTO POSSO GASTAR HOJE (computeDailyBudget). */
export function calcular(renda: number, contas: Conta[], agora: Date = new Date()): Resultado {
  const validas = contas.filter((c) => c.valor > 0);
  const fixos = validas.reduce((s, c) => s + c.valor, 0);
  const b = computeDailyBudget(renda, fixos, [], validas.map((c) => ({ id: c.id, value: c.valor })), agora);
  return { renda, fixos, n: validas.length, livre: b.availableReal, porDia: b.cantSpend ? 0 : Math.round(b.perDay), dias: b.remainingDays, aperto: b.cantSpend };
}

/** Os itens EXATAMENTE no formato que IncomeTable/FixedExpensesTable gravam (o mesmo do Montar Finanças da 1.0.16):
 *  `finance-incomes` ← "Renda do mês" com a data de hoje; `finance-fixed-expenses` ← 1 fixo por conta (boleto). */
export function itensParaGravar(renda: number, contas: Conta[], agora: Date = new Date()) {
  const base = agora.getTime();
  const receita = renda > 0 ? [{ id: `fh-${base}`, description: "Renda do mês", value: renda, date: localDayKey(agora) }] : [];
  const fixos = contas.filter((c) => c.valor > 0).map((c, i) => ({
    id: `fh-${base}-${i + 1}`,
    description: NOME_NO_MODULO[c.id] ?? c.nome,
    category: c.categoria || "outros",
    value: c.valor,
    paymentMethod: "boleto",
  }));
  return { receita, fixos };
}

/* ───────────────────────── o acesso (só pros textos) ───────────────────────── */

/** O fim do acesso que a pessoa comprou até aqui (o servidor decide de verdade; isto é só o texto da tela). */
export function fimDoAcesso(plano: PlanoHoje, pagos: OfertaHoje[], desde: Date = new Date()): { vitalicio: boolean; fim: Date } {
  if (pagos.some(ehPraSempre)) return { vitalicio: true, fim: new Date(desde.getTime() + 100 * 365 * 86_400_000) };
  const fim = new Date(desde);
  fim.setDate(fim.getDate() + PLANOS[plano].dias);
  return { vitalicio: false, fim };
}
export const dataCurta = (d: Date): string =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Chave do kit na conta (user_data): o app libera o conteúdo do Kit Primeiro Mês por ela. */
export const CHAVE_KIT = "core-kit-primeiro-mes";

/** As 16 áreas do app nos pastéis da Home (a tela do número). */
export const AREAS: { nome: string; emoji: string; cor: string }[] = [
  { nome: "Finanças", emoji: "💰", cor: "#fef3c7" },
  { nome: "Rotina", emoji: "☀️", cor: "#fce7f3" },
  { nome: "Treino", emoji: "💪", cor: "#dbeafe" },
  { nome: "Saúde", emoji: "🩺", cor: "#dcfce7" },
  { nome: "Dieta", emoji: "🥗", cor: "#ecfccb" },
  { nome: "Casa", emoji: "🏡", cor: "#ffedd5" },
  { nome: "Estudos", emoji: "📚", cor: "#ede9fe" },
  { nome: "+ 9", emoji: "✨", cor: "#f4f4f5" },
];
