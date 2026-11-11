/**
 * Parcela com data futura (07/11, ver mesDeInicio em lib/finance-parcelas): cada parcela conta só no mês em que vence,
 * nenhuma vira quitada sem pagar, e registro que já andou continua como estava.
 */
import { describe, it, expect } from "vitest";
import {
  avancarPara, carimbar, mesDeInicio, parcelaAtiva, parcelaQuitada, parcelasComoGastos, projetarParcelas, somaParcelasDoMes,
  viradaDeParcelas, type Parcela,
} from "@/lib/finance-parcelas";

const nova = (id: string, valor: number, total: number, date: string, mes = "2026-11", extra: Partial<Parcela> = {}): Parcela =>
  carimbar({ id, description: id, totalValue: valor * total, installmentValue: valor, paidInstallments: 0, totalInstallments: total, cardName: "x", category: "outros", date, ...extra }, mes);

/** Mês a mês como o app roda: virada no balde e soma do que sobrou. */
const percorrer = (inicio: Parcela[], meses: string[]) => {
  let b = inicio;
  return meses.map((m) => { b = viradaDeParcelas(b, m, [])?.lista ?? b; return [m, somaParcelasDoMes(b)]; });
};

describe("mesDeInicio", () => {
  it("só vale pra 1ª parcela com data depois do mês do registro", () => {
    expect(mesDeInicio(nova("a", 10, 1, "2026-12-10"))).toBe("2026-12");
    expect(mesDeInicio(nova("a", 10, 1, "2026-11-30"))).toBeNull();
    expect(mesDeInicio(nova("a", 10, 1, "2026-08-01"))).toBeNull();
    expect(mesDeInicio(nova("a", 10, 1, ""))).toBeNull();
    expect(mesDeInicio(nova("a", 10, 1, "lixo"))).toBeNull();
    expect(mesDeInicio(nova("a", 10, 6, "2026-12-10", "2026-11", { paidInstallments: 2 }))).toBeNull(); // já paguei 2
    expect(mesDeInicio({ ...nova("a", 10, 1, "2026-12-10"), levada: true })).toBeNull(); // retrato é história
    expect(mesDeInicio({ ...nova("a", 10, 1, "2026-12-10"), startMonth: undefined })).toBeNull(); // legado sem carimbo
  });
});

