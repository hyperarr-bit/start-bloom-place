import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type U = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> };
const authState: { user: U | null; loading: boolean; isSubscribed: boolean } = {
  user: null,
  loading: false,
  isSubscribed: false,
};
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));

let nativeShellMock = false;
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => nativeShellMock }));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      signOut: (...a: unknown[]) => signOut(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signInWithOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
    }),
  },
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({
  markPixPurchasePending: vi.fn(),
  firePixPurchaseOnce: vi.fn(async () => true),
}));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));

const definirEmailDaCompra = vi.fn();
vi.mock("@/lib/sessao-anonima", () => ({
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: vi.fn(async () => {}),
  limparBatismo: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { firePixPurchaseOnce, markPixPurchasePending } from "@/lib/purchase-tracking";
import FunilCRota, { _zerarEstadoFunilC } from "@/pages/funil-c/FunilC";
import { calcularMapaDoMes, ehDominioProducao } from "@/pages/funil-c/calculo";
import { _zerarSessaoVenda } from "@/pages/venda/rastreio";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";

const PIX_OK = {
  orderId: "qr_funil_c_99",
  qrCode: "00020126580014br.gov.bcb.pix0136chave-pix-teste520400005303986540597.905802BR",
  qrCodeBase64: null,
  expiresAt: null,
};

function DestinoProbe({ label }: { label: string }) {
  const loc = useLocation();
  return (
    <div data-testid={`destino-${label}`}>
      {loc.pathname}
      {loc.search}
    </div>
  );
}

const definirHost = (hostname: string, search = "") => {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      hostname,
      search,
      href: `https://${hostname}/funil-c${search}`,
    },
    writable: true,
    configurable: true,
  });
};

