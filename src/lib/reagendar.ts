import {
  agendarAniversarios, agendarCompromissos, agendarContas, agendarDieta, agendarLeitura, agendarLembreteSequencia, agendarLimiteDoDia, agendarManutencao, agendarRemedios,
  agendarRetrospectiva, agendarRotina, agendarTarefas, agendarTreino, type ManutencaoAgendavel, type PessoaAgendavel,
  type RemedioAgendavel,
} from "@/lib/notificacoes";
import { agendarPet } from "@/lib/notificacoes";
import { algumLigadoPet, lerDadosDosAvisosPet, type DadosDosAvisosPet } from "@/lib/pet-avisos";
import { agendarRelacoes } from "@/lib/notificacoes";
import { assinaturaDasRelacoes, lerDadosDasRelacoes, type DadosDasRelacoes } from "@/lib/relacoes-lembrete";
import { CHAVE_TAREFAS_CARREIRA, CHAVE_TAREFAS_ROTINA, tarefasAgendaveis, type TarefaAgendavel } from "@/lib/tarefas";
import { acaoMaisUsada } from "@/lib/conquistas-acao";
import { calcularSequencia, diasEfetivos, CHAVE_DIAS_ANOTADOS, CHAVE_HUB_STREAK } from "@/lib/sequencia";
import { CHAVE_COMPROMISSOS, compromissosValidos, type Compromisso } from "@/lib/compromissos";
import { CARD_CONFIG_KEY, CUSTOM_CARDS_KEY, DEFAULT_CARDS, type CustomCard } from "@/lib/finance-cards";
import type { CardConfig } from "@/lib/finance-fatura";
import { CHAVE_FATURAS_PAGAS, faturasAVencer, injetarFaturas, parcelasDoMesPassado } from "@/lib/finance-faturas";
import { avancarPara, somarMeses, type Parcela } from "@/lib/finance-parcelas";
import { mesCorrenteId } from "@/lib/virada-contas";
import { chaveArquivada } from "@/lib/virada-do-mes";
import type { PrefsNotificacoes } from "@/lib/prefs-notificacoes";
import { nomeComQuem } from "@/lib/saude-dependentes";
import { localDayKey } from "@/lib/utils";

/**
 * A fonte única de "o que agendar" (27/07).
 *
 * Dois lugares precisam reagendar: o hook que roda no app (quando o dado
 * muda) e a central de notificações (quando a pessoa mexe num interruptor).
 * Se cada um lesse os dados do seu jeito, mais cedo ou mais tarde a tela
 * mostraria uma coisa e o sistema teria outra — que é exatamente o defeito
 * que a central existe pra não ter.
 *
 * Recebe o `get` do useUserData em vez de chamar o hook: assim funciona
 * dentro de um evento de clique, não só durante o render.
 */

export type Leitor = <T>(key: string, fallback: T) => T;

/**
 * Interruptor dos lembretes de remédio (07/09). Mora FORA do PrefsNotificacoes
 * de propósito: lá todo diário "só liga se alguém disse true", e este nasce
 * LIGADO — cadastrar um remédio com horário já é pedir pra ser lembrado. A
 * permissão do Android é pedida no primeiro cadastro (PharmacyChecklist), não
 * na abertura. Desliga na central de notificações.
 */
export const CHAVE_REMEDIOS_LIGADO = "notif-remedios-ligado";

const ehDia = (k: unknown) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Sequência ATUAL de dias ativos (conta de hoje, ou de ontem, pra trás). */
export const sequenciaAtual = (marcados: Set<string>): number => {
  const hoje = new Date();
  let n = 0;
  // se hoje ainda não foi marcado, a sequência viva é a que termina ontem
  const inicio = marcados.has(localDayKey(hoje)) ? 0 : 1;
  for (let i = inicio; i < 400; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
    if (!marcados.has(localDayKey(d))) break;
    n++;
  }
  return n;
};

