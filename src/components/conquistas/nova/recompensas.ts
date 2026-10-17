import type { Badge } from "@/components/gamification/types";
import { raridadeDe } from "@/components/gamification/types";
import { MARCOS_SEQUENCIA } from "@/lib/sequencia";
import { ADESIVOS_SEQUENCIA_NOVOS, MARCOS_ADESIVO, MARCOS_NOVOS } from "@/lib/conquistas-registro";

/**
 * CONQUISTAS 2 (16/10): só SEQUÊNCIA + ÁLBUM. A mecânica PURA (sem React, sem
 * storage). As decisões, com o dado que as sustenta (scratchpad definitiva/5-produto.md):
 *
 *  - No teste, quem usa em 3 DIAS DIFERENTES paga 38% (× 15%) → adesivos novos
 *    da sequência em 2 e 3 dias ("Voltei" e "3 Dias Seguidos"; lib/conquistas-registro)
 *    e "AMANHÃ VOCÊ GANHA…" sempre visível (o prêmio do dia seguinte é o motivo de voltar).
 *  - Quem abre o álbum no teste paga 53% (× 31%) → o álbum é o herói da tela
 *    (capa grande, abrir, páginas por módulo com vaga vazia, figurinha nova
 *    esperando pra ser COLADA).
 *  - A festa em tela cheia (617 pessoas, 1.939 vezes, 1 compartilhamento) é
 *    interrupção → comum e raro viram um AVISO PEQUENO (toast, toque abre o álbum
 *    na página); tela cheia só nos marcos (7/30/100) e nos épicos/lendários.
 *    Compartilhar só nos marcos.
 */

export { ADESIVOS_SEQUENCIA_NOVOS, MARCOS_ADESIVO, MARCOS_NOVOS };
export type MarcoAdesivo = (typeof MARCOS_ADESIVO)[number];

export const idDoMarco = (n: number) => `sequencia-${n}`;

/** O marco de um adesivo da sequência (`sequencia-14` → 14), ou null. */
export const marcoDoAdesivo = (id: string): number | null => {
  const m = /^sequencia-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
};

/** É um dos 3 adesivos novos da sequência (2/3/14)? */
export const ehAdesivoNovoDaSequencia = (id: string): boolean => {
  const m = marcoDoAdesivo(id);
  return m !== null && (MARCOS_NOVOS as readonly number[]).includes(m);
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

/** Compartilhar só nos marcos (7/30/100 dias) — nunca num adesivo comum, raro, épico ou lendário avulso. */
export const podeCompartilhar = (b: Pick<Badge, "id">): boolean => ehMarcoDeFesta(b.id);

/**
 * Os 3 adesivos novos abrem pelo RECORDE (quem já teve 14 dias ganha "Duas
 * Semanas" na 1ª abertura). A festa/toast é só de quem BATEU o marco hoje:
 * dias seguidos = o marco e hoje já anotado. O resto cola em silêncio.
 */
export const festaDoMarcoNovo = (id: string, seq: { dias: number; hojeFeito: boolean }): boolean => {
  const m = marcoDoAdesivo(id);
  if (m === null || !(MARCOS_NOVOS as readonly number[]).includes(m)) return true;
  return seq.hojeFeito && seq.dias === m;
};

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
  /** A instrução, clara: "anote algo em qualquer módulo nos próximos 2 dias". */
  instrucao: string;
}

const DIAS_POR_PROTETOR = 7;

/** A frase de como ganhar — sem "2 dias de anotação" (16/10: o dono achou confuso). */
export const instrucaoDoPremio = (quando: ProximoPremio["quando"], faltam: number): string =>
  quando === "hoje" ? "anote algo em qualquer módulo hoje e ele cola sozinho"
    : quando === "amanha" ? "anote algo em qualquer módulo hoje e amanhã"
    : `anote algo em qualquer módulo nos próximos ${faltam} dias`;

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
  return { adesivo, marco, quando, faltam, daProtetor: marco % DIAS_POR_PROTETOR === 0, titulo, instrucao: instrucaoDoPremio(quando, faltam) };
}

