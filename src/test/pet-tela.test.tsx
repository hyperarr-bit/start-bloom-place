/**
 * PET — as telas (29/09). O que trava aqui:
 *  1. o formato do app ANTIGO abre (RG, carteirinha, rotina) e ABRIR NÃO GRAVA nada;
 *  2. o começo pronto (3 perguntas) grava o pet, a rotina da espécie e a carteirinha
 *     sugerida — nas chaves e formatos de sempre (+ a chave nova do plano);
 *  3. marcar a rotina, "Feito hoje", lançar gasto e pesar gravam no formato de sempre
 *     (pet-routine-<dia> objeto; pet-health, pet-expenses listas; weight texto);
 *  4. o ciclo: usar → sair → REABRIR (desmontar e montar com o mesmo store) mantém tudo;
 *  5. o widget da Home marca a mesma chave do módulo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import Pet from "@/pages/Pet";
import { PetWidget } from "@/components/home/widgets/PetWidget";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ isSubscribed: true, user: null }) }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));

const HOJE = "2026-09-29";
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 8, 29, 9, 0)); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

/** Store em memória que sobrevive ao desmontar (é o "servidor" do teste). `escritasDeDado` deixa de fora
 *  o carimbo "spotlight-done-pet" que o tutorial compartilhado (SpotlightOverlay) grava em TODO módulo
 *  pra quem já tem conta — é ajuste de interface, não dado (e não conta como dia anotado). */