export interface DadosDosLembretes {
  dueDays: { day?: number; bills?: { name?: string; paid?: boolean }[] }[];
  /** (26/09) as contas do MÊS SEGUINTE — todas em aberto (o ✓ expira na
   *  virada) e com a fatura que vence nele. Sem isto a conta do dia 1º nunca
   *  tinha aviso: a véspera dela cai no mês anterior. */
  dueDaysProximoMes: { day?: number; bills?: { name?: string; paid?: boolean }[] }[];
  marcados: Set<string>;
  sequencia: number;
  diasAtivos: string[];
  musculosPorDia: Record<string, string[]>;
  /** dias que têm músculo ou exercício montado — os outros são descanso na prática */
  diasComPlano: Set<string>;
  jaTreinouHoje: boolean;
  leitura: { titulo: string; faltam: number } | null;
  jaPreencheuHoje: boolean;
  /** remédios/suplementos do Saúde com horário, e se já foram tomados hoje */
  remedios: RemedioAgendavel[];
  remediosLigado: boolean;
  /** pessoas de Relações com aniversário (11/09) */
  pessoas: PessoaAgendavel[];
  /** tarefas de manutenção de Casa já feitas alguma vez (11/09) */
  manutencao: ManutencaoAgendavel[];
  /** compromissos com hora da Rotina (22/09) */
  compromissos: Compromisso[];
  /** tarefas de hoje com horário e aviso, ainda não feitas (28/09) — Rotina e Carreira */
  tarefas: TarefaAgendavel[];
  /** limite do dia (26/09): a pessoa usa Finanças? e já abriu hoje? */
  temFinancas: boolean;
  abriuFinancasHoje: boolean;
  /** sequência de dias anotados das Conquistas (26/09) */
  seqAnotada: { dias: number; anotouHoje: boolean; acao: string };
  /** cuidados do pet (29/09): prefs na chave própria, datas da carteirinha e doses de remédio de hoje */
  pet?: DadosDosAvisosPet;
  /** Relações (29/09): parabéns no dia + manter contato — as escolhas moram em `rel-lembrete-prefs` */
  relacoes?: DadosDasRelacoes;
}

