/**
 * OS CARDS DE COMPARTILHAR (29/09) — os tipos. Um card = um assunto com o
 * NÚMERO de verdade da pessoa e a PROVA visual daquele assunto (o
 * calendário dos treinos, a água do saldo subindo, as capas dos livros…).
 * Cada tipo tem os seus dados; a moldura (marca, zona segura, formatos) é
 * a mesma pra todos.
 */

/** Stories/Status 9:16 · feed 4:5 · adesivo (fundo transparente, pra colar em cima da própria foto). */
export type Formato = "stories" | "feed" | "adesivo";

export const FORMATOS: Record<Formato, { w: number; h: number }> = {
  stories: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  adesivo: { w: 1080, h: 1080 },
};

/**
 * Zona segura dos Stories: o Instagram põe a barra do perfil em cima e a
 * caixa de resposta embaixo. Nada importante acima de 250 px nem abaixo de
 * 1650 px (1920 − 270).
 */
export const ZONA_SEGURA = { topo: 250, base: 1650 } as const;

export interface Periodo {
  ano: number;
  mesIdx: number;
}

/** Treinos: os DIAS treinados (a lista `saude-workout-log`, dias distintos). */
export interface DadosTreinos {
  tipo: "treinos";
  /** "mes": o mês (ano/mesIdx) com o calendário · "total": desde o 1º treino, com a faixa de semanas. */
  periodo: "mes" | "total";
  ano: number;
  mesIdx: number;
  /** Dias treinados "AAAA-MM-DD" (no período). */
  dias: string[];
  /** Hoje (o calendário apaga os dias que ainda não chegaram). */
  hoje: string;
  /** Semanas seguidas na meta (agora). */
  semanasNaMeta?: number;
  /** Recordes batidos no período. */
  recordes?: number;
  /** A maior corrida de dias treinados no período (dias seguidos). */
  melhorSequencia?: number;
}

/** Mês no azul: os meses FECHADOS em que sobrou dinheiro, do mais antigo pro mais recente. */
export interface MesNoAzul {
  /** "AAAA-MM" */
  mes: string;
  /** Quanto sobrou, em % do que entrou (0–100). null quando não dá pra medir. */
  pct: number | null;
  /** O saldo em R$ — só aparece com "mostrar valores". */
  saldo?: number;
}

export interface DadosAzul {
  tipo: "azul";
  /** A corrida de meses seguidos no azul (o último é o mês que acabou de fechar). */
  meses: MesNoAzul[];
  valoresLigados: boolean;
}

/** Guardei X% do que ganhei (o mês corrente ou o que fechou). */
export interface DadosPoupanca {
  tipo: "poupanca";
  ano: number;
  mesIdx: number;
  pct: number;
  /** Só com "mostrar valores". */
  valor?: number;
  valoresLigados: boolean;
}

export interface Livro {
  titulo: string;
  autor?: string;
  /** URL da capa (Storage ou importada). Sem capa, o card desenha uma capa tipográfica. */
  capa?: string;
  paginas?: number;
}

export interface DadosLivros {
  tipo: "livros";
  periodo: "mes" | "ano";
  ano: number;
  mesIdx: number;
  livros: Livro[];
  /** Meta de livros do ano (lib-year-goal), quando existe. */
  metaDoAno?: number;
  /** Livros no ano (pro "7 de 12 da meta"). */
  noAno?: number;
}

export interface DadosSequencia {
  tipo: "sequencia";
  dias: number;
  recorde?: number;
  /** Os últimos 28 dias, do mais antigo pro de hoje: true = anotou. */
  ultimos: boolean[];
  /** Marco (7, 30, 100…) quando o card nasce de um. */
  marco?: number;
}

export interface DadosAgua {
  tipo: "agua";
  ano: number;
  mesIdx: number;
  hoje: string;
  /** Fração da meta por dia do mês (0–1+), índice 0 = dia 1. */
  porDia: number[];
}

export interface DadosSono {
  tipo: "sono";
  ano: number;
  mesIdx: number;
  /** Horas por noite (índice 0 = dia 1); null = sem registro. */
  horas: (number | null)[];
  meta: number;
}

export interface DadosHabitos {
  tipo: "habitos";
  ano: number;
  mesIdx: number;
  hoje: string;
  /** O hábito campeão. */
  habito: string;
  dias: string[];
}

