import { describe, expect, it } from "vitest";
import { calcularMapa, contarSabados, dataDeInput, idadeEm } from "./calculo";

describe("mapa dos sábados", () => {
  it("calcula a idade antes e depois do aniversário", () => {
    const nascimento = new Date(1996, 9, 20);
    expect(idadeEm(nascimento, new Date(2026, 9, 18))).toBe(29);
    expect(idadeEm(nascimento, new Date(2026, 9, 20))).toBe(30);
  });

  it("usa a próxima década estritamente futura", () => {
    const antesDos30 = calcularMapa(new Date(1996, 9, 20), new Date(2026, 9, 18));
    expect(antesDos30.marco).toBe(30);
    expect(antesDos30.dataMarco).toEqual(new Date(2026, 9, 20));
    expect(antesDos30.dias).toBe(2);

    const aos30 = calcularMapa(new Date(1996, 9, 18), new Date(2026, 9, 18));
    expect(aos30.marco).toBe(40);
    expect(aos30.dataMarco).toEqual(new Date(2036, 9, 18));
  });

  it("conta sábados a partir de hoje e antes da data marco", () => {
    expect(contarSabados(new Date(2026, 9, 18), new Date(2026, 9, 26))).toBe(1);
    expect(contarSabados(new Date(2026, 9, 24), new Date(2026, 9, 25))).toBe(1);
    expect(contarSabados(new Date(2026, 9, 25), new Date(2026, 9, 25))).toBe(0);
  });

  it("rejeita datas impossíveis e idades fora do público adulto", () => {
    expect(dataDeInput("2026-02-31")).toBeNull();
    expect(() => calcularMapa(new Date(2010, 0, 1), new Date(2026, 0, 1))).toThrow("idade_fora");
    expect(() => calcularMapa(new Date(1900, 0, 1), new Date(2026, 0, 1))).toThrow("idade_fora");
  });
});

