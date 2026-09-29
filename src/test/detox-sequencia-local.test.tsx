/**
 * Detox (28/09) — os dois bugs da varredura noturna:
 *  1. o Rastreador e as Conquistas do módulo contavam a sequência em UTC
 *     (`differenceInDays(new Date(), new Date("AAAA-MM-DD"))`) e o Stats em dia
 *     LOCAL (`sequenciaDetox`): das 21h à meia-noite no Brasil os números
 *     discordavam e o marco de 7 dias "abria" um dia antes;
 *  2. a ação rápida "Check-in Detox" da Home achava o hábito pelo NOME — dois
 *     hábitos com o mesmo nome levavam o check-in juntos.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { chaveDoHabito, marcarCheckin, sequenciaDetox } from "@/lib/detox";
import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { DetoxAchievements } from "@/components/detox/DetoxAchievements";
import { DetoxStats } from "@/components/detox/DetoxStats";
import { QuickActions } from "@/components/home/QuickActions";

process.env.TZ = "America/Sao_Paulo";

vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false, plataformaApp: () => "web" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));

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
const renderCom = (ui: React.ReactElement, store = criarStore()) => {
  const r = render(<MemoryRouter><UserDataContext.Provider value={store.valor}>{ui}</UserDataContext.Provider></MemoryRouter>);
  return { store, ...r };
};

/** A conta ANTIGA do Rastreador/Conquistas, pra provar que o caso realmente quebrava. */
const contaAntigaUtc = (desde: string, agora: Date) => differenceInDays(agora, new Date(desde));

afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = "America/Sao_Paulo";
});

describe("1. sequência em dia LOCAL — meia-noite e 21h (UTC já virou)", () => {
  const habito = { startDate: "2026-09-20", relapses: [] as string[] };

  it("das 21h às 23h59 no Brasil a conta antiga já dava +1; a nova não", () => {
    for (const [h, m] of [[20, 59], [21, 0], [22, 30], [23, 59]] as const) {
      const agora = new Date(2026, 8, 26, h, m);
      expect(sequenciaDetox(habito, agora), `${h}:${m}`).toBe(6);
    }
    expect(contaAntigaUtc("2026-09-20", new Date(2026, 8, 26, 22, 30))).toBe(7); // o bug
  });

  it("vira à MEIA-NOITE local, nem um minuto antes", () => {
    expect(sequenciaDetox(habito, new Date(2026, 8, 26, 23, 59, 59))).toBe(6);
    expect(sequenciaDetox(habito, new Date(2026, 8, 27, 0, 0, 0))).toBe(7);
    expect(sequenciaDetox(habito, new Date(2026, 8, 27, 0, 0, 1))).toBe(7);
  });

  it("recaída de hoje zera; a de ontem conta 1 a partir da meia-noite", () => {
    expect(sequenciaDetox({ startDate: "2026-09-26", relapses: ["2026-09-26"] }, new Date(2026, 8, 26, 23, 50))).toBe(0);
    expect(sequenciaDetox({ startDate: "2026-09-26", relapses: ["2026-09-26"] }, new Date(2026, 8, 27, 0, 10))).toBe(1);
  });

  it("virada de mês e de ano", () => {
    expect(sequenciaDetox({ startDate: "2026-09-30", relapses: [] }, new Date(2026, 9, 1, 0, 0))).toBe(1);
    expect(sequenciaDetox({ startDate: "2026-12-31", relapses: [] }, new Date(2027, 0, 1, 23, 30))).toBe(1);
  });
});

describe("1b. virada do fuso", () => {
  it("horário de verão (Nova York, 08/03: dia de 23 h) não pula nem repete dia", () => {
    process.env.TZ = "America/New_York";
    const h = { startDate: "2026-03-07", relapses: [] as string[] };
    expect(sequenciaDetox(h, new Date(2026, 2, 8, 0, 30))).toBe(1);
    expect(sequenciaDetox(h, new Date(2026, 2, 8, 23, 30))).toBe(1);
    expect(sequenciaDetox(h, new Date(2026, 2, 9, 0, 0))).toBe(2);
  });

  it("fim do horário de verão (01/11: dia de 25 h) também", () => {
    process.env.TZ = "America/New_York";
    const h = { startDate: "2026-10-31", relapses: [] as string[] };
    expect(sequenciaDetox(h, new Date(2026, 10, 1, 23, 59))).toBe(1);
    expect(sequenciaDetox(h, new Date(2026, 10, 2, 0, 0))).toBe(2);
  });

  it("fuso POSITIVO (Tóquio): a conta antiga ficava 1 dia ATRÁS de madrugada", () => {
    process.env.TZ = "Asia/Tokyo";
    const agora = new Date(2026, 8, 26, 3, 0);
    expect(sequenciaDetox({ startDate: "2026-09-20", relapses: [] }, agora)).toBe(6);
    expect(contaAntigaUtc("2026-09-20", agora)).toBe(5); // o bug, do outro lado do mundo
  });

  it("quem viaja: o dia é o do calendário de ONDE a pessoa está", () => {
    process.env.TZ = "Europe/Lisbon";
    expect(sequenciaDetox({ startDate: "2026-09-20", relapses: [] }, new Date(2026, 8, 26, 22, 30))).toBe(6);
  });
});

