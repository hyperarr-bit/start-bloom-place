import { BookOpen, CalendarCheck, CalendarClock, Droplets, Dumbbell, Moon, PiggyBank, Receipt, Smile, Utensils, type LucideIcon } from "lucide-react";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { ActionId } from "@/components/home/QuickActions";
import { TOM_DO_MODULO, TOM_DO_TIPO, type Tom } from "@/components/home-nova/e/paleta";
import { doPerfil, doPerfilDueDays, PERFIL_PESSOAL } from "@/lib/finance-perfil";
import { somaParcelasDoMes, type Parcela } from "@/lib/finance-parcelas";
import { computeDailyBudget, computeLooseBillsOutflow, computeMonthlyOutflow } from "@/lib/finance-totals";
import { CHAVE_CUIDADOS, cuidadosValidos, faltaDoCuidado, ordenarCuidados } from "@/lib/beleza-cuidados";
import { localDayKey } from "@/lib/utils";

/**
 * OS WIDGETS DA HOME NOVA (rodada 3, 26/10 — dono: "reformular no estilo Cal AI e tirar o excesso"). Um formato único
 * de card (número grande + rótulo curto + anel ou ícone, dado REAL, como os 3 resumos da página 1) e um catálogo
 * enxuto: só o que tem dado útil. Widget sem dado = estado vazio ÚTIL (uma ação pra cadastrar), nunca só a descrição.
 * A lista mora na conta em `core-home-widgets-e` (ids, na ordem da escolha, até 4); quem tinha os widgets antigos
 * (`core-home-widgets-v2`) é migrado na 1ª leitura (os que têm par). R$ nunca aparece aqui (regra da casa: valor só
 * dentro de Finanças) — o orçamento vem em % do que sobra.
 */
export type IdDoWidgetE = "proxima-conta" | "orcamento" | "calorias" | "treino" | "sono" | "leitura" | "habitos" | "agua" | "cuidados" | "humor";

export const CHAVE_WIDGETS_E = "core-home-widgets-e";
/** 26/10 (dono): no máximo 4 — 2×2, a mesma altura da página 1; 5 ou 6 viravam 3 linhas e esticavam o carrossel. */
export const MAX_WIDGETS_E = 4;
export const WIDGETS_E_PADRAO: IdDoWidgetE[] = ["proxima-conta", "orcamento", "treino", "sono"];

export interface DefWidgetE { id: IdDoWidgetE; rotulo: string; descricao: string; Icone: LucideIcon; tom: Tom; rota: string }
export const CATALOGO_WIDGETS_E: ReadonlyArray<DefWidgetE> = [
  { id: "proxima-conta", rotulo: "Próxima conta", descricao: "A conta que vence primeiro e em quantos dias", Icone: Receipt, tom: TOM_DO_MODULO.financas, rota: "/financas" },
  { id: "orcamento", rotulo: "Orçamento", descricao: "Quanto do mês ainda sobra pra gastar, em %", Icone: PiggyBank, tom: TOM_DO_MODULO.financas, rota: "/financas" },
  { id: "calorias", rotulo: "Calorias", descricao: "As kcal de hoje contra a meta", Icone: Utensils, tom: TOM_DO_MODULO.dieta, rota: "/dieta" },
  { id: "treino", rotulo: "Treino de hoje", descricao: "O treino do dia e se já foi", Icone: Dumbbell, tom: TOM_DO_MODULO.treino, rota: "/treino" },
  { id: "sono", rotulo: "Sono", descricao: "As horas da última noite", Icone: Moon, tom: TOM_DO_TIPO.sono, rota: "/saude" },
  { id: "leitura", rotulo: "Leitura", descricao: "O livro atual e quanto já foi", Icone: BookOpen, tom: TOM_DO_MODULO.biblioteca, rota: "/biblioteca" },
  { id: "habitos", rotulo: "Hábitos", descricao: "Os hábitos do dia feitos", Icone: CalendarCheck, tom: TOM_DO_TIPO.habitos, rota: "/rotina" },
  { id: "agua", rotulo: "Água", descricao: "Os copos da meta de hoje", Icone: Droplets, tom: TOM_DO_TIPO.agua, rota: "/saude" },
  { id: "cuidados", rotulo: "Próximo cuidado", descricao: "Unha, sobrancelha, depilação: o que vence primeiro", Icone: CalendarClock, tom: TOM_DO_MODULO.beleza, rota: "/beleza?aba=cuidados" },
  // 1.0.19 (dono 26/10: "Água/Humor de 1 toque" no padrão da conta nova): o humor de hoje, registrado no "+" em 1 toque
  { id: "humor", rotulo: "Humor", descricao: "Como você está hoje, em 1 toque", Icone: Smile, tom: TOM_DO_TIPO.humor, rota: "/desenvolvimento" },
];
const VALIDOS = new Set<string>(CATALOGO_WIDGETS_E.map((w) => w.id));
export const defDoWidgetE = (id: IdDoWidgetE): DefWidgetE => CATALOGO_WIDGETS_E.find((w) => w.id === id)!;

