import { describe, it, expect } from "vitest";
import { separarPorMes, mesclarSemDuplicar, chaveArquivada } from "@/lib/virada-do-mes";

/**
 * Os casos aqui são os do defeito real de 01/08 — inclusive o dado exato que
 * eu encontrei na conta do dono (gastos de 2026-05 e 2026-06 dentro do balde
 * que o app lia como agosto).
 */

const AGOSTO = new Date(2026, 7, 2); // 2 de agosto de 2026

describe("separarPorMes", () => {
  it("manda pro mês da própria data, não pro balde onde estava", () => {
    const r = separarPorMes(
      [
        { id: "1", date: "2026-05-01", value: 10 },
        { id: "2", date: "2026-05-08", value: 20 },
        { id: "3", date: "2026-06-10", value: 30 },
        { id: "4", date: "2026-08-01", value: 40 },
      ],
      AGOSTO,
      "expenses",
    );
    expect(r.movidos).toBe(3);
    expect(r.ficam.map((i) => i.id)).toEqual(["4"]);
    expect(r.arquivar["finance-2026-maio-expenses"].map((i) => i.id)).toEqual(["1", "2"]);
    expect(r.arquivar["finance-2026-junho-expenses"].map((i) => i.id)).toEqual(["3"]);
  });

  it("não desloca a data por fuso — 2026-05-01 é MAIO, não abril", () => {
    // `new Date("2026-05-01")` é UTC e no Brasil volta pra 30/04. Se o parse
    // fosse por Date, este lançamento cairia no mês errado exatamente na
    // virada, que é onde tudo isto precisa estar certo.
    const r = separarPorMes([{ id: "x", date: "2026-05-01" }], AGOSTO, "expenses");
    expect(Object.keys(r.arquivar)).toEqual(["finance-2026-maio-expenses"]);
  });

  it("item sem data legível FICA — na dúvida não se mexe no dado de ninguém", () => {
    const r = separarPorMes(
      [{ id: "a" }, { id: "b", date: "" }, { id: "c", date: "sei lá" }],
      AGOSTO,
      "expenses",
    );
    expect(r.movidos).toBe(0);
    expect(r.ficam).toHaveLength(3);
  });

  it("lançamento agendado pro futuro fica no mês corrente", () => {
    const r = separarPorMes([{ id: "f", date: "2026-12-20" }], AGOSTO, "expenses");
    expect(r.movidos).toBe(0);
    expect(r.ficam.map((i) => i.id)).toEqual(["f"]);
  });

  it("atravessa a virada de ano", () => {
    const janeiro = new Date(2027, 0, 3);
    const r = separarPorMes([{ id: "d", date: "2026-12-28" }], janeiro, "incomes");
    expect(r.arquivar["finance-2026-dezembro-incomes"]).toHaveLength(1);
  });

  it("aguenta entrada vazia ou inválida sem estourar", () => {
    expect(separarPorMes([], AGOSTO, "expenses").movidos).toBe(0);
    expect(separarPorMes(null as never, AGOSTO, "expenses").ficam).toEqual([]);
  });
});

describe("mesclarSemDuplicar", () => {
  it("rodar duas vezes é igual a rodar uma (idempotente)", () => {
    const existentes = [{ id: "1" }, { id: "2" }];
    const novos = [{ id: "2" }, { id: "3" }];
    const uma = mesclarSemDuplicar(existentes, novos);
    const duas = mesclarSemDuplicar(uma, novos);
    expect(uma.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(duas).toEqual(uma);
  });

  it("item sem id entra sempre — melhor duplicar que sumir com lançamento", () => {
    const r = mesclarSemDuplicar([{ id: "1" }], [{ value: 9 }]);
    expect(r).toHaveLength(2);
  });
});

describe("chaveArquivada", () => {
  it("normaliza acento igual às chaves que já existem no banco", () => {
    expect(chaveArquivada(2026, 2, "expenses")).toBe("finance-2026-marco-expenses");
    expect(chaveArquivada(2026, 6, "incomes")).toBe("finance-2026-julho-incomes");
  });
});
