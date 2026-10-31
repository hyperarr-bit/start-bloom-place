/**
 * O NÚMERO DA DEMO DA LANDING v2 (30/10, dono testando no iPhone): a página promete "Quanto posso gastar hoje · R$ 146"
 * (o print do painel de Finanças) e a demo aberta, perto do fim do mês, mostrava "R$ 1.241 por dia · 2 dias até o fim do
 * mês". O motivo: as sementes de Finanças têm SEMPRE os mesmos R$ 464 de gastos do mês (dias 2–6), com a renda de R$ 6.200 —
 * o saldo de R$ 2.482 dividido pelos dias que faltam dá R$ 146 só no dia 14/15 e explode no fim do mês.
 *
 * Aqui (SÓ quando a landing v2 abre a demo, /organizar/demo?…&lp=v2 — o braço atual, o /preview, o /experimente e o /liberar
 * seguem com as sementes de sempre) os gastos do mês acompanham o dia: o que já saiu é o que alguém que gasta no ritmo
 * normal teria gastado até ONTEM (nada com a data de hoje — sem a linha "sobram R$ X pra hoje"), e o "quanto posso gastar
 * hoje" fecha em R$ 146 em QUALQUER dia do mês, pela MESMA conta do app (computeDailyBudget).
 *   · do dia ~13 em diante: só os gastos mudam (renda 6.200; no dia 14 de um mês de 30 dias dá os R$ 464 do print);
 *   · no começo do mês a renda de 6.200 não cobre R$ 146 × 31 dias (sobram R$ 2.946 depois dos fixos e da parcela): entra
 *     uma 2ª receita, "Freela", redonda (múltipla de 50; no dia 1, o que falta exato), e os gastos andam ~R$ 45/dia.
 * Os limites de 3 categorias sobem um pouco (no fim do mês o ritmo passa dos de sempre e os cards ficariam vermelhos).
 */
import { somaParcelasDoMes, type Parcela } from "@/lib/finance-parcelas";

export const POR_DIA_DA_LANDING = 146;

type Lanc = [dia: number, valor: number, categoria: string, descricao: string, pagamento: string, cartao?: string];
/* O mês "normal" desta pessoa (~R$ 2.300 de variáveis), dia a dia. Crédito só até o dia 20 (o fechamento do Nubank da semente:
 * crédito depois do fechamento iria pra fatura do mês seguinte e sairia da conta deste mês). */
const MES: Lanc[] = [
  [1, 36, "alimentacao", "Padaria", "pix"],
  [2, 520, "alimentacao", "Mercado", "pix"],
  [3, 42, "delivery", "iFood", "credito", "nubank"],
  [4, 38, "transporte", "Uber", "pix"],
  [5, 28, "farmacia", "Farmácia", "pix"],
  [5, 89, "restaurante", "Almoço de domingo", "credito", "nubank"],
  [6, 32, "alimentacao", "Padaria", "pix"],
  [8, 34, "transporte", "Uber", "pix"],
  [9, 62, "lazer", "Cinema", "pix"],
  [11, 56, "delivery", "iFood", "credito", "nubank"],
  [12, 74, "alimentacao", "Feira", "pix"],
  [14, 138, "restaurante", "Jantar fora", "credito", "nubank"],
  [16, 210, "alimentacao", "Mercado", "pix"],
  [17, 46, "farmacia", "Farmácia", "pix"],
  [19, 120, "presente", "Presente de aniversário", "pix"],
  [21, 41, "transporte", "Uber", "pix"],
  [22, 220, "vestuario", "Tênis", "debito", "inter"],
  [24, 36, "alimentacao", "Padaria", "pix"],
  [25, 95, "pets", "Petshop", "pix"],
  [27, 190, "alimentacao", "Mercado", "pix"],
  [28, 38, "delivery", "Lanche", "pix"],
  [29, 150, "lazer", "Show", "pix"],
];

const soma = (xs: unknown, campo: string): number =>
  (Array.isArray(xs) ? xs : []).reduce((s: number, x: any) => s + (typeof x?.[campo] === "number" ? x[campo] : 0), 0);

/** Gasto por dia até ontem quando entra o freela (começo do mês). r2 da tela cheia: 25 → 45 (com 25 os primeiros dias tinham 1
 *  lançamento só; ~R$ 45/dia ainda é metade do ritmo do mês normal, ~R$ 74). */
const RITMO_COM_FREELA = 45;

