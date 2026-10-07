import { describe, it, expect } from "vitest";
import { tirarTreinoDoDia } from "@/lib/treino-outro-dia";

describe("tirarTreinoDoDia (07/10)", () => {
  it("tira o dia do registro, volume, carimbo e histórico, sem mexer nos outros dias", () => {
    const r = tirarTreinoDoDia({
      dia: "2026-10-07",
      historico: [{ date: "2026-10-06", exercise: "Supino" }, { date: "2026-10-07", exercise: "Supino" }],
      log: ["2026-10-06", "2026-10-07"],
      volume: { "2026-10-06": 100, "2026-10-07": 200 },
      sessoes: { "2026-10-06": { dia: "TERÇA" }, "2026-10-07": { dia: "QUARTA" } },
    });
    expect(r.log).toEqual(["2026-10-06"]);
    expect(r.volume).toEqual({ "2026-10-06": 100 });
    expect(Object.keys(r.sessoes)).toEqual(["2026-10-06"]);
    expect(r.historico).toEqual([{ date: "2026-10-06", exercise: "Supino" }]);
  });
  it("chaves vazias ou em formato estranho não quebram", () => {
    const r = tirarTreinoDoDia({ dia: "2026-10-07", historico: null, log: undefined, volume: [], sessoes: "x" });
    expect(r).toEqual({ historico: [], log: [], volume: {}, sessoes: {} });
  });
});
