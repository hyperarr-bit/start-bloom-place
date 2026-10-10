/**
 * AVALIAÇÕES NA 1.0.14 (10/10): os motivos da missão em doses
 * (pedirAvaliacaoPorMissao), as travas de momento ruim (cobrança/cancelamento/
 * presente nas últimas 24 h, erro na sessão), "Avaliar o CORE" no menu e o
 * total contado no caminho write-review. Chave AVALIACAO_V14 (QA: ?avaliacao-v14=on).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ track: vi.fn(), requestReview: vi.fn(async () => {}), plataforma: "ios" }));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.track }));
vi.mock("@capacitor-community/in-app-review", () => ({ InAppReview: { requestReview: m.requestReview } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => m.plataforma, isNativePlatform: () => true } }));
vi.mock("@/lib/teste-gratis", () => ({ trialCartaoAtivo: () => false }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", email: "a@b.c" }, isSubscribed: true, subLoaded: true, signOut: vi.fn() }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (_k: string, d: unknown) => d, set: vi.fn(), loaded: true }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { resetPasswordForEmail: vi.fn() } } }));

import {
  ATRASO_DEPOIS_DA_COMEMORACAO_MS, MOTIVOS_DIRETOS_NO_IPHONE, URL_AVALIAR_IOS, abrirPaginaDeAvaliacao, pedirAvaliacaoPorMissao,
  pedirAvaliacaoSePuder, podePedirAvaliacao, registrarDiaDeUso,
} from "@/lib/avaliacao";
import { CHAVE_FORCA_AVALIACAO_V14, guardarForcaDaAvaliacaoV14, avaliacaoV14Ligada } from "@/lib/avaliacao-v14";
import { anotarPeloEvento, limparMomentoRuim, momentoRuimRecente, erroNaSessao } from "@/lib/momento-ruim";
import { AccountDrawer } from "@/components/home/AccountDrawer";

const plataforma = (p: string) => {
  m.plataforma = p;
  (window as unknown as { Capacitor: unknown }).Capacitor = { getPlatform: () => p, isNativePlatform: () => true };
};
const ligar = () => localStorage.setItem(CHAVE_FORCA_AVALIACAO_V14, "on");
const doisDias = () => { registrarDiaDeUso(new Date(2026, 9, 9, 10)); registrarDiaDeUso(new Date(2026, 9, 10, 10)); };
const pedidos = () => m.track.mock.calls.filter((c) => c[0] === "app_avaliacao_pedida").map((c) => c[1] as Record<string, unknown>);

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  limparMomentoRuim();
  m.track.mockClear(); m.requestReview.mockClear();
  plataforma("ios");
  window.history.replaceState({}, "", "/home");
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date(2026, 9, 10, 15, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe("a chave AVALIACAO_V14", () => {
  it("nasce desligada; o link liga/desliga/desfaz só neste aparelho", () => {
    expect(avaliacaoV14Ligada()).toBe(false);
    guardarForcaDaAvaliacaoV14("?avaliacao-v14=on");
    expect(avaliacaoV14Ligada()).toBe(true);
    guardarForcaDaAvaliacaoV14("?avaliacao-v14=off");
    expect(avaliacaoV14Ligada()).toBe(false);
    guardarForcaDaAvaliacaoV14("?avaliacao-v14=auto");
    expect(localStorage.getItem(CHAVE_FORCA_AVALIACAO_V14)).toBeNull();
  });
});

describe("pedirAvaliacaoPorMissao (quem chama é a missão em doses)", () => {
  it("chave desligada: nunca pede, mesmo com tudo certo", async () => {
    doisDias();
    const p = pedirAvaliacaoPorMissao("missao_completa");
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
    expect(m.requestReview).not.toHaveBeenCalled();
  });

  it("ligada, 2+ dias de uso: espera 1,5 s depois da comemoração e pede com o MOTIVO certo (iPhone e Android)", async () => {
    ligar(); doisDias();
    const p = pedirAvaliacaoPorMissao("missao_dose_concluida");
    await vi.advanceTimersByTimeAsync(ATRASO_DEPOIS_DA_COMEMORACAO_MS - 100);
    expect(m.requestReview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(await p).toBe(true);
    expect(m.requestReview).toHaveBeenCalledTimes(1);
    expect(pedidos()[0]).toMatchObject({ motivo: "missao_dose_concluida", ordem: 1 });
    expect(MOTIVOS_DIRETOS_NO_IPHONE.has("missao_dose_concluida")).toBe(true);
    expect(MOTIVOS_DIRETOS_NO_IPHONE.has("plano_amanha_definido")).toBe(true);
    expect(MOTIVOS_DIRETOS_NO_IPHONE.has("missao_completa")).toBe(true);
    // Android, mesma régua
    localStorage.clear(); ligar(); plataforma("android"); doisDias(); m.requestReview.mockClear(); m.track.mockClear();
    const p2 = pedirAvaliacaoPorMissao("plano_amanha_definido");
    await vi.runAllTimersAsync();
    expect(await p2).toBe(true);
    expect(pedidos()[0]).toMatchObject({ motivo: "plano_amanha_definido" });
  });

  it("1º dia de uso (o passo do dia 1 da missão): não pede — nas duas lojas", async () => {
    ligar();
    const p = pedirAvaliacaoPorMissao("missao_dose_concluida");
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
    plataforma("android");
    const p2 = pedirAvaliacaoPorMissao("missao_completa");
    await vi.runAllTimersAsync();
    expect(await p2).toBe(false);
    expect(m.requestReview).not.toHaveBeenCalled();
  });

  it("motivo que não é da missão não passa por aqui", async () => {
    ligar(); doisDias();
    const p = pedirAvaliacaoPorMissao("conta_paga" as never);
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
  });
});

describe("travas de momento ruim (valem sempre, sem chave)", () => {
  it("aviso de cobrança / cancelamento / save-offer / presente 69 vistos: 24 h sem pedir; depois volta", async () => {
    doisDias();
    expect(podePedirAvaliacao()).toBe(true);
    for (const ev of ["aviso_cobranca_view", "cancel_loja_view", "save_offer_view", "presente69_view"]) {
      limparMomentoRuim();
      anotarPeloEvento(ev);
      expect(momentoRuimRecente(), ev).toBe(true);
      expect(podePedirAvaliacao(), ev).toBe(false);
      expect(await pedirAvaliacaoSePuder("conta_paga", { pagante: true }), ev).toBe(false);
    }
    expect(m.requestReview).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(2026, 9, 11, 15, 1));
    expect(momentoRuimRecente()).toBe(false);
    expect(podePedirAvaliacao()).toBe(true);
  });

  it("erro na sessão (js_error/funnel_error): não pede até fechar o app; evento qualquer não marca", () => {
    anotarPeloEvento("funnel_view");
    expect(erroNaSessao()).toBe(false);
    anotarPeloEvento("js_error");
    expect(erroNaSessao()).toBe(true);
    expect(podePedirAvaliacao()).toBe(false);
  });

  it("o toque explícito em 'Deixar minha nota' (write-review) continua abrindo — e agora conta no total da vida", async () => {
    anotarPeloEvento("aviso_cobranca_view");
    const href = vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, href: "", pathname: "/home", assign: vi.fn() } as unknown as Location);
    expect(await pedirAvaliacaoSePuder("momento_valor", { pagante: true, forte: true, tocouParaAvaliar: true })).toBe(true);
    expect(localStorage.getItem("core-avaliacao-total")).toBe("1");
    expect(localStorage.getItem("core-avaliacao-ultima")).not.toBeNull();
    expect(pedidos()[0]).toMatchObject({ motivo: "momento_valor", loja_direto: true, ordem: 1 });
    href.mockRestore();
  });
});

describe("'Avaliar o CORE' no menu", () => {
  it("iPhone: abre a tela de escrever avaliação da App Store (itms-apps write-review), conta total/última, evento com motivo menu", () => {
    const loc = { href: "", pathname: "/home" };
    vi.spyOn(window, "location", "get").mockReturnValue(loc as unknown as Location);
    expect(abrirPaginaDeAvaliacao("menu")).toBe(true);
    expect(loc.href).toBe(URL_AVALIAR_IOS);
    expect(URL_AVALIAR_IOS).toBe("itms-apps://itunes.apple.com/app/id6806913181?action=write-review");
    expect(localStorage.getItem("core-avaliacao-total")).toBe("1");
    expect(pedidos()[0]).toMatchObject({ motivo: "menu", origem: "menu", loja: "ios", loja_direto: true });
    expect(m.requestReview).not.toHaveBeenCalled(); // nunca a caixinha por botão
  });

  it("Android: a ficha na Play, numa aba externa; nunca a caixinha", () => {
    plataforma("android");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(abrirPaginaDeAvaliacao("menu")).toBe(true);
    expect(open).toHaveBeenCalledWith("https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app", "_blank", "noopener");
    expect(m.requestReview).not.toHaveBeenCalled();
    expect(pedidos()[0]).toMatchObject({ motivo: "menu", loja: "android" });
    open.mockRestore();
  });

  it("na web não existe", () => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    expect(abrirPaginaDeAvaliacao()).toBe(false);
    expect(pedidos()).toHaveLength(0);
  });

  it("o item só aparece no app da loja com a chave ligada", async () => {
    const montar = () => render(<MemoryRouter><AccountDrawer open onOpenChange={() => {}} /></MemoryRouter>);
    montar();
    expect(screen.queryByText("Avaliar o CORE")).toBeNull();
    cleanup();
    ligar();
    montar();
    expect(screen.getByText("Avaliar o CORE")).toBeInTheDocument();
    expect(screen.getByText("Ajuda e suporte")).toBeInTheDocument();
    cleanup();
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    montar();
    expect(screen.queryByText("Avaliar o CORE")).toBeNull();
  });
});
