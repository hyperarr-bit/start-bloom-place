/**
 * Avaliações da Play de setembro/2026, viradas em trava (07/09).
 *
 * Cada bloco cita a frase da avaliação que o motivou. Onde a feature é de UI,
 * o teste abre → usa → SAI → REABRE (regra da casa, 19/07): o buraco costuma
 * estar na remontagem, não no clique.
 */
// Fuso do Brasil ANTES de qualquer Date: o bug do aniversário só existe a
// oeste de Greenwich. O Node relê TZ quando process.env muda.
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";
import SmartPantry from "@/components/casa/SmartPantry";
import GroceryList from "@/components/casa/GroceryList";
import { kcalDoPlano, kcalRegistradas, lerKcal } from "@/pages/Dieta";
import { planejarRemedios } from "@/lib/notificacoes";

const criarStore = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  };
  return { dados, valor };
};

const renderComStore = (ui: React.ReactElement, store: ReturnType<typeof criarStore>) =>
  render(<UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider>);

/* ============================================================
 * RELAÇÕES — "na aba social não temos como editar informações das pessoas,
 * a data de nascimento é difícil de colocar e está colocando sempre um dia
 * anterior": as travas moram em relacoes-tela.test.tsx desde o módulo novo
 * (29/09) — o PeoplePanel saiu, as asserções foram junto pra tela nova.
 * ============================================================ */

/* ============================================================
 * CASA — "os itens voltam todos para o armário, poderia voltar o item para
 * o local onde foi colocado inicial"
 * ============================================================ */
describe("Casa: item comprado volta pra categoria de origem", () => {
  type Pantry = { id: string; name: string; category: string; status: string }[];
  type Shopping = { id: string; name: string; checked: boolean; fromPantry: boolean; origemCategory?: string }[];

  // 26/09 (varredura): o "Acabou" passou a mandar pro MERCADO (a dica do
  // módulo sempre prometeu a Lista de Compras), no corredor do canto de
  // origem; comprado lá, o item volta pro MESMO canto — o pedido da avaliação.
  it("acabou na geladeira → Mercado → comprado → volta pra GELADEIRA", () => {
    const store = criarStore({ "casa-pantry": [{ id: "1", name: "Leite", category: "geladeira", status: "cheio" }] });
    const tela = renderComStore(<SmartPantry />, store);
    fireEvent.change(screen.getByDisplayValue("Cheio"), { target: { value: "acabou" } });
    const m = store.dados["casa-grocery-categories"] as { name: string; items: { text: string; origem?: string }[] }[];
    expect(m.find((c) => c.name === "Laticínios e Frios")!.items[0]).toMatchObject({ text: "Leite", origem: "geladeira" });
    expect(store.dados["casa-pantry"]).toHaveLength(0);
    tela.unmount();
    renderComStore(<GroceryList />, store);
    fireEvent.click(within(screen.getByText("Leite").parentElement!).getByRole("checkbox"));
    expect((store.dados["casa-pantry"] as Pantry)[0]).toMatchObject({ name: "Leite", category: "geladeira", status: "cheio" });
  });

  it("item que já estava na lista ANTES da origem existir continua voltando pro armário", () => {
    const store = criarStore({
      "casa-pantry": [],
      "casa-shopping-list": [{ id: "9", name: "Arroz", checked: false, fromPantry: true }], // sem origemCategory
    });
    renderComStore(<SmartPantry />, store);
    fireEvent.click(screen.getByRole("button", { name: /Compras/i }));
    fireEvent.click(screen.getByRole("button", { name: /Comprei Arroz/i }));
    expect((store.dados["casa-pantry"] as Pantry)[0]).toMatchObject({ name: "Arroz", category: "armario" });
  });
});

/* ============================================================
 * DIETA — "na aba dieta n tem como colocar as calorias dos pratos"
 * ============================================================ */
describe("Dieta: calorias por refeição e total do dia", () => {
  it("soma o plano do dia ignorando valor torto", () => {
    expect(kcalDoPlano({ "Café da Manhã": 300, "Almoço": 650, "Lanche": "abc", "Janta": -5 })).toBe(950);
    expect(kcalDoPlano(undefined)).toBe(0);
  });

  it("soma o que a Home registrou (core-dieta-log) com a MESMA conta do widget", () => {
    const log = { "quick-1": { name: "Almoço: arroz", calories: 600 }, "quick-2": { name: "Lanche", calories: undefined }, x: { calories: "150" } };
    expect(kcalRegistradas(log)).toBe(750);
  });

  it("lê o que a pessoa digita: '350', '350,5', ' 350 kcal', lixo = 0", () => {
    expect(lerKcal("350")).toBe(350);
    expect(lerKcal("350,5")).toBe(351);
    expect(lerKcal(" 350 kcal")).toBe(350);
    expect(lerKcal("")).toBe(0);
    expect(lerKcal("abc")).toBe(0);
  });
});

/* ============================================================
 * SAÚDE — "adicionem notificação pra tomar remédio"
 * ============================================================ */
