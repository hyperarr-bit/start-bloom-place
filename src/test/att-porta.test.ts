/**
 * QUEM VEIO DA PORTA NÃO VÊ O ATT (10/10, build 38 — dono: "não quero 2 avisos do sistema na 1ª abertura").
 *   · aparelho marcado (link core://entrar?h=…) ou sessão de conta com user_metadata.porta → nenhum
 *     pedido de ATT (welcome automática de 3 s, botão Começar, Home) e o nativo é avisado (pularATT);
 *   · todo o resto: ATT exatamente como hoje;
 *   · nativo: o link core://entrar marca sozinho (open url) e a reserva de 10 s respeita a marca.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nativo = vi.hoisted(() => ({
  plataforma: "ios",
  pedir: vi.fn(async () => ({ status: "authorized" })),
  pular: vi.fn(async () => undefined),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => nativo.plataforma, isNativePlatform: () => nativo.plataforma !== "web" },
  registerPlugin: () => ({ pedirRastreamento: () => nativo.pedir(), pularATT: () => nativo.pular() }),
}));
const sessao = vi.hoisted(() => ({ metadata: {} as Record<string, unknown> | null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: sessao.metadata ? { user: { id: "u", user_metadata: sessao.metadata } } : null } }) } },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), capturarDispositivoApp: vi.fn(async () => undefined) }));

import { CHAVE_PORTA_SEM_ATT, marcarPortaSemATT, pedirRastreamentoIos, reavisarPortaSemATT, segurarReservaNativaDoATT } from "@/lib/att-ios";

beforeEach(() => {
  localStorage.clear();
  nativo.plataforma = "ios";
  nativo.pedir.mockClear();
  nativo.pular.mockClear();
  sessao.metadata = {};
});

describe("ATT × Porta", () => {
  it("app normal (sem marca, conta sem porta): pede o ATT como hoje", async () => {
    expect(await pedirRastreamentoIos("welcome_auto")).toBe("authorized");
    expect(nativo.pedir).toHaveBeenCalledTimes(1);
    expect(nativo.pular).not.toHaveBeenCalled();
  });

  it("veio pelo link da Porta (aparelho marcado): nenhum pedido — welcome automática, Começar ou Home", async () => {
    marcarPortaSemATT();
    expect(localStorage.getItem(CHAVE_PORTA_SEM_ATT)).toBe("1");
    await vi.waitFor(() => expect(nativo.pular).toHaveBeenCalledTimes(1)); // a reserva nativa de 10 s fica segura
    for (const origem of ["welcome_auto", "welcome", "home"]) expect(await pedirRastreamentoIos(origem)).toBe("pulado_porta");
    expect(nativo.pedir).not.toHaveBeenCalled();
  });

  it("entrou pelo 'Entrar' com uma conta da Porta (user_metadata.porta): pula, marca o aparelho e avisa o nativo", async () => {
    sessao.metadata = { porta: { respostas: { area: "rotina" } } };
    expect(await pedirRastreamentoIos("home")).toBe("pulado_porta");
    expect(nativo.pedir).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAVE_PORTA_SEM_ATT)).toBe("1");
    await vi.waitFor(() => expect(nativo.pular).toHaveBeenCalled());
  });

  it("1.0.18: a welcome segura a reserva nativa (pularATT) SEM marcar o aparelho — o JS continua pedindo no Começar/Home", async () => {
    segurarReservaNativaDoATT();
    await vi.waitFor(() => expect(nativo.pular).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(CHAVE_PORTA_SEM_ATT)).toBeNull();
    expect(await pedirRastreamentoIos("welcome")).toBe("authorized");
    expect(nativo.pedir).toHaveBeenCalledTimes(1);
  });

  it("reabrir o app num aparelho da Porta repete o aviso pro nativo; aparelho comum não avisa nada", async () => {
    reavisarPortaSemATT();
    await new Promise((r) => setTimeout(r, 10));
    expect(nativo.pular).not.toHaveBeenCalled();
    localStorage.setItem(CHAVE_PORTA_SEM_ATT, "1");
    reavisarPortaSemATT();
    await vi.waitFor(() => expect(nativo.pular).toHaveBeenCalledTimes(1));
  });

  it("nativo: o link core://entrar marca sozinho e a reserva de 10 s respeita a marca", () => {
    const swift = readFileSync(join(process.cwd(), "ios/App/App/AppDelegate.swift"), "utf8");
    expect(swift).toMatch(/if url\.scheme == "core", url\.host == "entrar" \{ AppDelegate\.pularATT = true \}/);
    expect(swift).toMatch(/asyncAfter\(deadline: \.now\(\) \+ 10\.0\) \{\s*\n\s*guard !AppDelegate\.pularATT else/);
    expect(swift).toContain('CAPPluginMethod(name: "pularATT", returnType: CAPPluginReturnPromise)');
    expect(swift).not.toMatch(/UIPasteboard/);
  });
});
