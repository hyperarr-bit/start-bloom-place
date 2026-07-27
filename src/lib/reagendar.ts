import {
  agendarContas, agendarDieta, agendarLeitura, agendarRetrospectiva,
  agendarRotina, agendarTreino,
} from "@/lib/notificacoes";
import type { PrefsNotificacoes } from "@/lib/prefs-notificacoes";
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
  marcados: Set<string>;
  sequencia: number;
  diasAtivos: string[];
  musculosPorDia: Record<string, string[]>;
  /** dias que têm músculo ou exercício montado — os outros são descanso na prática */
  diasComPlano: Set<string>;
  jaTreinouHoje: boolean;
  leitura: { titulo: string; faltam: number } | null;
  jaPreencheuHoje: boolean;
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

  return {
    dueDays: get("finance-dueDays", []) ?? [],
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
  };
}

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
    prefs.rotina && [dados.marcados.has(hoje), dados.sequencia],
    prefs.treino && [dados.diasAtivos, dados.musculosPorDia, [...dados.diasComPlano].sort(), dados.jaTreinouHoje],
    prefs.leitura && dados.leitura,
    prefs.dieta && dados.jaPreencheuHoje,
  ]);
}

/** Aplica as preferências no agendador do sistema. Devolve quantos de cada tipo. */
export async function reagendarTudo(
  get: Leitor,
  prefs: PrefsNotificacoes,
): Promise<Record<string, number>> {
  const d = lerDadosDosLembretes(get);
  return {
    contas: await agendarContas(d.dueDays, { hora: prefs.horaContas, ligado: prefs.contas }),
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
  };
}
