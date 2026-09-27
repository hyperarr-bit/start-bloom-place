import { describe, it, expect, vi, afterEach } from "vitest";
import { alternarHabitoDeHoje, checksDeHoje, nomesDosHabitos } from "@/lib/rotina-habitos";
import { semanaAtualId } from "@/lib/utils";

/* Widget de hábitos da Home (varredura 26/09): marca igual à Rotina — grade
 * da semana com carimbo, log por data e heatmap. */
describe("hábito marcado pelo widget da Home", () => {
  afterEach(() => vi.useRealTimers());

  it("marca na coluna de HOJE da grade da Rotina, com o carimbo da semana", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 10)); // sábado
    const r = alternarHabitoDeHoje({ nomes: ["Água", "Treinar", "Ler"], checked: {}, semana: "", habitLog: {}, heatmap: {}, indice: 1 });
    expect(r.semana).toBe(semanaAtualId());
    expect(r.checked["SÁBADO"]).toEqual([false, true, false]);
    expect(r.habitLog["2026-09-26"]).toEqual(["Treinar"]);
    expect(r.heatmap["2026-09-26"]).toBe(true);
    expect(checksDeHoje(r.checked, r.semana)).toEqual([false, true, false]);
  });

  it("desmarcar o último hábito do dia tira o dia do heatmap", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 10));
    const antes = { "SÁBADO": [false, true, false] };
    const r = alternarHabitoDeHoje({ nomes: ["Água", "Treinar", "Ler"], checked: antes, semana: semanaAtualId(), habitLog: {}, heatmap: { "2026-09-26": true }, indice: 1 });
    expect(r.checked["SÁBADO"]).toEqual([false, false, false]);
    expect(r.heatmap).toEqual({});
  });

  it("grade de outra semana não vale: começa limpa", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 10));
    const velha = { "SÁBADO": [true, true, true] };
    expect(checksDeHoje(velha, "2026-09-14")).toEqual([]);
    const r = alternarHabitoDeHoje({ nomes: ["Água", "Treinar", "Ler"], checked: velha, semana: "2026-09-14", habitLog: {}, heatmap: {}, indice: 0 });
    expect(r.checked).toEqual({ "SÁBADO": [true, false, false] });
  });

  it("aceita a lista antiga com objetos", () => {
    expect(nomesDosHabitos(["Água", { name: "Ler" }, { id: "x" }, ""])).toEqual(["Água", "Ler"]);
  });
});
