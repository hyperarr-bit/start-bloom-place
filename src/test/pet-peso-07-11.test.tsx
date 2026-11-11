/**
 * PESO DO PET — apagar pesagem errada (bug pet-peso, 07/11, chamado 18cc19fe).
 *
 * Pesagem digitada errada não saía: a do mesmo dia dava pra trocar pesando de novo, a de
 * outro dia ficava pra sempre no gráfico e no RG. O que trava aqui:
 *  1. a lixeira tira só aquele dia, em todo lugar que lê o peso;
 *  2. `weight` (o campo de sempre) ACOMPANHA quando sai a pesagem mais nova: se ficasse,
 *     `pesosDoPet` lia a diferença como "mudou no app antigo" e o valor apagado voltava;
 *  3. `weight` mudado no app antigo depois da última pesagem NÃO é a pesagem: fica;
 *  4. o ciclo usar → sair → REABRIR; Desfazer devolve o que estava lá, sem atropelar
 *     o que a pessoa fez depois.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Pet from "@/pages/Pet";
import { avisarApagado } from "@/lib/desfazer";
import { pesosDoPet, petsValidos, semPeso } from "@/lib/pet";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/lib/desfazer", async (orig) => ({ ...(await orig<typeof import("@/lib/desfazer")>()), avisarApagado: vi.fn() }));

const HOJE = "2026-09-29";
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 29, 9, 0)); vi.mocked(avisarApagado).mockClear(); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

/** Store em memória que sobrevive ao desmontar (o "servidor" do teste). O `get` é RETRATO do último desenho,
 *  como o de verdade (use-user-data: `useCallback(..., [store])`): quem guarda o `get` num toast lê o passado. */
