import type { Badge, Raridade } from "@/components/gamification/types";
import { raridadeDe } from "@/components/gamification/types";
import { MARCOS_SEQUENCIA } from "@/lib/sequencia";

/**
 * CONQUISTAS 2 (16/10, protótipo — NÃO ligado no app): só SEQUÊNCIA + ADESIVOS.
 *
 * Tudo aqui é PURO (sem React, sem storage). As decisões de mecânica, com o dado
 * que as sustenta (scratchpad definitiva/5-produto.md):
 *
 *  - No teste, quem usa em 3 DIAS DIFERENTES paga 38% (× 15%). O que a tela
 *    precisa fazer é puxar o dia 2 e o dia 3 → adesivos novos da sequência em
 *    2 e 3 dias ("Voltei" e "3 Dias Seguidos"), e "AMANHÃ VOCÊ GANHA…" sempre
 *    visível (o prêmio do dia seguinte é o motivo de voltar).
 *  - 47 pessoas chegaram a 7 dias e 4 a 30: entre 7 e 30 há um deserto de 23
 *    dias → adesivo de 14 dias ("Duas Semanas") no meio.
 *  - A festa em tela cheia (617 pessoas, 1.939 vezes, 1 compartilhamento) é
 *    interrupção → comum e raro viram um AVISO PEQUENO (toast); tela cheia só
 *    nos marcos da sequência (7/30/100) e nos épicos/lendários. Compartilhar
 *    só nos marcos.
 *  - A sequência continua contando "qualquer coisa anotada em qualquer módulo"
 *    (lib/sequencia.ts, `core-dias-anotados`): o dado de quem já usa fica
 *    intacto. Protetor fica (33 pessoas usaram): 1 a cada 7 dias, máximo 2.
 */

/** Os marcos da sequência que colam adesivo (os 3 novos + os 3 de sempre). */
export const MARCOS_ADESIVO = [2, 3, 7, 14, 30, 100] as const;
export type MarcoAdesivo = (typeof MARCOS_ADESIVO)[number];

/** Os adesivos NOVOS da sequência (os de 7/30/100 já existem em conquistas-registro). */
export const ADESIVOS_SEQUENCIA_NOVOS: Record<2 | 3 | 14, { nome: string; descricao: string; raridade: Raridade }> = {
  2: { nome: "Voltei", descricao: "Anote algo 2 dias seguidos — o 2º dia é o que mais conta", raridade: "comum" },
  3: { nome: "3 Dias Seguidos", descricao: "Anote algo 3 dias seguidos", raridade: "raro" },
  14: { nome: "Duas Semanas", descricao: "Anote algo 14 dias seguidos", raridade: "raro" },
};

export const idDoMarco = (n: number) => `sequencia-${n}`;

/** Monta os 3 adesivos novos (mesmo formato dos de 7/30/100). */
export const adesivosDaSequenciaNovos = (recorde: number): Badge[] =>
  ([2, 3, 14] as const).map((n) => {
    const d = ADESIVOS_SEQUENCIA_NOVOS[n];
    return {
      id: idDoMarco(n),
      name: d.nome,
      description: d.descricao,
      icon: "🔥",
      category: "sequencia",
      color: "green",
      raridade: d.raridade,
      xp: d.raridade === "comum" ? 50 : 100,
      unlocked: recorde >= n,
      progresso: { atual: Math.min(Math.max(0, recorde), n), alvo: n },
    };
  });

/** Ordena os adesivos da sequência pelo marco (2, 3, 7, 14, 30, 100, depois o resto). */
export const marcoDoAdesivo = (id: string): number | null => {
  const m = /^sequencia-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
};

export const ehMarcoDeFesta = (id: string): boolean => {
  const n = marcoDoAdesivo(id);
  return n !== null && (MARCOS_SEQUENCIA as readonly number[]).includes(n);
};

/**
 * Como um adesivo novo aparece: TOAST (aviso pequeno, 3,5 s, não interrompe) pros
 * comuns e raros; TELA CHEIA só pros marcos da sequência (7/30/100) e pros
 * épicos/lendários. É a regra "festa só em marco raro" do relatório de 16/10.
 */
export const formatoDoAviso = (b: Pick<Badge, "id" | "xp" | "raridade">): "toast" | "tela_cheia" => {
  if (ehMarcoDeFesta(b.id)) return "tela_cheia";
  const r = raridadeDe(b);
  return r === "epico" || r === "lendario" ? "tela_cheia" : "toast";
};

/** Compartilhar só nos marcos (7/30/100 dias) — nunca num adesivo comum. */
export const podeCompartilhar = (b: Pick<Badge, "id">): boolean => ehMarcoDeFesta(b.id);

/* ------------------------------------------------------------------------- *
 * "AMANHÃ VOCÊ GANHA…" — o próximo prêmio da sequência
 * ------------------------------------------------------------------------- */

