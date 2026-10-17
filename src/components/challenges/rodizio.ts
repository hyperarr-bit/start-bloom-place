/**
 * RODÍZIO DOS DESAFIOS (17/10) — quem decide as 4 opções da segunda e como a
 * semana fecha. Puro: o card e o hook de abertura chamam daqui e gravam.
 *
 *  · Vaga 1 = o da semana passada, como VARIAÇÃO (venceu → nível seguinte).
 *    Perdeu, ou venceu o último nível → a chave descansa. (REVANCHE só pra
 *    registro antigo com motivo `sem-registro`, da 1ª versão do rodízio, que
 *    exigia dias anotados — o dono tirou a regra em 17/10; o registro fica.)
 *  · Vagas 2 a 4 = novas ELEGÍVEIS (a pessoa tem o dado), sem repetir chave usada
 *    nas últimas 4 semanas; CALENDÁRIO primeiro (pré-Black Friday → sem comprinha
 *    online; semana do pagamento → guarda da semana; dezembro → rolê com teto —
 *    o calendário passa por cima do descanso); pelo menos 1 ação positiva entre
 *    as 4 quando houver; ordem embaralhada por semente da semana (estável de
 *    segunda a domingo, diferente entre semanas). Eram 3; o dono pediu 4 (17/10):
 *    "sem Uber, quem trabalha não pode se dar esse luxo; tendo 4 fica melhor de
 *    escolher" — com 4 sempre sobra uma que cabe na vida da pessoa.
 *  · Conta com pouco dado: menos de 4 opções é aceitável; nunca se inventa
 *    desafio sem dado. Com 0 ou 1 fora do descanso, repete a usada há mais tempo
 *    — card sem escolha é pior que repetir.
 *  · Fechamento: `active` COM `nivel` → catálogo novo (trava de registro, motivo);
 *    SEM `nivel` (escolhido pelo app antigo) → regra antiga, como sempre foi.
 */

import {
  type ChallengesState, type DesafioAtivo, type GastoDoDesafio, type OfertaDaSemana, type OfertasDaSemana, type RegistroDesafio,
  avaliarDesafio, challengeByKey, lerDesafios, mondayOf, segundaAnterior,
} from "./challenges";
import { CATALOGO, type DadosDaSemana, type DefDesafio, avaliarNoCatalogo, defDoCatalogo } from "./catalogo";

export const SEMANAS_DE_DESCANSO = 4;
export const OPCOES_POR_SEMANA = 4;

/** djb2 — só pra embaralhar de um jeito estável dentro da semana. */
const semente = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
};

const segundasAtras = (weekStart: string, n: number): string => {
  let s = weekStart;
  for (let i = 0; i < n; i++) s = segundaAnterior(s);
  return s;
};

/** O nível a oferecer pra uma chave: um acima do maior já vencido (até o teto da chave). */
export const nivelParaOferta = (def: DefDesafio, history: RegistroDesafio[]): number => {
  const maior = history.filter((h) => h.key === def.key && h.result === "win").reduce((m, h) => Math.max(m, h.nivel ?? 1), 0);
  return Math.min(def.niveis, maior + 1);
};

/** Vaga 1: o da semana passada como variação (venceu → nível seguinte); revanche só de registro antigo `sem-registro`. */
export const variacaoDaSemanaPassada = (d: DadosDaSemana, history: RegistroDesafio[]): OfertaDaSemana | null => {
  const anterior = segundaAnterior(d.weekStart);
  const daSemana = history.filter((h) => h.weekStart === anterior);
  const ultimo = daSemana[daSemana.length - 1];
  if (!ultimo) return null;
  const def = defDoCatalogo(ultimo.key);
  if (!def || !def.elegivel(d)) return null;
  const nivel = ultimo.nivel ?? 1;
  if (ultimo.result === "win") return nivel < def.niveis ? { key: def.key, nivel: nivel + 1, origem: "variacao" } : null;
  if (ultimo.motivo === "sem-registro") return { key: def.key, nivel, origem: "revanche" };
  return null;
};

/** As chaves que o calendário põe na frente nesta semana (na ordem). */
export const prioridadesDoCalendario = (d: DadosDaSemana): string[] => {
  const out: string[] = [];
  if (d.calendario.blackFriday) out.push("sem-comprinha-online");
  if (d.calendario.pagamento) out.push("guarda-da-semana");
  if (d.calendario.dezembro) out.push("role-com-teto");
  return out;
};