/** os widgets antigos (core-home-widgets-v2) que têm par no catálogo novo */
const DO_ANTIGO: Record<string, IdDoWidgetE> = {
  finances: "proxima-conta", "budget-remaining": "orcamento", calories: "calorias", workout: "treino", "sleep-log": "sono",
  reading: "leitura", habits: "habitos", health: "agua", cuidados: "cuidados",
};

/** O que está gravado → uma lista válida (ids conhecidos, sem repetir, até 4). null = nada gravado. */
export function normalizarWidgetsE(v: unknown): IdDoWidgetE[] | null {
  if (!Array.isArray(v)) return null;
  const lista = v.filter((x): x is IdDoWidgetE => typeof x === "string" && VALIDOS.has(x));
  return lista.filter((x, i) => lista.indexOf(x) === i).slice(0, MAX_WIDGETS_E);
}

/** A lista a mostrar: a gravada; senão a migrada dos widgets antigos (os que têm par); senão a padrão (`padrao`: a da
 *  conta nova, `widgetsDoNovato`; sem ela, WIDGETS_E_PADRAO como sempre). */
export function widgetsE(gravado: unknown, antigos: unknown, padrao: IdDoWidgetE[] = WIDGETS_E_PADRAO): IdDoWidgetE[] {
  const lista = normalizarWidgetsE(gravado);
  if (lista) return lista;
  if (Array.isArray(antigos) && antigos.length > 0) {
    const migrados = antigos.map((w) => (w && typeof w === "object" ? DO_ANTIGO[String((w as { id?: unknown }).id)] : undefined)).filter((x): x is IdDoWidgetE => !!x);
    const unicos = migrados.filter((x, i) => migrados.indexOf(x) === i).slice(0, MAX_WIDGETS_E);
    if (unicos.length > 0) return unicos;
  }
  return padrao;
}

/** Liga/desliga (até 4; a ordem é a da escolha). */
export function alternarWidgetE(atuais: IdDoWidgetE[], id: IdDoWidgetE): IdDoWidgetE[] {
  if (atuais.includes(id)) return atuais.filter((x) => x !== id);
  if (atuais.length >= MAX_WIDGETS_E) return atuais;
  return [...atuais, id];
}

/* ------------------------------------------------------------------ o dado de cada widget */
export interface DadoDoWidgetE {
  id: IdDoWidgetE;
  rotulo: string;
  Icone: LucideIcon;
  tom: Tom;
  /** o número grande (já formatado) */
  numero: string;
  /** a unidade pequena ao lado ("/8", "%", "h", "dias") */
  unidade?: string;
  /** a linha curta embaixo do número (nome do livro, "vence amanhã"…) */
  detalhe?: string;
  /** o anel (null = ícone no disco) */
  fracao: { valor: number; max: number } | null;
  /** feito/completo: ✓ no anel */
  completo?: boolean;
  /** sem dado: o estado vazio útil — um convite curto + a ação que cadastra (`acao`: abre o formulário do "+" em 1 toque
   *  em vez de ir pro módulo) */
  vazio: { texto: string; cta: string; acao?: ActionId } | null;
  rota: string;
  /** um toque que abre o formulário do "+" em vez do módulo */
  action?: ActionId;
}

