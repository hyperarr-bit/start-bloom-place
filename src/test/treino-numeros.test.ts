/**
 * Números do Treino (26/09, varredura): vírgula decimal cortada (52,5 → 52),
 * volume somando exercício não feito, "3.4k" com ponto, e a progressão da
 * demo mostrando a carga CAINDO porque o array era invertido em vez de
 * ordenado por data.
 */
import { describe, it, expect } from "vitest";
import { lerNumero, volumeDoExercicio, formatarVolume, emOrdemDeData } from "@/lib/treino-numeros";

describe("números do Treino", () => {
  it("lê carga com vírgula e com unidade", () => {
    expect(lerNumero("52,5kg")).toBe(52.5);
    expect(lerNumero("60 kg")).toBe(60);
    expect(lerNumero("12")).toBe(12);
    expect(lerNumero("—")).toBe(0);
    expect(lerNumero(undefined)).toBe(0);
  });

  it("volume = séries × reps × carga; cardio não soma", () => {
    expect(volumeDoExercicio({ sets: "4", reps: "10", carga: "52,5kg" })).toBe(2100);
    expect(volumeDoExercicio({ sets: "1", reps: "1", carga: "25min", tipo: "cardio" })).toBe(0);
  });

  it("volume em português: 3,4 mil", () => {
    expect(formatarVolume(3404)).toBe("3,4 mil");
    expect(formatarVolume(12450)).toBe("12,5 mil");
    expect(formatarVolume(850)).toBe("850");
  });

  it("progressão em ordem de data, qualquer que seja a ordem gravada", () => {
    const maisNovoPrimeiro = [{ date: "2026-09-23", carga: "60" }, { date: "2026-09-16", carga: "57,5" }, { date: "2026-09-09", carga: "55" }];
    const maisVelhoPrimeiro = [...maisNovoPrimeiro].reverse();
    for (const lista of [maisNovoPrimeiro, maisVelhoPrimeiro])
      expect(emOrdemDeData(lista).map((h) => lerNumero(h.carga))).toEqual([55, 57.5, 60]);
  });
});
