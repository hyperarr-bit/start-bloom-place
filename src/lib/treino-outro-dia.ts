import {
  concluirTreino, normalizarNome, registrarNoHistorico, seriesDaEntrada, seriesIniciais, ultimaVez,
  type EntradaDoHistorico, type ExercicioDoPlano, type SerieDaSessao,
} from "@/lib/treino-series";
import type { MetaDaSessao } from "@/lib/treino-constancia";

/**
 * TREINO DE ONTEM / ANTEONTEM (02/10) — "como marcar um exercício feito ontem?
 * esqueci de marcar na hora". A sessão do HOJE só existe pro dia dela (se
 * descarta no dia seguinte), então o treino de um dia que passou entra de uma
 * vez, como um "Concluir" com a data certa: as séries começam COMO ESTAVAM
 * PREVISTAS (a última vez da pessoa naquele exercício, ou o alvo do plano) e
 * ela marca o que fez e ajusta carga/reps se foi diferente.
 *
 * Grava o mesmo de sempre, na data do dia: o histórico por exercício
 * (`treino-exercise-history`), o registro de treinos (`saude-workout-log` —
 * é dele que a SEMANA e a constância leem), o volume do dia e o carimbo da
 * sessão (`treino-sessoes`: dia do plano e músculos; sem minutos, que ninguém
 * cronometrou). Tudo PURO, pra testar sem tela.
 */

/**
 * As séries de um dia que passou: se aquele dia JÁ tem treino gravado, o que foi
 * gravado (feito); senão, as séries previstas (última vez ou alvo do plano), todas
 * por marcar. Reabrir o dia mostra o que a pessoa salvou — dá pra corrigir.
 */
export function seriesDoDiaPassado({
  exercicios, chaves, historico, dia,
}: {
  exercicios: ExercicioDoPlano[];
  chaves: string[];
  historico: Partial<EntradaDoHistorico>[];
  dia: string;
}): Record<string, SerieDaSessao[]> {
  const out: Record<string, SerieDaSessao[]> = {};
  exercicios.forEach((ex, i) => {
    const prevista = seriesIniciais({ ...ex, done: false }, ex.tipo === "cardio" ? null : ultimaVez(historico, ex.name, dia))
      .map((s) => ({ ...s, feito: false }));
    const alvo = normalizarNome(ex.name);
    const gravada = (Array.isArray(historico) ? historico : []).find((h) => h && h.date === dia && normalizarNome(h.exercise) === alvo);
    if (!gravada) { out[chaves[i]] = prevista; return; }
    if (ex.tipo === "cardio") { out[chaves[i]] = [{ carga: 0, reps: 0, feito: true, ok: true }]; return; }
    const feitas = seriesDaEntrada(gravada).map((s) => ({ ...s, feito: true, ok: true }));
    // o que sobrou do plano continua por marcar (as séries feitas vêm primeiro)
    out[chaves[i]] = [...feitas, ...prevista.slice(feitas.length)];
  });
  return out;
}

export interface TreinoGravado {
  historico: EntradaDoHistorico[];
  log: string[];
  volume: Record<string, number>;
  sessoes: Record<string, MetaDaSessao>;
  /** séries de força feitas + cardios feitos */
  feitas: number;
  /** o treino foi tirado (nada marcado) */
  limpou: boolean;
}

/**
 * Grava (ou tira) o treino de um dia que passou. Salvar de novo no mesmo dia
 * SUBSTITUI o que era dele (a regra do Concluir); salvar sem nada marcado
 * desfaz o dia — o treino sai do histórico, do registro, do volume e do carimbo.
 */
export function gravarTreinoDeOutroDia({
  dia, diaDoPlano, musculos, exercicios, chaves, series, historico, log, volume, sessoes,
}: {
  dia: string;
  diaDoPlano: string;
  musculos: string[];
  exercicios: ExercicioDoPlano[];
  chaves: string[];
  series: Record<string, SerieDaSessao[]>;
  historico: unknown;
  log: unknown;
  volume: unknown;
  sessoes: unknown;
}): TreinoGravado {
  const hist = (Array.isArray(historico) ? historico : []) as EntradaDoHistorico[];
  const registro = (Array.isArray(log) ? log : []) as string[];
  const vol = (volume && typeof volume === "object" && !Array.isArray(volume) ? volume : {}) as Record<string, number>;
  const ses = (sessoes && typeof sessoes === "object" && !Array.isArray(sessoes) ? sessoes : {}) as Record<string, MetaDaSessao>;

  const antesDoDia = hist.filter((h) => h && typeof h.date === "string" && h.date < dia);
  const r = concluirTreino({ exercicios, chaves, series, historico: antesDoDia, data: dia });
  // tira tudo que era DESTE treino naquela data (inclusive o que foi desmarcado) e põe o de agora
  const nomes = new Set(exercicios.map((e) => String(e.name ?? "").trim()));
  const semOsDoDia = hist.filter((h) => !(h?.date === dia && nomes.has(String(h.exercise ?? "").trim())));

  if (r.feitas === 0) {
    const { [dia]: _v, ...volSem } = vol;
    const { [dia]: _s, ...sesSem } = ses;
    const restouAlgo = semOsDoDia.some((h) => h?.date === dia); // exercício de outro treino do mesmo dia
    return {
      historico: semOsDoDia,
      log: restouAlgo ? registro : registro.filter((d) => d !== dia),
      volume: restouAlgo ? vol : volSem,
      sessoes: restouAlgo ? ses : sesSem,
      feitas: 0,
      limpou: registro.includes(dia),
    };
  }
  return {
    historico: registrarNoHistorico(semOsDoDia, r.entradas, dia),
    log: registro.includes(dia) ? registro : [...registro, dia],
    volume: { ...vol, [dia]: r.volume },
    sessoes: { ...ses, [dia]: { dia: diaDoPlano, musculos } },
    feitas: r.feitas,
    limpou: false,
  };
}

/**
 * DESMARCAR O TREINO DE UM DIA (07/10, chamado: "cliquei no treino sem querer
 * e ele marcou que eu treinei; tento desmarcar e não sai"). O dia entra em
 * `saude-workout-log` por 3 portas (Concluir, atalho da Home, "esqueci") e só
 * o widget da Home sabia tirar. Tira o dia inteiro: registro, volume, carimbo
 * da sessão e as entradas do histórico daquela data. Mesmas chaves e formato.
 */
export function tirarTreinoDoDia({
  dia, historico, log, volume, sessoes,
}: {
  dia: string;
  historico: unknown;
  log: unknown;
  volume: unknown;
  sessoes: unknown;
}): Pick<TreinoGravado, "historico" | "log" | "volume" | "sessoes"> {
  const hist = (Array.isArray(historico) ? historico : []) as EntradaDoHistorico[];
  const registro = (Array.isArray(log) ? log : []) as string[];
  const vol = (volume && typeof volume === "object" && !Array.isArray(volume) ? volume : {}) as Record<string, number>;
  const ses = (sessoes && typeof sessoes === "object" && !Array.isArray(sessoes) ? sessoes : {}) as Record<string, MetaDaSessao>;
  const { [dia]: _v, ...volSem } = vol;
  const { [dia]: _s, ...sesSem } = ses;
  return {
    historico: hist.filter((h) => h?.date !== dia),
    log: registro.filter((d) => d !== dia),
    volume: volSem,
    sessoes: sesSem,
  };
}

/** O dia tem treino registrado? (`saude-workout-log` — o mesmo que a SEMANA lê) */
export const treinouNoDia = (log: unknown, dia: string): boolean => Array.isArray(log) && log.includes(dia);