const criarStore = (inicial: Record<string, unknown>) => {
  const dados: Record<string, unknown> = JSON.parse(JSON.stringify(inicial));
  const escritas: string[] = [];
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [, setVersao] = useState(0);
    const ref = useRef(dados);
    const [n, setN] = useState(0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in ref.current ? (ref.current[k] as T) : f), [n]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { ref.current[k] = v; escritas.push(k); setN((x) => x + 1); setVersao((x) => x + 1); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  const montar = (ui: ReactNode = <Pet />) => render(<MemoryRouter initialEntries={["/pet"]}><Provedor>{ui}</Provedor></MemoryRouter>);
  const escritasDeDado = () => escritas.filter((k) => !k.startsWith("spotlight-"));
  return { dados, escritas, escritasDeDado, montar };
};

const ANTIGO = {
  "pet-list": [
    { id: "1727000000000", name: "Thor", species: "cachorro", breed: "Golden", weight: "28 kg", birthday: "2021-04-15" },
    { id: "1727000000001", name: "Mia", species: "gata", breed: "", weight: "4,2", birthday: "" },
  ],
  "pet-health": [
    { id: "h1", petId: "1727000000000", type: "vaccine", name: "V10", date: "2025-10-24", nextDate: "2026-10-24" },
    { id: "h2", petId: "1727000000000", type: "deworming", name: "Drontal", date: "2026-06-26", nextDate: "2026-09-24" },
    { id: "h3", petId: "1727000000000", type: "deworming", name: "Bravecto", date: "2026-07-11", nextDate: "2026-10-03" },
  ],
  [`pet-routine-${HOJE}`]: { "1727000000000": { food: true, walk: true, bath: false } },
  "pet-expenses": [{ id: "g1", petId: "1727000000000", category: "Ração", description: "Ração 15 kg", value: 189.9, date: "2026-09-27" }],
  "pet-diary": [{ id: "e1", petName: "Thor", date: "2026-09-28T15:00:00.000Z", text: "Passeio longo.", mood: "😊" }],
};

describe("formato antigo", () => {
  it("abre o RG, a rotina e a carteirinha do app antigo — e abrir não grava nada", () => {
    const s = criarStore(ANTIGO);
    s.montar();
    const rg = screen.getByTestId("rg-do-pet");
    expect(within(rg).getByText("Thor")).toBeInTheDocument();
    expect(within(rg).getByText("28 kg")).toBeInTheDocument();
    expect(within(rg).getByText("Golden")).toBeInTheDocument();
    // a rotina de hoje com o passeio marcado no app antigo
    expect(screen.getByRole("checkbox", { name: /Desmarcar Passeio/ })).toHaveAttribute("aria-checked", "true");
    // a carteirinha: vermífugo venceu, Bravecto (gravado como "Vermífugo") vira ANTIPULGAS
    expect(screen.getByText("Drontal")).toBeInTheDocument();
    expect(screen.getByText("venceu há 5 dias")).toBeInTheDocument();
    expect(screen.getByText("Bravecto")).toBeInTheDocument();
    expect(screen.getAllByText("ANTIPULGAS").length).toBeGreaterThan(0);
    expect(s.escritasDeDado()).toEqual([]);
  });

  it("a aba SAÚDE mostra o histórico antigo com carimbo; GASTOS e DIÁRIO abrem como eram", () => {
    const s = criarStore(ANTIGO);
    s.montar();
    fireEvent.click(screen.getByTestId("aba-saude"));
    expect(screen.getByText("V10")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("aba-gastos"));
    expect(screen.getByTestId("gastos-total")).toHaveTextContent("189,90");
    fireEvent.click(screen.getByTestId("aba-diario"));
    expect(screen.getByText("Passeio longo.")).toBeInTheDocument();
    expect(s.escritasDeDado()).toEqual([]);
  });
});

describe("começo pronto", () => {
  it("3 perguntas → pet, rotina da espécie e carteirinha sugerida, nos formatos de sempre", () => {
    const s = criarStore({});
    s.montar();
    expect(screen.getByTestId("comeco-pronto")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("especie-cao"));
    fireEvent.change(screen.getByTestId("pet-nome"), { target: { value: "Paçoca" } });
    fireEvent.click(screen.getByRole("button", { name: "Fêmea" }));
    fireEvent.click(screen.getByTestId("pet-seguir-2"));
    fireEvent.click(screen.getByTestId("faixa-adulto"));
    fireEvent.click(screen.getByTestId("pet-seguir-3"));
    expect(screen.getByText("V8 ou V10")).toBeInTheDocument();
    // desmarca o antipulgas (gato de apartamento, por ex.) antes de criar
    fireEvent.click(screen.getByRole("checkbox", { name: "Antipulgas e carrapatos" }));
    fireEvent.click(screen.getByTestId("pet-criar"));

    const pets = s.dados["pet-list"] as Record<string, unknown>[];
    expect(Array.isArray(pets)).toBe(true);
    expect(pets).toHaveLength(1);
    expect(pets[0]).toMatchObject({ name: "Paçoca", species: "Cachorro", breed: "", weight: "", birthday: "", sexo: "femea", faixa: "adulto" });
    const id = String(pets[0].id);
    const tarefas = s.dados[`pet-routine-tasks-${id}`] as { id: string }[];
    expect(Array.isArray(tarefas)).toBe(true);
    expect(tarefas.map((t) => t.id)).toContain("walk");
    const cuidados = s.dados["pet-cuidados"] as { nome: string; sugerido: boolean; petId: string }[];
    expect(cuidados.map((c) => c.nome)).toEqual(["V8 ou V10", "Antirrábica", "Vermífugo", "Check-up"]);
    expect(cuidados.every((c) => c.sugerido && c.petId === id)).toBe(true);
    // nada de data inventada no histórico
    expect(s.dados["pet-health"]).toBeUndefined();
    // a tela já é a do pet novo
    expect(within(screen.getByTestId("rg-do-pet")).getByText("Paçoca")).toBeInTheDocument();
    expect(screen.getByText(/4 cuidados sem data/)).toBeInTheDocument();
  });
});

const COM_PET = {
  "pet-list": [{ id: "p1", name: "Caramelo", species: "Cachorro", breed: "Vira-lata", weight: "18,4", birthday: "2023-07-20", sexo: "macho" }],
  "pet-cuidados": [{ id: "c-pulga", petId: "p1", tipo: "antipulgas", nome: "NexGard", intervaloDias: 30 }],
  "pet-health": [{ id: "r5", petId: "p1", type: "antipulgas", name: "NexGard", date: "2026-08-28", nextDate: "2026-09-27", cuidadoId: "c-pulga" }],
};

describe("usar, sair e reabrir", () => {
  it("marcar a rotina, 'Feito hoje' e pesar: formatos de sempre, e tudo continua lá ao reabrir", () => {
    const s = criarStore(COM_PET);
    const primeira = s.montar();
    fireEvent.click(screen.getByRole("checkbox", { name: "Marcar Passeio" }));
    expect(s.dados[`pet-routine-${HOJE}`]).toEqual({ p1: { walk: true } });

    fireEvent.click(screen.getByTestId("feito-c-pulga"));
    const regs = s.dados["pet-health"] as Record<string, unknown>[];
    expect(regs).toHaveLength(2);
    expect(regs[0]).toMatchObject({ id: "r5" }); // o antigo continua
    expect(regs[1]).toMatchObject({ petId: "p1", type: "antipulgas", name: "NexGard", date: HOJE, nextDate: "2026-10-29", cuidadoId: "c-pulga" });

    fireEvent.click(screen.getByTestId("aba-saude"));
    fireEvent.change(screen.getByTestId("peso-input"), { target: { value: "18,9" } });
    fireEvent.click(screen.getByTestId("peso-salvar"));
    expect((s.dados["pet-list"] as { weight: unknown }[])[0].weight).toBe("18,9");
    expect(s.dados["pet-pesos"]).toEqual({ p1: [{ dia: HOJE, kg: 18.9 }] });

    // sair…
    primeira.unmount();
    // …e reabrir com o que ficou gravado
    s.montar();
    expect(screen.getByRole("checkbox", { name: "Desmarcar Passeio" })).toHaveAttribute("aria-checked", "true");
    expect(within(screen.getByTestId("rg-do-pet")).getByText("18,9 kg")).toBeInTheDocument();
    // o NexGard saiu de "venceu": agora a próxima é daqui a 30 dias (não aparece mais o botão cheio)
    expect(screen.queryByTestId("feito-c-pulga")).toBeNull();

    // as chaves de sempre não mudaram de tipo
    expect(Array.isArray(s.dados["pet-list"])).toBe(true);
    expect(Array.isArray(s.dados["pet-health"])).toBe(true);
    expect(typeof s.dados[`pet-routine-${HOJE}`]).toBe("object");
    expect(Array.isArray(s.dados[`pet-routine-${HOJE}`])).toBe(false);
  });

  it("GASTOS: lançar pela folha grava o valor como número, na data de hoje", () => {
    const s = criarStore(COM_PET);
    s.montar();
    fireEvent.click(screen.getByTestId("aba-gastos"));
    fireEvent.click(screen.getByTestId("gasto-novo"));
    fireEvent.change(screen.getByTestId("gasto-valor"), { target: { value: "89,90" } });
    fireEvent.click(screen.getByTestId("gasto-salvar"));
    const gastos = s.dados["pet-expenses"] as Record<string, unknown>[];
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ petId: "p1", category: "Ração", value: 89.9, date: HOJE });
  });

  it("RG: renomear leva os momentos do diário junto (o diário guarda o nome)", () => {
    const s = criarStore({ ...COM_PET, "pet-diary": [{ id: "e1", petName: "Caramelo", date: "2026-09-28T15:00:00.000Z", text: "Oi", mood: "😊" }] });
    s.montar();
    fireEvent.click(screen.getByTestId("rg-do-pet"));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Caramelo Jr." } });
    fireEvent.click(screen.getByTestId("rg-salvar"));
    expect((s.dados["pet-list"] as { name: string }[])[0].name).toBe("Caramelo Jr.");
    expect((s.dados["pet-diary"] as { petName: string }[])[0].petName).toBe("Caramelo Jr.");
  });
});

