import { describe, it, expect } from "vitest";
import { viradaDeContas, mesCorrenteId, temContas, CHAVE_CONTAS, CHAVE_CARIMBO_CONTAS } from "@/lib/virada-contas";

/**
 * A conta que continuava PAGA no mês seguinte.
 *
 * Rodou meses em produção sem ninguém perceber: `finance-dueDays` é uma chave
 * só, sem mês no nome, e nada zerava o `paid` na virada. Entrou agosto e o
 * app dizia "✓ contas em dia" por causa de julho — com o score de saúde
 * financeira inflado em cima disso. Número errado é pior que número ausente,
 * porque a pessoa decide com ele.
 *
 * Esta lógica roda UMA vez por mês, sozinha, na conta de 966 assinantes: se
 * errar, erra calado e mexe em dado real. Daí os testes cobrirem também os
 * casos chatos (convidado sem contas, dupla execução, arquivo já existente).
 */
const dia = (numero: number, bills: { id: string; name: string; paid: boolean }[]) => ({
  day: numero,
  color: "yellow",
  bills,
});

describe("virada de contas", () => {
  const agosto = new Date(2026, 7, 3); // 3 de agosto de 2026 (mês local, não UTC)

  it("zera o pago quando o mês virou, preservando dia, nome e valor", () => {
    const contas = [dia(5, [{ id: "a", name: "Luz", paid: true }]), dia(10, [{ id: "b", name: "Net", paid: false }])];
    const v = viradaDeContas(contas, "2026-07", agosto);
    expect(v).not.toBeNull();
    expect(v!.zerou).toBe(true);
    expect(v!.zeradas[0].bills[0]).toMatchObject({ id: "a", name: "Luz", paid: false });
    expect(v!.zeradas[0].day).toBe(5);
    expect(v!.zeradas[1].bills[0].paid).toBe(false);
  });

  it("arquiva o retrato do mês que acabou (com os pagamentos preservados)", () => {
    const contas = [dia(5, [{ id: "a", name: "Luz", paid: true }])];
    const v = viradaDeContas(contas, "2026-07", agosto);
    expect(v!.arquivo?.chave).toContain("julho");
    // o arquivo guarda o mês como ELE foi, não zerado — é o histórico
    expect(v!.arquivo?.contas[0].bills[0].paid).toBe(true);
  });

  it("não faz nada duas vezes no mesmo mês (idempotente)", () => {
    const contas = [dia(5, [{ id: "a", name: "Luz", paid: true }])];
    expect(viradaDeContas(contas, mesCorrenteId(agosto), agosto)).toBeNull();
  });

  it("não carimba quem não tem conta nenhuma (caso do convidado)", () => {
    // Um carimbo gravado no estado de convidado migraria pra conta no
    // cadastro e faria o balde real parecer já virado — perdendo a virada.
    expect(viradaDeContas([], "", agosto)).toBeNull();
    expect(viradaDeContas(undefined, "", agosto)).toBeNull();
    expect(viradaDeContas([dia(5, [])], "", agosto)).toBeNull();
  });

  it("na primeira vez (sem carimbo) só carimba, sem inventar arquivo", () => {
    const contas = [dia(5, [{ id: "a", name: "Luz", paid: true }])];
    const v = viradaDeContas(contas, "", agosto);
    expect(v!.carimbo).toBe("2026-08");
    // sem saber de que mês eram os ✓, arquivar seria chutar o histórico
    expect(v!.arquivo).toBeNull();
  });

  it("aguenta dado torto vindo do servidor sem quebrar", () => {
    const torto = [{ day: 5, color: "yellow", bills: null }] as never;
    expect(() => viradaDeContas(torto, "2026-07", agosto)).not.toThrow();
  });

  it("mês corrente usa fuso local (a regra de data do projeto)", () => {
    // 31/12 às 23h local ainda é dezembro — com UTC viraria janeiro do ano
    // seguinte e a virada rodaria um dia antes, zerando o mês vivo.
    expect(mesCorrenteId(new Date(2026, 11, 31, 23, 0))).toBe("2026-12");
    expect(temContas([dia(5, [{ id: "a", name: "Luz", paid: false }])])).toBe(true);
  });

  it("as chaves são as combinadas (renomear quebra 966 assinantes)", () => {
    expect(CHAVE_CONTAS).toBe("finance-dueDays");
    expect(CHAVE_CARIMBO_CONTAS).toBe("finance-dueDays-mes");
  });
});