/** Lê de uma vez tudo o que os lembretes precisam saber. */
export function lerDadosDosLembretes(get: Leitor): DadosDosLembretes {
  const hoje = localDayKey();

  const heatmap = get<Record<string, boolean | number>>("heatmap-log", {}) ?? {};
  const marcados = new Set(
    Object.entries(heatmap)
      .filter(([k, v]) => ehDia(k) && (typeof v === "number" ? v > 0 : v === true))
      .map(([k]) => k),
  );

  const plano = get<Record<string, { muscles?: string[]; exercises?: unknown[] }>>("saude-workouts-v2", {}) ?? {};
  const musculosPorDia: Record<string, string[]> = {};
  const diasComPlano = new Set<string>();
  Object.entries(plano).forEach(([dia, v]) => {
    const musculos = Array.isArray(v?.muscles) ? v.muscles : [];
    const exercicios = Array.isArray(v?.exercises) ? v.exercises : [];
    musculosPorDia[dia] = musculos;
    if (musculos.length > 0 || exercicios.length > 0) diasComPlano.add(dia);
  });

  // o livro em andamento mais avançado — é o que a pessoa está lendo AGORA
  type Livro = { title?: string; status?: string; pages?: number; currentPage?: number };
  const acervo = get<Livro[]>("lib-books", []) ?? [];
  const lendo = (Array.isArray(acervo) ? acervo : [])
    .filter((b) => b?.status === "lendo" && b?.title)
    .sort((a, b) => (Number(b?.currentPage) || 0) - (Number(a?.currentPage) || 0))[0];

  const diarioDieta = get<Record<string, { meals?: Record<string, unknown> }>>("dieta-diary-v2", {}) ?? {};

  // Remédios (07/09): a lista do PharmacyChecklist + o log de "tomado hoje"
  type Suplemento = { id?: string; name?: string; time?: string; quem?: string };
  const suplementos = get<Suplemento[]>("core-saude-supplements", []) ?? [];
  const tomadosHoje = (get<Record<string, string[]>>("core-saude-supplement-log", {}) ?? {})[hoje] ?? [];
  const remedios: RemedioAgendavel[] = (Array.isArray(suplementos) ? suplementos : [])
    .filter((s) => s?.name && s?.time)
    .map((s) => ({
      id: String(s.id ?? ""),
      // remédio do dependente leva o nome dele no aviso (22/09): "Hora do Ômega 3 (Mãe)"
      nome: nomeComQuem(String(s.name), s.quem),
      hora: String(s.time),
      tomadoHoje: Array.isArray(tomadosHoje) && tomadosHoje.includes(String(s.id)),
    }));

  /* FATURA DO CARTÃO no aviso de conta a vencer (22/09): a mesma conta da
     tela (lib/finance-faturas), pelo NOME só — o texto da notificação congela
     no agendamento e um valor de ontem seria mentira amanhã.
     26/09: a fatura que VENCE no mês (`faturasAVencer` — no cartão "vence dia
     5 do mês seguinte" é a que fechou no mês anterior) e também a do MÊS
     SEGUINTE, pro aviso da véspera do dia 1º/2 existir. */
  const mes = mesCorrenteId();
  const mesSeguinte = somarMeses(mes, 1);
  const configCartoes = get<Record<string, CardConfig>>(CARD_CONFIG_KEY, {}) ?? {};
  const personalizados = get<CustomCard[]>(CUSTOM_CARDS_KEY, []) ?? [];
  const rotulos = new Map<string, string>([
    ...DEFAULT_CARDS.map((c) => [c.value, c.label] as [string, string]),
    ...(Array.isArray(personalizados) ? personalizados : []).map((c) => [c.value, c.label] as [string, string]),
  ]);
  const gravadas = (get<DadosDosLembretes["dueDays"]>("finance-dueDays", []) ?? []) as DadosDosLembretes["dueDays"];
  let dueDays = gravadas;
  // mês seguinte: as mesmas contas, TODAS em aberto (o ✓ expira na virada)
  let dueDaysProximoMes = (Array.isArray(gravadas) ? gravadas : []).map((d) => ({
    ...d, bills: (Array.isArray(d?.bills) ? d.bills : []).map((b) => ({ ...b, paid: false })),
  }));
  try {
    const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const parcelasDoBalde = lista<Parcela>(get<unknown>("finance-installments", []));
    const base = {
      // gastos gravados na chave do mês: balde corrente, arquivo, ou nada (futuro)
      gastosDoMes: (m: string) => lista<never>(
        m === mes ? get<unknown>("finance-expenses", [])
          : m > mes ? []
          : get<unknown>(chaveArquivada(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, "expenses"), []),
      ),
      // parcelas: o balde é o mês de agora; mês que vem = o balde avançado; mês passado = retratos da virada
      parcelasDoMes: (m: string) => (m === mes ? parcelasDoBalde
        : m > mes ? parcelasDoBalde.map((p) => avancarPara(p, mes, m) ?? p)
        : parcelasDoMesPassado(m, (chave) => lista<Parcela>(get<unknown>(chave, [])))),
      fixos: lista<never>(get<unknown>("finance-fixed-expenses", [])),
      cards: [...rotulos.keys()],
      configOf: (card: string) => configCartoes?.[card],
      labelOf: (card: string) => rotulos.get(card) ?? card,
      pagas: get<Record<string, boolean>>(CHAVE_FATURAS_PAGAS, {}) ?? {},
    };
    dueDays = injetarFaturas(gravadas as never[], faturasAVencer({ mes, ...base }), true) as DadosDosLembretes["dueDays"];
    dueDaysProximoMes = injetarFaturas(dueDaysProximoMes as never[], faturasAVencer({ mes: mesSeguinte, ...base }), true) as typeof dueDaysProximoMes;
  } catch { /* dado torto em alguma chave: o aviso sai sem a fatura, nunca sem as contas */ }

  return {
    dueDays,
    dueDaysProximoMes,
    marcados,
    sequencia: sequenciaAtual(marcados),
    diasAtivos: get<string[]>("treino-active-days", []) ?? [],
    musculosPorDia,
    diasComPlano,
    jaTreinouHoje: (get<string[]>("saude-workout-log", []) ?? []).includes(hoje),
    leitura: lendo
      ? {
          titulo: lendo.title as string,
          faltam: Math.max(0, (Number(lendo.pages) || 0) - (Number(lendo.currentPage) || 0)),
        }
      : null,
    jaPreencheuHoje: Object.keys(diarioDieta[hoje]?.meals ?? {}).length > 0,
    remedios,
    remediosLigado: get<boolean>(CHAVE_REMEDIOS_LIGADO, true) !== false,
    pessoas: (get<{ name?: string; birthday?: string }[]>("rel-people", []) ?? [])
      .filter((p) => p?.name && p?.birthday)
      .map((p) => ({ nome: String(p.name), aniversario: String(p.birthday) })),
    manutencao: (get<{ task?: string; lastDone?: string; frequencyMonths?: number }[]>("casa-maint-tasks", []) ?? [])
      .filter((t) => t?.task && t?.lastDone)
      .map((t) => ({ tarefa: String(t.task), ultimaVez: String(t.lastDone), frequenciaMeses: Number(t.frequencyMonths) || 6 })),
    compromissos: compromissosValidos(get<unknown>(CHAVE_COMPROMISSOS, [])),
    // marcar como feita tira a tarefa daqui → a assinatura muda → o aviso pendente é cancelado
    tarefas: tarefasAgendaveis([
      { chave: CHAVE_TAREFAS_ROTINA, lista: get<unknown>(CHAVE_TAREFAS_ROTINA, []) },
      { chave: CHAVE_TAREFAS_CARREIRA, lista: get<unknown>(CHAVE_TAREFAS_CARREIRA, []) },
    ], hoje),
    // usa Finanças = lançou alguma coisa (as 4 "caixas" padrão de vencimento
    // existem pra todo mundo, então conta a vencer só vale com conta dentro)
    temFinancas: ["finance-expenses", "finance-incomes", "finance-fixed-expenses"]
      .some((k) => { const v = get<unknown>(k, null); return Array.isArray(v) && v.length > 0; })
      || (get<{ bills?: unknown[] }[]>("finance-dueDays", []) ?? []).some((d) => Array.isArray(d?.bills) && d.bills.length > 0),
    abriuFinancasHoje: get<string>(CHAVE_FINANCAS_VISTO, "") === hoje,
    seqAnotada: (() => {
      const seq = calcularSequencia(diasEfetivos(get<unknown>(CHAVE_DIAS_ANOTADOS, undefined), get<unknown>(CHAVE_HUB_STREAK, null), hoje), hoje);
      return { dias: seq.dias, anotouHoje: seq.hojeFeito, acao: acaoMaisUsada(get, hoje).texto };
    })(),
    pet: lerDadosDosAvisosPet(get, hoje),
    relacoes: lerDadosDasRelacoes(get),
  };
}

