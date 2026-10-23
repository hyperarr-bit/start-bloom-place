import type { DadosAgua, DadosAzul, DadosFigurinha, DadosHabitos, DadosInsignia, DadosLivros, DadosMetas, DadosPoupanca, DadosSequencia, DadosSono, DadosTreinos } from "@/components/compartilhar/tipos";
import { diaDoMes } from "@/components/compartilhar/textos";

/**
 * Os DADOS DE EXEMPLO do /dev/compartilhar (29/09) — nada de conta real. Hoje
 * = 29/09/2026. Os dois cards do dono ("35 treinos", "1 mês no azul") com os
 * números do print dele; o resto com números de uma pessoa que usa bem.
 */

export const HOJE_EXEMPLO = "2026-09-29";
const set = (d: number) => diaDoMes(2026, 8, d);

/** 18 treinos em setembro (seg/ter/qui + sábados), melhor trecho: 21→24. */
export const TREINOS_MES: DadosTreinos = {
  tipo: "treinos",
  periodo: "mes",
  ano: 2026,
  mesIdx: 8,
  hoje: HOJE_EXEMPLO,
  dias: [1, 3, 5, 7, 8, 10, 11, 14, 15, 17, 19, 21, 22, 23, 24, 26, 28, 29].map(set),
  semanasNaMeta: 4,
  recordes: 2,
};

/** O card do dono: 35 treinos DESDE MARÇO (o "35 TREINOS" do print era o total, não setembro). */
const treinosDesdeMarco = (): string[] => {
  const out: string[] = [];
  // março–junho devagar, julho–setembro no embalo
  const porMes: [number, number[]][] = [
    [2, [16, 19, 24]], [3, [2, 9, 14, 28]], [4, [5, 12, 26]], [5, [9, 23]],
    [6, [6, 8, 13, 20, 27]], [7, [3, 10, 12, 17, 24, 31]], [8, [1, 3, 8, 10, 15, 17, 22, 24, 26, 29, 12, 5]],
  ];
  for (const [m, dias] of porMes) for (const d of dias) out.push(diaDoMes(2026, m, d));
  return [...new Set(out)].sort();
};
export const TREINOS_TOTAL: DadosTreinos = {
  tipo: "treinos",
  periodo: "total",
  ano: 2026,
  mesIdx: 8,
  hoje: HOJE_EXEMPLO,
  dias: treinosDesdeMarco(),
  semanasNaMeta: 3,
  recordes: 4,
};

/** O card do dono: agosto fechou no azul (o 1º), sobrou 18% do que entrou. */
export const AZUL_1: DadosAzul = { tipo: "azul", meses: [{ mes: "2026-08", pct: 18, saldo: 612 }], valoresLigados: false };
export const AZUL_3: DadosAzul = { tipo: "azul", meses: [{ mes: "2026-06", pct: 9, saldo: 280 }, { mes: "2026-07", pct: 14, saldo: 450 }, { mes: "2026-08", pct: 18, saldo: 612 }], valoresLigados: false };

export const POUPANCA: DadosPoupanca = { tipo: "poupanca", ano: 2026, mesIdx: 8, pct: 23, valor: 780, valoresLigados: false };

export const LIVROS_MES: DadosLivros = {
  tipo: "livros",
  periodo: "mes",
  ano: 2026,
  mesIdx: 8,
  livros: [
    { titulo: "Tudo é rio", autor: "Carla Madeira", paginas: 210 },
    { titulo: "Hábitos atômicos", autor: "James Clear", paginas: 320 },
    { titulo: "Torto arado", autor: "Itamar Vieira Junior", paginas: 264 },
  ],
  metaDoAno: 24,
  noAno: 17,
};

/** O leque cheio (5 capas) com título comprido e palavra longa — pra conferir que nada some embaixo da vizinha. */
export const LIVROS_5: DadosLivros = {
  tipo: "livros",
  periodo: "mes",
  ano: 2026,
  mesIdx: 8,
  livros: [
    { titulo: "Essencialismo", autor: "Greg McKeown", paginas: 272 },
    { titulo: "A psicologia financeira", autor: "Morgan Housel", paginas: 304 },
    { titulo: "Pai rico, pai pobre", autor: "Robert Kiyosaki", paginas: 336 },
    { titulo: "O poder do hábito", autor: "Charles Duhigg", paginas: 408 },
    { titulo: "Mindset", autor: "Carol S. Dweck", paginas: 312 },
  ],
};

export const SEQUENCIA: DadosSequencia = {
  tipo: "sequencia",
  dias: 30,
  recorde: 30,
  marco: 30,
  ultimos: Array.from({ length: 28 }, () => true),
};

export const AGUA: DadosAgua = {
  tipo: "agua",
  ano: 2026,
  mesIdx: 8,
  hoje: HOJE_EXEMPLO,
  porDia: Array.from({ length: 29 }, (_, i) => (i % 7 === 5 ? 0.6 : i % 9 === 3 ? 0.85 : 1 + (i % 3) * 0.05)),
};

export const SONO: DadosSono = {
  tipo: "sono",
  ano: 2026,
  mesIdx: 8,
  meta: 8,
  horas: Array.from({ length: 29 }, (_, i) => (i % 6 === 4 ? 6.5 : i % 5 === 2 ? 7.2 : 8 + (i % 3) * 0.25)),
};

export const HABITOS: DadosHabitos = {
  tipo: "habitos",
  ano: 2026,
  mesIdx: 8,
  hoje: HOJE_EXEMPLO,
  habito: "Meditar",
  dias: Array.from({ length: 29 }, (_, i) => i + 1).filter((d) => d % 6 !== 0 && d !== 13).map(set),
};

export const METAS: DadosMetas = { tipo: "metas", ano: 2026, mesIdx: 8, feitas: 4, total: 5, textos: ["Guardar 10% do salário", "Ler 2 livros", "Treinar 3x por semana", "Marcar o dentista", "Aprender a nadar"] };

export const INSIGNIA_OURO: DadosInsignia = {
  tipo: "insignia",
  modulo: "financas",
  moduloNome: "Finanças",
  nivel: "ouro",
  de: "prata",
  feito: "90 dias anotando · 3 meses fechados",
  proximo: "Platina: faltam 34 dias anotando",
  cor: "#047857",
};

export const FIGURINHA_LENDARIA: DadosFigurinha = {
  tipo: "figurinha",
  id: "sequencia-100",
  titulo: "Centenário",
  descricao: "100 dias seguidos anotando",
  raridade: "lendario",
  colecao: "1 de 7 lendárias",
};