/** Os números do mês pra um dia (exportado pros testes). */
export function contaDoDia(livre: number, dia: number, diasNoMes: number): { gastos: number; freela: number } {
  const resto = diasNoMes - dia + 1; // os dias que faltam CONTANDO HOJE (a mesma régua do computeDailyBudget)
  const precisa = POR_DIA_DA_LANDING * resto;
  const gastos = livre - precisa;
  if (gastos >= 25 * (dia - 1)) return { gastos, freela: 0 }; // r2: era 12 — no dia 13 sobravam R$ 172 pra 12 dias (2 lançamentos)
  // começo do mês: a renda não cobre — entra o freela (redondo), com gastos de ~R$ 45/dia até ontem
  const freela = dia === 1 ? precisa - livre : Math.ceil((precisa + RITMO_COM_FREELA * (dia - 1) - livre) / 50) * 50;
  return { gastos: livre + freela - precisa, freela };
}

/** Cada lançamento fica com pelo menos 60% do valor do mês normal (crítica r2 da tela cheia, persona 7: no começo do mês a escala
 *  proporcional dava "Uber −R$ 6", "iFood −R$ 7" — ninguém acredita). */
export const PISO_DO_LANCAMENTO = 0.6;
/** O maior lançamento do período (o Mercado) absorve o resto; abaixo disto, saem lançamentos pequenos pra ele não ficar ridículo. */
const PISO_DO_MAIOR = 60;

/** Os lançamentos até ONTEM somando EXATAMENTE `gastos` (exportado pros testes).
 *  · gastos ≥ 60% do mês normal até ontem: todos, na proporção do mês normal (como antes);
 *  · abaixo disso (começo do mês, ou o dia 13 sem freela): os outros ficam em 60% do normal e o maior absorve o resto; se o
 *    resto não chega a R$ 60, saem os lançamentos menores (os que alguém nem anotaria) — menos lançamentos, nunca "R$ 6". */
export function lancamentosAteOntem(dia: number, gastos: number): Lanc[] {
  const ate = MES.filter(([d]) => d < dia);
  if (!ate.length) return [];
  const base = ate.reduce((s, l) => s + l[1], 0);
  const maior = ate.reduce((m, l, i) => (l[1] > ate[m][1] ? i : m), 0);
  let valores: Array<number | null>;
  if (gastos >= PISO_DO_LANCAMENTO * base) {
    valores = ate.map((l) => Math.max(1, Math.round((l[1] * gastos) / base)));
  } else {
    valores = ate.map((l) => Math.round(l[1] * PISO_DO_LANCAMENTO));
    const ordem = ate.map((_, i) => i).filter((i) => i !== maior).sort((x, y) => ate[x][1] - ate[y][1] || y - x); // menores 1º
    const resto = () => gastos - valores.reduce((s: number, v, i) => s + (i === maior || v === null ? 0 : v), 0);
    for (const i of ordem) { if (resto() >= PISO_DO_MAIOR) break; valores[i] = null; }
  }
  const outros = valores.reduce((s: number, v, i) => s + (i === maior || v === null ? 0 : v), 0);
  valores[maior] = gastos - outros;
  return ate.flatMap((l, i) => (valores[i] === null ? [] : [[l[0], valores[i]!, ...l.slice(2)] as Lanc]));
}

/** As sementes de Finanças com os gastos (e, no começo do mês, o freela) do dia de hoje. Sem Finanças nas sementes: igual. */
export function financasNoNumeroDaLanding(sementes: Record<string, any>, agora: Date = new Date()): Record<string, any> {
  if (!Array.isArray(sementes["finance-incomes"]) || !Array.isArray(sementes["finance-fixed-expenses"])) return sementes;
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const dia = agora.getDate();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const data = (n: number) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;

  const renda = soma(sementes["finance-incomes"], "value");
  const livre = renda - soma(sementes["finance-fixed-expenses"], "value") - somaParcelasDoMes(sementes["finance-installments"] as Parcela[]);
  const { gastos, freela } = contaDoDia(livre, dia, diasNoMes);

  const lancamentos = lancamentosAteOntem(dia, gastos).map(([d, valor, category, description, paymentMethod, cardName], i) => ({
    id: `lp-e${i + 1}`, date: data(d), value: valor, category, description, paymentMethod, ...(cardName ? { cardName } : {}),
  }));

  const limites = { ...(sementes["finance-category-budgets"] ?? {}) };
  for (const [k, v] of Object.entries({ alimentacao: 1400, restaurante: 320, lazer: 300 })) limites[k] = Math.max(Number(limites[k]) || 0, v);

  return {
    ...sementes,
    "finance-incomes": freela > 0
      ? [...sementes["finance-incomes"], { id: "i-lp-freela", date: data(1), value: freela, description: "Freela" }]
      : sementes["finance-incomes"],
    "finance-expenses": lancamentos,
    "finance-category-budgets": limites,
  };
}