type Get = <T>(k: string, f: T) => T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const valor = (i: unknown): number => { const o = i as { value?: unknown; amount?: unknown } | null; return Number(o?.value) || Number(o?.amount) || 0; };
const diasTxt = (n: number) => (n === 0 ? "vence hoje" : n === 1 ? "vence amanhã" : `vence em ${n} dias`);

/** Os custos fixos do perfil ativo SEM dia de vencimento (finance-fixed-expenses sem `day` 1–31 — só os com dia viram
 *  conta no calendário, lib/finance-sync): os nomes. */
export function contasSemVencimento(get: Get): string[] {
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const fixas = doPerfil(lista(get<unknown>("finance-fixed-expenses", [])), perfil);
  return fixas
    .filter((f) => { const dia = Number((f as { day?: unknown } | null)?.day); return !(Number.isFinite(dia) && dia >= 1 && dia <= 31); })
    .map((f) => String((f as { description?: unknown; name?: unknown } | null)?.description ?? (f as { name?: unknown } | null)?.name ?? "").trim())
    .filter(Boolean);
}

/** % do orçamento do mês que ainda sobra (a MESMA conta do Finanças/BudgetRemainingWidget: computeDailyBudget); null sem renda. */
export function orcamentoRestante(get: Get): { pct: number; dias: number } | null {
  const perfil = get<string>("finance-perfil-ativo", PERFIL_PESSOAL) || PERFIL_PESSOAL;
  const incomes = doPerfil(lista(get<unknown>("finance-incomes", [])), perfil);
  const variaveis = doPerfil(lista(get<unknown>("finance-expenses", [])), perfil);
  const fixas = doPerfil(lista(get<unknown>("finance-fixed-expenses", [])), perfil);
  const parcelas = doPerfil(lista(get<unknown>("finance-installments", [])), perfil) as Parcela[];
  const dueDays = doPerfilDueDays(lista(get<unknown>("finance-dueDays", [])), perfil);
  const renda = incomes.reduce((s: number, i: unknown) => s + valor(i), 0);
  if (renda <= 0) return null;
  const saida = computeMonthlyOutflow(variaveis.reduce((s: number, e: unknown) => s + valor(e), 0), fixas.reduce((s: number, e: unknown) => s + valor(e), 0), somaParcelasDoMes(parcelas), computeLooseBillsOutflow(dueDays, fixas));
  const { availableReal, remainingDays } = computeDailyBudget(renda, saida, dueDays, fixas);
  return { pct: Math.max(0, Math.min(100, Math.round((availableReal / renda) * 100))), dias: remainingDays };
}