describe("Saúde: lembrete na hora de cada remédio", () => {
  const lista = [
    { id: "a", nome: "Ômega 3", hora: "08:00", tomadoHoje: false },
    { id: "b", nome: "Vitamina D", hora: "08:00", tomadoHoje: true },
    { id: "c", nome: "Creatina", hora: "21:30", tomadoHoje: false },
  ];

  it("agrupa quem tem o mesmo horário, pula hoje quem já tomou, e nunca agenda pro passado", () => {
    const agora = new Date(2026, 8, 7, 7, 0, 0); // 07/09/2026 07:00
    const avisos = planejarRemedios(lista, agora);

    expect(avisos.every((a) => a.quando.getTime() > agora.getTime())).toBe(true);
    const hoje8 = avisos.find((a) => a.quando.getDate() === 7 && a.quando.getHours() === 8)!;
    expect(hoje8.title).toBe("💊 Hora do Ômega 3"); // Vitamina D já foi tomada hoje
    const amanha8 = avisos.find((a) => a.quando.getDate() === 8 && a.quando.getHours() === 8)!;
    expect(amanha8.title).toBe("💊 Hora do Ômega 3 e Vitamina D");
    const hoje2130 = avisos.find((a) => a.quando.getDate() === 7 && a.quando.getHours() === 21)!;
    expect(hoje2130.title).toBe("💊 Hora do Creatina");
    expect(hoje2130.quando.getMinutes()).toBe(30);

    // ids únicos e dentro da faixa "saude" — 1300000–1309999 desde 26/09 (a
    // 800000 era da régua do teste grátis e os remédios apagavam o D1/D2/D3)
    const ids = avisos.map((a) => a.id!);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id >= 1300000 && id < 1310000)).toBe(true);
  });

  it("depois do horário, o aviso de hoje não existe — só o de amanhã em diante", () => {
    const agora = new Date(2026, 8, 7, 9, 0, 0);
    const avisos = planejarRemedios(lista, agora).filter((a) => a.quando.getHours() === 8);
    expect(avisos[0].quando.getDate()).toBe(8);
  });

  it("lista vazia ou sem horário válido = nada agendado", () => {
    expect(planejarRemedios([])).toEqual([]);
    expect(planejarRemedios([{ id: "x", nome: "Sem hora", hora: "", tomadoHoje: false }])).toEqual([]);
  });
});

/* ─── 11/09: dois lembretes novos, só como opção na central ──────────────── */
import { planejarAniversarios, planejarManutencao } from "@/lib/notificacoes";

describe("Notificações: aniversário chegando (véspera) e manutenção da casa (no vencimento)", () => {
  const agora = new Date(2026, 8, 11, 22, 0, 0); // sexta 11/09 22h

  it("aniversário: avisa na VÉSPERA na hora escolhida, junta quem cai no mesmo dia, ignora quem já passou e quem está longe", () => {
    const avisos = planejarAniversarios([
      { nome: "Ana", aniversario: "1990-09-13" },        // domingo 13 → véspera sábado 12 às 10h
      { nome: "Bruno", aniversario: "1985-09-13" },      // mesmo dia: junta
      { nome: "Carla", aniversario: "2000-09-05" },      // já passou este ano → só em 2027, longe
      { nome: "Dora", aniversario: "1999-12-25" },       // > 60 dias
      { nome: "Edu", aniversario: "1993-10-02" },        // véspera 01/10
      { nome: "", aniversario: "1990-09-20" },           // sem nome: fora
      { nome: "Fê", aniversario: "20/09" },              // formato torto: fora
    ], 10, agora);
    expect(avisos.map((a) => a.quando.toLocaleString("pt-BR"))).toEqual(["12/09/2026, 10:00:00", "01/10/2026, 10:00:00"]);
    expect(avisos[0].title).toBe("🎂 Amanhã tem 2 aniversários");
    expect(avisos[0].body).toContain("Ana, Bruno");
    expect(avisos[1].title).toBe("🎂 Amanhã é aniversário de Edu");
  });

  it("aniversário de hoje não avisa (a véspera já passou); 29/02 em ano comum é pulado", () => {
    expect(planejarAniversarios([{ nome: "Gil", aniversario: "1990-09-11" }], 10, agora)).toEqual([]);
    const emAnoComum = planejarAniversarios([{ nome: "Hal", aniversario: "1992-02-29" }], 10, new Date(2027, 1, 1, 8));
    expect(emAnoComum).toEqual([]);
  });

  it("manutenção: vence em última vez + frequência; vencida avisa uma vez amanhã; nunca feita fica de fora", () => {
    const avisos = planejarManutencao([
      { tarefa: "Limpar filtro do ar", ultimaVez: "2026-03-20", frequenciaMeses: 6 },  // vence 20/09
      { tarefa: "Trocar filtro da água", ultimaVez: "2026-01-05", frequenciaMeses: 6 }, // venceu 05/07 → amanhã 12/09
      { tarefa: "Dedetização", ultimaVez: "2026-09-01", frequenciaMeses: 12 },          // 2027: longe
      { tarefa: "Calha", ultimaVez: "", frequenciaMeses: 6 },                            // nunca feita
    ], 10, agora);
    expect(avisos.map((a) => [a.quando.toLocaleString("pt-BR"), a.title])).toEqual([
      ["12/09/2026, 10:00:00", "🔧 Manutenção: Trocar filtro da água"],
      ["20/09/2026, 10:00:00", "🔧 Manutenção: Limpar filtro do ar"],
    ]);
  });
});
