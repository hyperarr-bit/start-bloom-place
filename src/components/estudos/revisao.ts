/**
 * REVISÃO ESPAÇADA dos aprendizados (11/09) — contas puras, sem React.
 *
 * Pedido de um cliente: "active recall, repetição espaçada, flashcards
 * tipo Anki alimentados pelo que estudei". O material já existe: cada "o que
 * aprendi" registrado no curso é um cartão. A FRENTE é a pergunta que a
 * pessoa escreveu (opcional) ou, sem ela, a referência ("Aula 12 · slide 8")
 * com "o que você aprendeu aqui?". O VERSO é o próprio aprendizado e o
 * por quê. Nada de cadastrar cartão à parte — cada campo a mais é um
 * motivo pra não registrar.
 *
 * Agenda: intervalos crescentes (1, 3, 7, 14, 30, 60, 120 dias). Lembrou →
 * sobe um degrau. Não lembrou → volta pro 1. Cartão novo entra no dia
 * seguinte ao registro. No máximo 15 por dia, os mais atrasados primeiro:
 * uma revisão de 5 minutos que acontece vale mais que uma de 40 que não.
 *
 * Chave própria (`estudos-revisoes`, `{ [idDoAprendizado]: estado }`):
 * apagar o aprendizado apaga o cartão por tabela (ninguém lê estado órfão).
 */
import { localDayKey } from "@/lib/utils";
import type { AprendizadoComCurso } from "./aprendizados";

export const INTERVALOS_DIAS = [1, 3, 7, 14, 30, 60, 120];
export const MAXIMO_POR_DIA = 15;

export interface EstadoRevisao {
  /** próximo dia LOCAL (YYYY-MM-DD) em que o cartão volta */
  proxima: string;
  /** degrau atual em INTERVALOS_DIAS */
  degrau: number;
  /** quantas vezes já foi respondido */
  vezes: number;
}
export type Revisoes = Record<string, EstadoRevisao>;

export const comoRevisoes = (v: unknown): Revisoes => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Revisoes = {};
  for (const [id, e] of Object.entries(v as Record<string, unknown>)) {
    const r = e as Partial<EstadoRevisao> | null;
    if (!r || typeof r.proxima !== "string") continue;
    out[id] = { proxima: r.proxima, degrau: Number.isInteger(r.degrau) ? Math.max(0, r.degrau as number) : 0, vezes: Number(r.vezes) || 0 };
  }
  return out;
};

const somarDias = (dia: string, n: number): string => {
  const [y, m, d] = dia.split("-").map(Number);
  return localDayKey(new Date(y, m - 1, d + n));
};

/** Dia em que o cartão vence: o agendado, ou o dia seguinte ao registro. */
export const vencimento = (a: { id: string; data: string }, revisoes: Revisoes): string =>
  revisoes[a.id]?.proxima ?? somarDias(a.data || localDayKey(), 1);

/** Cartões de hoje: vencidos até hoje, mais atrasados primeiro, no máximo 15. */
export const paraRevisarHoje = (lista: AprendizadoComCurso[], revisoes: Revisoes, hoje: string = localDayKey()): AprendizadoComCurso[] =>
  lista
    .map((a) => ({ a, vence: vencimento(a, revisoes) }))
    .filter(({ vence }) => vence <= hoje)
    .sort((x, y) => x.vence.localeCompare(y.vence) || x.a.id.localeCompare(y.a.id, undefined, { numeric: true }))
    .slice(0, MAXIMO_POR_DIA)
    .map(({ a }) => a);

/** Quantos vencem em cada dia futuro — pro "amanhã: 3" do fim da sessão. */
export const contarVencendoEm = (lista: AprendizadoComCurso[], revisoes: Revisoes, dia: string): number =>
  lista.filter((a) => vencimento(a, revisoes) === dia).length;

/** Resposta: lembrou sobe um degrau; não lembrou volta pro começo. */
export const responder = (atual: EstadoRevisao | undefined, lembrou: boolean, hoje: string = localDayKey()): EstadoRevisao => {
  const degrau = lembrou ? Math.min((atual?.degrau ?? -1) + 1, INTERVALOS_DIAS.length - 1) : 0;
  return { proxima: somarDias(hoje, INTERVALOS_DIAS[degrau]), degrau, vezes: (atual?.vezes ?? 0) + 1 };
};

/** Frente do cartão: a pergunta da pessoa, ou a referência como deixa. */
export const frenteDoCartao = (a: AprendizadoComCurso): { deixa: string; pergunta: string } => {
  const deixa = [a.cursoNome, a.referencia].filter(Boolean).join(" · ");
  const pergunta = a.pergunta?.trim();
  return { deixa, pergunta: pergunta || "O que você aprendeu aqui?" };
};
