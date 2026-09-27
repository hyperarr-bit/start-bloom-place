/**
 * EVOLUÇÃO DO TREINO (26/09, mockup aprovado — p3). Consolida as antigas abas
 * RESUMO, PROGRESSÃO e RECORDES (o uso real mostrou que quase ninguém abria):
 *  - ESTA SEMANA: treinos x meta, volume e a comparação com a semana passada
 *    ATÉ O MESMO DIA (antes era semana parcial × semana cheia: toda segunda
 *    aparecia "−80%");
 *  - RECORDES DO MÊS: automáticos, do histórico — sem precisar anotar;
 *  - CARGA POR EXERCÍCIO (30 dias): variação, minigráfico e carga atual.
 */
import { localDayKey, parseLocalDay } from "@/lib/utils";
import {
  type EntradaDoHistorico,
  type Serie,
  epley,
  melhorSerie,
  normalizarNome,
  seriesDaEntrada,
  superou,
  volumeDasSeries,
} from "@/lib/treino-series";
import { ehData, faixaDaSemana, indiceDoDia, segundaDe, somarDias, diasEntre } from "@/lib/treino-constancia";

export interface ResumoDaSemana {
  treinos: number;
  volume: number;
  anterior: number;
  /** % contra a semana passada até o mesmo dia; null sem base */
  variacao: number | null;
  rotulo: string;
}

export const resumoDaSemana = (log: unknown, volumePorDia: Record<string, number> | null | undefined, hoje: Date): ResumoDaSemana => {
  const seg = segundaDe(hoje);
  const vol = volumePorDia ?? {};
  // hoje só entra na conta depois de ter treino: de manhã, antes de treinar,
  // comparar "até hoje" com a semana passada inteira-até-hoje dava sempre queda
  const ate = indiceDoDia(hoje) - ((Number(vol[localDayKey(hoje)]) || 0) > 0 ? 0 : 1);
  const datas = Array.from({ length: 7 }, (_, i) => localDayKey(somarDias(seg, i)));
  const passadas = Array.from({ length: 7 }, (_, i) => localDayKey(somarDias(seg, i - 7)));
  const soma = (lista: string[]) => lista.slice(0, ate + 1).reduce((t, d) => t + (Number(vol[d]) || 0), 0);
  const noLog = new Set((Array.isArray(log) ? log : []).filter(ehData));
  const treinos = datas.filter((d) => noLog.has(d)).length;
  const volume = soma(datas);
  const anterior = soma(passadas);
  return {
    treinos,
    volume,
    anterior,
    variacao: anterior > 0 ? Math.round(((volume - anterior) / anterior) * 100) : null,
    rotulo: faixaDaSemana(seg),
  };
};

/** Sessões de cada exercício de força: por data, com todas as séries do dia. */
const sessoesPorExercicio = (historico: Partial<EntradaDoHistorico>[]) => {
  const mapa = new Map<string, { nome: string; porData: Map<string, Serie[]> }>();
  const lista = (Array.isArray(historico) ? historico : []).filter((h) => h && h.tipo !== "cardio" && ehData(h.date) && h.exercise);
  // o nome mostrado é o da entrada mais nova
  const ordenada = [...lista].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const h of ordenada) {
    const k = normalizarNome(h.exercise);
    const series = seriesDaEntrada(h);
    if (!series.length) continue;
    const item = mapa.get(k) ?? { nome: String(h.exercise).trim(), porData: new Map<string, Serie[]>() };
    item.porData.set(h.date as string, [...(item.porData.get(h.date as string) ?? []), ...series]);
    mapa.set(k, item);
  }
  return [...mapa.values()].map(({ nome, porData }) => ({
    nome,
    sessoes: [...porData.entries()]
      .map(([data, series]) => ({ data, series, melhor: melhorSerie(series) as Serie }))
      .filter((s) => s.melhor)
      .sort((a, b) => a.data.localeCompare(b.data)),
  }));
};

export interface RecordeDoMes {
  exercicio: string;
  melhor: Serie;
  anterior: Serie;
  data: string;
  ganhoKg: number;
  ganhoReps: number;
}

/** Recordes batidos no mês (`mes` 0–11): pra cada exercício, o ÚLTIMO recorde do
 *  mês (a série que superou a melhor de todas as anteriores) e o ganho sobre o
 *  recorde que ele derrubou. A 1ª vez de um exercício não é recorde (não bateu
 *  nada). Mais recente primeiro. */
