import { BookOpen, CalendarCheck, CalendarClock, Droplets, Dumbbell, Moon, PiggyBank, Receipt, Utensils, type LucideIcon } from "lucide-react";
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
export type IdDoWidgetE = "proxima-conta" | "orcamento" | "calorias" | "treino" | "sono" | "leitura" | "habitos" | "agua" | "cuidados";

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

/** A lista a mostrar: a gravada; senão a migrada dos widgets antigos (os que têm par); senão a padrão. */
export function widgetsE(gravado: unknown, antigos: unknown): IdDoWidgetE[] {
  const lista = normalizarWidgetsE(gravado);
  if (lista) return lista;
  if (Array.isArray(antigos) && antigos.length > 0) {
    const migrados = antigos.map((w) => (w && typeof w === "object" ? DO_ANTIGO[String((w as { id?: unknown }).id)] : undefined)).filter((x): x is IdDoWidgetE => !!x);
    const unicos = migrados.filter((x, i) => migrados.indexOf(x) === i).slice(0, MAX_WIDGETS_E);
    if (unicos.length > 0) return unicos;
  }
  return WIDGETS_E_PADRAO;
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
  /** sem dado: o estado vazio útil — texto curto + a ação que cadastra */
  vazio: { texto: string; cta: string } | null;
  rota: string;
  /** um toque que abre o formulário do "+" em vez do módulo */
  action?: ActionId;
}

type Get = <T>(k: string, f: T) => T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const valor = (i: unknown): number => { const o = i as { value?: unknown; amount?: unknown } | null; return Number(o?.value) || Number(o?.amount) || 0; };
const diasTxt = (n: number) => (n === 0 ? "vence hoje" : n === 1 ? "vence amanhã" : `vence em ${n} dias`);

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
    case "proxima-conta":
      return d.nextBillName && d.nextBillDaysUntil !== null
        ? { ...base, numero: String(Math.max(0, d.nextBillDaysUntil)), unidade: d.nextBillDaysUntil === 1 ? "dia" : "dias", detalhe: `${d.nextBillName} · ${diasTxt(Math.max(0, d.nextBillDaysUntil))}`, fracao: null, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Nenhuma conta cadastrada", cta: "Cadastrar conta" } };
    case "orcamento": {
      const o = orcamentoRestante(get);
      return o
        ? { ...base, numero: String(o.pct), unidade: "%", detalhe: o.pct === 0 ? "do mês já foi" : o.dias > 1 ? `sobra pra ${o.dias} dias` : "sobra pra hoje", fracao: { valor: o.pct, max: 100 }, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Sem renda cadastrada", cta: "Cadastrar renda" } };
    }
    case "calorias":
      return d.caloriesGoal > 0 && (d.mealsLogged > 0 || d.caloriesConsumed > 0)
        ? { ...base, numero: String(d.caloriesConsumed), unidade: `/${d.caloriesGoal}`, detalhe: "kcal hoje", fracao: { valor: d.caloriesConsumed, max: d.caloriesGoal }, vazio: null }
        : { ...base, numero: "0", unidade: `/${d.caloriesGoal}`, fracao: { valor: 0, max: d.caloriesGoal }, vazio: { texto: "Nada registrado hoje", cta: "Registrar refeição" } };
    case "treino":
      if (d.todayWorkoutGroup) return { ...base, numero: d.workoutDone ? "Feito" : "Hoje", detalhe: d.todayWorkoutGroup, fracao: { valor: d.workoutDone ? 1 : 0, max: 1 }, completo: d.workoutDone, vazio: null, action: d.workoutDone ? undefined : "workout" };
      if (d.workoutStatus === "descanso") return { ...base, numero: "Descanso", detalhe: "hoje o corpo recupera", fracao: null, vazio: null };
      return { ...base, numero: "—", fracao: null, vazio: { texto: "Sem treino montado", cta: "Montar treino" } };
    case "sono": {
      const h = d.sleepHours;
      return h
        ? { ...base, numero: String(h).replace(".", ","), unidade: "h", detalhe: h >= 7 ? "noite boa" : h >= 5 ? "noite regular" : "pouco sono", fracao: { valor: Math.min(8, h), max: 8 }, vazio: null, action: "sleep" }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Sem registro de ontem", cta: "Registrar sono" }, action: "sleep" };
    }
    case "leitura":
      return d.currentBook
        ? { ...base, numero: String(d.readingProgress), unidade: "%", detalhe: d.currentBook, fracao: { valor: d.readingProgress, max: 100 }, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Nenhum livro em andamento", cta: "Começar um livro" } };
    case "habitos": {
      const t = d.habits.length;
      const f = d.habits.filter((x) => x.done).length;
      return t > 0
        ? { ...base, numero: String(f), unidade: `/${t}`, detalhe: f >= t ? "todos feitos" : `${t - f} ${t - f === 1 ? "falta" : "faltam"}`, fracao: { valor: f, max: t }, completo: f >= t, vazio: null }
        : { ...base, numero: "—", fracao: null, vazio: { texto: "Nenhum hábito na semana", cta: "Criar hábito" } };
    }
    case "agua": {
      const meta = Math.max(1, d.waterGoal);
      const v = Math.min(d.waterGlasses, meta);
      return { ...base, numero: String(v), unidade: `/${meta}`, detalhe: v >= meta ? "meta batida" : `${meta - v} ${meta - v === 1 ? "copo" : "copos"} pra meta`, fracao: { valor: v, max: meta }, completo: v >= meta, vazio: null, action: "water" };
    }
    case "cuidados": {
      const c = ordenarCuidados(cuidadosValidos(get<unknown>(CHAVE_CUIDADOS, [])), hoje)[0];
      const falta = c ? faltaDoCuidado(c, hoje) : undefined;
      if (!c || falta === undefined) return { ...base, numero: "—", fracao: null, vazio: { texto: "Nenhum cuidado cadastrado", cta: "Cadastrar cuidado" } };
      const n = Math.max(0, falta);
      return { ...base, numero: String(n), unidade: n === 1 ? "dia" : "dias", detalhe: `${c.nome} · ${falta < 0 ? "venceu" : n === 0 ? "é hoje" : n === 1 ? "amanhã" : `em ${n} dias`}`, fracao: null, vazio: null };
    }
  }
}
