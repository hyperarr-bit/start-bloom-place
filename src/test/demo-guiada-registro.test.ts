/**
 * O ITEM DA DEMO NA CONTA (28/09) — travas de src/lib/demo-guiada-registro.ts.
 *
 *   · só as chaves REAIS dos módulos (lista fechada);
 *   · só o item dela — nenhum dado de exemplo da demo atravessa;
 *   · chave sincronizada nunca muda de tipo (lição do finance-orcamento-ano);
 *   · gravar duas vezes não duplica;
 *   · no formato que o módulo já usa.
 */
import { describe, it, expect } from "vitest";
import {
  CHAVES_DO_ITEM, gravacoesDoItem, levarItemParaConta, aplicarItemNaDemo, idDoItem, type ChaveDoItem,
} from "@/lib/demo-guiada-registro";
import { exercicioNovo } from "@/lib/treino-plano";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { TIPOS_DO_ITEM, type ItemDaDemo } from "@/lib/demo-guiada";

const QUARTA = new Date(2026, 8, 30, 10); // 30/09/2026, quarta-feira
const SABADO = new Date(2026, 9, 3, 10); // 03/10/2026, sábado
const CAFE: ItemDaDemo = { tipo: "gasto", nome: "Café", valor: 12 };
const ITENS: ItemDaDemo[] = [
  CAFE,
  { tipo: "habito", nome: "Beber água" },
  { tipo: "exercicio", nome: "Agachamento" },
  { tipo: "agua", nome: "1 copo d'água", valor: 250 },
  { tipo: "meta", nome: "Correr 5 km" },
];

/** Conta de mentira: um mapa chave → valor, e a lista do que foi gravado. */
const conta = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const gravadas: Array<[string, unknown]> = [];
  return {
    dados,
    gravadas,
    levar: (item: ItemDaDemo, hoje = QUARTA) =>
      levarItemParaConta(item, (k) => dados[k], (k, v) => { dados[k] = v; gravadas.push([k, v]); }, hoje),
  };
};

describe("lista fechada de chaves", () => {
  it("são exatamente as chaves reais dos 5 módulos da missão", () => {
    expect([...CHAVES_DO_ITEM].sort()).toEqual([
      "core-saude-water", "finance-expenses", "goals-board-v2", "rotina-habits", "saude-workouts-v2", "treino-active-days", "water-log",
    ]);
  });

  it("nenhum tipo de item grava fora da lista (nem no sábado, que mexe nos dias de treino)", () => {
    for (const item of ITENS) {
      for (const hoje of [QUARTA, SABADO]) {
        for (const g of gravacoesDoItem(item, hoje)) expect(CHAVES_DO_ITEM).toContain(g.chave as ChaveDoItem);
      }
    }
    expect(TIPOS_DO_ITEM).toHaveLength(ITENS.length);
  });
});

describe("gasto (Finanças: finance-expenses)", () => {
  it("conta nova: grava SÓ o gasto dela, no formato do addExpense", () => {
    const c = conta();
    expect(c.levar(CAFE)).toEqual(["finance-expenses"]);
    expect(c.dados["finance-expenses"]).toEqual([
      { id: idDoItem(CAFE), description: "Café", category: "outros", value: 12, date: "2026-09-30", paymentMethod: "pix" },
    ]);
  });

  it("nenhum dado de exemplo da demo vai pra conta", () => {
    const c = conta();
    c.levar(CAFE);
    const exemplo = (getSeedsForModule("financas")["finance-expenses"] as Array<{ description: string }>).map((e) => e.description);
    expect(exemplo.length).toBeGreaterThan(3);
    const naConta = (c.dados["finance-expenses"] as Array<{ description: string }>).map((e) => e.description);
    expect(naConta).toEqual(["Café"]);
    for (const nome of exemplo) expect(naConta).not.toContain(nome);
    expect(Object.keys(c.dados)).toEqual(["finance-expenses"]);
  });

  it("conta que já tinha gastos: soma no fim, sem tocar nos dela", () => {
    const antigos = [{ id: "1", description: "Aluguel", category: "casa", value: 900, date: "2026-09-01", paymentMethod: "pix" }];
    const c = conta({ "finance-expenses": antigos });
    c.levar(CAFE);
    const lista = c.dados["finance-expenses"] as unknown[];
    expect(lista).toHaveLength(2);
    expect(lista[0]).toBe(antigos[0]);
  });

  it("duas vezes não duplica (o paywall remonta, ela volta do Pix)", () => {
    const c = conta();
    c.levar(CAFE);
    expect(c.levar(CAFE)).toEqual([]);
    expect(c.gravadas).toHaveLength(1);
  });

  it("CHAVE NUNCA MUDA DE TIPO: achou objeto/texto/número lá → não grava", () => {
    for (const estranho of [{ "2026-09": [] }, "texto", 7, true]) {
      const c = conta({ "finance-expenses": estranho });
      expect(c.levar(CAFE)).toEqual([]);
      expect(c.dados["finance-expenses"]).toBe(estranho);
    }
  });
});

