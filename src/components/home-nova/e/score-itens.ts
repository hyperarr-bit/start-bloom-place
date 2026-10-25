import type { LifeHubData } from "@/hooks/use-life-hub-data";
import type { ActionId } from "@/components/home/QuickActions";
import { CATALOGO_PENDENCIAS, scoreDosBlocos, type BlocoDoScore, type TipoPendencia } from "@/lib/home-pendencias";

/**
 * O QUE COMPÕE O SCORE, ITEM POR ITEM (opção E, 25/10) — pra folha "Como funciona a pontuação".
 *
 * É a MESMA conta do hub (use-life-hub-data, bloco a bloco: treino 15, hábitos 20, água 15,
 * refeições 10, leitura 5, humor 5, gratidão 5, ideia 5, peso 5, suplementos 5, sono 5, gasto 5),
 * refeita a partir dos números que o hub já devolve — nada é lido do storage de novo. O que a
 * pessoa ocultou (pendenciasCobradas) sai da lista e o resto se reescala pra 100, como lá.
 * `somaConfere` prova que a conta daqui bate com `dayScore` (se um dia não bater, a folha avisa).
 */
export interface ItemDoScore extends BlocoDoScore {
  nome: string;
  emoji: string;
  /** "3 de 5 feitos" · "Peito · pendente" · "Sem livro em leitura (já conta)" */
  detalhe: string;
  feito: boolean;
  /** Onde resolver: rota do módulo ou a ação rápida do "+". */
  route?: string;
  action?: ActionId;
  /** Tom (a mesma família de cor do módulo de origem). */
  cor: CorDoTipo;
}

export type CorDoTipo = "emerald" | "blue" | "cyan" | "green" | "red" | "orange" | "pink" | "amber" | "purple" | "indigo" | "violet" | "rose";

export const COR_DO_TIPO: Record<TipoPendencia, CorDoTipo> = {
  habitos: "emerald", treino: "blue", agua: "cyan", refeicoes: "green", suplementos: "red", leitura: "orange",
  humor: "pink", gasto: "amber", peso: "purple", sono: "indigo", ideia: "violet", gratidao: "rose",
};

/** Classe literal da barra (o Tailwind só gera classe escrita por extenso; escuro.css remapeia pra noite). */
export const BARRA_DO_TIPO: Record<TipoPendencia, string> = {
  habitos: "bg-emerald-500", treino: "bg-blue-500", agua: "bg-cyan-500", refeicoes: "bg-green-500", suplementos: "bg-red-400",
  leitura: "bg-orange-500", humor: "bg-pink-500", gasto: "bg-amber-500", peso: "bg-purple-500", sono: "bg-indigo-500",
  ideia: "bg-violet-500", gratidao: "bg-rose-500",
};

const nomeDoTipo = (t: TipoPendencia) => CATALOGO_PENDENCIAS.find((c) => c.tipo === t)?.nome ?? t;
const emojiDoTipo = (t: TipoPendencia) => CATALOGO_PENDENCIAS.find((c) => c.tipo === t)?.emoji ?? "•";

