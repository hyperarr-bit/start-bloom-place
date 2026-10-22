/**
 * QUANDO A WELCOME PEDE O ATT — pelo braço do `att_momento` (1.0.18, dono 21/10: "testar, não decidir"). O que este
 * arquivo trava, nas duas welcomes (a do funil Cal AI e a antiga):
 *   · braço "auto3s" (padrão, RevenueCat calado): o pedido sai 3 s depois de a tela aparecer (o de hoje);
 *   · braço "comecar": 5 s na tela NÃO pede; a welcome segura a reserva nativa de 10 s (sem marcar o aparelho como "da
 *     Porta"); tocar em "Começar" pede 1 vez; "Já tem conta? Entrar" sai sem pedir (a Home pergunta);
 *   · os `app_welcome_*` levam `att_braco` e `att_momento`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const att = vi.hoisted(() => ({ pedir: vi.fn(async () => "nao_ios"), segurar: vi.fn() }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/att-ios", () => ({ pedirRastreamentoIos: (o: string) => att.pedir(o), segurarReservaNativaDoATT: () => att.segurar() }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  instalouVindoDoSite: () => false,
}));
vi.mock("@/lib/revenuecat", () => ({ initRevenueCat: async () => {}, restaurar: async () => false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
vi.mock("@/components/app/JaPagouPeloSite", () => ({ JaPagouPeloSite: () => null }));

import { WelcomeCalai } from "@/pages/funis/w/WelcomeCalai";
import { AppWelcome } from "@/components/app/AppWelcome";
import { CHAVE_ATT_MOMENTO_APARELHO, _zerarAttMomentoRemoto } from "@/lib/att-momento";

beforeEach(() => {
  localStorage.clear();
  _zerarAttMomentoRemoto();
  att.pedir.mockClear();
  att.segurar.mockClear();
  eventos.length = 0;
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
  vi.useFakeTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const esperar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const dos = (nome: string) => eventos.filter(([n]) => n === nome).map(([, d]) => d);

describe("braço auto3s (padrão: RevenueCat nunca respondeu) = o de hoje", () => {
  it("WelcomeCalai: pede 3 s depois de aparecer; não segura a reserva nativa; Começar pede de novo (a lib devolve 'já pedido')", async () => {
    render(<MemoryRouter><WelcomeCalai onComecar={() => {}} /></MemoryRouter>);
    await esperar(2900);
    expect(att.pedir).not.toHaveBeenCalled();
    await esperar(200);
    expect(att.pedir).toHaveBeenCalledWith("welcome_auto");
    expect(att.segurar).not.toHaveBeenCalled();
    expect(dos("app_welcome_view")).toEqual([expect.objectContaining({ calai: true, att_braco: "auto3s", att_momento: "auto3s" })]);
    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await esperar(10);
    expect(att.pedir).toHaveBeenLastCalledWith("welcome");
    expect(dos("app_welcome_start")).toEqual([expect.objectContaining({ att_braco: "auto3s" })]);
  });

  it("AppWelcome antiga: idem", async () => {
    render(<MemoryRouter><AppWelcome onComecar={() => {}} /></MemoryRouter>);
    await esperar(3100);
    expect(att.pedir).toHaveBeenCalledWith("welcome_auto");
    expect(att.segurar).not.toHaveBeenCalled();
    expect(dos("app_welcome_view")).toEqual([expect.objectContaining({ att_braco: "auto3s" })]);
  });
});

describe("braço comecar (metadata att_momento = comecar guardada no aparelho)", () => {
  beforeEach(() => { localStorage.setItem(CHAVE_ATT_MOMENTO_APARELHO, "comecar"); });

  it("WelcomeCalai: 5 s na tela sem pedido; a reserva nativa fica segura; 'Começar' pede 1 vez; eventos com o braço", async () => {
    const onComecar = vi.fn();
    render(<MemoryRouter><WelcomeCalai onComecar={onComecar} /></MemoryRouter>);
    await esperar(5000);
    expect(att.pedir).not.toHaveBeenCalled();
    expect(att.segurar).toHaveBeenCalledTimes(1);
    expect(dos("app_welcome_view")).toEqual([expect.objectContaining({ att_braco: "comecar", att_momento: "comecar" })]);

    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await esperar(10);
    expect(att.pedir).toHaveBeenCalledTimes(1);
    expect(att.pedir).toHaveBeenCalledWith("welcome");
    expect(onComecar).toHaveBeenCalledTimes(1);
    expect(dos("app_welcome_start")).toEqual([expect.objectContaining({ calai: true, att_braco: "comecar" })]);
  });

  it("WelcomeCalai: 'Já tem conta? Entrar' sai sem pedir nada (a Home pergunta depois)", async () => {
    const onEntrar = vi.fn();
    render(<MemoryRouter><WelcomeCalai onComecar={() => {}} onEntrar={onEntrar} /></MemoryRouter>);
    await esperar(5000);
    fireEvent.click(screen.getByText("Entrar"));
    await esperar(10);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(att.pedir).not.toHaveBeenCalled();
    expect(dos("app_welcome_login")).toEqual([expect.objectContaining({ att_braco: "comecar" })]);
  });

  it("AppWelcome antiga: 5 s sem pedido; 'Começar' pede 1 vez", async () => {
    const onComecar = vi.fn();
    render(<MemoryRouter><AppWelcome onComecar={onComecar} /></MemoryRouter>);
    await esperar(5000);
    expect(att.pedir).not.toHaveBeenCalled();
    expect(att.segurar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Começar"));
    await esperar(10);
    expect(att.pedir).toHaveBeenCalledTimes(1);
    expect(att.pedir).toHaveBeenCalledWith("welcome");
    expect(onComecar).toHaveBeenCalledTimes(1);
    expect(dos("app_welcome_start")).toEqual([expect.objectContaining({ att_braco: "comecar" })]);
  });
});