const montar = (hostname = "core-preview.vercel.app", search = "?utm_source=meta&utm_campaign=teste_c&fbclid=IwAR_c") => {
  definirHost(hostname, search);
  return render(
    <MemoryRouter initialEntries={[`/funil-c${search}`]}>
      <Routes>
        <Route path="/" element={<DestinoProbe label="raiz" />} />
        <Route path="/app" element={<DestinoProbe label="app" />} />
        <Route path="/funil-c" element={<FunilCRota />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("/funil-c — Calculadora do Teto Diário & Dia do Apagão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    _zerarEstadoFunilC();
    _zerarSessaoVenda();
    _zerarMemoriaPorta();
    nativeShellMock = false;
    authState.user = null;
    authState.loading = false;
    authState.isSubscribed = false;

    getSession.mockResolvedValue({ data: { session: null } });
    getUser.mockResolvedValue({ data: { user: { id: "u_c1", user_metadata: {} } } });
    updateUser.mockResolvedValue({ data: {}, error: null });
    definirEmailDaCompra.mockResolvedValue({ erro: null });
    invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return { data: PIX_OK, error: null };
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: false }, error: null };
      if (fn === "check-subscription") return { data: { subscribed: false }, error: null };
      if (fn === "porta-handoff") return { data: { codigo: "654321", email_enviado: true }, error: null };
      return { data: {}, error: null };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redireciona para a landing preservando UTMs em coreaplicativo.com.br e www.coreaplicativo.com.br", () => {
    expect(ehDominioProducao("coreaplicativo.com.br")).toBe(true);
    expect(ehDominioProducao("www.coreaplicativo.com.br")).toBe(true);
    expect(ehDominioProducao("core-git-cursor-funil-c.vercel.app")).toBe(false);
    expect(ehDominioProducao("localhost")).toBe(false);

    montar("coreaplicativo.com.br", "?utm_source=ig&fbclid=abc123&step=lixo");
    expect(screen.getByTestId("destino-raiz").textContent).toBe("/?utm_source=ig&fbclid=abc123");
    cleanup();

    montar("www.coreaplicativo.com.br", "?utm_campaign=c1");
    expect(screen.getByTestId("destino-raiz").textContent).toBe("/?utm_campaign=c1");
  });

  it("redireciona para ENTRADA_APP (/app) quando aberto dentro do shell nativo", () => {
    nativeShellMock = true;
    montar("localhost");
    expect(screen.getByTestId("destino-app").textContent).toContain("/app");
  });

  it("está registrado dentro de <SoNaWeb> no src/App.tsx", () => {
    const appSrc = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(appSrc).toContain('path="/funil-c"');
    expect(appSrc).toMatch(/path="\/funil-c"\s+element=\{<SoNaWeb>/);
  });

  it("calcula corretamente o Teto Diário, Dia do Apagão e Sobra Anual no motor puro", () => {
    const m = calcularMapaDoMes({
      renda: 5000,
      comprometidoPct: 55,
      modo: "equilibrio",
      agora: new Date("2026-10-18T12:00:00Z"),
    });
    expect(m.comprometidoReais).toBe(2750);
    expect(m.saldoAposFixos).toBe(2250);
    expect(m.sobraMensal).toBe(540);
    expect(m.sobraAnual).toBe(6480);
    expect(m.tetoDiario).toBeGreaterThan(80);
    expect(m.diaApagao).toBeGreaterThanOrEqual(15);
    expect(m.diaApagao).toBeLessThanOrEqual(24);
  });

  it("percorre o fluxo completo: Calculadora -> Mapa do Mês -> Oferta R$ 97,90 -> Pix Asaas (a97) -> Sucesso", async () => {
    montar("core-preview.vercel.app");

    // Tela 1: Calculadora
    expect(screen.getByTestId("funil-c").getAttribute("data-passo")).toBe("calculadora");
    fireEvent.click(screen.getByTestId("funil-c-renda-6000"));
    fireEvent.click(screen.getByTestId("funil-c-comp-70"));
    fireEvent.click(screen.getByTestId("funil-c-escape-parcelas_cartao"));
    fireEvent.click(screen.getByTestId("funil-c-calcular-cta"));

    // Tela 2: Mapa do Mês
    await waitFor(() => expect(screen.getByTestId("funil-c").getAttribute("data-passo")).toBe("mapa"));
    const tetoInicial = screen.getByTestId("funil-c-teto-diario").textContent;
    expect(tetoInicial).toMatch(/R\$\s*\d+/);

    // Simulador ao vivo muda a sobra anual quando troca de modo
    const sobraAntes = screen.getByTestId("funil-c-sobra-anual").textContent;
    fireEvent.click(screen.getByTestId("funil-c-modo-blindagem"));
    const sobraDepois = screen.getByTestId("funil-c-sobra-anual").textContent;
    expect(sobraDepois).not.toBe(sobraAntes);

    // Avança para a Oferta
    fireEvent.click(screen.getByTestId("funil-c-mapa-cta"));
    await waitFor(() => expect(screen.getByTestId("funil-c").getAttribute("data-passo")).toBe("oferta"));
    expect(screen.getByTestId("funil-c-preco-anual").textContent).toContain("97,90");
    expect(vi.mocked(fireMetaEvent)).toHaveBeenCalledWith(
      "InitiateCheckout",
      expect.objectContaining({ value: 97.9, currency: "BRL" }),
      expect.stringMatching(/^venda_ic_/),
    );

    // Preenche Nome e E-mail e gera o Pix
    fireEvent.change(screen.getByTestId("venda-nome"), { target: { value: "João Silva" } });
    fireEvent.change(screen.getByTestId("venda-email"), { target: { value: "joao@teste.com" } });
    fireEvent.click(screen.getByTestId("venda-dados-cta"));

    // Tela 4: Pix na página (Asaas oferta a97)
    await waitFor(() => expect(screen.getByTestId("funil-c").getAttribute("data-passo")).toBe("pix"));
    await waitFor(() => expect(screen.getByTestId("venda-pix").getAttribute("data-fase")).toBe("qr"));
    expect(markPixPurchasePending).toHaveBeenCalledWith({ offer: "a97", orderId: "qr_funil_c_99" });

    // Simula confirmação do pagamento no check
    invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: true }, error: null };
      if (fn === "check-subscription") return { data: { subscribed: true, subscription_end: "2027-10-18T00:00:00Z" }, error: null };
      if (fn === "porta-handoff") return { data: { codigo: "654321", email_enviado: true }, error: null };
      return { data: {}, error: null };
    });

    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByTestId("funil-c").getAttribute("data-passo")).toBe("sucesso"));
    expect(firePixPurchaseOnce).toHaveBeenCalledWith("checkout");
    expect(screen.getByTestId("venda-sucesso-email").textContent).toBe("joao@teste.com");
    expect(vi.mocked(trackEvent)).toHaveBeenCalledWith(
      "venda_pago",
      expect.objectContaining({ plano: "anual", metodo: "pix", valor: 97.9, funil: "funil_c" }),
    );
  });
});
