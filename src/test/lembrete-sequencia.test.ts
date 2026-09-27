import { describe, it, expect } from "vitest";
import { planejarLembreteSequencia, BASES_LEMBRETES } from "@/lib/notificacoes";
import { lerPrefs } from "@/lib/prefs-notificacoes";

/* Lembrete da sequência (26/09): à noite, só se o dia estiver vazio. */
const sabado18h = new Date(2026, 8, 26, 18, 0);

describe("lembrete da sequência", () => {
  it("nasce desligado nas preferências, às 20h", () => {
    const p = lerPrefs({});
    expect(p.sequencia).toBe(false);
    expect(p.horaSequencia).toBe(20);
  });

  it("hoje vazio: avisa às 20h com o número e a ação", () => {
    const [hoje] = planejarLembreteSequencia({ dias: 12, anotouHoje: false, acao: "registrar um gasto" }, 20, sabado18h);
    expect(hoje.quando).toEqual(new Date(2026, 8, 26, 20, 0));
    expect(hoje.title).toBe("Sua sequência de 12 dias acaba hoje 🔥");
    expect(hoje.body).toContain("registrar um gasto");
  });

  it("já anotou hoje: pula hoje e deixa os próximos dias com texto sem número", () => {
    const avisos = planejarLembreteSequencia({ dias: 12, anotouHoje: true, acao: "x" }, 20, sabado18h);
    expect(avisos[0].quando).toEqual(new Date(2026, 8, 27, 20, 0));
    expect(avisos.every((a) => !/\d+ dias/.test(a.title))).toBe(true);
  });

  it("sem sequência (0 dias): nada a lembrar", () => {
    expect(planejarLembreteSequencia({ dias: 0, anotouHoje: false, acao: "x" }, 20, sabado18h)).toEqual([]);
  });

  it("depois das 20h o de hoje não é agendado no passado", () => {
    const avisos = planejarLembreteSequencia({ dias: 3, anotouHoje: false, acao: "x" }, 20, new Date(2026, 8, 26, 21, 0));
    expect(avisos[0].quando.getDate()).toBe(27);
  });

  it("faixa de ids própria, sem colidir com os outros lembretes", () => {
    const bases = Object.values(BASES_LEMBRETES).sort((a, b) => a - b);
    expect(BASES_LEMBRETES.sequencia).toBe(1500000);
    bases.forEach((b, i) => { if (i) expect(b - bases[i - 1]).toBeGreaterThanOrEqual(10000); });
  });
});
