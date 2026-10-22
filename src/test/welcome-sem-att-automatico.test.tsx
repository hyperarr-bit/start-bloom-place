/**
 * WELCOME SEM PEDIDO AUTOMÁTICO DE ATT (1.0.18, dono 21/10). O que este arquivo trava:
 *   · abrir a welcome (a do funil Cal AI e a antiga) e esperar 5 s NÃO pede o rastreamento;
 *   · a welcome segura a reserva nativa de 10 s (CoreNativo.pularATT) sem marcar o aparelho como "da Porta";
 *   · tocar em "Começar" pede 1 vez (origem "welcome");
 *   · quem entra por "Já tem conta? Entrar" não é perguntado na welcome (a Home pergunta — já existia).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const att = vi.hoisted(() => ({ pedir: vi.fn(async () => "nao_ios"), segurar: vi.fn() }));
vi.mock("@/lib/att-ios", () => ({ pedirRastreamentoIos: (o: string) => att.pedir(o), segurarReservaNativaDoATT: () => att.segurar() }));
vi.mock("@/lib/analytics", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics")>()), trackEvent: vi.fn(), instalouVindoDoSite: () => false }));
vi.mock("@/lib/revenuecat", () => ({ initRevenueCat: async () => {}, restaurar: async () => false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
vi.mock("@/components/app/JaPagouPeloSite", () => ({ JaPagouPeloSite: () => null }));

import { WelcomeCalai } from "@/pages/funis/w/WelcomeCalai";
import { AppWelcome } from "@/components/app/AppWelcome";

beforeEach(() => {
  localStorage.clear();
  att.pedir.mockClear();
  att.segurar.mockClear();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
  vi.useFakeTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const esperar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe("welcome do funil (WelcomeCalai)", () => {
  it("5 s na tela: nenhum pedido de ATT; a reserva nativa fica segura; 'Começar' pede 1 vez", async () => {
    const onComecar = vi.fn();
    render(<MemoryRouter><WelcomeCalai onComecar={onComecar} /></MemoryRouter>);
    await esperar(5000);
    expect(att.pedir).not.toHaveBeenCalled();
    expect(att.segurar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("welcome-comecar"));
    await esperar(10);
    expect(att.pedir).toHaveBeenCalledTimes(1);
    expect(att.pedir).toHaveBeenCalledWith("welcome");
    expect(onComecar).toHaveBeenCalledTimes(1);
  });

  it("'Já tem conta? Entrar': sai da welcome sem pedir nada (a Home pergunta depois)", async () => {
    const onEntrar = vi.fn();
    render(<MemoryRouter><WelcomeCalai onComecar={() => {}} onEntrar={onEntrar} /></MemoryRouter>);
    await esperar(5000);
    fireEvent.click(screen.getByText("Entrar"));
    await esperar(10);
    expect(onEntrar).toHaveBeenCalledTimes(1);
    expect(att.pedir).not.toHaveBeenCalled();
  });
});

describe("welcome antiga (AppWelcome)", () => {
  it("5 s na tela: nenhum pedido; 'Começar' pede 1 vez", async () => {
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
  });
});
