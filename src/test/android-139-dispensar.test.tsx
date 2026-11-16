/**
 * ANDROID 139 (14/11): a Play recusou a 138 por "Política de assinaturas: botão de dispensar incorreto ou invisível"
 * (prints do paywall do funil, PaywallW). No Android o paywall do funil só saía pelo Voltar físico.
 *  · Android, funil (PaywallW): X de fechar visível (44 px, ícone escuro, borda) → mesmo efeito do Voltar físico
 *    (`core:voltar`, que desarma a reabertura da folha) + recua um passo (onVoltar = recuoDoPaywall do ComecarW);
 *    linha "Pra usar o CORE você escolhe um plano: mensal ou pra sempre.".
 *  · Android, /planos (PaywallAssinatura "planos"): o X fica com 44 px e contraste alto; a mesma linha.
 *  · Android, gate (PaywallAssinatura "gate"): a mesma linha + "Entrar com outra conta" como botão de verdade, com ou
 *    sem o paywall enxuto. O gate continua sem X (bloqueia o app pra quem não pagou).
 *  · iPhone (1.0.27 na revisão da Apple) e site: nada muda — o HTML do iPhone é comparado com o da 138 (v1026).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const auth = vi.hoisted(() => ({ user: null as null | { id: string; email: string } }));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn(async () => "pronto"),
  prefetchSemTeste: vi.fn(async () => undefined),
  prefetchVitalicio: vi.fn(async () => undefined),
  prefetchAssinaturas: vi.fn(async () => undefined),
  prefetchAnualIos: vi.fn(async () => undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  temAnual97: () => false,
  temMensalVista: () => true,
  temAnualIos: () => false,
  dadosSemTeste: (p: string) => (p === "mensal"
    ? { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true }
    : p === "anual" ? { produto: "core_anual_97_direto", preco: "R$ 97,90", valor: 97.9, precoMes: "R$ 8,16", offering: "sem_teste", pacote: true }
    : null),
  dadosMensalAndroid: () => ({ produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true }),
  comprarMensalAndroid: vi.fn(async () => false),
  comprarSemTeste: vi.fn(async () => false),
  comprar: vi.fn(async () => false),
  comprarVitalicio: vi.fn(async () => false),
  comprarAnual97: vi.fn(async () => false),
  motivoUltimaCompra: () => null,
  restaurar: vi.fn(async () => false),
  compraAssinaturaLocal: vi.fn(async () => false),
  compraVitaliciaLocal: vi.fn(async () => false),
  identificarRevenueCat: vi.fn(async () => undefined),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ data: {}, get: (_k: string, d: unknown) => d, loaded: true }) }));
vi.mock("@/lib/teste-gratis", async (original) => ({ ...(await original<typeof import("@/lib/teste-gratis")>()), estadoTeste: () => ({ fase: "nunca" }), limparGuiaSemente: vi.fn() }));
vi.mock("@/lib/notificacoes", () => ({
  agendarResgateDoPlano: vi.fn(async () => undefined), cancelarResgateDoPlano: vi.fn(async () => undefined),
  cancelarReguaDoTeste: vi.fn(async () => undefined), pedirLembreteDoTeste: vi.fn(async () => "pendente"),
}));

import { trackEvent } from "@/lib/analytics";
import { PaywallW } from "@/pages/funis/w/PaywallW";
import { PaywallAssinatura } from "@/components/paywall/PaywallAssinatura";

const LINHA = "Pra usar o CORE você escolhe um plano: mensal ou pra sempre.";
const plataforma = (p: "ios" | "android" | "web") => {
  if (p === "web") { delete (window as { Capacitor?: unknown }).Capacitor; return; }
  (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p };
};
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const corpo = () => document.body.textContent ?? "";
const classes = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

beforeEach(() => {
  localStorage.clear(); // conta vazia, aparelho novo
  vi.clearAllMocks();
  auth.user = null;
  window.history.replaceState({}, "", "/");
  plataforma("android");
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("Android, funil (PaywallW): X visível + linha do plano", () => {
  it("mostra o X (Fechar) com 44 px, fixo, ícone escuro e borda — e a linha do plano pago", async () => {
    render(<MemoryRouter><PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={vi.fn()} onVoltar={vi.fn()} /></MemoryRouter>);
    await espera();
    const x = screen.getByTestId("paywall-w-fechar");
    expect(x.getAttribute("aria-label")).toBe("Fechar");
    const c = classes(x);
    for (const k of ["fixed", "w-11", "h-11", "bg-white", "text-[#16121c]", "border"]) expect(c).toContain(k);
    expect(c.some((k) => /opacity-0|invisible|hidden|sr-only/.test(k))).toBe(false);
    expect(screen.getByTestId("paywall-w-precisa-plano").textContent).toBe(LINHA);
    // nada antes do paywall muda e o preço/botão continuam os de hoje
    expect(corpo()).toMatch(/Quero pra sempre — R\$ 97,90/);
    expect(corpo()).toMatch(/R\$ 34,90/);
  });

  it("tocar no X = o Voltar físico (core:voltar, desarma a reabertura) e recua um passo (onVoltar)", async () => {
    const onVoltar = vi.fn();
    const voltares: Event[] = [];
    const ouvir = (e: Event) => voltares.push(e);
    window.addEventListener("core:voltar", ouvir);
    render(<MemoryRouter><PaywallW area="dinheiro" answers={{}} onPagoSemConta={vi.fn()} onVoltar={onVoltar} /></MemoryRouter>);
    await espera();
    fireEvent.click(screen.getByTestId("paywall-w-fechar"));
    window.removeEventListener("core:voltar", ouvir);
    expect(voltares).toHaveLength(1);
    expect(onVoltar).toHaveBeenCalledTimes(1);
    const cliques = vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === "funnel_click").map((c) => c[1] as Record<string, unknown>);
    expect(cliques).toContainEqual(expect.objectContaining({ cta: "w_x_fechar", funil: "w" }));
  });

  it("sem onVoltar (quem monta não sabe recuar) não mostra um X morto", async () => {
    render(<MemoryRouter><PaywallW area="dinheiro" answers={{}} onPagoSemConta={vi.fn()} /></MemoryRouter>);
    await espera();
    expect(screen.queryByTestId("paywall-w-fechar")).toBeNull();
    expect(screen.getByTestId("paywall-w-precisa-plano")).toBeTruthy();
  });

  it("o ComecarW passa o recuo pro paywall do Android (e nunca pro site)", () => {
    const fonte = readFileSync(join(__dirname, "../pages/funis/w/ComecarW.tsx"), "utf8");
    expect(fonte).toMatch(/onVoltar=\{naWeb \? undefined : recuarDoPaywall\}/);
  });
});

describe("Android, /planos e gate (PaywallAssinatura)", () => {
  it("/planos: X de 44 px com contraste alto, fecha (o mesmo onFechar do Voltar físico) + a linha do plano", async () => {
    const onFechar = vi.fn();
    render(<MemoryRouter><PaywallAssinatura contexto="planos" onFechar={onFechar} /></MemoryRouter>);
    await espera();
    const x = screen.getByTestId("paywall-fechar");
    const c = classes(x);
    for (const k of ["w-11", "h-11", "bg-white", "text-[#16121c]", "border"]) expect(c).toContain(k);
    expect(screen.getByTestId("paywall-precisa-plano").textContent).toBe(LINHA);
    fireEvent.click(x);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  for (const enxuto of [false, true]) {
    it(`gate${enxuto ? " (paywall enxuto ligado)" : ""}: a linha do plano + "Entrar com outra conta" como botão de 44 px, uma vez só; sem X`, async () => {
      auth.user = { id: "u1", email: "pessoa@exemplo.com" };
      if (enxuto) localStorage.setItem("ofertas-saida-force", "enxuto");
      render(<MemoryRouter><PaywallAssinatura contexto="gate" /></MemoryRouter>);
      await espera();
      expect(screen.getByTestId("paywall-precisa-plano").textContent).toBe(LINHA);
      const botoes = screen.getAllByTestId("gate-trocar-conta");
      expect(botoes).toHaveLength(1);
      expect(botoes[0].tagName).toBe("BUTTON");
      expect(botoes[0].textContent).toBe("Entrar com outra conta");
      expect(classes(botoes[0])).toContain("min-h-[44px]");
      expect(screen.getByTestId("gate-saida-android").textContent).toMatch(/pessoa@exemplo\.com/);
      expect(screen.queryByLabelText("Fechar")).toBeNull();
      if (enxuto) expect(screen.getByTestId("rodape-enxuto").textContent).not.toMatch(/Já tem conta/);
    });
  }
});

describe("iPhone e site não mudam", () => {
  it("site (PaywallW naWeb): sem X e sem a linha", async () => {
    plataforma("web");
    render(<MemoryRouter><PaywallW area="dinheiro" answers={{}} naWeb onPagoSemConta={vi.fn()} onVoltar={vi.fn()} /></MemoryRouter>);
    await espera();
    expect(screen.queryByTestId("paywall-w-fechar")).toBeNull();
    expect(screen.queryByTestId("paywall-w-precisa-plano")).toBeNull();
    expect(corpo()).not.toMatch(/Pra usar o CORE/);
  });

  for (const modo of ["funil", "gate", "planos"] as const) {
    it(`iPhone sem teste, PaywallW ${modo}: sem X do Android, sem a linha; o Voltar redondo do iPhone segue onde estava`, async () => {
      plataforma("ios");
      localStorage.setItem("paywall-oferta-force", "anual");
      render(<MemoryRouter><PaywallW modo={modo} semTeste area="dinheiro" answers={{}} onPagoSemConta={vi.fn()} onVoltar={modo === "gate" ? undefined : vi.fn()} /></MemoryRouter>);
      await espera();
      expect(screen.queryByTestId("paywall-w-fechar")).toBeNull();
      expect(corpo()).not.toMatch(/Pra usar o CORE/);
      if (modo === "gate") expect(screen.queryByTestId("paywall-w-voltar")).toBeNull();
      else expect(screen.getByTestId("paywall-w-voltar")).toBeTruthy();
    });
  }

  it("iPhone, PaywallAssinatura gate e /planos: sem a linha, X pequeno de antes, \"Entrar com outra conta\" como texto de antes", async () => {
    plataforma("ios");
    auth.user = { id: "u1", email: "pessoa@exemplo.com" };
    render(<MemoryRouter><PaywallAssinatura contexto="gate" /></MemoryRouter>);
    await espera();
    expect(corpo()).not.toMatch(/Pra usar o CORE/);
    expect(screen.queryByTestId("gate-saida-android")).toBeNull();
    expect(screen.getByTestId("gate-trocar-conta").tagName).toBe("P");
    cleanup();
    render(<MemoryRouter><PaywallAssinatura contexto="planos" onFechar={vi.fn()} /></MemoryRouter>);
    await espera();
    expect(corpo()).not.toMatch(/Pra usar o CORE/);
    expect(screen.queryByTestId("paywall-fechar")).toBeNull();
    const c = classes(screen.getByLabelText("Fechar"));
    expect(c).toContain("w-8");
    expect(c).not.toContain("w-11");
  });
});
