import type { ReactNode } from "react";
import type { FatoDaCurta, RetroMes } from "@/lib/retrospectiva";

/**
 * O contrato entre o motor da retrospectiva (MonthlyWrapped: páginas,
 * stories, eventos, dados) e cada TEMA (a pele de cada página) — 26/09.
 * O motor decide QUAIS páginas existem e com que dado; o tema só desenha.
 */

/** Barras de progresso + "CORE · RETROSPECTIVA" + chip + X, na cor da página. */
export interface Moldura {
  barraOn: string;
  barraOff: string;
  topo: string;
  /** onde as barras e o topo começam (o planner tem a espiral: 40) */
  esquerda: number;
  chip: { fg: string; bg: string; borda: string };
}

/** Uma página pronta pra montar: fundo sangrado + conteúdo na área segura. */
export interface PaginaPronta {
  /** cor por trás de tudo (sobra de tela e barras do sistema) */
  fundoCor: string;
  /** desenho de fundo sangrado (unidades de desenho, altura = tela cheia) */
  fundo?: ReactNode;
  moldura: Moldura;
  conteudo: ReactNode;
}

export interface Base {
  retro: RetroMes;
  /** nome completo que a pessoa deu (a capa usa até dois nomes) */
  nome: string | null;
  /** ids das páginas desta retrospectiva, na ordem (abas, sumário) */
  paginas: string[];
  /** o mês que começa (foco) */
  proximo: { nome: string; ano: number };
  /** a retrospectiva é do mês que acabou de fechar (o fecho fala do próximo) */
  recente: boolean;
}

export interface PropsDinheiro extends Base { revelado: boolean; onRevelar: () => void }
export interface PropsFoco extends Base {
  opcoes: { texto: string; contexto: string }[];
  escolha: string | null;
  texto: string;
  onEscolha: (t: string) => void;
  onTexto: (t: string) => void;
  onSalvar: () => void;
  salvo: string | null;
  onFechar: () => void;
}
export interface PropsFato extends Base { fato: FatoDaCurta }
export interface PropsFecho extends Base { podeFocar: boolean; onFocar: () => void; onFechar: () => void }

/** As cores da tela do card (os controles abaixo do card). */
export interface PeleDoCard {
  fundoCor: string;
  fundo?: ReactNode;
  moldura: Moldura;
  linha: { bg: string; fg: string; sombra?: string; trilhoOff: string };
  salvar: { bg: string; fg: string; borda: string };
  postar: { bg: string; fg: string };
  proxima: string;
  /** segmentado "Estilo do card" (revista e recortes) */
  seg: { bg: string; fg: string; onBg: string; onFg: string };
}

/** A folha de temas nas cores do tema aberto. */
export interface PeleDaFolha { bg: string; fg: string; acento: string }

export interface Pele {
  capa: (p: Base) => PaginaPronta;
  capaCurta: (p: Base) => PaginaPronta;
  meuMes: (p: Base) => PaginaPronta;
  dinheiro: (p: PropsDinheiro) => PaginaPronta;
  corpo: (p: Base) => PaginaPronta;
  humor: (p: Base) => PaginaPronta;
  foco: (p: PropsFoco) => PaginaPronta;
  fato: (p: PropsFato) => PaginaPronta;
  fecho: (p: PropsFecho) => PaginaPronta;
  card: PeleDoCard;
  folha: PeleDaFolha;
}