describe("1c. as abas do Detox mostram o MESMO número às 22h30", () => {
  // começou dia 20; às 22h30 do dia 26 são 6 dias — a conta UTC dizia 7 e abria "1 Semana"
  const habitos = [{ id: "a", name: "Instagram", icon: "📱", startDate: "2026-09-20", createdAt: "2026-09-20", relapses: [], record: 0, checkins: [] }];

  it("Rastreador, Conquistas e Stats concordam (6), e o marco de 7 dias segue fechado", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 26, 22, 30), toFake: ["Date"] });
    const store = criarStore({ "detox-habits": habitos });

    const r1 = renderCom(<DetoxTracker />, store);
    expect(screen.getByText(/6 dias/)).toBeInTheDocument();
    expect(screen.getByText(/Recorde: 6/)).toBeInTheDocument();
    r1.unmount();

    const r2 = renderCom(<DetoxStats />, store);
    const maior = screen.getByText("Maior streak ativo").parentElement!;
    expect(within(maior).getByText("6")).toBeInTheDocument();
    r2.unmount();

    renderCom(<DetoxAchievements />, store);
    expect(screen.getByText("2/9")).toBeInTheDocument(); // 1 e 3 dias; 7 ainda não
    expect(screen.getByText("1 Semana").closest("div")?.parentElement?.className).toMatch(/opacity-40/);
  });
});

describe("2. ação rápida 'Check-in Detox' pelo id", () => {
  const hoje = "2026-09-28";

  it("chave = id; hábito antigo sem id cai na posição", () => {
    expect(chaveDoHabito({ id: "abc" }, 3)).toBe("abc");
    expect(chaveDoHabito({ id: 17 }, 3)).toBe("17");
    expect(chaveDoHabito({ name: "sem id" }, 3)).toBe("#3");
    expect(chaveDoHabito({ id: "" }, 0)).toBe("#0");
  });

  it("dois hábitos com o mesmo nome: só o tocado recebe o check-in", () => {
    const lista = [
      { id: "m", name: "Redes sociais", checkins: [] as string[] },
      { id: "n", name: "Redes sociais", checkins: [] as string[] },
    ];
    const depois = marcarCheckin(lista, "n", hoje);
    expect(depois[0].checkins).toEqual([]);
    expect(depois[1].checkins).toEqual([hoje]);
    // um por dia, e o formato antigo (objeto) vira lista
    expect(marcarCheckin(depois, "n", hoje)[1].checkins).toEqual([hoje]);
    expect(marcarCheckin([{ id: "x", checkins: { "2026-09-27": 1 } }], "x", hoje)[0].checkins).toEqual(["2026-09-27", hoje]);
  });

  it("na Home: tocar no 2º 'Redes sociais' marca só ele", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 21, 0), toFake: ["Date"] });
    const store = criarStore({
      "detox-habits": [
        { id: "m", name: "Redes sociais", icon: "📱", startDate: "2026-09-20", relapses: [], record: 0, checkins: [] },
        { id: "n", name: "Redes sociais", icon: "📱", startDate: "2026-09-25", relapses: [], record: 0, checkins: [] },
        { name: "Doce (sem id, de versão antiga)", icon: "🍫", startDate: "2026-09-25", relapses: [], record: 0 },
      ],
    });
    const r = renderCom(<QuickActions />, store);
    fireEvent.click(screen.getByRole("button", { name: /Check-in Detox/ }));
    const botoes = screen.getAllByRole("button", { name: /Redes sociais/ });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[1]);
    const salvos = store.dados["detox-habits"] as { id?: string; checkins?: string[] }[];
    expect(salvos[0].checkins).toEqual([]);
    expect(salvos[1].checkins).toEqual([hoje]);
    expect(salvos[2].checkins).toBeUndefined();
    r.unmount(); // o botão fica "Feito!" por 1,5 s — abre de novo do zero

    // o hábito sem id também funciona (pela posição) e não mexe nos outros
    renderCom(<QuickActions />, store);
    fireEvent.click(screen.getByRole("button", { name: /Check-in Detox/ }));
    fireEvent.click(screen.getByRole("button", { name: /Doce/ }));
    const depois = store.dados["detox-habits"] as { checkins?: string[] }[];
    expect(depois[2].checkins).toEqual([hoje]);
    expect(depois[0].checkins).toEqual([]);
  });
});