/** Marca "Finanças aberto hoje" (dia local) — o limite do dia não avisa quem já viu. */
export const CHAVE_FINANCAS_VISTO = "finance-visto-dia";

/**
 * Só o que MUDA o agendamento entra aqui. Comparar esta string antes de
 * mexer no agendador é o que impede um reagendamento a cada render.
 */
export function assinaturaDos(dados: DadosDosLembretes, prefs: PrefsNotificacoes): string {
  const hoje = localDayKey();
  return JSON.stringify([
    prefs,
    hoje,
    dados.dueDays
      .map((d) => [d?.day, (d?.bills ?? []).filter((b) => !b?.paid).map((b) => b?.name).sort()])
      .filter(([, naoPagas]) => Array.isArray(naoPagas) && naoPagas.length),
    // (26/09) o mês seguinte também agenda: conta nova ou fatura nova muda o plano
    (dados.dueDaysProximoMes ?? [])
      .map((d) => [d?.day, (d?.bills ?? []).map((b) => b?.name).sort()])
      .filter(([, nomes]) => Array.isArray(nomes) && nomes.length),
    prefs.rotina && [dados.marcados.has(hoje), dados.sequencia],
    prefs.treino && [dados.diasAtivos, dados.musculosPorDia, [...dados.diasComPlano].sort(), dados.jaTreinouHoje],
    prefs.leitura && dados.leitura,
    prefs.dieta && dados.jaPreencheuHoje,
    dados.remediosLigado && dados.remedios,
    prefs.aniversario && dados.pessoas,
    prefs.casa && dados.manutencao,
    prefs.compromissos && dados.compromissos,
    prefs.tarefas && dados.tarefas,
    prefs.limite && [dados.temFinancas, dados.abriuFinancasHoje],
    prefs.sequencia && [dados.seqAnotada.dias, dados.seqAnotada.anotouHoje],
    // (29/09) pet: as prefs moram na chave própria; marcar vacina/dose muda o plano
    !!dados.pet && algumLigadoPet(dados.pet.prefs) && dados.pet,
    // (29/09) Relações: as escolhas moram na chave própria; "Falei hoje" muda o plano
    dados.relacoes ? assinaturaDasRelacoes(dados.relacoes) : false,
  ]);
}

