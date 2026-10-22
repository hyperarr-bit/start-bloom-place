/**
 * A TELA DO SINO ANTES DO PAYWALL DO iPHONE (1.0.18, dono 22/10 — lib/sino-paywall, pages/funis/ios/SinoIOS).
 * O que este arquivo trava:
 *   · a chave remota `sino_paywall` (off|on|ab) lida da metadata das offerings (a current vence), padrão "off";
 *   · OFF: o passo "offer" do iPhone é o paywall de hoje, byte a byte (mesmo DOM, nenhum evento do sino);
 *   · ON: o sino aparece antes do paywall (copy do dono, sem preço), `funnel_view step=sino`, o "Continuar grátis"
 *     pede a permissão SÓ se ainda não foi decidida (`sino_permissao`) e segue pro paywall;
 *   · AB: sorteio 50/50 por aparelho, gravado e estável; o braço vai nos campos do paywall (`sino: com|sem`);
 *   · nada repete: o Voltar do paywall, a reabertura do app no meio e o deep link caem direto no paywall;
 *   · quem a loja diz que não tem teste grátis pula o sino (a promessa seria falsa).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
const loja = vi.hoisted(() => ({ estado: "pronto" as string, temAnual: true, trial: true }));
const notif = vi.hoisted(() => ({ estado: "prompt" as string, pedidos: 0, concede: true }));
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  getAttributionParams: () => ({}),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, isSubscribed: false, loading: false }) }));
vi.mock("@/lib/sessao-anonima", () => ({ anonimoLigado: async () => true, precisaBatizar: async () => true }));
vi.mock("@/lib/revenuecat", () => ({
  compraNaLojaSemConta: async () => false,
  estadoRevenueCat: () => loja.estado,
  temAnualIos: () => loja.temAnual,
  anualIosTemTrial: () => loja.trial,
}));
vi.mock("@/lib/notificacoes", () => ({
  agendarResgateDoPlano: vi.fn(async () => {}),
  cancelarResgateDoPlano: vi.fn(async () => {}),
  estadoPermissao: vi.fn(async () => notif.estado),
  pedirPermissao: vi.fn(async () => { notif.pedidos++; notif.estado = notif.concede ? "granted" : "denied"; return notif.concede; }),
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => {} }), minimizeApp: async () => {} } }));
vi.mock("@/pages/funis/w/PaywallW", () => ({ PaywallW: () => <div data-testid="paywall-w">paywall</div> }));
vi.mock("@/pages/funis/ios/PaywallIOS", () => ({
  PaywallIOS: ({ onVoltar }: { onVoltar?: () => void }) => (
    <div data-testid="paywall-ios">paywall ios<button data-testid="paywall-ios-voltar" onClick={() => onVoltar?.()}>voltar</button></div>
  ),
}));
vi.mock("@/pages/funis/ios/CadastroIOS", () => ({ SignupIOS: () => <div />, ConfirmIOS: () => <div />, LiberandoIOS: () => <div /> }));
vi.mock("@/pages/funis/radar/ComecarRadar", () => ({ SignupScreen: () => <div />, ConfirmScreen: () => <div />, LiberandoScreen: () => <div />, POS_COMPRA_OAUTH_KEY: "core-pos-compra-oauth" }));
vi.mock("@/components/app/AppWelcome", () => ({ AppWelcome: () => <div data-testid="welcome">welcome</div> }));
vi.mock("framer-motion", async (orig) => {
  const m = await orig<typeof import("framer-motion")>();
  return { ...m, AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</> };
});

import ComecarW from "@/pages/funis/w/ComecarW";
import { CHAVES_FUNIL_W, guardarChave } from "@/pages/funis/w/retomada";
import {
  CHAVE_BRACO_SINO, CHAVE_FORCA_SINO, CHAVE_SINO_APARELHO, CHAVE_SINO_VISTO, _zerarSinoRemoto, bracoSino, camposDoSino,
  lerSinoRemoto, modoSino, registrarSinoRemoto, sortearBracoSino,
} from "@/lib/sino-paywall";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";
import { TEXTOS_DO_SINO } from "@/pages/funis/ios/SinoIOS";

const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const montar = (url: string) => {
  window.history.replaceState({}, "", url);
  return render(<MemoryRouter initialEntries={[url]}><ComecarW /></MemoryRouter>);
};
const espera = (ms = 20) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const doSino = () => eventos.filter(([n, d]) => d.step === "sino" || n === "sino_permissao" || String(d.cta ?? "").startsWith("sino_"));
const remoto = (v: string) => registrarSinoRemoto({ current: { identifier: "default", metadata: { sino_paywall: v } }, all: {} });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  eventos.length = 0;
  _zerarSinoRemoto();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Object.assign(loja, { estado: "pronto", temAnual: true, trial: true });
  Object.assign(notif, { estado: "prompt", pedidos: 0, concede: true });
  ios();
  guardarChave(CHAVES_FUNIL_W.area, "dinheiro");
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("a chave sino_paywall", () => {
  it("padrão off; lida da metadata (a current vence); estranha = off; a última resposta fica no aparelho; QA pelo link", () => {
    expect(modoSino()).toBe("off");
    expect(bracoSino()).toBeNull();
    expect(camposDoSino()).toEqual({});
    expect(lerSinoRemoto(null)).toBe("off");
    expect(lerSinoRemoto({ current: { metadata: { sino_paywall: "banana" } }, all: {} })).toBe("off");
    const outra = { metadata: { sino_paywall: "on" } };
    const current = { metadata: { sino_paywall: "ab" } };
    expect(lerSinoRemoto({ current, all: { outra, current } })).toBe("ab");
    expect(lerSinoRemoto({ current: { metadata: {} }, all: { outra } })).toBe("on");
    remoto("ON");
    expect(modoSino()).toBe("on");
    expect(localStorage.getItem(CHAVE_SINO_APARELHO)).toBe("on");
    _zerarSinoRemoto(); // abertura nova, RevenueCat ainda sem resposta → a cópia do aparelho
    expect(modoSino()).toBe("on");
    expect(camposDoSino()).toEqual({ sino: "com" });
    localStorage.setItem(CHAVE_FORCA_SINO, "off");
    expect(modoSino()).toBe("off");
  });

  it("ab: 50/50 pelo id do aparelho, gravado na 1ª vez e estável", () => {
    let com = 0;
    for (let i = 0; i < 2000; i++) if (sortearBracoSino(`id-${i}`) === "com") com++;
    expect(com).toBeGreaterThan(900);
    expect(com).toBeLessThan(1100);
    remoto("ab");
    localStorage.setItem("device_id", "aparelho-x");
    const b = bracoSino();
    expect(b).toBe(sortearBracoSino("aparelho-x"));
    expect(localStorage.getItem(CHAVE_BRACO_SINO)).toBe(b);
    localStorage.setItem("device_id", "outro-id"); // o gravado manda
    expect(bracoSino()).toBe(b);
    expect(camposDoSino()).toEqual({ sino: b });
  });

  it("as chaves são do aparelho (a vassoura do cache não leva)", () => {
    for (const k of [CHAVE_SINO_APARELHO, CHAVE_BRACO_SINO, CHAVE_SINO_VISTO]) expect(CHAVES_DO_APARELHO.has(k)).toBe(true);
  });
});

describe("OFF: o paywall de hoje, byte a byte", () => {
  it("?step=offer cai direto no paywall; nenhum evento do sino; nada gravado", async () => {
    const { container } = montar("/app?step=offer");
    await espera();
    expect(screen.getByTestId("paywall-ios")).toBeInTheDocument();
    expect(screen.queryByTestId("ios-sino")).toBeNull();
    expect(screen.queryByTestId("ios-sino-decidindo")).toBeNull();
    expect(doSino()).toEqual([]);
    expect(localStorage.getItem(CHAVE_SINO_VISTO)).toBeNull();
    expect(localStorage.getItem(CHAVE_BRACO_SINO)).toBeNull();
    // o mesmo DOM que o paywall sozinho renderia dentro do passo
    expect(container.querySelector('[data-testid="paywall-ios"]')?.parentElement?.className).toContain("flex-1 flex flex-col");
  });
});

describe("ON: o sino antes do paywall", () => {
  it("mostra a copy do dono (sem preço), pede a permissão 1x e segue pro paywall", async () => {
    remoto("on");
    montar("/app?step=offer");
    await waitFor(() => expect(screen.getByTestId("ios-sino")).toBeInTheDocument());
    const tela = screen.getByTestId("ios-sino");
    expect(screen.getByTestId("ios-sino-titulo").textContent).toBe("A gente te avisa antes do teste acabar");
    expect(tela).toHaveTextContent("Com as notificações ligadas");
    expect(tela).toHaveTextContent("Nada é cobrado hoje");
    expect(screen.getByTestId("ios-sino-continuar").textContent).toBe("Continuar grátis");
    expect(tela.textContent).not.toMatch(/R\$|24 ?h|Apple|cobra antes/);
    expect(TEXTOS_DO_SINO.titulo.endsWith(".")).toBe(false);
    expect(screen.queryByTestId("paywall-ios")).toBeNull();
    expect(eventos).toContainEqual(["funnel_view", expect.objectContaining({ step: "sino", funil: "ios", loja: "ios", sino: "com", area: "dinheiro" })]);
    expect(localStorage.getItem(CHAVE_SINO_VISTO)).toBe("1");
    fireEvent.click(screen.getByTestId("ios-sino-continuar"));
    await waitFor(() => expect(screen.getByTestId("paywall-ios")).toBeInTheDocument());
    expect(notif.pedidos).toBe(1);
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "sino_continuar", step: "sino", sino: "com" })]);
    expect(eventos).toContainEqual(["sino_permissao", expect.objectContaining({ antes: "prompt", resultado: "concedeu" })]);
  });

  it("permissão já decidida (concedida ou negada): não pede de novo, só segue", async () => {
    for (const estado of ["granted", "denied"] as const) {
      localStorage.removeItem(CHAVE_SINO_VISTO);
      Object.assign(notif, { estado, pedidos: 0 });
      eventos.length = 0;
      remoto("on");
      montar("/app?step=offer");
      await waitFor(() => expect(screen.getByTestId("ios-sino")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("ios-sino-continuar"));
      await waitFor(() => expect(screen.getByTestId("paywall-ios")).toBeInTheDocument());
      expect(notif.pedidos).toBe(0);
      expect(eventos).toContainEqual(["sino_permissao", expect.objectContaining({ antes: estado, resultado: estado === "granted" ? "ja_tinha" : "ja_negada" })]);
      cleanup();
    }
  });

  it("o Voltar do paywall recua um passo e, ao voltar pro paywall, o sino não aparece de novo", async () => {
    remoto("on");
    montar("/app?step=offer&onboarding-1tela=on");
    await waitFor(() => expect(screen.getByTestId("ios-sino")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("ios-sino-continuar"));
    await waitFor(() => expect(screen.getByTestId("paywall-ios")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("paywall-ios-voltar"));
    await waitFor(() => expect(screen.getByTestId("plano-3-dias")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
    await waitFor(() => expect(screen.getByTestId("paywall-ios")).toBeInTheDocument());
    expect(screen.queryByTestId("ios-sino")).toBeNull();
    expect(eventos.filter(([n, d]) => n === "funnel_view" && d.step === "sino")).toHaveLength(1);
  });

  it("o Voltar do próprio sino recua um passo; seguir de novo cai no paywall (o sino já foi visto)", async () => {
    remoto("on");
    montar("/app?step=offer&onboarding-1tela=on");
    await waitFor(() => expect(screen.getByTestId("ios-sino")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("ios-sino-voltar"));
    await waitFor(() => expect(screen.getByTestId("plano-3-dias")).toBeInTheDocument());
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "sino_voltar" })]);
    fireEvent.click(screen.getByTestId("plano-3-dias-fechado"));
    await waitFor(() => expect(screen.getByTestId("paywall-ios")).toBeInTheDocument());
    expect(screen.queryByTestId("ios-sino")).toBeNull();
  });

  it("reabrir o app no meio do sino (retomada no passo offer) cai direto no paywall", async () => {
    remoto("on");
    const { unmount } = montar("/app?step=offer");
    await waitFor(() => expect(screen.getByTestId("ios-sino")).toBeInTheDocument());
    unmount(); // o app morreu com o sino na tela
    _zerarSinoRemoto(); // abertura nova: só a cópia do aparelho
    eventos.length = 0;
    guardarChave(CHAVES_FUNIL_W.passo, "offer");
    montar("/app");
    await espera();
    expect(screen.getByTestId("paywall-ios")).toBeInTheDocument();
    expect(screen.queryByTestId("ios-sino")).toBeNull();
    expect(doSino()).toEqual([]);
  });

  it("quem a loja diz que não tem teste grátis pula o sino (a promessa seria falsa)", async () => {
    remoto("on");
    loja.trial = false;
    montar("/app?step=offer");
    await waitFor(() => expect(screen.getByTestId("paywall-ios")).toBeInTheDocument());
    expect(screen.queryByTestId("ios-sino")).toBeNull();
    expect(eventos).toContainEqual(["funnel_click", expect.objectContaining({ cta: "sino_pulado", motivo: "sem_teste" })]);
    expect(localStorage.getItem(CHAVE_SINO_VISTO)).toBeNull();
  });
});

describe("AB: sorteia por aparelho e marca", () => {
  it("braço 'com' vê o sino; braço 'sem' cai no paywall — e o braço fica gravado", async () => {
    remoto("ab");
    localStorage.setItem(CHAVE_BRACO_SINO, "sem");
    const { unmount } = montar("/app?step=offer");
    await espera();
    expect(screen.getByTestId("paywall-ios")).toBeInTheDocument();
    expect(screen.queryByTestId("ios-sino")).toBeNull();
    expect(camposDoSino()).toEqual({ sino: "sem" });
    unmount();
    localStorage.setItem(CHAVE_BRACO_SINO, "com");
    montar("/app?step=offer");
    await waitFor(() => expect(screen.getByTestId("ios-sino")).toBeInTheDocument());
    expect(camposDoSino()).toEqual({ sino: "com" });
  });

  it("sem braço gravado: sorteia pelo id do aparelho e grava", async () => {
    remoto("ab");
    localStorage.setItem("device_id", "aparelho-qa");
    montar("/app?step=offer");
    await espera();
    const b = sortearBracoSino("aparelho-qa");
    expect(localStorage.getItem(CHAVE_BRACO_SINO)).toBe(b);
    await waitFor(() => expect(screen.queryByTestId(b === "com" ? "ios-sino" : "paywall-ios")).toBeInTheDocument());
  });
});
