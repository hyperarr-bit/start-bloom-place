/**
 * A PRÉ-FOLHA DA PERMISSÃO + o hook de abertura (03/10, Lembrete do dia 2).
 *   · depois do 1º registro do dia 1 (core:activation), com a permissão ainda não decidida, aparece
 *     "Quer que eu te lembre amanhã às HH:MM?" com a hora de verdade e a prévia do texto;
 *   · "Sim" pede a permissão (origem pre_folha) e avisa o reagendador; "Agora não" grava e não insiste;
 *   · não aparece: fora do app, com o passo da missão na tela (a comemoração pede), do dia 3 em diante,
 *     já pedida/adiada, permissão já decidida;
 *   · o hook useLembreteDia2: na abertura (app, logado) sincroniza e conta as entregues; na web, nada.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); } }));
const conta = vi.hoisted(() => ({ created_at: new Date(2026, 9, 3, 9, 0).toISOString() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: conta.created_at }, isSubscribed: true }) }));
const notif = vi.hoisted(() => ({
  permissao: "prompt" as "prompt" | "granted" | "denied" | "indisponivel",
  pedirDia2: vi.fn(async (_o: string) => "concedeu" as const),
  adiar: vi.fn((_o: string) => {}),
  sincronizar: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
  entregues: vi.fn(async () => 0),
}));
vi.mock("@/lib/notificacoes", () => ({
  estadoPermissao: async () => notif.permissao,
  pedirPermissaoDia2: (o: string) => notif.pedirDia2(o),
  adiarPermissaoDia2: (o: string) => notif.adiar(o),
  sincronizarLembreteDia2: (...a: unknown[]) => notif.sincronizar(...a),
  registrarEntregues: () => notif.entregues(),
}));

// o módulo mockado entra ANTES: os `import()` dinâmicos do hook e da folha resolvem em microtasks
import "@/lib/notificacoes";
import { UserDataContext } from "@/hooks/use-user-data";
import { PreFolhaLembrete } from "@/components/missao-doses/PreFolhaLembrete";
import { useLembreteDia2 } from "@/hooks/use-lembrete-dia2";
import { EVENTO_DIA2, lerDia2, registrarAbertura } from "@/lib/lembrete-dia2";

const Provedor = ({ dados, children }: { dados: Record<string, unknown>; children: ReactNode }) => (
  <UserDataContext.Provider value={{ get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f), set: () => {}, loaded: true, isGuest: false, fetchKey: async () => null }}>{children}</UserDataContext.Provider>
);
const registro = () => act(() => { window.dispatchEvent(new CustomEvent("core:activation", { detail: { action: "first_transaction", key: "finance-expenses" } })); });
const esperar = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); for (let i = 0; i < 24; i++) await Promise.resolve(); }); };
const Hook = () => { useLembreteDia2(); return null; };

beforeEach(() => {
  localStorage.clear();
  eventos.length = 0;
  notif.permissao = "prompt";
  notif.pedirDia2.mockClear(); notif.adiar.mockClear(); notif.sincronizar.mockClear(); notif.entregues.mockClear();
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 19, 17));
});
afterEach(() => { cleanup(); vi.useRealTimers(); delete (window as { Capacitor?: unknown }).Capacitor; document.documentElement.removeAttribute("data-missao-doses-faixa"); });

describe("a pré-folha", () => {
  it("1º registro do dia 1 → 'Quer que eu te lembre amanhã às 19:17?' com a prévia do texto da pessoa; 'Sim' pede a permissão e avisa o reagendador", async () => {
    const reagendou = vi.fn();
    window.addEventListener(EVENTO_DIA2, reagendou);
    render(<Provedor dados={{ "rotina-habits": ["Água", "Ler"] }}><PreFolhaLembrete /></Provedor>);
    registro();
    await esperar(1300);
    const folha = screen.getByTestId("pre-folha-lembrete");
    expect(folha).toHaveTextContent("Quer que eu te lembre amanhã às 19:17?");
    expect(screen.getByTestId("pre-folha-previa")).toHaveTextContent("2 hábitos te esperando hoje");
    expect(eventos).toContainEqual(["lembrete_dia2_pre_folha", { acao: "view", hora: "19:17", modulo: "rotina" }]);
    fireEvent.click(screen.getByTestId("pre-folha-sim"));
    await esperar(0);
    expect(notif.pedirDia2).toHaveBeenCalledWith("pre_folha");
    expect(reagendou).toHaveBeenCalled();
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
    window.removeEventListener(EVENTO_DIA2, reagendou);
  });

  it("'Agora não' grava a recusa (adiarPermissaoDia2) e some; a hora respeita 08:00–21:30 (abriu às 23h → 21:30)", async () => {
    vi.setSystemTime(new Date(2026, 9, 3, 23, 5));
    render(<Provedor dados={{}}><PreFolhaLembrete /></Provedor>);
    registro();
    await esperar(1300);
    expect(screen.getByTestId("pre-folha-lembrete")).toHaveTextContent("amanhã às 21:30?");
    fireEvent.click(screen.getByTestId("pre-folha-nao"));
    await esperar(0);
    expect(notif.adiar).toHaveBeenCalledWith("pre_folha");
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
  });

  it("NÃO aparece: com o passo da missão na tela, do dia 3 em diante, já pedida, permissão já decidida, ou fora do app", async () => {
    // o passo da missão na tela: a comemoração é quem pede
    document.documentElement.setAttribute("data-missao-doses-faixa", "1");
    const r = render(<Provedor dados={{}}><PreFolhaLembrete /></Provedor>);
    registro(); await esperar(1300);
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
    document.documentElement.removeAttribute("data-missao-doses-faixa");
    // dia 3 do uso: o momento passou
    localStorage.clear();
    registrarAbertura(new Date(2026, 9, 1, 10, 0));
    registro(); await esperar(1300);
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
    // já pedida/adiada
    localStorage.clear();
    const e = registrarAbertura(new Date(2026, 9, 3, 19, 0));
    localStorage.setItem("core-dia2", JSON.stringify({ ...e, permissao: { dia: "2026-10-03", resultado: "agora_nao", origem: "pre_folha" } }));
    registro(); await esperar(1300);
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
    // permissão já decidida pelo sistema
    localStorage.clear();
    notif.permissao = "granted";
    registro(); await esperar(1300);
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
    notif.permissao = "prompt";
    r.unmount();
    // fora do app
    localStorage.clear();
    delete (window as { Capacitor?: unknown }).Capacitor;
    render(<Provedor dados={{}}><PreFolhaLembrete /></Provedor>);
    registro(); await esperar(1300);
    expect(screen.queryByTestId("pre-folha-lembrete")).toBeNull();
    expect(notif.pedirDia2).not.toHaveBeenCalled();
    expect(lerDia2()).toBeNull();
  });
});

describe("useLembreteDia2 — a abertura do app", () => {
  it("no app, logado: sincroniza (com a conta, a área e a pref) e conta as entregues; o estado da missão e um registro reagendam", async () => {
    localStorage.setItem("core-funnel-area", "rotina");
    render(<Provedor dados={{ "notif-prefs": { primeiraSemana: true } }}><Hook /></Provedor>);
    await esperar(800);
    expect(notif.sincronizar).toHaveBeenCalledTimes(1);
    expect(notif.sincronizar.mock.calls[0][1]).toEqual({ criadoEm: conta.created_at, area: "rotina", ligado: true });
    expect(notif.entregues).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new CustomEvent("missao-doses:mudou")); });
    await esperar(800);
    expect(notif.sincronizar).toHaveBeenCalledTimes(2);
    registro();
    await esperar(800);
    expect(notif.sincronizar).toHaveBeenCalledTimes(3);
    expect(notif.entregues).toHaveBeenCalledTimes(1); // as entregues só na abertura/volta
  });

  it("na web (sem shell) não faz nada", async () => {
    delete (window as { Capacitor?: unknown }).Capacitor;
    render(<Provedor dados={{}}><Hook /></Provedor>);
    await esperar(1000);
    expect(notif.sincronizar).not.toHaveBeenCalled();
    expect(notif.entregues).not.toHaveBeenCalled();
  });
});
