/**
 * APRENDIZADOS POR CURSO — tipos e contas puras (sem React).
 *
 * Pedido do dono (09/09): "Módulo de estudos muito básico, quero melhorar
 * ele. Não tem como acrescentar o que aprendi no curso. Tipo: aprendi isso,
 * esse slide é bom por causa disso."
 *
 * A frase dele é o registro inteiro: uma REFERÊNCIA ("esse slide"), O QUE
 * APRENDI ("aprendi isso") e o POR QUÊ ("é bom por causa disso"). Nada além
 * disso vira campo — cada campo a mais é um motivo pra não registrar.
 *
 * Fica numa CHAVE PRÓPRIA (`estudos-aprendizados`) indexada pelo id do
 * curso, em vez de inflar `estudos-cursos-andamento`: o array de cursos é
 * lido a cada render da lista e já tem gente de verdade com ele salvo —
 * curso antigo sem entrada continua exatamente igual (lê `undefined` e o
 * `?? []` resolve). E uma chave separada não chega perto do limite de 50KB
 * que faz a carga inicial pular a chave (bug de 16/07).
 */
import { localDayKey, semanaAtualId } from "@/lib/utils";

export interface Aprendizado {
  id: string;
  /** Dia LOCAL (YYYY-MM-DD) em que foi registrado — nunca toISOString. */
  data: string;
  /** "Aula 12 · slide 8", "cap. 3", texto livre e curto. */
  referencia?: string;
  /** Obrigatório: é o registro. */
  aprendi: string;
  /** "é bom por causa disso" / como aplicar. */
  porque?: string;
}

/** `{ [courseId]: Aprendizado[] }` — é o formato salvo na chave. */
export type AprendizadosPorCurso = Record<string, Aprendizado[]>;

/** Dado do store pode chegar torto (versão antiga, null, lista no lugar do
 *  objeto). Nunca derrubar o módulo por isso: lixo vira vazio, entrada sem
 *  texto some. */
export const comoAprendizados = (v: unknown): AprendizadosPorCurso => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: AprendizadosPorCurso = {};
  for (const [cursoId, lista] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(lista)) continue;
    out[cursoId] = lista.filter(
      (a): a is Aprendizado => !!a && typeof a === "object" && typeof (a as Aprendizado).aprendi === "string" && typeof (a as Aprendizado).id === "string",
    );
  }
  return out;
};

/** Mais recente primeiro. Empate no dia desempata pelo id, que é
 *  `Date.now()` em string — o registrado por último fica no topo. */
export const maisRecentesPrimeiro = (lista: Aprendizado[]): Aprendizado[] =>
  [...lista].sort((a, b) => (b.data || "").localeCompare(a.data || "") || b.id.localeCompare(a.id, undefined, { numeric: true }));

/** Quantos foram registrados NESTA semana (de segunda até hoje, dia local).
 *  Comparação de string funciona porque a chave é YYYY-MM-DD. O teto em
 *  "hoje" é defesa contra relógio adiantado de outro aparelho. */
export const contarNaSemana = (mapa: AprendizadosPorCurso, hoje: string = localDayKey(), inicioSemana: string = semanaAtualId()): number => {
  let n = 0;
  for (const lista of Object.values(mapa)) {
    for (const a of lista) if (a.data >= inicioSemana && a.data <= hoje) n++;
  }
  return n;
};

/** Todos os cursos misturados, cada um sabendo de qual curso veio — é o que
 *  o Caderno lista. Curso apagado NÃO leva os aprendizados junto (o que a
 *  pessoa escreveu é dela), então o nome pode não existir mais. */
export interface AprendizadoComCurso extends Aprendizado {
  cursoId: string;
  cursoNome: string;
}

export const misturarCursos = (mapa: AprendizadosPorCurso, nomes: Record<string, string>): AprendizadoComCurso[] => {
  const tudo: AprendizadoComCurso[] = [];
  for (const [cursoId, lista] of Object.entries(mapa)) {
    for (const a of lista) tudo.push({ ...a, cursoId, cursoNome: nomes[cursoId] ?? "Curso removido" });
  }
  return maisRecentesPrimeiro(tudo) as AprendizadoComCurso[];
};

/** Busca por texto em referência, aprendi, porquê E nome do curso — sem
 *  acento importar ("licao" acha "lição"). */
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const filtrarAprendizados = (lista: AprendizadoComCurso[], busca: string, cursoId: string | null): AprendizadoComCurso[] => {
  const q = semAcento(busca.trim());
  return lista.filter((a) => {
    if (cursoId && a.cursoId !== cursoId) return false;
    if (!q) return true;
    return semAcento([a.referencia, a.aprendi, a.porque, a.cursoNome].filter(Boolean).join(" ")).includes(q);
  });
};

/** "1 aprendizado" / "7 aprendizados" — o tile de sequência já mostrou
 *  "1 dias" uma vez (07/09); plural é responsabilidade de quem formata. */
export const rotuloAprendizados = (n: number): string => `${n} ${n === 1 ? "aprendizado" : "aprendizados"}`;

/** "09/09" pra listar. Parse local — `new Date("2026-09-09")` vira véspera no Brasil. */
export const diaCurto = (chave: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(chave || "");
  return m ? `${m[3]}/${m[2]}` : "";
};