const criarStore = (inicial: Record<string, unknown>) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [store, setStore] = useState(() => ({ ...dados }));
    const get = useCallback(<T,>(k: string, f: T): T => (k in store ? (store[k] as T) : f), [store]);
    const set = useCallback((k: string, v: unknown) => { dados[k] = v; setStore((x) => ({ ...x, [k]: v })); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = () => {
    const r = render(<MemoryRouter initialEntries={["/pet"]}><Provedor><Pet /></Provedor></MemoryRouter>);
    fireEvent.click(screen.getByTestId("aba-saude"));
    return r;
  };
  return { dados, montar };
};

const comPesos = (weight: string, pesos: { dia: string; kg: number }[], extra: Record<string, unknown> = {}) => ({
  "pet-list": [
    { id: "p1", name: "Caramelo", species: "Cachorro", breed: "Vira-lata", weight, birthday: "2023-07-20", campoDoFuturo: "fica", ...extra },
    { id: "p2", name: "Frida", species: "Gata", breed: "", weight: "4,1", birthday: "" },
  ],
  "pet-pesos": { p1: pesos, p2: [{ dia: "2026-09-26", kg: 4.1 }] },
});

const TRES = [{ dia: "2026-08-01", kg: 18 }, { dia: "2026-09-01", kg: 18.4 }, { dia: "2026-09-20", kg: 184 }];

const abrirPesagens = () => fireEvent.click(screen.getByTestId("peso-ver-pesagens"));
const lixeira = (data: string) => screen.getByRole("button", { name: `Apagar a pesagem de ${data}` });
const desfazer = (i = 0) => act(() => { vi.mocked(avisarApagado).mock.calls[i][1](); });
/** O peso grande do card PESO, como a pessoa lê: "18,4 kg". */
const peso = () => {
  const p = document.querySelector('[data-card="PESO"] p.tabular-nums');
  return p ? `${p.firstChild?.textContent} ${p.querySelector("span")?.textContent}` : null;
};
/** O peso no RG, que mora na aba HOJE. */
const pesoNoRg = () => {
  fireEvent.click(screen.getByTestId("aba-hoje"));
  const rg = screen.getByTestId("rg-do-pet");
  fireEvent.click(screen.getByTestId("aba-saude"));
  return rg.textContent;
};
const weightDe = (s: { dados: Record<string, unknown> }) => (s.dados["pet-list"] as { weight: string }[])[0].weight;
const pesosDe = (s: { dados: Record<string, unknown> }) => (s.dados["pet-pesos"] as Record<string, { dia: string; kg: number }[]>).p1;
/** O que qualquer tela enxerga depois: a mesma leitura do RG, da carteirinha e do card. */
const serieDe = (s: { dados: Record<string, unknown> }) => pesosDoPet(petsValidos(s.dados["pet-list"])[0], s.dados["pet-pesos"]);

describe("apagar a pesagem errada", () => {
  it("a mais nova: sai do histórico, o weight volta pra anterior e o valor apagado não reaparece ao reabrir", () => {
    const s = criarStore(comPesos("184", TRES));
    const aberta = s.montar();
    expect(peso()).toBe("184 kg");
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));

    expect(pesosDe(s)).toEqual(TRES.slice(0, 2));
    expect(weightDe(s)).toBe("18,4");
    expect(serieDe(s)).toEqual(TRES.slice(0, 2)); // sem o ponto sem data de 184
    expect(peso()).toBe("18,4 kg");
    expect(avisarApagado).toHaveBeenCalledWith("Pesagem de 20/09 apagada", expect.any(Function));

    aberta.unmount();
    s.montar();
    expect(peso()).toBe("18,4 kg");
    const rg = pesoNoRg();
    expect(rg).toContain("18,4 kg");
    expect(rg).not.toContain("184");
  });

  it("uma do meio: o weight e o peso atual não mudam, e o pet-list nem é regravado", () => {
    const s = criarStore(comPesos("18,4", [TRES[0], { dia: "2026-08-15", kg: 81 }, TRES[1]]));
    s.montar();
    const listaAntes = s.dados["pet-list"];
    abrirPesagens();
    fireEvent.click(lixeira("15/08/2026"));
    expect(pesosDe(s)).toEqual([TRES[0], TRES[1]]);
    expect(s.dados["pet-list"]).toBe(listaAntes);
    expect(peso()).toBe("18,4 kg");
  });

  it("a única pesagem: weight fica vazio (senão o valor volta como ponto sem data) e a tela pede o peso", () => {
    const s = criarStore(comPesos("184", [TRES[2]]));
    const aberta = s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    expect(pesosDe(s)).toEqual([]);
    expect(weightDe(s)).toBe("");
    expect(typeof weightDe(s)).toBe("string"); // o tipo de sempre
    expect(serieDe(s)).toEqual([]);
    expect(screen.getByText(/Sem peso ainda/)).toBeInTheDocument();
    expect(screen.queryByTestId("peso-ver-pesagens")).toBeNull();

    aberta.unmount();
    s.montar();
    expect(screen.getByText(/Sem peso ainda/)).toBeInTheDocument();
  });

  it("weight mudado no app antigo depois da última pesagem é outro dado: apagar a pesagem não mexe nele", () => {
    const s = criarStore(comPesos("31", TRES));
    s.montar();
    expect(peso()).toBe("31 kg");
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    expect(weightDe(s)).toBe("31");
    expect(peso()).toBe("31 kg");
  });

  it("weight em texto livre do app antigo ('18 kg', '65 g') também acompanha", () => {
    const s = criarStore(comPesos("65 g", [{ dia: "2026-09-01", kg: 0.06 }, { dia: "2026-09-20", kg: 0.065 }]));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    expect(weightDe(s)).toBe("0,06");
    expect(peso()).toBe("60 g");
  });

  it("não toca no outro pet nem nos campos do item (campo que uma versão futura pôs fica)", () => {
    const s = criarStore(comPesos("184", TRES));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    const [p1, p2] = s.dados["pet-list"] as Record<string, unknown>[];
    expect(p1.campoDoFuturo).toBe("fica");
    expect(p1.birthday).toBe("2023-07-20");
    expect(p2.weight).toBe("4,1");
    expect((s.dados["pet-pesos"] as Record<string, unknown>).p2).toEqual([{ dia: "2026-09-26", kg: 4.1 }]);
  });

  it("nascimento gravado fora do formato continua como estava (a escrita parte do valor bruto)", () => {
    const s = criarStore(comPesos("184", TRES, { birthday: "20/07/2023" }));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    expect((s.dados["pet-list"] as Record<string, unknown>[])[0].birthday).toBe("20/07/2023");
  });

  it("abrir a lista não grava nada", () => {
    const s = criarStore(comPesos("18,4", TRES.slice(0, 2)));
    s.montar();
    const antes = JSON.stringify(s.dados);
    abrirPesagens();
    expect(JSON.stringify(s.dados)).toBe(antes);
  });

  it("pet sem pesagem com data (só o weight antigo): não há lista pra apagar, e pesar hoje continua trocando", () => {
    const s = criarStore({ "pet-list": [{ id: "p1", name: "Caramelo", species: "Cachorro", breed: "", weight: "28 kg", birthday: "" }] });
    s.montar();
    expect(screen.queryByTestId("peso-ver-pesagens")).toBeNull();
    expect(peso()).toBe("28 kg");
  });
});

