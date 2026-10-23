import { montarRetroOutubro, type RetroOutubro } from "@/components/compartilhar/retro-outubro-dados";
import { diaDoMes } from "@/components/compartilhar/textos";
import type { Leitor } from "@/lib/retrospectiva";

/**
 * A CONTA DE EXEMPLO da retrospectiva de outubro (23/10) — só no dev, nada de
 * conta real. É um STORE (as mesmas chaves do user_data que o app grava) e a
 * retrospectiva sai da conta DE VERDADE (`montarRetroOutubro`), no dia
 * 01/11/2026 às 10h: o que o /dev/compartilhar mostra e filma é exatamente o
 * que a pessoa veria com esses dados.
 *
 * As capas dos livros são da Open Library (o fetch-book-metadata usa a mesma
 * fonte), que manda CORS — "Tudo é rio" fica sem capa de propósito, pra mostrar
 * a capa tipográfica.
 */

export const AGORA_EXEMPLO = new Date(2026, 10, 1, 10, 0, 0);
const out = (d: number) => diaDoMes(2026, 9, d);
const dias = (ns: number[]) => ns.map(out);

const gasto = (d: number, value: number, category: string, i: number) => ({ id: `g${d}-${i}`, date: out(d), value, category, description: category });

/** Uma pessoa que usou bem o mês (a "conta demo" da retrospectiva). */
export const SEMENTE_COMPLETA: Record<string, unknown> = {
  // Finanças: salário + extra, gastos espalhados até o dia 30 → passa no critério do azul (sobrou 18%)
  "finance-incomes": [
    { id: "r1", date: out(5), value: 3000, category: "salario", description: "Salário" },
    { id: "r2", date: out(20), value: 400, category: "extra", description: "Freela" },
  ],
  "finance-expenses": [
    gasto(1, 180, "mercado", 1), gasto(2, 42, "transporte", 1), gasto(4, 96, "restaurante", 1), gasto(6, 230, "mercado", 2),
    gasto(8, 60, "farmacia", 1), gasto(11, 120, "lazer", 1), gasto(13, 210, "mercado", 3), gasto(15, 38, "transporte", 2),
    gasto(18, 150, "restaurante", 2), gasto(21, 260, "mercado", 4), gasto(24, 90, "lazer", 2), gasto(27, 44, "transporte", 3),
    gasto(30, 148, "mercado", 5),
  ],
  "finance-fixed-expenses": [
    { id: "fx-1690000000000", value: 900, category: "moradia", description: "Aluguel" },
    { id: "fx-1690000000001", value: 120, category: "internet_telefone", description: "Internet" },
  ],
  // os meses anteriores fechados no azul (agosto e setembro) — a corrida vira "3 meses seguidos"
  "finance-2026-agosto-incomes": [{ id: "a1", date: "2026-08-05", value: 3000 }],
  "finance-2026-agosto-expenses": [1, 4, 8, 12, 16, 20, 24, 28].map((d, i) => ({ id: `ag${i}`, date: `2026-08-${String(d).padStart(2, "0")}`, value: 240 })),
  "finance-2026-setembro-incomes": [{ id: "s1", date: "2026-09-05", value: 3200 }],
  "finance-2026-setembro-expenses": [2, 5, 9, 13, 17, 21, 25, 29].map((d, i) => ({ id: `se${i}`, date: `2026-09-${String(d).padStart(2, "0")}`, value: 250 })),
  // Treino: 18 dias
  "saude-workout-log": dias([1, 2, 3, 5, 7, 9, 12, 13, 14, 15, 17, 19, 21, 23, 26, 28, 30, 31]),
  // Rotina: meditar em 24 dias
  "rotina-habit-log": Object.fromEntries(dias([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 27, 29, 31]).map((d) => [d, ["Meditar"]])),
  // Água: meta de 8 copos, 23 dias na meta
  "core-saude-water-goal": 8,
  "water-log": Object.fromEntries(Array.from({ length: 31 }, (_, i) => [out(i + 1), [1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 22, 23, 25, 26, 27, 29, 30].includes(i + 1) ? 8 : 0])),
  // Leitura: 4 livros terminados em outubro (3 com capa de verdade, 1 sem)
  "lib-books": [
    { id: "b1", title: "Dom Casmurro", author: "Machado de Assis", status: "lido", endDate: out(6), pages: 256, cover: "https://covers.openlibrary.org/b/id/15231557-L.jpg" },
    { id: "b2", title: "Torto Arado", author: "Itamar Vieira Junior", status: "lido", endDate: out(14), pages: 264, cover: "https://covers.openlibrary.org/b/id/12369648-L.jpg" },
    { id: "b3", title: "Tudo é rio", author: "Carla Madeira", status: "lido", endDate: out(22), pages: 210, cover: "" },
    { id: "b4", title: "O Pequeno Príncipe", author: "Antoine de Saint-Exupéry", status: "lido", endDate: out(29), pages: 96, cover: "https://covers.openlibrary.org/b/id/15231561-L.jpg" },
    { id: "b5", title: "Sapiens", author: "Yuval Noah Harari", status: "lendo", pages: 464 },
  ],
  "lib-year-goal": 12,
  // Metas do mês: 3 de 4
  "month-goals": { "2026-10": [
    { text: "Correr meus primeiros 5 km", done: true },
    { text: "Ler 3 livros", done: true },
    { text: "Organizar os documentos", done: true },
    { text: "Guardar R$ 500", done: false },
  ] },
};

/** Pouco dado: 2 treinos e uns gastos soltos (sem entrada) → abertura, treino, finanças neutro? não (só 3 lançamentos) → resumo. */
export const SEMENTE_POUCA: Record<string, unknown> = {
  "saude-workout-log": dias([18, 25]),
  "finance-expenses": [gasto(3, 40, "mercado", 1), gasto(18, 22, "transporte", 1), gasto(25, 60, "restaurante", 1)],
};

/** Mês anotado pela metade: entrada e 9 gastos até o dia 15 → Finanças NEUTRO (nunca "no azul"). */
export const SEMENTE_FIN_INCOMPLETA: Record<string, unknown> = {
  "finance-incomes": [{ id: "r1", date: out(5), value: 3000 }],
  "finance-expenses": [1, 2, 4, 6, 8, 10, 12, 14, 15].map((d, i) => gasto(d, 50, "mercado", i)),
};

export const leitorDe = (semente: Record<string, unknown>): Leitor => (k) => semente[k];

export const RETRO_EXEMPLO: RetroOutubro = montarRetroOutubro(leitorDe(SEMENTE_COMPLETA), { agora: AGORA_EXEMPLO })!;
export const RETRO_POUCA: RetroOutubro | null = montarRetroOutubro(leitorDe(SEMENTE_POUCA), { agora: AGORA_EXEMPLO });
export const RETRO_FIN_INCOMPLETA: RetroOutubro | null = montarRetroOutubro(leitorDe(SEMENTE_FIN_INCOMPLETA), { agora: AGORA_EXEMPLO });
