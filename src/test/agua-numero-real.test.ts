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

/* varredura novato (26/10): depois do Montar Finanças (Aluguel e Luz sem vencimento) o widget dizia "Nenhuma conta cadastrada" */
import { contasSemVencimento } from "@/lib/home-widgets-e";
describe("Próxima conta: contas sem vencimento", () => {
  const vazio = { nextBillName: null, nextBillDaysUntil: null } as unknown as LifeHubData;
  const conta = (dados: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f);
  // 1.0.19 (novato polido, 51c5f443): os vazios viraram CONVITE curto — "Que dia vencem Aluguel e mais 1?" (era
  // "Aluguel e mais 1 · sem data") e, sem conta nenhuma, "Te aviso antes de vencer" (era "Nenhuma conta cadastrada")
  it("contas do Montar sem dia: o widget mostra a conta, honesto (pergunta o dia), com 'Pôr o dia'", () => {
    const get = conta({ "finance-fixed-expenses": [{ id: "a", description: "Aluguel", value: 900 }, { id: "b", description: "Luz", value: 150 }] });
    expect(contasSemVencimento(get)).toEqual(["Aluguel", "Luz"]);
    const w = dadoDoWidgetE("proxima-conta", vazio, get);
    expect(w.vazio).toEqual({ texto: "Que dia vencem Aluguel e mais 1?", cta: "Pôr o dia" });
    const um = dadoDoWidgetE("proxima-conta", vazio, conta({ "finance-fixed-expenses": [{ id: "a", description: "Aluguel", value: 900 }] }));
    expect(um.vazio?.texto).toBe("Que dia vence Aluguel?");
  });
  it("conta com dia: não entra; nada cadastrado: o convite de cadastrar", () => {
    expect(contasSemVencimento(conta({ "finance-fixed-expenses": [{ id: "a", description: "Aluguel", value: 900, day: 10 }] }))).toEqual([]);
    expect(dadoDoWidgetE("proxima-conta", vazio, conta({})).vazio).toEqual({ texto: "Te aviso antes de vencer", cta: "Cadastrar conta" });
  });
});