describe("semPeso, com o que vier gravado", () => {
  const pet = petsValidos([{ id: "p1", name: "Thor", species: "Cachorro", breed: "", weight: "28 kg", birthday: "" }])[0];

  it("sem mapa ou sem pesagem no dia: não inventa nada e o weight fica", () => {
    expect(semPeso(pet, undefined, "2026-09-01")).toEqual({ pesos: {}, weight: "28 kg", kg: undefined, acompanhava: false });
    expect(semPeso(pet, "lixo", "2026-09-01").weight).toBe("28 kg");
    expect(semPeso(pet, { p1: [{ dia: "2026-09-02", kg: 28 }] }, "2026-09-01")).toEqual({ pesos: { p1: [{ dia: "2026-09-02", kg: 28 }] }, weight: "28 kg", kg: undefined, acompanhava: false });
  });

  it("item que não se lê continua no bruto", () => {
    const lixo = { dia: "ontem", kg: 3 };
    expect(semPeso(pet, { p1: [lixo, { dia: "2026-09-02", kg: 28 }] }, "2026-09-02").pesos.p1).toEqual([lixo]);
  });
});

describe("Desfazer", () => {
  it("devolve a pesagem e o weight como estavam", () => {
    const s = criarStore(comPesos("184 kg", TRES));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    desfazer();
    expect(pesosDe(s)).toEqual(TRES);
    expect(weightDe(s)).toBe("184 kg");
    expect(peso()).toBe("184 kg");
  });

  it("a única pesagem volta com o weight dela", () => {
    const s = criarStore(comPesos("184", [TRES[2]]));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    desfazer();
    expect(pesosDe(s)).toEqual([TRES[2]]);
    expect(weightDe(s)).toBe("184");
  });

  it("apagou e pesou hoje antes de desfazer: a antiga volta pro histórico, mas o peso atual é o de hoje", () => {
    const s = criarStore(comPesos("184", TRES));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("20/09/2026"));
    fireEvent.change(screen.getByTestId("peso-input"), { target: { value: "18,6" } });
    fireEvent.click(screen.getByTestId("peso-salvar"));
    desfazer();
    expect(pesosDe(s).map((p) => p.dia)).toEqual(["2026-08-01", "2026-09-01", "2026-09-20", HOJE]);
    expect(weightDe(s)).toBe("18,6");
    expect(peso()).toBe("18,6 kg");
  });

  it("apagou a de hoje e pesou de novo hoje: Desfazer não troca o peso certo pelo errado", () => {
    const s = criarStore(comPesos("184", [TRES[1], { dia: HOJE, kg: 184 }]));
    s.montar();
    abrirPesagens();
    fireEvent.click(lixeira("29/09/2026"));
    fireEvent.change(screen.getByTestId("peso-input"), { target: { value: "18,6" } });
    fireEvent.click(screen.getByTestId("peso-salvar"));
    desfazer();
    expect(pesosDe(s)).toEqual([TRES[1], { dia: HOJE, kg: 18.6 }]);
    expect(weightDe(s)).toBe("18,6");
  });

  it("duas apagadas, desfeitas em qualquer ordem: histórico e weight terminam como começaram", () => {
    for (const ordem of [[0, 1], [1, 0]]) {
      vi.mocked(avisarApagado).mockClear();
      const s = criarStore(comPesos("184", TRES));
      const aberta = s.montar();
      abrirPesagens();
      fireEvent.click(lixeira("20/09/2026"));
      fireEvent.click(lixeira("01/09/2026"));
      expect(weightDe(s)).toBe("18");
      ordem.forEach((i) => desfazer(i));
      expect(pesosDe(s)).toEqual(TRES);
      expect(weightDe(s)).toBe("184");
      expect(serieDe(s)).toEqual(TRES);
      aberta.unmount();
    }
  });
});
