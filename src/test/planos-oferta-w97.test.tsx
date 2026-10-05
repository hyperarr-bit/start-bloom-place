/**
 * /planos?oferta=w97 (01/10): a oferta do e-mail de cartão recusado na App
 * Store — R$ 97,90 UMA VEZ no Pix (oferta `w97`, vitalícia). Quem chega está
 * na carência da Apple (isSubscribed TRUE pela linha play_store), então a
 * página tem que oferecer mesmo "assinante"; quem já é vitalício não vê nada.
 * Trava de preço: a tela mostra 97,90 e o checkout recebe `w97` — o servidor
 * (asaas-pix) cobra 9790 nessa chave.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

type Linha = { billing_period: string | null; plan: string | null; payment_method: string | null; revenuecat_subscription_id: string | null };
const estado = vi.hoisted(() => ({
  auth: { user: { id: "u1", email: "ana@x.com" } as { id: string; email: string } | null, isSubscribed: false, subLoaded: true },
  linha: null as Linha | null,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => estado.auth }));
vi.mock("@/integrations/supabase/client", () => {
  const consulta = {
    select: () => consulta, eq: () => consulta, order: () => consulta, limit: () => consulta,
    then: (ok: (r: { data: Linha[] }) => void) => Promise.resolve({ data: estado.linha ? [estado.linha] : [] }).then(ok),
  };
  return {
    supabase: {
      from: () => consulta,
      auth: { getUser: async () => ({ data: { user: estado.auth.user } }) },
      functions: { invoke: async () => ({ data: { subscribed: false } }) },
    },
  };
});
vi.mock("@/components/paywall/PixCheckout", async (orig) => ({
  ...(await orig<typeof import("@/components/paywall/PixCheckout")>()),
  PixCheckout: ({ offer }: { offer: string }) => <div data-testid="pix-mock">oferta:{offer}</div>,
}));
vi.mock("@/components/PaymentStatus", () => ({ PaymentStatus: () => null }));
vi.mock("@/components/retention/CancelFlowDialog", () => ({ CancelFlowDialog: () => null }));
vi.mock("@/hooks/use-winback-trigger", () => ({ useWinbackTrigger: () => ({ markIntent: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import Planos from "@/pages/Planos";

const LOJA_EM_CARENCIA: Linha = { billing_period: "annual", plan: "app", payment_method: "play_store", revenuecat_subscription_id: "subAap123" };
const PIX_VITALICIO: Linha = { billing_period: "lifetime", plan: "lifetime", payment_method: "pix", revenuecat_subscription_id: null };

const montar = (url: string) =>
  render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/planos" element={<Planos />} /></Routes></MemoryRouter>);

beforeEach(() => { estado.auth = { user: { id: "u1", email: "ana@x.com" }, isSubscribed: false, subLoaded: true }; estado.linha = null; });
afterEach(cleanup);

describe("/planos?oferta=w97", () => {
  it("carência da App Store (assinante pela loja): mostra R$ 97,90, abre o Pix com w97 e o botão fica vivo", async () => {
    estado.auth.isSubscribed = true;
    estado.linha = LOJA_EM_CARENCIA;
    montar("/planos?oferta=w97&from=cobranca_recusada_pix");
    await waitFor(() => expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w97"));
    expect(document.body.textContent).toMatch(/R\$ 97,90/);
    expect(document.body.textContent).not.toMatch(/27,90|99,90/);
    const botao = screen.getByRole("button", { name: /Pagar R\$ 97,90 no Pix — uma vez só/ });
    expect(botao).not.toBeDisabled();
    // o aviso honesto de cancelar a renovação na Apple
    expect(screen.getByTestId("aviso-cancelar-loja").textContent).toMatch(/Assinaturas → CORE → Cancelar assinatura/);
    expect(document.body.textContent).toMatch(/A Apple não conseguiu cobrar/);
  });

  it("sem assinatura nenhuma: também recebe a oferta de 97,90 com w97", async () => {
    montar("/planos?oferta=w97");
    await waitFor(() => expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w97"));
    expect(document.body.textContent).toMatch(/R\$ 97,90/);
    expect(document.body.textContent).not.toMatch(/27,90/);
  });

  it("quem já é VITALÍCIO não vê a oferta nem o checkout", async () => {
    estado.auth.isSubscribed = true;
    estado.linha = PIX_VITALICIO;
    montar("/planos?oferta=w97");
    await waitFor(() => expect(document.body.textContent).toMatch(/VITALÍCIO/));
    expect(screen.queryByTestId("pix-mock")).toBeNull();
    // (05/10) quem já tem acesso não vê card de preço nenhum — a página vira "Meu acesso"
    expect(screen.queryByRole("button", { name: /Acesso já liberado/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/R\$ 97,90|27,90/);
    expect(screen.queryByTestId("aviso-cancelar-loja")).toBeNull();
  });

  it("enquanto a assinatura não carregou, não mostra preço nenhum (nem abre o Pix)", () => {
    estado.auth = { ...estado.auth, isSubscribed: true, subLoaded: false };
    montar("/planos?oferta=w97");
    expect(screen.getByTestId("planos-preparando")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/97,90|27,90/);
    expect(screen.queryByTestId("pix-mock")).toBeNull();
  });

  it("sem ?oferta a página segue como hoje: 27,90 e w27", async () => {
    montar("/planos");
    expect(document.body.textContent).toMatch(/R\$ 27,90/);
    expect(document.body.textContent).not.toMatch(/97,90/);
    fireEvent.click(screen.getByRole("button", { name: /Gerar meu Pix de R\$ 27,90/ }));
    await waitFor(() => expect(screen.getByTestId("pix-mock").textContent).toBe("oferta:w27"));
  });
});

describe("/planos sem oferta, de quem JÁ tem acesso (05/10: 'Meu acesso')", () => {
  it("assinante da App Store (inclusive na carência): nenhum preço nem 'vitalício R$ 27,90' — o plano dela e onde troca o cartão/cancela", async () => {
    estado.auth.isSubscribed = true;
    estado.linha = LOJA_EM_CARENCIA;
    montar("/planos");
    await waitFor(() => expect(screen.getByTestId("meu-acesso-loja")).toBeInTheDocument());
    expect(document.body.textContent).toMatch(/Meu acesso/);
    expect(document.body.textContent).toMatch(/assinatura anual da App Store/);
    expect(screen.getByTestId("meu-acesso-loja").textContent).toMatch(/Pagamento e Envio/);
    expect(document.body.textContent).not.toMatch(/27,90|CORE VITALÍCIO|Acesso já liberado/);
    expect(screen.queryByTestId("pix-mock")).toBeNull();
  });
  it("assinante do Google Play: o caminho da Play", async () => {
    estado.auth.isSubscribed = true;
    estado.linha = { billing_period: "monthly", plan: "app", payment_method: "play_store", revenuecat_subscription_id: "GPA.123" };
    montar("/planos");
    await waitFor(() => expect(screen.getByTestId("meu-acesso-loja")).toBeInTheDocument());
    expect(document.body.textContent).toMatch(/assinatura mensal do Google Play/);
    expect(document.body.textContent).not.toMatch(/27,90/);
  });
});