export function dadoDoWidgetE(id: IdDoWidgetE, d: LifeHubData, get: Get, hoje = localDayKey()): DadoDoWidgetE {
  const def = defDoWidgetE(id);
  const base = { id, rotulo: def.rotulo, Icone: def.Icone, tom: def.tom, rota: def.rota };
  switch (id) {
    case "proxima-conta": {
      if (d.nextBillName && d.nextBillDaysUntil !== null)
        return { ...base, numero: String(Math.max(0, d.nextBillDaysUntil)), unidade: d.nextBillDaysUntil === 1 ? "dia" : "dias", detalhe: `${d.nextBillName} · ${diasTxt(Math.max(0, d.nextBillDaysUntil))}`, fracao: null, vazio: null };
      // varredura novato (26/10): o Montar Finanças cadastra contas SEM dia de vencimento (Aluguel, Luz) e o widget dizia
      // "Nenhuma conta cadastrada" logo depois — honesto: a conta existe, falta a data
      const semData = contasSemVencimento(get);
      if (semData.length)
        return { ...base, numero: "—", fracao: null, vazio: { texto: semData.length === 1 ? `Que dia vence ${semData[0]}?` : `Que dia vencem ${semData[0]} e mais ${semData.length - 1}?`, cta: "Pôr o dia" } };
      return { ...base, numero: "—", fracao: null, vazio: { texto: "Te aviso antes de vencer", cta: "Cadastrar conta" } };
    }
    case "orcamento": {
      const o = orcamentoRestante(get);
      return o
        ? { ...base, numero: String(o.pct), unidade: "%", detalhe: o.pct === 0 ? "do mês já foi" : o.dias > 1 ? `sobra pra ${o.dias} dias` : "sobra pra hoje", fracao: { valor: o.pct, max: 100 }, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Veja quanto sobra no mês", cta: "Cadastrar renda" } };
    }
    case "calorias":
      return d.caloriesGoal > 0 && (d.mealsLogged > 0 || d.caloriesConsumed > 0)
        ? { ...base, numero: String(d.caloriesConsumed), unidade: `/${d.caloriesGoal}`, detalhe: "kcal hoje", fracao: { valor: d.caloriesConsumed, max: d.caloriesGoal }, vazio: null }
        : { ...base, numero: "0", unidade: `/${d.caloriesGoal}`, fracao: { valor: 0, max: d.caloriesGoal }, vazio: { texto: "O que você comeu hoje?", cta: "Registrar refeição", acao: "meal" } };
    case "treino":
      if (d.todayWorkoutGroup) return { ...base, numero: d.workoutDone ? "Feito" : "Hoje", detalhe: d.todayWorkoutGroup, fracao: { valor: d.workoutDone ? 1 : 0, max: 1 }, completo: d.workoutDone, vazio: null, action: d.workoutDone ? undefined : "workout" };
      if (d.workoutStatus === "descanso") return { ...base, numero: "Descanso", detalhe: "hoje o corpo recupera", fracao: null, vazio: null };
      return { ...base, numero: "—", fracao: null, vazio: { texto: "Um treino pronto em 20 s", cta: "Montar treino" } };
    case "sono": {
      const h = d.sleepHours;
      return h
        ? { ...base, numero: String(h).replace(".", ","), unidade: "h", detalhe: h >= 7 ? "noite boa" : h >= 5 ? "noite regular" : "pouco sono", fracao: { valor: Math.min(8, h), max: 8 }, vazio: null, action: "sleep" }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Como foi a noite?", cta: "Registrar sono", acao: "sleep" }, action: "sleep" };
    }
    case "leitura":
      return d.currentBook
        ? { ...base, numero: String(d.readingProgress), unidade: "%", detalhe: d.currentBook, fracao: { valor: d.readingProgress, max: 100 }, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "O que você está lendo?", cta: "Começar um livro" } };
    case "habitos": {
      const t = d.habits.length;
      const f = d.habits.filter((x) => x.done).length;
      return t > 0
        ? { ...base, numero: String(f), unidade: `/${t}`, detalhe: f >= t ? "todos feitos" : `${t - f} ${t - f === 1 ? "falta" : "faltam"}`, fracao: { valor: f, max: t }, completo: f >= t, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Comece com 1 hábito", cta: "Criar hábito" } };
    }
    case "agua": {
      const meta = Math.max(1, d.waterGoal);
      const v = Math.max(0, d.waterGlasses); // varredura 26/10: o número REAL (15/8); o anel enche e para (Anel limita)
      return { ...base, numero: String(v), unidade: `/${meta}`, detalhe: v >= meta ? "meta batida" : `${meta - v} ${meta - v === 1 ? "copo" : "copos"} pra meta`, fracao: { valor: v, max: meta }, completo: v >= meta, vazio: null, action: "water" };
    }
    case "cuidados": {
      const c = ordenarCuidados(cuidadosValidos(get<unknown>(CHAVE_CUIDADOS, [])), hoje)[0];
      const falta = c ? faltaDoCuidado(c, hoje) : undefined;
      if (!c || falta === undefined) return { ...base, numero: "—", fracao: null, vazio: { texto: "Lembre do próximo cuidado", cta: "Cadastrar cuidado" } };
      const n = Math.max(0, falta);
      return { ...base, numero: String(n), unidade: n === 1 ? "dia" : "dias", detalhe: `${c.nome} · ${falta < 0 ? "venceu" : n === 0 ? "é hoje" : n === 1 ? "amanhã" : `em ${n} dias`}`, fracao: null, vazio: null };
    }
    case "humor": {
      // o check de humor de hoje (a ação do "+" grava em core-mood-log: { value, emoji }); tocar abre o formulário
      const r = (get<Record<string, { value?: unknown; emoji?: unknown }>>("core-mood-log", {}) ?? {})[hoje];
      const emoji = typeof r?.emoji === "string" && r.emoji ? r.emoji : null;
      if (emoji) return { ...base, numero: emoji, detalhe: ROTULO_DO_HUMOR[Number(r?.value)] ?? "hoje", fracao: null, vazio: null, action: "mood" };
      if (d.registrosHoje?.humor) return { ...base, numero: "✓", detalhe: "registrado hoje", fracao: null, vazio: null, action: "mood" };
      return { ...base, numero: "—", fracao: null, vazio: { texto: "Como você está hoje?", cta: "Registrar humor", acao: "mood" }, action: "mood" };
    }
  }
}

/** Os rótulos das 5 caras do check de humor (os mesmos do formulário do "+"). */
const ROTULO_DO_HUMOR: Record<number, string> = { 1: "Péssimo", 2: "Ruim", 3: "Neutro", 4: "Bom", 5: "Ótimo" };

/** O resumo da página 1 que já mostra o mesmo número (Hábitos, Água, Refeições≈Calorias, Sono, Treino, Leitura). */
const NA_PAGINA_1: Partial<Record<IdDoWidgetE, string>> = { habitos: "habitos", agua: "agua", calorias: "refeicoes", sono: "sono", treino: "treino", leitura: "leitura" };

/**
 * 1.0.19 (dono 26/10: "3 dos 4 widgets da conta nova são vazios") — o PADRÃO da conta NOVA que nunca escolheu widgets:
 * primeiro o que JÁ TEM conteúdo (o que ela montou: o orçamento depois do Montar Finanças, a conta que vence, os
 * hábitos, o treino, o livro, o cuidado, a refeição/o sono/o humor de hoje); depois, pra completar, o que se faz em
 * 1 TOQUE no dia 1 (Sono e Humor — abrem o formulário do "+"). Nunca repete um resumo que já está na página 1
 * (`naPagina1`: os ids de metricasDoDia). Muda sozinho conforme ela usa, até ela escolher (core-home-widgets-e manda).
 */
export function widgetsDoNovato(d: LifeHubData, get: Get, naPagina1: ReadonlyArray<string> = [], hoje = localDayKey()): IdDoWidgetE[] {
  const out: IdDoWidgetE[] = [];
  const pagina1 = new Set(naPagina1);
  const por = (id: IdDoWidgetE) => { if (out.length < MAX_WIDGETS_E && !out.includes(id) && !(NA_PAGINA_1[id] && pagina1.has(NA_PAGINA_1[id]!))) out.push(id); };
  const temConteudo = (id: IdDoWidgetE) => dadoDoWidgetE(id, d, get, hoje).vazio === null;
  for (const id of ["orcamento", "proxima-conta", "habitos", "treino", "leitura", "cuidados", "calorias", "sono", "humor"] as const) if (temConteudo(id)) por(id);
  // a conta que o Montar Finanças cadastrou sem dia: "Que dia vence Aluguel?" — é o passo seguinte do que ela acabou de fazer
  if (contasSemVencimento(get).length > 0) por("proxima-conta");
  por("sono");
  por("humor");
  return out;
}
