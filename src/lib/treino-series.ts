/**
 * SÉRIE POR SÉRIE (26/09, redesenho do Treino aprovado em mockup).
 *
 * Até aqui o treino do dia era um ✓ por exercício, com o alvo do plano
 * ("4 × 10 × 50kg") gravado no histórico como se tivesse sido feito. Agora
 * cada exercício de força vira a tabela SÉRIE | CARGA | REPS | FEITO, com o
 * que a pessoa fez DA ÚLTIMA VEZ já preenchido (em cinza até confirmar).
 *
 * Tudo aqui é função pura — a tela só chama. Compatibilidade:
 *  - o plano (`saude-workouts-v2`) continua com sets/reps/carga em TEXTO;
 *  - o histórico (`treino-exercise-history`) continua com o resumo de sempre
 *    (sets = séries feitas, reps/carga = da melhor série) e ganha o campo
 *    opcional `series`. Entrada antiga, sem `series`, é lida pelo resumo.
 */
import { lerNumero } from "@/lib/treino-numeros";
import { parseLocalDay } from "@/lib/utils";

export type Serie = { carga: number; reps: number };
/** `ok`: valor confirmado ou mexido pela pessoa (preto). Sem ok e sem feito = cinza (sugestão). */
export type SerieDaSessao = Serie & { feito: boolean; ok?: boolean };

export interface ExercicioDoPlano {
  name: string;
  sets: string;
  reps: string;
  carga: string;
  done: boolean;
  obs: string;
  tipo?: "cardio";
  duracao?: string;
  distancia?: string;
}

export interface EntradaDoHistorico {
  date: string;
  exercise: string;
  sets: string;
  reps: string;
  carga: string;
  obs?: string;
  /** 26/09: as séries uma a uma. Opcional — o resto do app lê o resumo. */
  series?: Serie[];
  tipo?: "cardio";
  duracao?: string;
  distancia?: string;
}

/** A sessão de hoje (`treino-sessao`). Só vale pro dia dela. */
export interface SessaoDoTreino {
  data: string;
  /** Dia do PLANO sendo feito ("SÁBADO"); pode ser outro no dia de descanso. */
  dia: string;
  inicio: string | null;
  fim?: string | null;
  /** O que foi gravado no último "Concluir" — muda depois, o botão vira "Salvar de novo". */
  assinatura?: string;
  series: Record<string, SerieDaSessao[]>;
}

const arred = (n: number) => Math.round(n * 100) / 100;
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : lerNumero(v));

