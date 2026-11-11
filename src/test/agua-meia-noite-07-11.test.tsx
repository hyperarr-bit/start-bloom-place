/**
 * Bug "agua-meia-noite" (07/11). O app fica aberto de noite; de manhã, sem nada redesenhar a tela, o "+" gravava no dia
 * guardado no último desenho (ontem). O toque redesenhava a tela já no dia novo: a água caía em ontem e a tela dizia 0ml.
 * O relógio aqui anda sem redesenhar nada, como o celular que volta do bloqueio com a tela do jeito que estava.
 */
import { useMemo, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { HealthWidget } from "@/components/home/widgets/HealthWidget";
import { HealthTracker } from "@/pages/Rotina";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));

const ONTEM = "2026-11-06";
const HOJE = "2026-11-07";
const NOITE = new Date(2026, 10, 6, 23, 30);
const MANHA = new Date(2026, 10, 7, 8, 0);

type Log = Record<string, number>;
const criarDados = (inicial: Record<string, unknown> = {}) => ({ ...inicial }) as Record<string, unknown>;

/** Store vivo: `get` muda a cada escrita, como o de verdade (a Home lê por ele). */
const Loja = ({ dados, children }: { dados: Record<string, unknown>; children: ReactNode }) => {
  const [versao, setVersao] = useState(0);
  const valor = useMemo<UserDataContextType>(() => ({
    get: <T,>(key: string, fallback: T) => (versao >= 0 && key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; setVersao((v) => v + 1); },
    loaded: true,
    isGuest: true,
    fetchKey: async () => null,
  }), [dados, versao]);
  return <MemoryRouter><UserDataContext.Provider value={valor}>{children}</UserDataContext.Provider></MemoryRouter>;
};

const amanhece = () => vi.setSystemTime(MANHA);
const saude = (d: Record<string, unknown>) => (d["core-saude-water"] ?? {}) as Log;
const rotina = (d: Record<string, unknown>) => (d["water-log"] ?? {}) as Log;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOITE);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Saúde (HydrationTracker): o dia é o do toque", () => {
  const abrir = (inicial: Record<string, unknown> = {}) => {
    const dados = criarDados(inicial);
    render(<Loja dados={dados}><HydrationTracker /></Loja>);
    return dados;
  };
  const noite5 = { "core-saude-water": { [ONTEM]: 5 }, "water-log": { [ONTEM]: 5 } };

  it("aberto de noite, +250ml às 8h: grava hoje nas 2 chaves, ontem fica como estava e a tela mostra 250ml", () => {
    const dados = abrir(noite5);
    expect(screen.getByText("1250ml / 2000ml")).toBeTruthy();
    amanhece();
    fireEvent.click(screen.getByRole("button", { name: /\+250ml/ }));
    expect(saude(dados)).toEqual({ [ONTEM]: 5, [HOJE]: 1 });
    expect(rotina(dados)).toEqual({ [ONTEM]: 5, [HOJE]: 1 });
    expect(screen.getByText("250ml / 2000ml")).toBeTruthy();
  });

  it("o 2º toque soma em cima do 1º, no dia novo", () => {
    const dados = abrir(noite5);
    amanhece();
    const mais = screen.getByRole("button", { name: /\+250ml/ });
    fireEvent.click(mais);
    fireEvent.click(mais);
    expect(saude(dados)[HOJE]).toBe(2);
    expect(rotina(dados)[HOJE]).toBe(2);
    expect(screen.getByText("500ml / 2000ml")).toBeTruthy();
  });

  it("o '−' de manhã não tira copo de ontem", () => {
    const dados = abrir(noite5);
    amanhece();
    fireEvent.click(screen.getByRole("button", { name: /Tirar um registro/ }));
    expect(saude(dados)[ONTEM]).toBe(5);
    expect(rotina(dados)[ONTEM]).toBe(5);
    expect(saude(dados)[HOJE] ?? 0).toBe(0);
  });

  it("'Zerar o dia' de manhã não apaga ontem", () => {
    const dados = abrir(noite5);
    amanhece();
    fireEvent.click(screen.getByRole("button", { name: /Zerar o dia/ }));
    expect(saude(dados)[ONTEM]).toBe(5);
    expect(rotina(dados)[ONTEM]).toBe(5);
  });

  it("voltou pro app de manhã: a tela vira o dia sozinha, sem precisar tocar, e nada é gravado", () => {
    const dados = abrir(noite5);
    amanhece();
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByText("0ml / 2000ml")).toBeTruthy();
    expect(dados).toEqual(noite5);
  });

  it("no mesmo dia, nada muda: lê o maior das 2 chaves e grava nas 2", () => {
    const dados = abrir({ "core-saude-water": { [ONTEM]: 2 }, "water-log": { [ONTEM]: 3 } });
    fireEvent.click(screen.getByRole("button", { name: /\+250ml/ }));
    expect(saude(dados)[ONTEM]).toBe(4);
    expect(rotina(dados)[ONTEM]).toBe(4);
  });
});

