import type { PendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import type { PendenciasPrefs, TipoPendencia } from "@/lib/home-pendencias";

/**
 * PENDÊNCIAS DO NOVATO (1.0.19, dono 26/10 — "parece cobrança"). Na conta nova, depois da dose 1 da missão, a página 2
 * da Home nova mostrava 8 pendências de módulos que a pessoa nunca escolheu ("4 refeições para registrar", "Pesar hoje",
 * "Check de humor"…). A regra agora, SÓ pra conta nova (origem "nova", lib/home-nova) nos primeiros 7 dias:
 *   · entra o tipo que ela JÁ USOU/CONFIGUROU (tem registro ou cadastro na conta — `tiposAdotados`);
 *   · entra o tipo do módulo que está na MISSÃO em doses (os 3 módulos; Saúde = a água, que é a dose dela — nada de
 *     "Pesar hoje" sem ela ter pesado alguma vez; Dieta só se a Dieta estiver na missão ou ela já tiver anotado refeição);
 *   · entra o que ela LIGOU à mão em Personalizar (`prefs.ligados`); o que ela desligou (`ocultos`) continua fora;
 *   · enquanto a dose de hoje está na lista (a linha "Dose de hoje · Rotina"), a pendência do MESMO módulo espera —
 *     é a mesma coisa dita duas vezes;
 *   · compromissos, tarefas e contas que ela criou ficam sempre (são dela);
 *   · no máximo 4 linhas na página (a dose conta); vazia = uma linha calma, sem ilustração.
 * O SCORE segue a LISTA (dono 26/10, depois do antes×depois: "o score só contar o que tá lá"): na mesma conta e no mesmo
 * período, o hub (use-life-hub-data) conta SÓ os tipos que a lista mostra — fez tudo o que está lá = 100; ligou um tipo
 * em Personalizar, ele entra nos dois (o score pode cair: é o plano dela); desligou, sai dos dois. Sem nenhum tipo
 * visível o score é 0 (nunca 100 de graça). Só com a Home nova ligada; conta antiga/admin e a Home antiga: nada muda.
 * Rollback = `DIAS_NOVATO_PENDENCIAS = 0`.
 */
export const DIAS_NOVATO_PENDENCIAS = 7;
/** A página 2 do novato cabe no máximo isto (a dose de hoje e os avisos contam). */
export const MAX_LINHAS_NOVATO = 4;

/** A régua: conta NOVA criada há menos de `DIAS_NOVATO_PENDENCIAS` dias. Sem data de criação: não (a lista de sempre). */
export function pendenciasDeNovato(p: { origemNova: boolean; criadoEm?: string | null; agora?: number }): boolean {
  if (!p.origemNova || DIAS_NOVATO_PENDENCIAS <= 0) return false;
  const t = p.criadoEm ? new Date(p.criadoEm).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return (p.agora ?? Date.now()) - t < DIAS_NOVATO_PENDENCIAS * 86400e3;
}

/**
 * 1.0.20 — A ORDEM DOS TIPOS NA LISTA (a página 2 com tudo pendente: hábitos 1, treino 2, refeições 3, água 4,
 * suplementos 5, leitura 6 e os registros 20–25 na ordem das ações rápidas — pendenciasDeHoje, NextHoursTimeline).
 * Os 3 cards da página 1 da conta nova seguem esta ordem (fixa: o card não troca de lugar quando um item fica feito).
 * O teste `novato-polido` confere que ela bate com a lista de verdade.
 */
export const ORDEM_DA_LISTA: readonly TipoPendencia[] = ["habitos", "treino", "refeicoes", "agua", "suplementos", "leitura", "humor", "gasto", "peso", "sono", "ideia", "gratidao"];

/** O tipo de pendência que a dose de cada módulo da missão cria (os módulos sem pendência diária não trazem nada). */
export const TIPOS_DA_DOSE: Readonly<Record<string, readonly TipoPendencia[]>> = {
  financas: ["gasto"], rotina: ["habitos"], saude: ["agua"], treino: ["treino"], dieta: ["refeicoes"], hiperfoco: ["ideia"], biblioteca: ["leitura"],
};

type Get = <T>(k: string, f: T) => T;

/** Tem conteúdo de verdade? (lista/objeto com algo dentro, número > 0, texto) — `{}`, `[]`, `{dia: []}` e `{dia: 0}` não. */
function cheio(x: unknown, fundo = 0): boolean {
  if (x === null || x === undefined || x === false || x === "" || x === 0) return false;
  if (typeof x === "number") return x > 0;
  if (Array.isArray(x)) return fundo > 3 ? x.length > 0 : x.some((y) => cheio(y, fundo + 1));
  if (typeof x === "object") return fundo > 3 ? Object.keys(x as object).length > 0 : Object.values(x as Record<string, unknown>).some((y) => cheio(y, fundo + 1));
  return true;
}

/**
 * Os tipos que a pessoa já usou ou configurou — pelas MESMAS chaves que o hub lê pra montar a lista
 * (use-life-hub-data). Um registro em qualquer dia basta ("já pesou alguma vez" = adotou o peso).
 */
export function tiposAdotados(get: Get): Set<TipoPendencia> {
  const s = new Set<TipoPendencia>();
  const algum = (...chaves: string[]) => chaves.some((k) => cheio(get<unknown>(k, null)));
  if (algum("rotina-habits", "core-rotina-habits")) s.add("habitos");
  if (algum("saude-workouts-v2", "saude-workout-log")) s.add("treino");
  if (algum("core-saude-water", "water-log") || get<unknown>("core-saude-water-goal", null) !== null) s.add("agua");
  if (algum("core-dieta-meals", "core-dieta-log", "dieta-diary-v2", "saude-meals")) s.add("refeicoes");
  if (algum("core-saude-supplements")) s.add("suplementos");
  if (algum("lib-books")) s.add("leitura");
  if (algum("core-mood-log", "mood-log", "dp-mood-log")) s.add("humor");
  if (algum("finance-expenses", "finance-incomes", "finance-fixed-expenses")) s.add("gasto");
  if (algum("core-saude-measures")) s.add("peso");
  if (algum("core-saude-sleep", "sleep-log")) s.add("sono");
  if (algum("hiperfoco-thoughts")) s.add("ideia");
  if (algum("core-gratitude-log", "dp-gratitude")) s.add("gratidao");
  return s;
}

/** Os módulos da missão que contam (quem tocou "Explorar por conta própria" não fez a missão: nenhum). */
export const modulosDaMissaoQueContam = (m: { modulos: readonly string[]; explorou?: boolean } | null | undefined): readonly string[] | null =>
  (m && !m.explorou ? m.modulos : null);

/** Os tipos que a lista do novato mostra: adotados + os da missão + os ligados à mão − os ocultos. */
export function tiposDoNovato(p: { adotados: Iterable<TipoPendencia>; modulosDaMissao?: readonly string[] | null; prefs?: PendenciasPrefs | null }): Set<TipoPendencia> {
  const s = new Set<TipoPendencia>(p.adotados);
  for (const m of p.modulosDaMissao ?? []) for (const t of TIPOS_DA_DOSE[m] ?? []) s.add(t);
  for (const t of p.prefs?.ligados ?? []) s.add(t);
  for (const t of p.prefs?.ocultos ?? []) s.delete(t);
  return s;
}

/**
 * A lista do novato a partir da lista de sempre (pendenciasDeHoje): só os tipos permitidos (o que não tem tipo — o
 * compromisso dela — fica); o aviso "Configurar treino da semana" só com o treino permitido; a conta a vencer (dela) fica.
 * `moduloDaDose`: a dose de hoje ainda na lista — a pendência PENDENTE do mesmo módulo espera a dose sair.
 */
export function enxugarPendencias(p: PendenciasDeHoje, permitidos: Set<TipoPendencia>, moduloDaDose?: string | null): PendenciasDeHoje {
  const daDose = new Set<TipoPendencia>(moduloDaDose ? TIPOS_DA_DOSE[moduloDaDose] ?? [] : []);
  return {
    ...p,
    pending: p.pending.filter((i) => !i.tipo || (permitidos.has(i.tipo) && !daDose.has(i.tipo))),
    done: p.done.filter((i) => !i.tipo || permitidos.has(i.tipo)),
    avisoTreino: p.avisoTreino && permitidos.has("treino"),
  };
}