describe("hábito (Rotina: rotina-habits)", () => {
  it("conta nova ganha só o hábito dela; lista antiga ganha no fim; nome repetido não duplica", () => {
    const c = conta();
    c.levar({ tipo: "habito", nome: "Beber água" });
    expect(c.dados["rotina-habits"]).toEqual(["Beber água"]);
    const c2 = conta({ "rotina-habits": ["Ler", { name: "beber ÁGUA" }] });
    expect(c2.levar({ tipo: "habito", nome: "Beber água" })).toEqual([]);
    const c3 = conta({ "rotina-habits": ["Ler"] });
    c3.levar({ tipo: "habito", nome: "Meditar" });
    expect(c3.dados["rotina-habits"]).toEqual(["Ler", "Meditar"]);
  });

  it("tipo errado não é sobrescrito", () => {
    const c = conta({ "rotina-habits": { a: 1 } });
    expect(c.levar({ tipo: "habito", nome: "Meditar" })).toEqual([]);
  });
});

describe("exercício (Treino: saude-workouts-v2)", () => {
  it("entra no dia de HOJE, no formato do exercicioNovo, sem apagar o resto do plano", () => {
    const plano = { SEGUNDA: { muscles: ["Peito"], exercises: [exercicioNovo("Supino")] } };
    const c = conta({ "saude-workouts-v2": plano });
    c.levar({ tipo: "exercicio", nome: "Agachamento" }, QUARTA);
    const novo = c.dados["saude-workouts-v2"] as Record<string, { muscles: string[]; exercises: unknown[] }>;
    expect(novo.SEGUNDA).toEqual(plano.SEGUNDA);
    expect(novo.QUARTA).toEqual({ muscles: [], exercises: [exercicioNovo("Agachamento")] });
    expect(c.dados["treino-active-days"]).toBeUndefined(); // quarta já é dia de treino
  });

  it("no fim de semana, o dia vira dia de treino (mesma regra do módulo)", () => {
    const c = conta();
    c.levar({ tipo: "exercicio", nome: "Corrida" }, SABADO);
    expect(c.dados["treino-active-days"]).toEqual(["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"]);
  });

  it("plano em formato estranho não é tocado", () => {
    const c = conta({ "saude-workouts-v2": ["velho"] });
    expect(c.levar({ tipo: "exercicio", nome: "Corrida" })).toEqual([]);
  });
});

describe("água (Saúde: core-saude-water + water-log)", () => {
  it("conta: pelo menos 1 copo hoje, nas DUAS chaves; quem já bebeu 3 não perde nada", () => {
    const c = conta();
    c.levar({ tipo: "agua", nome: "1 copo d'água", valor: 250 });
    expect(c.dados["core-saude-water"]).toEqual({ "2026-09-30": 1 });
    expect(c.dados["water-log"]).toEqual({ "2026-09-30": 1 });
    const c2 = conta({ "core-saude-water": { "2026-09-30": 3 }, "water-log": { "2026-09-30": 3 } });
    expect(c2.levar({ tipo: "agua", nome: "1 copo d'água", valor: 250 })).toEqual([]);
  });

  it("na demo, o copo dela entra POR CIMA dos copos de exemplo (é o que ela viu)", () => {
    const sementes = { "core-saude-water": { "2026-09-30": 5 }, "water-log": { "2026-09-30": 5 } };
    const depois = aplicarItemNaDemo(sementes, { tipo: "agua", nome: "1 copo d'água", valor: 250 }, QUARTA);
    expect(depois["core-saude-water"]).toEqual({ "2026-09-30": 6 });
  });
});

describe("meta (Metas: goals-board-v2)", () => {
  it("a mesma forma da emptyGoal do GoalsBoardV2; título repetido não duplica", () => {
    const c = conta();
    c.levar({ tipo: "meta", nome: "Correr 5 km" });
    const [meta] = c.dados["goals-board-v2"] as Array<Record<string, unknown>>;
    expect(Object.keys(meta).sort()).toEqual(["actionGroups", "id", "problems", "referenceImages", "referenceLinks", "title", "vision"]);
    expect(meta.title).toBe("Correr 5 km");
    expect(meta.actionGroups).toHaveLength(2);
    expect(meta.vision).toEqual({ meta: "", objetivo: "", tempo: "" });
    const c2 = conta({ "goals-board-v2": [{ id: "x", title: "correr 5 KM" }] });
    expect(c2.levar({ tipo: "meta", nome: "Correr 5 km" })).toEqual([]);
  });
});

describe("de volta na demo (ela saiu do módulo e voltou)", () => {
  it("o item reaparece junto com o exemplo — e o exemplo continua inteiro", () => {
    const sementes = getSeedsForModule("financas");
    const depois = aplicarItemNaDemo(sementes, CAFE, QUARTA);
    const antes = sementes["finance-expenses"] as unknown[];
    const agora = depois["finance-expenses"] as Array<{ description: string }>;
    expect(agora).toHaveLength(antes.length + 1);
    expect(agora.at(-1)?.description).toBe("Café");
    expect(agora.slice(0, antes.length)).toEqual(antes);
    // aplicar de novo (remontou) não duplica
    expect((aplicarItemNaDemo(depois, CAFE, QUARTA)["finance-expenses"] as unknown[]).length).toBe(antes.length + 1);
  });
});