/** Aplica as preferências no agendador do sistema. Devolve quantos de cada tipo. */
export async function reagendarTudo(
  get: Leitor,
  prefs: PrefsNotificacoes,
): Promise<Record<string, number>> {
  const d = lerDadosDosLembretes(get);
  return {
    contas: await agendarContas(d.dueDays, { hora: prefs.horaContas, ligado: prefs.contas }, d.dueDaysProximoMes),
    retrospectiva: await agendarRetrospectiva(prefs.retrospectiva),
    rotina: await agendarRotina(
      { marcados: d.marcados, sequencia: d.sequencia },
      { hora: prefs.horaRotina, ligado: prefs.rotina },
    ),
    treino: await agendarTreino(
      { diasAtivos: d.diasAtivos, musculosPorDia: d.musculosPorDia, diasComPlano: d.diasComPlano, jaTreinouHoje: d.jaTreinouHoje },
      { hora: prefs.horaTreino, ligado: prefs.treino },
    ),
    leitura: await agendarLeitura(d.leitura, { hora: prefs.horaLeitura, ligado: prefs.leitura }),
    dieta: await agendarDieta({ jaPreencheuHoje: d.jaPreencheuHoje }, { hora: prefs.horaDieta, ligado: prefs.dieta }),
    saude: await agendarRemedios(d.remedios, { ligado: d.remediosLigado }),
    aniversario: await agendarAniversarios(d.pessoas, { hora: prefs.horaAniversario, ligado: prefs.aniversario }),
    casa: await agendarManutencao(d.manutencao, { hora: prefs.horaCasa, ligado: prefs.casa }),
    compromisso: await agendarCompromissos(d.compromissos, { ligado: prefs.compromissos }),
    tarefa: await agendarTarefas(d.tarefas, { ligado: prefs.tarefas }),
    limite: await agendarLimiteDoDia(
      { temFinancas: d.temFinancas, abriuFinancasHoje: d.abriuFinancasHoje },
      { hora: prefs.horaLimite, ligado: prefs.limite },
    ),
    sequencia: await agendarLembreteSequencia(d.seqAnotada, { hora: prefs.horaSequencia, ligado: prefs.sequencia }),
    pet: d.pet ? await agendarPet(d.pet) : 0,
    relacoes: d.relacoes ? await agendarRelacoes(d.relacoes) : 0,
  };
}