export function montarOfertas(d: DadosDaSemana, estado: ChallengesState): OfertasDaSemana {
  const history = estado.history;
  const itens: OfertaDaSemana[] = [];
  const jaTem = (key: string) => itens.some((i) => i.key === key);
  const oferta = (def: DefDesafio, origem: OfertaDaSemana["origem"]): OfertaDaSemana => ({ key: def.key, nivel: nivelParaOferta(def, history), origem });

  const variacao = variacaoDaSemanaPassada(d, history);
  if (variacao) itens.push(variacao);

  const elegiveis = CATALOGO.filter((def) => def.elegivel(d));
  for (const key of prioridadesDoCalendario(d)) {
    if (itens.length >= OPCOES_POR_SEMANA) break;
    const def = elegiveis.find((e) => e.key === key);
    if (def && !jaTem(key)) itens.push(oferta(def, "calendario"));
  }

  const desdeDescanso = segundasAtras(d.weekStart, SEMANAS_DE_DESCANSO);
  const usadas = history.filter((h) => h.weekStart >= desdeDescanso);
  const emDescanso = new Set(usadas.map((h) => h.key));
  const embaralhar = (defs: DefDesafio[]) => [...defs].sort((a, b) => semente(`${a.key}|${d.weekStart}`) - semente(`${b.key}|${d.weekStart}`));
  const novas = embaralhar(elegiveis.filter((def) => !jaTem(def.key) && !emDescanso.has(def.key)));
  for (const def of novas) {
    if (itens.length >= OPCOES_POR_SEMANA) break;
    itens.push(oferta(def, "nova"));
  }

  // mistura: ao menos 1 ação positiva (troca a última vaga "nova", nunca a variação nem o calendário)
  const temAcao = () => itens.some((i) => defDoCatalogo(i.key)?.tipo === "acao");
  if (itens.length >= OPCOES_POR_SEMANA && !temAcao()) {
    const acao = novas.find((def) => def.tipo === "acao" && !jaTem(def.key));
    const ultima = itens[itens.length - 1];
    if (acao && ultima.origem === "nova") itens[itens.length - 1] = oferta(acao, "nova");
  }

  // quase nada fora do descanso (0 ou 1 opção): repete a usada há mais tempo — card
  // sem escolha é pior que repetir; com 2+ opções o descanso de 4 semanas vale inteiro
  if (itens.length < 2) {
    const ultimaVez = new Map<string, string>();
    for (const h of usadas) if (!ultimaVez.has(h.key) || h.weekStart > ultimaVez.get(h.key)!) ultimaVez.set(h.key, h.weekStart);
    const descansando = elegiveis.filter((def) => !jaTem(def.key) && emDescanso.has(def.key)).sort((a, b) => (ultimaVez.get(a.key) ?? "").localeCompare(ultimaVez.get(b.key) ?? ""));
    for (const def of descansando) {
      if (itens.length >= OPCOES_POR_SEMANA) break;
      itens.push(oferta(def, "nova"));
    }
  }

  return { weekStart: d.weekStart, itens };
}

/** As ofertas da semana ainda abertas: tira as chaves que já têm resultado nesta semana. */
export const ofertasVisiveis = (estado: ChallengesState, weekStart: string): OfertaDaSemana[] => {
  if (!estado.ofertas || estado.ofertas.weekStart !== weekStart) return [];
  const fechadas = new Set(estado.history.filter((h) => h.weekStart === weekStart).map((h) => h.key));
  return estado.ofertas.itens.filter((i) => !fechadas.has(i.key));
};

/** O registro de `active` em `weekStart` (a escolha), com o retrato de segunda quando a definição pede. */
export const escolher = (oferta: OfertaDaSemana, d: DadosDaSemana): DesafioAtivo => {
  const def = defDoCatalogo(oferta.key);
  const ativo: DesafioAtivo = { key: oferta.key, weekStart: d.weekStart, nivel: oferta.nivel };
  const meta = def?.retrato?.(d);
  if (meta && Object.keys(meta).length) ativo.meta = meta;
  return ativo;
};

export type DadosDe = (weekStart: string, meta: Record<string, unknown>) => DadosDaSemana;

/** Avalia o `active` de uma semana que passou e devolve o registro pro histórico. */
export function avaliarFechamento(ativo: DesafioAtivo, dadosDa: DadosDe, hoje: Date): RegistroDesafio {
  const d = dadosDa(ativo.weekStart, ativo.meta ?? {});
  const defNovo = ativo.nivel ? defDoCatalogo(ativo.key) : null;
  if (defNovo && ativo.nivel) {
    const ev = avaliarNoCatalogo(defNovo, ativo.nivel, d);
    return { key: ativo.key, weekStart: ativo.weekStart, nivel: ativo.nivel, result: ev.done ? "win" : "loss", motivo: ev.done ? "cumpriu" : ev.motivo ?? "nao-cumpriu" };
  }
  // regra antiga: escolhido pelo app antigo (ou antes desta versão) — ninguém leva regra nova no meio da semana
  const legado = challengeByKey(ativo.key);
  const gastos: GastoDoDesafio[] = [...d.semana, ...d.anterior];
  const ev = legado ? avaliarDesafio(legado, ativo.weekStart, gastos, hoje) : null;
  return { key: ativo.key, weekStart: ativo.weekStart, result: ev?.done ? "win" : "loss" };
}

export interface Fechamento { estado: ChallengesState; registro: RegistroDesafio | null }

/**
 * Fecha o desafio de uma semana que já passou (null = nada a fazer). Já tem
 * resultado daquela semana (vitória do meio da semana) → só libera. As ofertas de
 * uma semana velha saem junto.
 */
export function fecharSemana(bruto: unknown, dadosDa: DadosDe, hoje: Date = new Date()): Fechamento | null {
  const s = lerDesafios(bruto);
  const ativo = s.active;
  const segundaDeAgora = mondayOf(hoje);
  if (!ativo || ativo.weekStart >= segundaDeAgora) return null;
  const base: ChallengesState = { active: null, history: s.history };
  if (s.ofertas && s.ofertas.weekStart === segundaDeAgora) base.ofertas = s.ofertas;
  if (s.history.some((h) => h.weekStart === ativo.weekStart && h.key === ativo.key)) return { estado: base, registro: null };
  const registro = avaliarFechamento(ativo, dadosDa, hoje);
  return { estado: { ...base, history: [...s.history, registro] }, registro };
}
