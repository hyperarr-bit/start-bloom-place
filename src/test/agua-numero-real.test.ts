/** Varredura 26/10 (item 13): a água acima da meta mostrava "15 /8" no formulário e "8 /8" no card/score — o número REAL em todo lugar. */
import { describe, it, expect } from "vitest";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { dadoDoWidgetE } from "@/lib/home-widgets-e";
import { contagemDoItem } from "@/components/home-nova/e/FolhaScore";
import { itensDoScore } from "@/components/home-nova/e/score-itens";
import { metricasDoDia } from "@/components/home-nova/e/PaginaSeuDia";

const d = { waterGlasses: 15, waterGoal: 8, habits: [], mealsLogged: 0, mealsTotal: 0, supplementsTaken: 0, supplementsTotal: 0 } as unknown as LifeHubData;

describe("água: o número real (15 de 8)", () => {
  it("widget, folha do score, item do score e card do Seu dia dizem 15", () => {
    const w = dadoDoWidgetE("agua", d, (_k, f) => f);
    expect(w.numero).toBe("15");
    expect(w.unidade).toBe("/8");
    expect(w.completo).toBe(true);
    const item = itensDoScore(d).find((i) => i.tipo === "agua")!;
    expect(contagemDoItem(item, d)).toBe("15/8");
    expect(item.pontos).toBeLessThanOrEqual(item.max); // os pontos continuam limitados à meta
    const m = metricasDoDia(d, 250, ["agua"]).find((x) => x.id === "agua")!;
    expect(m.valor).toBe(15);
  });
});