/** "HOJE" · "AMANHÃ" · "EM 2 DIAS" — a pílula da trilha e da vaga do álbum. */
export const quandoCurto = (p: Pick<ProximoPremio, "quando" | "faltam">): string =>
  p.quando === "hoje" ? "HOJE" : p.quando === "amanha" ? "AMANHÃ" : `EM ${p.faltam} DIAS`;

/**
 * O prêmio citado no LEMBRETE das 20h (opt-in, id de notificação de sempre):
 * pro aviso do dia `i` (0 = hoje), a sequência que a pessoa teria anotando
 * naquele dia é `seguidosSe`; se isso cola um adesivo, "e cola o 'Voltei'";
 * se o dia SEGUINTE cola, "e amanhã cola o 'Duas Semanas'". Senão, null.
 */
export function premioDoLembrete(seguidosSe: number, adesivos: Badge[]): string | null {
  const colados = new Set(adesivos.filter((b) => b.unlocked).map((b) => b.id));
  const nome = (m: number): string | null => {
    if (!(MARCOS_ADESIVO as readonly number[]).includes(m) || colados.has(idDoMarco(m))) return null;
    return adesivos.find((b) => b.id === idDoMarco(m))?.name ?? null;
  };
  const hoje = nome(seguidosSe);
  if (hoje) return `Anota e cola o adesivo "${hoje}".`;
  const amanha = nome(seguidosSe + 1);
  if (amanha) return `Anota hoje — e amanhã cola o "${amanha}".`;
  return null;
}

/* ------------------------------------------------------------------------- *
 * Coleções por módulo ("faltam 2 pra completar a página")
 * ------------------------------------------------------------------------- */

/** "faltam 2 pra fechar" quando perto; "6 de 24" quando longe; "completa" quando fechou. */
export const fraseDaColecao = (abertos: number, total: number): string => {
  const faltam = total - abertos;
  if (total === 0) return "";
  if (faltam <= 0) return "coleção completa";
  if (faltam <= 3) return `faltam ${faltam} pra fechar`;
  return `${abertos} de ${total}`;
};

/** "faltam 2 pra completar a página" · "página completa" — o rodapé de cada página do álbum. */
export const fraseDaPagina = (abertos: number, total: number): string => {
  const faltam = total - abertos;
  if (faltam <= 0) return "Página completa — todas coladas.";
  return `${faltam === 1 ? "Falta 1 figurinha" : `Faltam ${faltam} figurinhas`} pra completar a página`;
};

/* ------------------------------------------------------------------------- *
 * Medição — tudo com o prefixo `conquistas2_`
 * ------------------------------------------------------------------------- */

export const EVENTOS2 = {
  /** Abriu a tela {origem, dias, teste_dia}. */
  abrir: "conquistas2_open",
  /** Saiu da tela {ms} — hoje a visita dura ~8 s; a meta é passar de 15. */
  tempo: "conquistas2_tempo",
  /** Abriu o álbum {origem: capa|pacotinho|toast|missao|vaga|colecao}. */
  albumAbrir: "conquistas2_album_abrir",
  /** Colou uma figurinha nova no álbum {id, raridade, restantes}. */
  figurinhaColar: "conquistas2_figurinha_colar",
  /** O "amanhã você ganha" apareceu {marco, quando}. */
  amanhaVisto: "conquistas2_amanha_visto",
  /** Tocou num adesivo fora do álbum {id, aberto, colecao}. */
  adesivoToque: "conquistas2_adesivo_toque",
  /** Abriu a coleção inteira (ver todos) {colecao|"todas"}. */
  colecaoAbrir: "conquistas2_colecao_abrir",
  /** Abriu o detalhe da sequência {dias}. */
  sequenciaAbrir: "conquistas2_sequencia_abrir",
  /** Toast de adesivo apareceu {id, raridade, quantidade, suave} / foi tocado {id}. */
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