/** "52,5" — vírgula, sem zero à toa. */
export const formatarKg = (kg: number): string =>
  (Number.isFinite(kg) ? kg : 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** "3.404" — volume inteiro com ponto de milhar. */
export const formatarKgInteiro = (kg: number): string => Math.round(kg || 0).toLocaleString("pt-BR");

/** Mesmo exercício, com ou sem maiúscula/espaço sobrando. */
export const normalizarNome = (nome: unknown): string =>
  String(nome ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Séries de uma entrada do histórico: as gravadas uma a uma ou, na entrada
 *  antiga, o resumo "4 × 10 × 50kg" expandido em 4 séries iguais. */
export const seriesDaEntrada = (h: Partial<EntradaDoHistorico> | null | undefined): Serie[] => {
  if (!h) return [];
  if (Array.isArray(h.series) && h.series.length > 0) {
    const s = h.series
      .map((x) => ({ carga: Math.max(0, numero(x?.carga)), reps: Math.max(0, Math.round(numero(x?.reps))) }))
      .filter((x) => x.reps > 0 || x.carga > 0);
    if (s.length) return s;
  }
  const carga = lerNumero(h.carga);
  const reps = Math.round(lerNumero(h.reps));
  if (carga <= 0 && reps <= 0) return [];
  const n = Math.min(Math.max(Math.round(lerNumero(h.sets)) || 1, 1), 20);
  return Array.from({ length: n }, () => ({ carga, reps }));
};

/** A ÚLTIMA VEZ desse exercício: a entrada mais nova (por data, antes de
 *  `antesDe` — o treino de hoje não é "a última vez" dele mesmo). */
export const ultimaVez = (
  historico: Partial<EntradaDoHistorico>[],
  nome: string,
  antesDe?: string,
): { data: string; series: Serie[] } | null => {
  const alvo = normalizarNome(nome);
  let achada: { data: string; series: Serie[] } | null = null;
  for (const h of Array.isArray(historico) ? historico : []) {
    if (!h || h.tipo === "cardio" || typeof h.date !== "string" || normalizarNome(h.exercise) !== alvo) continue;
    if (antesDe && h.date >= antesDe) continue;
    if (achada && h.date <= achada.data) continue;
    const series = seriesDaEntrada(h);
    if (series.length) achada = { data: h.date, series };
  }
  return achada;
};

/** Reps-alvo do plano: "10" → 10; faixa "8-12" ou "8 a 12" → 12 (fecha quem chega no topo). */
export const repsAlvo = (reps: unknown): number => {
  const t = String(reps ?? "");
  const faixa = t.match(/(\d+)\s*(?:-|–|a|até)\s*(\d+)/i);
  if (faixa) return Math.max(Number(faixa[1]), Number(faixa[2]));
  return Math.round(lerNumero(t));
};

/** Degrau de carga do −/+ e do "Sobe pra": +2,5 kg; abaixo de 20 kg, 1 kg
 *  (halter de 8 kg não vira 10,5). */
export const ajustarCarga = (carga: number, direcao: 1 | -1): number => {
  const c = Math.max(0, carga || 0);
  if (direcao > 0) return arred(c + (c < 20 ? 1 : 2.5));
  return Math.max(0, arred(c - (c <= 20 ? 1 : 2.5)));
};
export const proximaCarga = (carga: number): number => ajustarCarga(carga, 1);

/** Chave de cada exercício na sessão = o nome; repetido no mesmo dia ganha "#2". */
export const chavesDosExercicios = (exercicios: { name?: string }[]): string[] => {
  const vistos = new Map<string, number>();
  return exercicios.map((e) => {
    const nome = String(e?.name ?? "").trim() || "Exercício";
    const n = (vistos.get(nome) ?? 0) + 1;
    vistos.set(nome, n);
    return n === 1 ? nome : `${nome} #${n}`;
  });
};

/** Séries de partida: o que a pessoa fez da última vez; sem última vez, o alvo
 *  do plano. Quantas: as do plano (sem número no plano, as da última vez; senão 3).
 *  Exercício marcado como feito no plano (✓ antigo) já nasce feito. */
export const seriesIniciais = (ex: ExercicioDoPlano, ultima: { series: Serie[] } | null): SerieDaSessao[] => {
  const feito = !!ex.done;
  if (ex.tipo === "cardio") return [{ carga: 0, reps: 0, feito }];
  const doPlano = Math.round(lerNumero(ex.sets));
  const base = ultima?.series ?? [];
  const n = Math.min(Math.max(doPlano || base.length || 3, 1), 20);
  const cargaDoPlano = lerNumero(ex.carga);
  const repsDoPlano = Math.round(lerNumero(ex.reps));
  return Array.from({ length: n }, (_, i) => {
    const u = base.length ? base[Math.min(i, base.length - 1)] : null;
    return { carga: u ? u.carga : cargaDoPlano, reps: u ? u.reps : repsDoPlano, feito };
  });
};

export interface SugestaoDeCarga {
  /** carga que a pessoa aguentou em todas as séries */
  base: number;
  nova: number;
  /** "4×10" */
  fechou: string;
  data: string;
}

/** Post-it de progressão: a última sessão fechou TODAS as séries com as reps-alvo
 *  → sugere +2,5 kg (abaixo de 20 kg, +1 kg). Sem reps-alvo no plano, o alvo é a
 *  maior rep da última vez (todas iguais = fechou). */
export const sugestaoDeCarga = (
  ex: ExercicioDoPlano,
  ultima: { data: string; series: Serie[] } | null,
): SugestaoDeCarga | null => {
  if (!ultima || ex.tipo === "cardio" || ultima.series.length === 0) return null;
  const alvoSeries = Math.round(lerNumero(ex.sets)) || ultima.series.length;
  const alvoReps = repsAlvo(ex.reps) || Math.max(...ultima.series.map((s) => s.reps));
  if (alvoReps <= 0 || ultima.series.length < alvoSeries) return null;
  if (!ultima.series.every((s) => s.carga > 0 && s.reps >= alvoReps)) return null;
  const base = Math.min(...ultima.series.map((s) => s.carga));
  return { base, nova: proximaCarga(base), fechou: `${ultima.series.length}×${alvoReps}`, data: ultima.data };
};

const DIA_CURTO = ["No domingo", "Na segunda", "Na terça", "Na quarta", "Na quinta", "Na sexta", "No sábado"];

/** "Semana passada" / "Na terça" / "Ontem" — pro texto do post-it. */
export const quandoFoi = (data: string, hoje: string): string => {
  const dias = Math.round((parseLocalDay(hoje).getTime() - parseLocalDay(data).getTime()) / 86_400_000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return DIA_CURTO[parseLocalDay(data).getDay()];
  if (dias < 14) return "Semana passada";
  return "Da última vez";
};

/** "50 kg × 10·10·9·8"; cargas diferentes viram faixa "50–52,5 kg × …". */
export const textoDaUltimaVez = (series: Serie[]): string => {
  if (!series.length) return "";
  const cargas = series.map((s) => s.carga);
  const min = Math.min(...cargas);
  const max = Math.max(...cargas);
  const reps = series.map((s) => s.reps).join("·");
  if (max <= 0) return `${reps} reps`;
  const kg = min === max ? `${formatarKg(max)} kg` : `${formatarKg(min)}–${formatarKg(max)} kg`;
  return `${kg} × ${reps}`;
};

/** "55 kg × 8" (sem carga: "15 reps"). */
export const textoDaSerie = (s: Serie): string => (s.carga > 0 ? `${formatarKg(s.carga)} kg × ${s.reps}` : `${s.reps} reps`);

/** Melhor série = a de maior carga; empate, mais reps. */
export const melhorSerie = (series: Serie[]): Serie | null => {
  let m: Serie | null = null;
  for (const s of series) {
    if (!s || (s.reps <= 0 && s.carga <= 0)) continue;
    if (!m || s.carga > m.carga || (s.carga === m.carga && s.reps > m.reps)) m = { carga: s.carga, reps: s.reps };
  }
  return m;
};

/** `a` bate o recorde `b`: mais carga, ou a mesma carga com mais reps. */
export const superou = (a: Serie, b: Serie): boolean => a.carga > b.carga || (a.carga === b.carga && a.reps > b.reps);

/** Volume = Σ carga × reps. */
export const volumeDasSeries = (series: Serie[]): number =>
  series.reduce((t, s) => t + Math.max(0, s.carga || 0) * Math.max(0, s.reps || 0), 0);

/** 1RM estimado (Epley). */
export const epley = (carga: number, reps: number): number => {
  if (reps <= 0 || carga <= 0) return 0;
  if (reps === 1) return carga;
  return Math.round(carga * (1 + reps / 30));
};

/** O recorde de antes (melhor série de todas as entradas anteriores a `antesDe`). */
export const recordeAnterior = (historico: Partial<EntradaDoHistorico>[], nome: string, antesDe: string): Serie | null => {
  const alvo = normalizarNome(nome);
  const todas: Serie[] = [];
  for (const h of Array.isArray(historico) ? historico : []) {
    if (!h || h.tipo === "cardio" || typeof h.date !== "string" || h.date >= antesDe) continue;
    if (normalizarNome(h.exercise) === alvo) todas.push(...seriesDaEntrada(h));
  }
  return melhorSerie(todas);
};

/* ---------------- a sessão (cada mudança devolve uma sessão nova) ---------------- */

export const sessaoNova = (data: string, dia: string): SessaoDoTreino => ({ data, dia, inicio: null, series: {} });

/** A sessão salva só vale pro DIA dela — esquecida aberta, gravaria o treino no
 *  dia errado (mesma regra do "sessão > 12 h", 26/09). Exceção: treino que passou
 *  da meia-noite (começou há menos de 6 h e não foi concluído). */
export const sessaoValida = (s: unknown, hoje: string, agoraMs: number): s is SessaoDoTreino => {
  if (!s || typeof s !== "object") return false;
  const x = s as SessaoDoTreino;
  if (typeof x.data !== "string" || typeof x.dia !== "string" || !x.series || typeof x.series !== "object") return false;
  if (x.data === hoje) return true;
  if (x.data > hoje || !x.inicio || x.fim) return false;
  const t = Date.parse(x.inicio);
  return Number.isFinite(t) && agoraMs - t >= 0 && agoraMs - t < 6 * 3_600_000;
};

const mudarTodas = (
  sessao: SessaoDoTreino,
  chave: string,
  iniciais: SerieDaSessao[],
  mudar: (lista: SerieDaSessao[]) => SerieDaSessao[],
): SessaoDoTreino => {
  const atual = (sessao.series[chave] ?? iniciais).map((s) => ({ ...s }));
  return { ...sessao, series: { ...sessao.series, [chave]: mudar(atual) } };
};

export const alternarFeito = (sessao: SessaoDoTreino, chave: string, iniciais: SerieDaSessao[], i: number) =>
  mudarTodas(sessao, chave, iniciais, (l) => l.map((s, j) => (j === i ? { ...s, feito: !s.feito, ok: true } : s)));

export const definirValor = (
  sessao: SessaoDoTreino,
  chave: string,
  iniciais: SerieDaSessao[],
  i: number,
  campo: "carga" | "reps",
  valor: number,
) =>
  mudarTodas(sessao, chave, iniciais, (l) =>
    l.map((s, j) => {
      if (j !== i) return s;
      const v = Number.isFinite(valor) ? valor : 0;
      return { ...s, [campo]: campo === "reps" ? Math.max(0, Math.round(v)) : Math.max(0, arred(v)), ok: true };
    }),
  );

/** "Subir": a carga nova vale pras séries que faltam (as feitas ficam como foram;
 *  a que ela já tinha posto acima não desce). */
export const subirCarga = (sessao: SessaoDoTreino, chave: string, iniciais: SerieDaSessao[], nova: number) =>
  mudarTodas(sessao, chave, iniciais, (l) => l.map((s) => (s.feito ? s : { ...s, carga: Math.max(s.carga, nova), ok: true })));

export const adicionarSerie = (sessao: SessaoDoTreino, chave: string, iniciais: SerieDaSessao[]) =>
  mudarTodas(sessao, chave, iniciais, (l) => {
    const u = l[l.length - 1] ?? { carga: 0, reps: 0, feito: false };
    return l.length >= 20 ? l : [...l, { carga: u.carga, reps: u.reps, feito: false, ok: u.ok }];
  });

/** Tira a última série se ela ainda não foi feita (o "+ série" tocado sem querer). */
export const removerUltimaSerie = (sessao: SessaoDoTreino, chave: string, iniciais: SerieDaSessao[]) =>
  mudarTodas(sessao, chave, iniciais, (l) => (l.length > 1 && !l[l.length - 1].feito ? l.slice(0, -1) : l));

/** Quadradinho da linha fechada: marca (ou desmarca) o exercício inteiro. */
export const marcarExercicio = (sessao: SessaoDoTreino, chave: string, iniciais: SerieDaSessao[], feito: boolean) =>
  mudarTodas(sessao, chave, iniciais, (l) => l.map((s) => ({ ...s, feito, ok: true })));

/** O que foi feito, num texto — muda quando alguma série feita muda (exercício
 *  sem nada feito não entra: incluir um exercício depois de concluir não é mudança). */
export const assinaturaDasSeries = (series: Record<string, SerieDaSessao[]>): string =>
  JSON.stringify(
    Object.keys(series)
      .sort()
      .map((k) => [k, (series[k] ?? []).filter((s) => s.feito).map((s) => [s.carga, s.reps])])
      .filter(([, feitas]) => (feitas as unknown[]).length > 0),
  );

/* ---------------- concluir ---------------- */

export interface LinhaDoResumo {
  nome: string;
  series: number;
  melhor: Serie | null;
  recorde: boolean;
  cardio?: { duracao?: string; distancia?: string };
}

export interface Conclusao {
  entradas: EntradaDoHistorico[];
  linhas: LinhaDoResumo[];
  volume: number;
  recordes: string[];
  /** séries de força feitas + cardios feitos */
  feitas: number;
}

/** Monta o que o "Concluir treino" grava: UMA entrada de histórico por exercício
 *  feito (resumo de sempre + `series`), o volume do dia (Σ carga × reps das séries
 *  feitas; cardio não soma) e quem bateu recorde. `historico` = o de ANTES do dia. */
export const concluirTreino = ({
  exercicios,
  chaves,
  series,
  historico,
  data,
}: {
  exercicios: ExercicioDoPlano[];
  chaves: string[];
  series: Record<string, SerieDaSessao[]>;
  historico: Partial<EntradaDoHistorico>[];
  data: string;
}): Conclusao => {
  const entradas: EntradaDoHistorico[] = [];
  const linhas: LinhaDoResumo[] = [];
  const recordes: string[] = [];
  let volume = 0;
  let feitas = 0;
  exercicios.forEach((ex, i) => {
    const lista = series[chaves[i]] ?? [];
    const nome = String(ex.name ?? "").trim();
    if (!nome) return;
    if (ex.tipo === "cardio") {
      if (!lista.some((s) => s.feito)) return;
      feitas += 1;
      entradas.push({
        date: data, exercise: nome, sets: "", reps: "", carga: "", obs: ex.obs ?? "",
        tipo: "cardio", ...(ex.duracao ? { duracao: ex.duracao } : {}), ...(ex.distancia ? { distancia: ex.distancia } : {}),
      });
      linhas.push({ nome, series: 1, melhor: null, recorde: false, cardio: { duracao: ex.duracao, distancia: ex.distancia } });
      return;
    }
    const feitasDoEx = lista.filter((s) => s.feito);
    if (!feitasDoEx.length) return;
    feitas += feitasDoEx.length;
    const s = feitasDoEx.map(({ carga, reps }) => ({ carga, reps }));
    const melhor = melhorSerie(s);
    volume += volumeDasSeries(s);
    const antes = melhor ? recordeAnterior(historico, nome, data) : null;
    const recorde = !!(melhor && antes && superou(melhor, antes));
    if (recorde) recordes.push(nome);
    entradas.push({
      date: data,
      exercise: nome,
      sets: String(s.length),
      reps: melhor ? String(melhor.reps) : "",
      carga: melhor && melhor.carga > 0 ? `${formatarKg(melhor.carga)}kg` : "",
      obs: ex.obs ?? "",
      series: s,
    });
    linhas.push({ nome, series: s.length, melhor, recorde });
  });
  return { entradas, linhas, volume, recordes, feitas };
};

/** Grava no histórico: concluir de novo no mesmo dia SUBSTITUI a entrada do dia
 *  (a regra de sempre); mais novo primeiro; no máximo 500. */
export const registrarNoHistorico = <T extends { date?: string; exercise?: string }>(
  historico: T[],
  novas: T[],
  data: string,
  maximo = 500,
): T[] => {
  const nomes = new Set(novas.map((n) => n.exercise));
  const resto = (Array.isArray(historico) ? historico : []).filter((h) => !(h && h.date === data && nomes.has(h.exercise)));
  return [...novas, ...resto]
    .sort((a, b) => String(b?.date ?? "").localeCompare(String(a?.date ?? "")))
    .slice(0, maximo);
};

/** A vez anterior com esses exercícios (a data mais nova antes de `antesDe`) e o
 *  volume deles nela — o "VS. ÚLTIMA" do treino concluído. */
export const volumeDaVezAnterior = (
  historico: Partial<EntradaDoHistorico>[],
  nomes: string[],
  antesDe: string,
): { data: string; volume: number } | null => {
  const alvo = new Set(nomes.map(normalizarNome));
  const lista = (Array.isArray(historico) ? historico : []).filter(
    (h) => h && h.tipo !== "cardio" && typeof h.date === "string" && h.date < antesDe && alvo.has(normalizarNome(h.exercise)),
  );
  let data = "";
  for (const h of lista) if ((h.date as string) > data) data = h.date as string;
  if (!data) return null;
  const volume = lista.filter((h) => h.date === data).reduce((t, h) => t + volumeDasSeries(seriesDaEntrada(h)), 0);
  return volume > 0 ? { data, volume } : null;
};

/** Variação em %, arredondada; sem base, null. */
export const variacaoPct = (atual: number, anterior: number): number | null =>
  anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null;

/** Duração estimada do treino do dia: a média das últimas vezes desse dia, se
 *  houver; senão, ~1,5 min por série + o descanso + 2 min de troca por exercício. */
export const duracaoEstimada = (exercicios: ExercicioDoPlano[], descansoSeg: number, minutosAnteriores: number[] = []): number => {
  const validos = minutosAnteriores.filter((m) => Number.isFinite(m) && m > 0).slice(0, 4);
  if (validos.length) return Math.max(5, Math.round(validos.reduce((a, b) => a + b, 0) / validos.length / 5) * 5);
  let min = 0;
  for (const ex of exercicios) {
    if (ex.tipo === "cardio") min += lerNumero(ex.duracao) || 10;
    else min += (Math.round(lerNumero(ex.sets)) || 3) * (1.5 + Math.max(0, descansoSeg) / 60) + 2;
  }
  return Math.max(5, Math.round(min / 5) * 5);
};