describe("Home (HealthWidget): o dia é o do toque", () => {
  const abrir = (inicial: Record<string, unknown>) => {
    const dados = criarDados(inicial);
    render(<Loja dados={dados}><HealthWidget size="large" /></Loja>);
    return dados;
  };
  const botoes = () => screen.getAllByRole("button").filter((b) => b.className.includes("rounded-full"));

  it("+ às 8h grava hoje nas 2 chaves, ontem fica como estava e o número da tela é o de hoje", () => {
    const dados = abrir({ "core-saude-water": { [ONTEM]: 5 }, "water-log": { [ONTEM]: 5 } });
    expect(screen.getByText(/^5\/8/)).toBeTruthy();
    amanhece();
    fireEvent.click(botoes()[1]);
    expect(saude(dados)).toEqual({ [ONTEM]: 5, [HOJE]: 1 });
    expect(rotina(dados)).toEqual({ [ONTEM]: 5, [HOJE]: 1 });
    expect(screen.getByText(/^1\/8/)).toBeTruthy();
  });

  it("− às 8h não tira copo de ontem", () => {
    const dados = abrir({ "core-saude-water": { [ONTEM]: 5 }, "water-log": { [ONTEM]: 5 } });
    amanhece();
    fireEvent.click(botoes()[0]);
    expect(saude(dados)[ONTEM]).toBe(5);
    expect(rotina(dados)[ONTEM]).toBe(5);
  });
});

describe("Rotina (SAÚDE DIÁRIA): o dia é o do toque", () => {
  const abrir = (inicial: Record<string, unknown>) => {
    const dados = criarDados(inicial);
    render(<Loja dados={dados}><HealthTracker /></Loja>);
    return dados;
  };
  const botoesDaAgua = () => {
    const contagem = screen.getByText(/\/8 copos/);
    return Array.from(contagem.closest(".space-y-3")!.querySelectorAll("button"));
  };
  const noite = { "core-saude-water": { [ONTEM]: 5 }, "water-log": { [ONTEM]: 5 }, "sleep-log": { [ONTEM]: 7 }, "core-saude-sleep": { [ONTEM]: 7 } };

  it("+ às 8h grava hoje nas 2 chaves, ontem fica como estava e a tela mostra 1/8", () => {
    const dados = abrir(noite);
    expect(screen.getByText("5/8 copos")).toBeTruthy();
    amanhece();
    fireEvent.click(botoesDaAgua()[1]);
    expect(saude(dados)).toEqual({ [ONTEM]: 5, [HOJE]: 1 });
    expect(rotina(dados)).toEqual({ [ONTEM]: 5, [HOJE]: 1 });
    expect(screen.getByText("1/8 copos")).toBeTruthy();
  });

  it("− às 8h não tira copo de ontem", () => {
    const dados = abrir(noite);
    amanhece();
    fireEvent.click(botoesDaAgua()[0]);
    expect(saude(dados)[ONTEM]).toBe(5);
    expect(rotina(dados)[ONTEM]).toBe(5);
  });

  it("o sono digitado às 8h vai pra hoje e não troca o de ontem (o mesmo dia velho, no mesmo card)", () => {
    const dados = abrir(noite);
    amanhece();
    fireEvent.change(screen.getByPlaceholderText("Horas dormidas"), { target: { value: "6.5" } });
    expect(dados["sleep-log"]).toEqual({ [ONTEM]: 7, [HOJE]: 6.5 });
    expect(dados["core-saude-sleep"]).toEqual({ [ONTEM]: 7, [HOJE]: 6.5 });
  });

  it("voltou pro app de manhã: água e campo do sono viram o dia, sem gravar nada", () => {
    const dados = abrir(noite);
    expect((screen.getByPlaceholderText("Horas dormidas") as HTMLInputElement).value).toBe("7");
    amanhece();
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByText("0/8 copos")).toBeTruthy();
    expect((screen.getByPlaceholderText("Horas dormidas") as HTMLInputElement).value).toBe("");
    expect(dados).toEqual(noite);
  });
});