describe("widget da Home", () => {
  it("mostra o dia do pet e marca na mesma chave do módulo", () => {
    const s = criarStore({ ...COM_PET, "pet-routine-tasks-p1": [{ id: "food", label: "Comida", emoji: "🥣" }, { id: "walk", label: "Passeio", emoji: "🦮" }] });
    s.montar(<PetWidget size="large" />);
    expect(screen.getByTestId("widget-pet")).toHaveTextContent("Caramelo");
    fireEvent.click(screen.getByRole("checkbox", { name: /Passeio/ }));
    expect(s.dados[`pet-routine-${HOJE}`]).toEqual({ p1: { walk: true } });
    // o antipulgas vencido aparece como chamada
    expect(screen.getByText(/NexGard: venceu há 2 dias/)).toBeInTheDocument();
  });
});

describe("avisos só no app (30/09: na web não aparece botão morto)", () => {
  afterEach(() => { delete (window as { Capacitor?: unknown }).Capacitor; });

  it("na WEB a SAÚDE mostra só o recado de onde o aviso mora (sem interruptor) e a dica não oferece aviso", () => {
    const s = criarStore({ ...COM_PET, "core-home-widgets-v2": [{ id: "pet", size: "large" }] });
    s.montar();
    // já está na Home: sem o convite dos avisos na web, a dica some
    expect(screen.queryByTestId("dica-avisos")).toBeNull();
    fireEvent.click(screen.getByTestId("aba-saude"));
    expect(screen.getByTestId("avisos-pet-so-no-app")).toHaveTextContent(/app do celular/);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(s.escritasDeDado()).toEqual([]);
  });

  it("no APP os interruptores aparecem, nascem desligados e gravam a chave nova (objeto)", () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    const s = criarStore({ ...COM_PET, "core-home-widgets-v2": [{ id: "pet", size: "large" }] });
    s.montar();
    expect(screen.getByTestId("dica-avisos")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("aba-saude"));
    const cuidados = screen.getByRole("switch", { name: "Avisos de vacina, vermífugo e antipulgas" });
    expect(cuidados).toHaveAttribute("aria-checked", "false");
    fireEvent.click(cuidados);
    expect(s.dados["pet-lembrete-prefs"]).toMatchObject({ cuidados: true, remedios: false });
  });
});
