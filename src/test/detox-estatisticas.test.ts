import { describe, it, expect } from "vitest";
import { inicioDoHabito, sequenciaDetox, taxaDeSucesso, semanasDetox } from "@/lib/detox";

/* Estatística do Detox (varredura 26/09): a recaída reescreve o startDate,
 * então "dias desde o início" encolhia e a taxa ia a -100%. */
const hoje = new Date(2026, 8, 26, 22, 30); // 22h30: depois das 21h o UTC já é amanhã

describe("estatística do detox", () => {
  it("o começo real é o mais antigo entre criação, início e recaídas", () => {
    expect(inicioDoHabito({ createdAt: "2026-09-10", startDate: "2026-09-25", relapses: ["2026-09-12", "2026-09-25"] })).toBe("2026-09-10");
    expect(inicioDoHabito({ startDate: "2026-09-25", relapses: ["2026-09-20"] })).toBe("2026-09-20");
  });

  it("taxa de sucesso fica entre 0 e 100 e conta dia com recaída uma vez", () => {
    // criado hoje e já recaiu 4 vezes: antes dava -100%
    const h = { createdAt: "2026-09-26", startDate: "2026-09-26", relapses: ["2026-09-26", "2026-09-26", "2026-09-26", "2026-09-26"] };
    expect(taxaDeSucesso(h, hoje)).toBe(0);
    // 10 dias (17 a 26), 2 dias com recaída → 80%
    expect(taxaDeSucesso({ createdAt: "2026-09-17", startDate: "2026-09-24", relapses: ["2026-09-20", "2026-09-24"] }, hoje)).toBe(80);
  });

  it("sequência em dia local, a partir da última recaída", () => {
    expect(sequenciaDetox({ startDate: "2026-09-20", relapses: [] }, hoje)).toBe(6);
    expect(sequenciaDetox({ startDate: "2026-09-10", relapses: ["2026-09-24"] }, hoje)).toBe(2);
  });

  it("hábito criado hoje não ganha 4 semanas cheias de dias limpos", () => {
    const semanas = semanasDetox({ createdAt: "2026-09-26", startDate: "2026-09-26", relapses: [] }, hoje);
    expect(semanas.map((s) => s.pure)).toEqual([0, 0, 0, 1]);
    const antigo = semanasDetox({ createdAt: "2026-08-01", startDate: "2026-09-21", relapses: ["2026-09-21"] }, hoje);
    expect(antigo[3]).toEqual({ name: "S4", pure: 6, relapse: 1 });
  });
});
