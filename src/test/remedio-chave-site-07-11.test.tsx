/**
 * REMÉDIO DE VÁRIAS DOSES ATRÁS DE CHAVE NO SITE (07/11, 4ª rodada da crítica).
 *
 * O lembrete do celular é agendado pelo app do celular. A versão que está na loja não conhece
 * `ate` nem `inicio`: um 8 em 8 com fim cadastrado no site viraria, no celular antigo, aviso às
 * 08, 16 e 00 todo dia, pra sempre. Por isso "Quantas vezes" (além de 1×) e "Até quando" ficam
 * atrás da chave `REMEDIO_VEZES` (lib/remedio-vezes): LIGADA no app das lojas, DESLIGADA no site
 * até a build nova estar na loja. Sem a chave, o cadastro do site é o de sempre (1 horário).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCallback, useMemo, useReducer, type ReactNode } from "react";

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: "granted" }),
    requestPermissions: async () => ({ display: "granted" }),
    createChannel: async () => {},
    getPending: async () => ({ notifications: [] }),
    cancel: async () => {},
    schedule: async () => ({}),
    checkExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    changeExactNotificationSetting: async () => ({ exact_alarm: "granted" }),
    getDeliveredNotifications: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: () => {} }),
  },
}));
const plataforma = vi.hoisted(() => ({ nativo: false }));
const chave = vi.hoisted(() => ({ ligada: false }));
vi.mock("@/lib/remedio-vezes", async (orig) => {
  const real = await orig<typeof import("@/lib/remedio-vezes")>();
  return { ...real, remedioVezesLigado: () => chave.ligada || real.remedioVezesLigado() };
});
vi.mock("@/lib/native-shell", async (orig) => ({
  ...(await orig<typeof import("@/lib/native-shell")>()),
  isNativeShell: () => plataforma.nativo,
  isAndroid: () => plataforma.nativo,
  isIOS: () => false,
  plataformaApp: () => (plataforma.nativo ? "android" : "web"),
}));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));

import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";
import { REMEDIO_VEZES_APP, REMEDIO_VEZES_WEB, remedioVezesLigado } from "@/lib/remedio-vezes";
import { gerarHorarios, montarLinhas, type Remedio } from "@/lib/remedios";

type Dados = Record<string, unknown>;
function criarStore(inicial: Dados) {
  const estado = { dados: { ...inicial } as Dados };
  const Provedor = ({ children }: { children: ReactNode }) => {
    const [versao, subir] = useReducer((x: number) => x + 1, 0);
    const get = useCallback(<T,>(k: string, f: T): T => (k in estado.dados ? (estado.dados[k] as T) : f), [versao]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = useCallback((k: string, v: unknown) => { estado.dados = { ...estado.dados, [k]: v }; subir(); }, []);
    const valor = useMemo<UserDataContextType>(() => ({ get, set, loaded: true, isGuest: false, fetchKey: async () => null }), [get, set]);
    return <UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider>;
  };
  return { estado, Provedor };
}
const CHAVE = "core-saude-supplements";
const montar = (store: ReturnType<typeof criarStore>) =>
  render(<MemoryRouter><store.Provedor><PharmacyChecklist /></store.Provedor></MemoryRouter>);

beforeEach(() => { plataforma.nativo = false; chave.ligada = false; });
afterEach(() => { cleanup(); });

describe("a chave REMEDIO_VEZES", () => {
  it("build 1.0.25/137 (10/11): desligada no app e no site — o remédio novo tem problema aberto (J1–J3)", () => {
    expect(REMEDIO_VEZES_APP).toBe("off");
    expect(REMEDIO_VEZES_WEB).toBe("off");
    expect(remedioVezesLigado()).toBe(false);
    plataforma.nativo = true;
    expect(remedioVezesLigado()).toBe(false);
  });

  it("no app desta build, com a chave desligada: o cadastro de sempre (1 horário)", () => {
    plataforma.nativo = true;
    montar(criarStore({}));
    expect(screen.queryByRole("button", { name: "8 em 8" })).toBeNull();
    expect(screen.queryByTestId("remedio-ate")).toBeNull();
  });

  it("no site, sem a chave: só o cadastro de sempre — sem 'Quantas vezes', sem 'Até quando', sem o aviso", () => {
    const store = criarStore({});
    montar(store);
    expect(screen.queryByRole("group", { name: "Quantas vezes por dia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "8 em 8" })).toBeNull();
    expect(screen.queryByTestId("remedio-ate")).toBeNull();
    expect(screen.queryByTestId("remedio-aviso-app")).toBeNull();
    expect(screen.queryByTestId("remedio-comeca")).toBeNull();
    // o horário único de sempre, ao lado do nome
    fireEvent.change(screen.getByPlaceholderText("Novo remédio ou suplemento..."), { target: { value: "Vitamina D" } });
    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar remédio" }));
    const salvas = store.estado.dados[CHAVE] as Remedio[];
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ name: "Vitamina D", time: "09:00", stock: 30, dosesPerDay: 1 });
    expect(salvas[0]).not.toHaveProperty("grupo");
    expect(salvas[0]).not.toHaveProperty("ate");
    expect(salvas[0]).not.toHaveProperty("inicio");
  });

  it("no site, um 8 em 8 cadastrado no app novo continua aparecendo e marcando; não dá pra pôr data de fim nele", () => {
    const novas = montarLinhas({ name: "Amoxicilina", stock: 21 }, gerarHorarios("08:00", 3), undefined, new Date(2026, 10, 7, 7).getTime());
    montar(criarStore({ [CHAVE]: novas }));
    expect(screen.getByTestId(`dose-${novas[0].id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar horários de Amoxicilina" }));
    expect(screen.getByLabelText("Horário de Amoxicilina (1ª dose)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Até quando de Amoxicilina")).toBeNull();
  });

  it("no app das lojas, com a chave ligada: 'Quantas vezes' e 'Até quando' aparecem, sem o aviso de atualizar", () => {
    plataforma.nativo = true;
    chave.ligada = true;
    montar(criarStore({}));
    expect(screen.getByRole("button", { name: "8 em 8" })).toBeInTheDocument();
    expect(screen.getByTestId("remedio-ate")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "8 em 8" }));
    expect(screen.getByTestId("remedio-comeca")).toBeInTheDocument();
    expect(screen.queryByTestId("remedio-aviso-app")).toBeNull();
  });
});
