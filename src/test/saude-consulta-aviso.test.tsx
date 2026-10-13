/**
 * A linha "🔔 Aviso 1 dia antes e 2 h antes" na consulta e o pedido de
 * permissão no cadastro (13/10). App da loja simulado; o agendador é mockado
 * (a conta das datas está em consulta-avisos.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";

const permissao = vi.hoisted(() => ({ tem: true, pedir: vi.fn(async () => true) }));
const reagendar = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => ({})));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => true, isAndroid: () => false, plataformaApp: () => "ios" }));
vi.mock("@/lib/notificacoes", () => ({ temPermissao: async () => permissao.tem, pedirPermissao: permissao.pedir }));
vi.mock("@/lib/reagendar", () => ({ reagendarTudo: reagendar }));
vi.mock("@/lib/calendario", () => ({ adicionarAoCalendario: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, storage: { from: () => ({}) } } }));

import { MedicalLog } from "@/components/saude/MedicalLog";

const montar = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  render(<UserDataContext.Provider value={valor}><MedicalLog /></UserDataContext.Provider>);
  return dados;
};

const agora = new Date(2026, 9, 13, 10, 0);
const consultas = [
  { id: "c1", doctor: "Dr. Hélio", specialty: "Neurologia", date: "2026-10-20", time: "14:30", address: "", questions: "" },
  { id: "c2", doctor: "Dra. Camila", specialty: "Médica da família", date: "2026-10-22", time: "", address: "", questions: "" },
  { id: "c3", doctor: "Dr. Antigo", specialty: "Clínico geral", date: "2026-09-01", time: "09:00", address: "", questions: "" },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(agora);
  permissao.tem = true;
  permissao.pedir.mockClear().mockResolvedValue(true);
  reagendar.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe("linha do aviso na consulta", () => {
  it("com horário: 1 dia antes e 2 h antes; sem horário: só a véspera; passada: nada", async () => {
    montar({ "core-saude-appointments": consultas });
    await waitFor(() => expect(screen.getAllByTestId("consulta-aviso")).toHaveLength(2));
    const linhas = screen.getAllByTestId("consulta-aviso").map((l) => [l.closest("td")!.textContent!.split("🔔")[0], l.textContent]);
    expect(linhas).toEqual([
      [expect.stringContaining("Dra. Camila"), "🔔 Aviso 1 dia antes, às 19h"],
      [expect.stringContaining("Dr. Hélio"), "🔔 Aviso 1 dia antes e 2 h antes"],
    ]);
  });

  it("sem permissão ou com o aviso desligado na central: a linha não promete nada", async () => {
    permissao.tem = false;
    montar({ "core-saude-appointments": consultas });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("consulta-aviso")).toBeNull();
  });

  it("desligado na central (notif-consultas-ligado = false): nenhuma linha", async () => {
    montar({ "core-saude-appointments": consultas, "notif-consultas-ligado": false });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("consulta-aviso")).toBeNull();
  });
});

describe("cadastro pede a permissão e arma os avisos", () => {
  it("consulta futura nova: pede a permissão (se ainda não tem) e reagenda com a lista NOVA", async () => {
    permissao.tem = false;
    const dados = montar({ "core-saude-appointments": [] });
    fireEvent.click(screen.getByRole("button", { name: /Nova Consulta/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome do médico"), { target: { value: "Dr. Hélio" } });
    const data = document.querySelector('[data-testid="campo-data"] input, input[type="date"]') as HTMLInputElement;
    fireEvent.change(data, { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Consulta" }));
    await waitFor(() => expect(reagendar).toHaveBeenCalledTimes(1));
    expect(permissao.pedir).toHaveBeenCalledTimes(1);
    const leitor = reagendar.mock.calls[0][0] as (k: string, fb: unknown) => unknown;
    expect(leitor("core-saude-appointments", [])).toEqual([expect.objectContaining({ doctor: "Dr. Hélio", date: "2026-10-20" })]);
    expect(dados["core-saude-appointments"]).toHaveLength(1);
  });

  it("negou a permissão: não agenda nada", async () => {
    permissao.tem = false;
    permissao.pedir.mockResolvedValue(false);
    montar({ "core-saude-appointments": [] });
    fireEvent.click(screen.getByRole("button", { name: /Nova Consulta/ }));
    fireEvent.change(screen.getByPlaceholderText("Nome do médico"), { target: { value: "Dr. Hélio" } });
    const data = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(data, { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Consulta" }));
    await waitFor(() => expect(permissao.pedir).toHaveBeenCalledTimes(1));
    expect(reagendar).not.toHaveBeenCalled();
  });

  it("remarcar (editar a data) refaz a série com a data nova", async () => {
    montar({ "core-saude-appointments": [consultas[0]] });
    await waitFor(() => expect(screen.getByTestId("consulta-aviso")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Editar consulta com Dr. Hélio" }));
    const data = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(data, { target: { value: "2026-10-27" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(reagendar).toHaveBeenCalledTimes(1));
    const leitor = reagendar.mock.calls[0][0] as (k: string, fb: unknown) => unknown;
    expect(leitor("core-saude-appointments", [])).toEqual([expect.objectContaining({ id: "c1", date: "2026-10-27" })]);
    expect(permissao.pedir).not.toHaveBeenCalled(); // já tinha
  });
});