export interface DadosMetas {
  tipo: "metas";
  ano: number;
  mesIdx: number;
  feitas: number;
  total: number;
  /** Os textos das metas só entram com a escolha da pessoa (podem ser pessoais). */
  textos?: string[];
  mostrarTextos?: boolean;
}

export type NivelMoeda = "bronze" | "prata" | "ouro" | "platina" | "diamante";

/**
 * A insígnia (moeda do módulo) que EVOLUIU. A imagem da moeda vem da frente
 * das insígnias (`MoedaEstatica` exportada como PNG/SVG); até ela existir o
 * card mostra a VAGA (um disco de metal com o emblema do módulo).
 */
export interface DadosInsignia {
  tipo: "insignia";
  modulo: string;
  moduloNome: string;
  nivel: NivelMoeda;
  de?: NivelMoeda;
  /** "faltam 34 dias anotando" — o que falta pro próximo (opcional). */
  proximo?: string;
  /** "90 dias anotando · 3 meses fechados" — o que ela fez pra chegar. */
  feito?: string;
  /** URL/dataURL da moeda estática (quando a frente das insígnias entregar). */
  imagem?: string;
  cor: string;
}

export interface DadosFigurinha {
  tipo: "figurinha";
  id: string;
  titulo: string;
  descricao: string;
  raridade: "comum" | "raro" | "epico" | "lendario";
  /** "1 de 5 lendárias" */
  colecao?: string;
}

/**
 * O card GERAL (o número de qualquer insígnia que ainda não tem card próprio:
 * sessões de estudo, dias limpos, passeios com o pet…): o número gigante na
 * cor da área, sem a prova visual.
 */
export interface DadosNumero {
  tipo: "numero";
  /** A área ("Estudos") e a cor dela (o fundo sai dela, escurecida até passar no AA). */
  modulo: string;
  cor: string;
  /** "12" · "40%" (nunca R$ sem "mostrar valores" — quem monta garante). */
  numero: string;
  /** "sessões de estudo" */
  rotulo: string;
  /** "em setembro" · "desde que comecei" */
  sub?: string;
  /** "SETEMBRO 2026" */
  periodo: string;
}

/**
 * FINANÇAS SEM "NO AZUL" (23/10, retrospectiva de outubro): quando os gastos
 * do mês não estão completos o bastante pra dizer se sobrou (critério em
 * retro-outubro-dados.ts), o card mostra só o que foi ANOTADO — quantos
 * lançamentos e em quais dias. Nunca "fechou no azul".
 */
export interface DadosLancamentos {
  tipo: "lancamentos";
  ano: number;
  mesIdx: number;
  hoje: string;
  /** Lançamentos com data no mês (entradas + saídas). */
  lancamentos: number;
  /** Os dias com algum lançamento ("AAAA-MM-DD"). */
  dias: string[];
}

/** Um módulo que entrou na retrospectiva (o chip da abertura e o bloco do resumo). */
export type ModuloDaRetro = "financas" | "treino" | "rotina" | "agua" | "leitura" | "metas";

/** A ABERTURA da retrospectiva (23/10): "Seu outubro" + o calendário dos dias com registro acendendo. */
export interface DadosRetroAbertura {
  tipo: "retro-abertura";
  ano: number;
  mesIdx: number;
  hoje: string;
  /** Dias do mês com QUALQUER registro datado ("AAAA-MM-DD"). */
  dias: string[];
  /** Os módulos que têm card, na ordem da sequência. */
  modulos: ModuloDaRetro[];
}

export interface ItemDoResumo {
  modulo: ModuloDaRetro;
  /** "18" · "18%" · "3" */
  numero: string;
  /** "treinos" · "do que entrou, sobrou" */
  rotulo: string;
}

/** O RESUMO da retrospectiva (23/10): um bloco por módulo, cada um na cor do seu card. */
export interface DadosRetroResumo {
  tipo: "retro-resumo";
  ano: number;
  mesIdx: number;
  itens: ItemDoResumo[];
  diasComRegistro: number;
}

export type DadosCard =
  | DadosLancamentos
  | DadosRetroAbertura
  | DadosRetroResumo
  | DadosNumero
  | DadosTreinos
  | DadosAzul
  | DadosPoupanca
  | DadosLivros
  | DadosSequencia
  | DadosAgua
  | DadosSono
  | DadosHabitos
  | DadosMetas
  | DadosInsignia
  | DadosFigurinha;

export type TipoCard = DadosCard["tipo"];
