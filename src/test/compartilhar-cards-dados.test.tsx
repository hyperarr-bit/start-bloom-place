/**
 * OS DADOS DE VERDADE DOS CARDS (29/09): cada card lê a MESMA chave do app,
 * só aparece com o mínimo que dá orgulho, e a insígnia do mês vira o card do
 * assunto (sensível sem "mostrar valores" → nenhum card). E a CHAVE: com ela
 * desligada, o botão novo não existe.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { chaveArquivada } from "@/lib/virada-do-mes";
import { cardDaInsignia, cardsDoApp, MINIMOS } from "@/components/compartilhar/dados-do-app";
import { CATALOGO, montarInsignia, type Get } from "@/components/conquistas/insignias";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { CHAVE_FORCA, COMPARTILHAR_V2 } from "@/components/compartilhar/chave";

vi.mock("@/lib/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/analytics")>()), trackEvent: () => {} }));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));

const HOJE = "2026-09-29";
const dias = (mes: string, ns: number[]) => ns.map((n) => `${mes}-${String(n).padStart(2, "0")}`);

const semente = (): Record<string, unknown> => ({
  "saude-workout-log": [...dias("2026-09", [1, 3, 5, 7, 8, 10, 11, 14]), ...dias("2026-08", [2, 4, 6, 9, 12])],
  // agosto fechou no azul: 5 gastos datados, receita maior que a saída
  [chaveArquivada(2026, 7, "incomes")]: [{ value: 4000, date: "2026-08-05", description: "Salário" }],
  [chaveArquivada(2026, 7, "expenses")]: [1, 2, 3, 4, 5].map((i) => ({ value: 400, date: `2026-08-1${i}`, category: "mercado" })),
  "lib-books": [
    { title: "Tudo é rio", author: "Carla Madeira", status: "lido", pages: 210, endDate: "2026-09-12", cover: "" },
    { title: "Antigo", status: "lido", pages: 100, endDate: "2026-03-01" },
    { title: "Lendo", status: "lendo", pages: 300 },
  ],
  "month-goals": { "2026-09": [{ id: "1", text: "Marcar o dentista", done: true }, { id: "2", text: "Ler 2 livros", done: false }] },
});

const getDe = (s: Record<string, unknown>): Get => (<T,>(k: string, fb: T) => (k in s ? (s[k] as T) : fb)) as Get;

afterEach(() => {
  cleanup();
  try { localStorage.removeItem(CHAVE_FORCA); } catch { /* sem storage */ }
});

describe("cardsDoApp: a mesma chave, com o mínimo", () => {
  it("treinos do mês (8 ≥ 4) com a lista de dias do mês — e o total desde o 1º", () => {
    const c = cardsDoApp(getDe(semente()), HOJE);
    expect(c.treinos?.dias).toHaveLength(8);
    expect(c.treinos?.dias.every((d) => d.startsWith("2026-09"))).toBe(true);
    expect(c.treinosTotal?.dias).toHaveLength(13);
  });

  it("abaixo do mínimo, o card não vem", () => {
    const s = semente();
    s["saude-workout-log"] = dias("2026-09", [1, 2]);
    const c = cardsDoApp(getDe(s), HOJE);
    expect(MINIMOS.treinosNoMes).toBeGreaterThan(2);
    expect(c.treinos).toBeUndefined();
    expect(c.treinosTotal).toBeUndefined();
  });

  it("mês no azul: agosto fechado com sobra — % do que entrou, e o R$ só vai no dado (o card decide mostrar)", () => {
    const c = cardsDoApp(getDe(semente()), HOJE);
    expect(c.azul?.meses).toEqual([{ mes: "2026-08", pct: 50, saldo: 2000 }]);
    expect(c.azul?.valoresLigados).toBe(false);
  });

  it("livros lidos no mês, com título e autor (a capa vazia vira capa tipográfica)", () => {
    const c = cardsDoApp(getDe(semente()), HOJE);
    expect(c.livros?.livros).toEqual([{ titulo: "Tudo é rio", autor: "Carla Madeira", capa: undefined, paginas: 210 }]);
  });

  it("metas do mês: feitas primeiro, com os textos guardados pra quando a pessoa escolher mostrar", () => {
    const c = cardsDoApp(getDe(semente()), HOJE);
    expect(c.metas).toMatchObject({ feitas: 1, total: 2, textos: ["Marcar o dentista", "Ler 2 livros"] });
    expect(c.metas?.mostrarTextos).toBeFalsy();
  });
});

describe("cardDaInsignia: a conquista do mês vira o card do assunto", () => {
  const cards = cardsDoApp(getDe(semente()), HOJE);
  const ins = (id: string, valor: number) => montarInsignia(CATALOGO.find((d) => d.id === id)!, { valor });

  it("treinos no mês → o calendário; mês no azul → a água", () => {
    expect(cardDaInsignia(ins("tre-mes", 8), cards, { mesIdx: 8, ano: 2026 })?.tipo).toBe("treinos");
    expect(cardDaInsignia(ins("fin-azul", 1), cards, { mesIdx: 8, ano: 2026 })?.tipo).toBe("azul");
  });

  it("sem card próprio → o card geral com o número e o período", () => {
    const c = cardDaInsignia(ins("est-sessoes", 12), cards, { mesIdx: 8, ano: 2026 });
    expect(c).toMatchObject({ tipo: "numero", numero: "12", sub: "em setembro", periodo: "SETEMBRO 2026" });
  });

  it("sensível (R$, peso) sem 'mostrar valores' → nenhum card", () => {
    expect(cardDaInsignia(ins("fin-sobrou", 900), cards, { mesIdx: 8, ano: 2026 })).toBeNull();
    expect(cardDaInsignia(ins("sau-peso", 2), cards, { mesIdx: 8, ano: 2026 })).toBeNull();
  });
});

describe("a chave COMPARTILHAR_V2", () => {
  const ctx = (s: Record<string, unknown>): UserDataContextType => ({ get: getDe(s), set: () => {}, loaded: true, fetchKey: async () => undefined, isGuest: false, apagarTudo: async () => {} } as unknown as UserDataContextType);
  const Botao = async () => (await import("@/components/compartilhar/BotaoPostarCard")).BotaoPostarCard;

  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 29, 12)); });
  afterEach(() => vi.useRealTimers());

  it("vem DESLIGADA", () => {
    expect(COMPARTILHAR_V2).toBe("off");
  });

  it("desligada: o botão do Treino concluído não existe", async () => {
    const B = await Botao();
    render(<UserDataContext.Provider value={ctx(semente())}><B tipo="treinos" origem="teste" /></UserDataContext.Provider>);
    expect(screen.queryByTestId("postar-card-treinos")).toBeNull();
  });

  it("ligada (força local) e com o mínimo: o botão aparece", async () => {
    localStorage.setItem(CHAVE_FORCA, "on");
    const B = await Botao();
    render(<UserDataContext.Provider value={ctx(semente())}><B tipo="treinos" origem="teste" /></UserDataContext.Provider>);
    // a parte pesada carrega sob demanda (só com a chave ligada)
    // 27/10: a importação sob demanda passava de 1 s (o padrão do findBy) com a máquina ocupada e travava o build
    expect(await screen.findByTestId("postar-card-treinos", {}, { timeout: 5000 })).toBeTruthy();
  });

  it("fora do provedor de dados, nunca quebra (sem cards)", async () => {
    localStorage.setItem(CHAVE_FORCA, "on");
    const B = await Botao();
    render(<B tipo="treinos" origem="teste" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("postar-card-treinos")).toBeNull();
  });
});