export const recordesDoMes = (historico: Partial<EntradaDoHistorico>[], ano: number, mes: number): RecordeDoMes[] => {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}-`;
  const saida: RecordeDoMes[] = [];
  for (const { nome, sessoes } of sessoesPorExercicio(historico)) {
    let rec: Serie | null = null;
    let doMes: RecordeDoMes | null = null;
    for (const s of sessoes) {
      if (rec && superou(s.melhor, rec) && s.data.startsWith(prefixo)) {
        doMes = {
          exercicio: nome,
          melhor: s.melhor,
          anterior: rec,
          data: s.data,
          ganhoKg: Math.round((s.melhor.carga - rec.carga) * 100) / 100,
          ganhoReps: s.melhor.carga === rec.carga ? s.melhor.reps - rec.reps : 0,
        };
      }
      if (!rec || superou(s.melhor, rec)) rec = s.melhor;
    }
    if (doMes) saida.push(doMes);
  }
  return saida.sort((a, b) => b.data.localeCompare(a.data) || a.exercicio.localeCompare(b.exercicio));
};

export type VariacaoDeCarga = { tipo: "subiu" | "desceu"; kg: number } | { tipo: "igual"; semanas: number };

export interface CargaDoExercicio {
  nome: string;
  /** carga da melhor série de cada sessão, em ordem de data */
  pontos: { data: string; carga: number }[];
  atual: number;
  variacao: VariacaoDeCarga;
  ultimaData: string;
}

/** Carga por exercício nos últimos `janela` dias: base = a última sessão antes da
 *  janela (se houver; senão a 1ª dentro dela). Sem mudança, conta há quantas
 *  semanas a carga está igual. Mais recente primeiro. */
export const cargaPorExercicio = (historico: Partial<EntradaDoHistorico>[], hoje: string, janela = 30): CargaDoExercicio[] => {
  const inicio = localDayKey(somarDias(parseLocalDay(hoje), -janela));
  const saida: CargaDoExercicio[] = [];
  for (const { nome, sessoes } of sessoesPorExercicio(historico)) {
    const comCarga = sessoes.filter((s) => s.melhor.carga > 0 && s.data <= hoje).map((s) => ({ data: s.data, carga: s.melhor.carga }));
    const naJanela = comCarga.filter((p) => p.data > inicio);
    if (!naJanela.length) continue;
    const antes = [...comCarga].reverse().find((p) => p.data <= inicio) ?? null;
    const base = antes?.carga ?? naJanela[0].carga;
    const atual = naJanela[naJanela.length - 1].carga;
    const delta = Math.round((atual - base) * 100) / 100;
    let variacao: VariacaoDeCarga;
    if (delta > 0) variacao = { tipo: "subiu", kg: delta };
    else if (delta < 0) variacao = { tipo: "desceu", kg: -delta };
    else {
      let desde = naJanela[naJanela.length - 1].data;
      for (let i = comCarga.length - 1; i >= 0 && comCarga[i].carga === atual; i--) desde = comCarga[i].data;
      variacao = { tipo: "igual", semanas: Math.floor(diasEntre(desde, hoje) / 7) };
    }
    saida.push({ nome, pontos: antes ? [antes, ...naJanela] : naJanela, atual, variacao, ultimaData: naJanela[naJanela.length - 1].data });
  }
  return saida.sort((a, b) => b.ultimaData.localeCompare(a.ultimaData) || a.nome.localeCompare(b.nome));
};

export interface SessaoDoExercicio {
  data: string;
  series: Serie[];
  melhor: Serie;
  volume: number;
  obs?: string;
}

/** Todas as sessões de um exercício (mais nova primeiro) e o 1RM estimado (Epley)
 *  da melhor série já registrada por esse critério. */
export const detalheDoExercicio = (
  historico: Partial<EntradaDoHistorico>[],
  nome: string,
): { sessoes: SessaoDoExercicio[]; rm: { valor: number; serie: Serie; data: string } | null } => {
  const alvo = normalizarNome(nome);
  const porData = new Map<string, { series: Serie[]; obs?: string }>();
  for (const h of Array.isArray(historico) ? historico : []) {
    if (!h || h.tipo === "cardio" || !ehData(h.date) || normalizarNome(h.exercise) !== alvo) continue;
    const series = seriesDaEntrada(h);
    if (!series.length) continue;
    const atual = porData.get(h.date as string) ?? { series: [] as Serie[] };
    atual.series.push(...series);
    if (h.obs && !atual.obs) atual.obs = h.obs;
    porData.set(h.date as string, atual);
  }
  const sessoes = [...porData.entries()]
    .map(([data, { series, obs }]) => ({ data, series, melhor: melhorSerie(series) as Serie, volume: volumeDasSeries(series), obs }))
    .filter((s) => s.melhor)
    .sort((a, b) => b.data.localeCompare(a.data));
  let rm: { valor: number; serie: Serie; data: string } | null = null;
  for (const s of sessoes) {
    for (const x of s.series) {
      const v = epley(x.carga, x.reps);
      if (v > 0 && (!rm || v > rm.valor)) rm = { valor: v, serie: x, data: s.data };
    }
  }
  return { sessoes, rm };
};