export interface ProximoPremio {
  /** O adesivo que vem (ou null quando só vem protetor). */
  adesivo: Badge | null;
  marco: number;
  /** "hoje" = anotar hoje já cola · "amanha" = anotar hoje e amanhã · "dias" = faltam N dias. */
  quando: "hoje" | "amanha" | "dias";
  /** Dias de anotação que faltam, contando hoje se hoje ainda está vazio. */
  faltam: number;
  /** O marco também dá protetor (a cada 7). */
  daProtetor: boolean;
  /** Frase pronta pra tela: "Amanhã você ganha" · "Hoje você ganha" · "Em 4 dias você ganha". */
  titulo: string;
}

const DIAS_POR_PROTETOR = 7;

/**
 * O próximo prêmio pela sequência DE AGORA (`dias` = dias seguidos contando
 * até hoje se hoje já está feito, até ontem se não). Pula marcos cujo adesivo
 * já está colado (um recorde antigo maior) — a não ser que o marco dê protetor.
 */
export function proximoPremio(dias: number, hojeFeito: boolean, adesivos: Badge[]): ProximoPremio {
  const seguidos = Math.max(0, dias);
  // o 1º dia que ainda falta anotar: hoje (se vazio) vale `seguidos + 1`
  const seHoje = hojeFeito ? seguidos : seguidos + 1;
  const colados = new Set(adesivos.filter((b) => b.unlocked).map((b) => b.id));
  const candidatos: number[] = [];
  for (const m of MARCOS_ADESIVO) {
    if (m <= seguidos) continue;
    const semAdesivo = colados.has(idDoMarco(m));
    if (semAdesivo && m % DIAS_POR_PROTETOR !== 0) continue;
    candidatos.push(m);
  }
  // sem marco de adesivo à frente (recorde enorme): o próximo múltiplo de 7 (protetor)
  const marco = candidatos[0] ?? (Math.floor(seguidos / DIAS_POR_PROTETOR) + 1) * DIAS_POR_PROTETOR;
  const adesivo = adesivos.find((b) => b.id === idDoMarco(marco) && !b.unlocked) ?? null;
  const faltam = Math.max(1, marco - seHoje + (hojeFeito ? 0 : 1));
  const quando: ProximoPremio["quando"] = !hojeFeito && marco === seHoje ? "hoje" : faltam === 1 ? "amanha" : "dias";
  const titulo = quando === "hoje" ? "Hoje você ganha" : quando === "amanha" ? "Amanhã você ganha" : `Em ${faltam} dias você ganha`;
  return { adesivo, marco, quando, faltam, daProtetor: marco % DIAS_POR_PROTETOR === 0, titulo };
}

/* ------------------------------------------------------------------------- *
 * Coleções por módulo ("faltam 2 pra fechar a página")
 * ------------------------------------------------------------------------- */

/** "faltam 2 pra fechar" quando perto; "6 de 24" quando longe; "completa" quando fechou. */
export const fraseDaColecao = (abertos: number, total: number): string => {
  const faltam = total - abertos;
  if (total === 0) return "";
  if (faltam <= 0) return "coleção completa";
  if (faltam <= 3) return `faltam ${faltam} pra fechar`;
  return `${abertos} de ${total}`;
};

/* ------------------------------------------------------------------------- *
 * Medição — tudo com o prefixo `conquistas2_`
 * ------------------------------------------------------------------------- */

export const EVENTOS2 = {
  /** Abriu a tela {origem, dias, teste_dia?, direcao}. */
  abrir: "conquistas2_open",
  /** Saiu da tela {ms} — hoje a visita dura ~8 s; a meta é passar de 15. */
  tempo: "conquistas2_tempo",
  /** O "amanhã você ganha" apareceu {marco, quando}. */
  amanhaVisto: "conquistas2_amanha_visto",
  /** Tocou num adesivo {id, aberto, colecao}. */
  adesivoToque: "conquistas2_adesivo_toque",
  /** Abriu a coleção inteira {colecao|"todas"}. */
  colecaoAbrir: "conquistas2_colecao_abrir",
  /** Abriu o detalhe da sequência {dias}. */
  sequenciaAbrir: "conquistas2_sequencia_abrir",
  /** Toast de adesivo apareceu {id, raridade} / foi tocado {id}. */
  toastView: "conquistas2_toast_view",
  toastToque: "conquistas2_toast_toque",
  /** Tela cheia do marco {dias} / compartilhou {dias}. */
  marcoView: "conquistas2_marco_view",
  marcoShare: "conquistas2_marco_share",
  /** Tocou na ação do dia {acao, via}. */
  acaoToque: "conquistas2_acao_toque",
  /** Ligou o lembrete da sequência pela tela nova. */
  lembreteLigar: "conquistas2_lembrete_ligar",
} as const;