export function itensDoScore(d: LifeHubData): ItemDoScore[] {
  const reg = d.registrosHoje ?? { humor: false, gasto: false, peso: false, sono: false, gratidao: false, ideia: false };
  const itens: ItemDoScore[] = [];
  const item = (tipo: TipoPendencia, pontos: number, max: number, detalhe: string, feito: boolean, destino: { route?: string; action?: ActionId }) =>
    itens.push({ tipo, pontos: Math.min(max, pontos), max, nome: nomeDoTipo(tipo), emoji: emojiDoTipo(tipo), detalhe, feito, cor: COR_DO_TIPO[tipo], ...destino });

  // hábitos (20) — o único bloco que NÃO vira ponto cheio sem cadastro (a Home pede pra cadastrar)
  const th = d.habits.length;
  const fh = d.habits.filter((h) => h.done).length;
  item("habitos", th > 0 ? Math.round((fh / th) * 20) : 0, 20, th > 0 ? `${fh} de ${th} feitos` : "Cadastre seus hábitos na Rotina", th > 0 && fh === th, { route: "/rotina" });

  // treino (15) — feito, ou sem treino hoje (descanso / sem plano): nada a cobrar
  const temTreino = !!d.todayWorkoutGroup;
  item(
    "treino",
    d.workoutDone || !temTreino ? 15 : 0, 15,
    temTreino ? `${d.todayWorkoutGroup} · ${d.workoutDone ? "feito" : "pendente"}` : d.workoutStatus === "descanso" ? "Hoje é descanso (já conta)" : "Sem treino programado (já conta)",
    d.workoutDone || !temTreino, { route: "/treino" },
  );

  // água (15) — meta sempre existe
  const copos = Math.min(d.waterGlasses, d.waterGoal);
  item("agua", Math.min(15, Math.round((d.waterGlasses / Math.max(1, d.waterGoal)) * 15)), 15, `${copos} de ${d.waterGoal} copos`, d.waterGlasses >= d.waterGoal, { action: "water" });

  // refeições (10) — pelo número real do plano (4 sem plano)
  item("refeicoes", d.mealsTotal > 0 ? Math.min(10, Math.round((d.mealsLogged / d.mealsTotal) * 10)) : 0, 10, `${Math.min(d.mealsLogged, d.mealsTotal)} de ${d.mealsTotal} registradas`, d.mealsLogged >= d.mealsTotal && d.mealsTotal > 0, { route: "/dieta" });

  // suplementos (5) — sem cadastro vale cheio
  item(
    "suplementos",
    d.supplementsTotal > 0 ? Math.min(5, Math.round((d.supplementsTaken / d.supplementsTotal) * 5)) : 5, 5,
    d.supplementsTotal > 0 ? `${d.supplementsTaken} de ${d.supplementsTotal} tomados` : "Nenhum cadastrado (já conta)",
    d.supplementsTotal === 0 || d.supplementsTaken >= d.supplementsTotal, { route: "/saude" },
  );

  // leitura (5) — sem livro em leitura vale cheio; com livro, vale por ter lido hoje
  item("leitura", !d.currentBook || d.leuHoje ? 5 : 0, 5, d.currentBook ? (d.leuHoje ? `Leu hoje · "${d.currentBook}"` : `Continuar "${d.currentBook}"`) : "Sem livro em leitura (já conta)", !d.currentBook || !!d.leuHoje, { route: "/biblioteca" });

  // os seis registros de 5 — ordem da fileira de ações rápidas
  item("humor", reg.humor ? 5 : 0, 5, reg.humor ? "Registrado hoje" : "Como você está hoje?", reg.humor, { action: "mood" });
  item("gasto", reg.gasto ? 5 : 0, 5, reg.gasto ? "Registrado hoje" : "Anote um gasto do dia", reg.gasto, { action: "expense" });
  item("peso", reg.peso ? 5 : 0, 5, reg.peso ? "Registrado hoje" : d.pendenciasPrefs?.peso.frequencia === "semanal" ? "Pesagem da semana" : "Pesar e anotar", reg.peso, { action: "weight" });
  item("sono", reg.sono ? 5 : 0, 5, reg.sono ? `${d.sleepHours} h dormidas` : "Quantas horas dormiu?", reg.sono, { action: "sleep" });
  item("ideia", reg.ideia ? 5 : 0, 5, reg.ideia ? "Anotada hoje" : "Anote uma ideia", reg.ideia, { action: "idea" });
  item("gratidao", reg.gratidao ? 5 : 0, 5, reg.gratidao ? "Anotada hoje" : "Pelo que você é grato hoje?", reg.gratidao, { action: "gratitude" });

  const cobrados = new Set<TipoPendencia>(d.pendenciasCobradas ?? itens.map((i) => i.tipo));
  return itens.filter((i) => cobrados.has(i.tipo));
}

export interface ResumoDoScore {
  itens: ItemDoScore[];
  pontos: number;
  max: number;
  /** o score reescalado (0–100), pela mesma função do hub */
  score: number;
  /** a conta daqui bate com o dayScore do hub? */
  somaConfere: boolean;
  /** quantos itens ainda faltam */
  faltam: number;
}

export function resumoDoScore(d: LifeHubData): ResumoDoScore {
  const itens = itensDoScore(d);
  const pontos = itens.reduce((s, i) => s + i.pontos, 0);
  const max = itens.reduce((s, i) => s + i.max, 0);
  const score = scoreDosBlocos(itens, new Set(itens.map((i) => i.tipo)));
  return { itens, pontos, max, score, somaConfere: score === d.dayScore, faltam: itens.filter((i) => !i.feito).length };
}