describe("cada parcela no mês dela", () => {
  it("o caso do chamado: 1 de 1 em dez, jan e jun não somam em novembro e contam no vencimento", () => {
    const balde = [nova("dez", 100, 1, "2026-12-10"), nova("jan", 200, 1, "2027-01-10"), nova("jun", 400, 1, "2027-06-10")];
    expect(somaParcelasDoMes(balde)).toBe(0);
    expect(percorrer(balde, ["2026-12", "2027-01", "2027-02", "2027-06", "2027-07"])).toEqual([
      ["2026-12", 100], ["2027-01", 200], ["2027-02", 0], ["2027-06", 400], ["2027-07", 0],
    ]);
  });

  it("3x com a 1ª em janeiro: jan, fev e mar, e quita depois", () => {
    const fim = percorrer([nova("3x", 100, 3, "2027-01-10")], ["2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]);
    expect(fim).toEqual([["2026-12", 0], ["2027-01", 100], ["2027-02", 100], ["2027-03", 100], ["2027-04", 0]]);
  });

  it("não vira quitada antes de vencer e a dívida segue contada", () => {
    const v = viradaDeParcelas([nova("jun", 400, 1, "2027-06-10"), nova("dez", 100, 1, "2026-12-10")], "2026-12", [])!;
    const jun = v.lista.find((p) => p.id === "jun")!;
    expect(parcelaQuitada(jun)).toBe(false);
    expect(jun.startMonth).toBe("2026-11"); // nada é reescrito antes do mês dele
    expect(parcelaAtiva(jun)).toBe(false);
  });

  it("virada sem nada pra fazer devolve null, como toda abertura normal", () => {
    expect(viradaDeParcelas([nova("jun", 400, 1, "2027-06-10")], "2026-11", [])).toBeNull();
    expect(viradaDeParcelas([nova("jun", 400, 1, "2027-06-10")], "2026-12", [])).toBeNull();
  });

  it("rodar a virada duas vezes dá no mesmo", () => {
    const v = viradaDeParcelas([nova("dez", 100, 1, "2026-12-10")], "2026-12", [])!;
    expect(viradaDeParcelas(v.lista, "2026-12", [])).toBeNull();
  });

  it("ficou meses sem abrir: cada mês pulado ganha o retrato certo e o balde chega no ponto", () => {
    const v = viradaDeParcelas([nova("3x", 100, 3, "2026-12-10")], "2027-02", [])!;
    expect(v.lista[0]).toMatchObject({ startMonth: "2027-02", parcelaDoMes: 3, paidInstallments: 2 });
    expect(Object.keys(v.arquivos).sort()).toEqual(["2026-12", "2027-01"]);
    expect(somaParcelasDoMes(v.arquivos["2026-12"])).toBe(100);
    expect(v.arquivos["2026-12"][0]).toMatchObject({ startMonth: "2026-12", parcelaDoMes: 1, levada: true });
    expect(somaParcelasDoMes(v.arquivos["2027-01"])).toBe(100);
  });

  it("ficou sem abrir e a 1 de 1 venceu no meio: quita, com o retrato no mês em que venceu", () => {
    const v = viradaDeParcelas([nova("dez", 100, 1, "2026-12-10")], "2027-02", [])!;
    expect(parcelaQuitada(v.lista[0])).toBe(true);
    expect(somaParcelasDoMes(v.arquivos["2026-12"])).toBe(100);
    expect(v.arquivos["2027-01"]).toBeUndefined();
  });

  it("planilhas futuras enxergam só o mês certo", () => {
    const b = [nova("3x", 100, 3, "2027-01-10")];
    const proj = (m: string) => projetarParcelas([{ mes: "2026-11", itens: b }], m, []);
    expect(proj("2026-12")).toEqual([]);
    expect(proj("2027-01")[0]).toMatchObject({ parcelaDoMes: 1, startMonth: "2027-01" });
    expect(proj("2027-03")[0]).toMatchObject({ parcelaDoMes: 3 });
    expect(proj("2027-04")).toEqual([]);
  });

  it("cadastrada numa planilha passada: vem pro balde sem contar, sai da chave e conta no mês dela, uma vez só", () => {
    const fonte = { mes: "2026-10", itens: [nova("x", 50, 2, "2026-12-10", "2026-10")] };
    const v = viradaDeParcelas([], "2026-11", [fonte])!;
    expect(v.lista.map((p) => p.id)).toEqual(["x"]);
    expect(somaParcelasDoMes(v.lista)).toBe(0);
    expect(v.fontesAtualizadas["2026-10"]).toEqual([]);
    expect(viradaDeParcelas(v.lista, "2026-11", [{ mes: "2026-10", itens: [] }])).toBeNull();
    const dez = viradaDeParcelas(v.lista, "2026-12", [{ mes: "2026-10", itens: [] }])!;
    expect(dez.lista[0]).toMatchObject({ startMonth: "2026-12", parcelaDoMes: 1 });
    expect(somaParcelasDoMes(dez.lista)).toBe(50);
  });

  it("planejada na planilha de dezembro pra fevereiro: em dezembro segue na lista sem contar, nada some", () => {
    const fonte = { mes: "2026-12", itens: [nova("p", 80, 3, "2027-02-10", "2026-12")] };
    const v = viradaDeParcelas([], "2026-12", [fonte])!;
    expect(v.lista.map((p) => p.id)).toEqual(["p"]);
    expect(somaParcelasDoMes(v.lista)).toBe(0);
    expect(v.fontesAtualizadas["2026-12"]).toEqual([]);
    expect(percorrer(v.lista, ["2027-01", "2027-02", "2027-03", "2027-04", "2027-05"])).toEqual([
      ["2027-01", 0], ["2027-02", 80], ["2027-03", 80], ["2027-04", 80], ["2027-05", 0],
    ]);
  });

  it("marcada como paga antes de vencer: continua contando só no mês dela e fica paga", () => {
    const p = { ...nova("a", 100, 1, "2026-12-10"), paidInstallments: 1, parcelaDoMes: 1 };
    expect(somaParcelasDoMes([p])).toBe(0);
    const v = viradaDeParcelas([p], "2026-12", [])!;
    expect(somaParcelasDoMes(v.lista)).toBe(100);
    expect(v.lista[0].paidInstallments).toBe(1);
  });

  it("não entra no limite da categoria antes de começar", () => {
    expect(parcelasComoGastos([nova("a", 100, 1, "2026-12-10")])).toEqual([]);
  });
});

describe("o que já andou não muda", () => {
  it("parcela em andamento com data de hoje e 'Já paguei' segue igual", () => {
    const p = nova("a", 100, 12, "2026-11-07", "2026-11", { paidInstallments: 3 });
    expect(somaParcelasDoMes([p])).toBe(100);
    expect(avancarPara(p, "2026-11", "2026-12")).toMatchObject({ parcelaDoMes: 5 });
  });

  it("registro que a virada antiga já avançou fica como está", () => {
    const p = { ...nova("a", 100, 6, "2026-12-10"), startMonth: "2026-12", parcelaDoMes: 2, paidInstallments: 1 };
    expect(somaParcelasDoMes([p])).toBe(100);
    expect(viradaDeParcelas([p], "2026-12", [])).toBeNull();
  });

  it("retrato de mês passado continua somando o que somava", () => {
    expect(somaParcelasDoMes([{ ...nova("a", 100, 6, "2026-12-10"), levada: true }])).toBe(100);
  });
});
