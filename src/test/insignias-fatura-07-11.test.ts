/**
 * INSÍGNIAS DE FINANÇAS COM A CONTA ERRADA DEPOIS DA REGRA DA FATURA (bug "insignias-fatura", 07/11).
 *
 * O 0f5b6021 (dois-numeros) trocou o `expenses` de lerFinancasDoMes pela lista que CONTA na fatura, mas
 * insignias.ts `totaisDe` ainda filtrava essa lista pela data do mês. Resultado:
 *  - a TV de 28/10 no crédito (fechamento 25), que a tela conta em novembro, saía do "Sobrou no mês" e do
 *    "Guardei X%" (o card de compartilhar lê o mesmo número);
 *  - o Cinema no crédito em 26/11 (depois do fechamento, fatura de dezembro) sumia dos dias com gasto e o
 *    dia 26 virava "dia sem gastar" — antes do ramo esse dia contava certo.
 *
 * Conserto: o dinheiro segue a fatura (f.expenses; o filtro de data só nos itens que vieram da chave do
 * próprio mês); dias, delivery, contagem e "medido" seguem o que ela LANÇOU (f.lancados).
 *
 * Rodar com: npx vitest run src/test/insignias-fatura-07-11.test.ts
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { medirInsignias } from "@/components/conquistas/insignias";
import { variaveisDoMesLidas } from "@/lib/finance-fatura";

const montar = (dados: Record<string, unknown>) => <T,>(k: string, padrao: T): T => (k in dados ? (dados[k] as T) : padrao);

const pix = (id: string, description: string, date: string, extra: Record<string, unknown> = {}) =>
  ({ id, description, value: 100, date, paymentMethod: "pix", ...extra });

const DADOS = {
  "finance-incomes": [{ id: "r1", description: "Salário", value: 3000, date: "2026-11-05" }],
  "finance-expenses": [
    pix("p1", "Mercado", "2026-11-02"),
    pix("p2", "Padaria", "2026-11-03"),
    pix("p3", "Farmácia", "2026-11-04"),
    pix("p4", "Uber", "2026-11-05"),
    pix("p5", "Feira", "2026-11-06"),
    // crédito depois do fechamento (25): fatura de dezembro — mas ela GASTOU no dia 26
    { id: "c1", description: "Cinema", value: 60, date: "2026-11-26", paymentMethod: "credito", cardName: "nubank" },
  ],
  // TV de 28/10 no crédito: a fatura dela cai em novembro
  "finance-2026-outubro-expenses": [{ id: "tv", description: "TV", value: 1000, date: "2026-10-28", paymentMethod: "credito", cardName: "nubank" }],
  "finance-card-config": { nubank: { closingDay: 25, dueDay: 5 } },
};

describe("insígnias de finanças × tela de Finanças (regra da fatura)", () => {
  const get = montar(DADOS);

  it("'Sobrou no mês' = receitas − saída da tela (a TV de 28/10 é despesa de novembro)", () => {
    const v = variaveisDoMesLidas("2026-11", (k) => get<unknown>(k, undefined), undefined, "2026-11");
    expect(v.total).toBe(1500); // 5 × 100 + TV 1.000 (o Cinema vai pra dezembro)
    const M = medirInsignias(get, "2026-11-28");
    expect(M["fin-sobrou"].valor).toBe(3000 - v.total);
    expect(M["fin-guardei"].valor).toBeCloseTo(50, 5);
  });

  it("o dia 26 (Cinema no crédito, fatura de dezembro) não é 'dia sem gastar'", () => {
    const M = medirInsignias(get, "2026-11-28");
    // dias 2..28 = 27 dias; com gasto: 2, 3, 4, 5, 6 e 26 → 21 sem gasto
    expect(M["fin-sem-gastar"].valor).toBe(21);
  });

  it("delivery no crédito depois do fechamento continua 'sujando' a semana", () => {
    const comDelivery = montar({
      ...DADOS,
      "finance-expenses": [
        ...(DADOS["finance-expenses"] as unknown[]),
        { id: "d1", description: "iFood", value: 40, date: "2026-11-27", category: "delivery", paymentMethod: "credito", cardName: "nubank" },
      ],
    });
    // semanas cheias até 28/11: 1–7, 8–14, 15–21, 22–28 → o iFood de 27/11 suja a última
    expect(medirInsignias(comDelivery, "2026-11-28")["fin-delivery"].valor).toBe(3);
  });

  it("sem cartão com fechamento nada muda: soma crua do mês, gasto do mês passado no balde fica fora", () => {
    const semCartao = montar({
      ...DADOS,
      "finance-card-config": {},
      "finance-2026-outubro-expenses": [],
      // antes da virada o balde ainda tem um gasto de outubro: fora do mês, como sempre
      "finance-expenses": [...(DADOS["finance-expenses"] as unknown[]), pix("o1", "Antigo", "2026-10-30")],
    });
    const M = medirInsignias(semCartao, "2026-11-28");
    expect(M["fin-sobrou"].valor).toBe(3000 - 560);
    expect(M["fin-sem-gastar"].valor).toBe(21);
  });
});
