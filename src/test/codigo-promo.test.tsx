/**
 * "Segue e ganha 7 dias" (14/09) — o código no paywall de entrada.
 *
 * O paywall roda ANTES do cadastro: o código só é conferido e guardado no
 * aparelho, e o funil segue como se tivesse pago (onPagoSemConta). O
 * resgate de verdade é o resgatarPendente(), na tela "Liberando".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  comprar: vi.fn(), comprarVitalicio: vi.fn(), comprarAnual97: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null, inicioUltimaFolha: () => null, sincronizarAssinatura: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

import { PaywallW } from "@/pages/funis/w/PaywallW";
import { CHAVE_CODIGO_PENDENTE, resgatarPendente } from "@/lib/codigo-promo";

const plataforma = (p: string) => {
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => p, isNativePlatform: () => true };
};
const montar = (onPagoSemConta = vi.fn()) => {
  render(
    <MemoryRouter>
      <PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={onPagoSemConta} />
    </MemoryRouter>,
  );
  return onPagoSemConta;
};

beforeEach(() => { plataforma("android"); localStorage.clear(); invoke.mockReset(); });
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("código promocional no paywall de entrada", () => {
  it("código válido: guarda no aparelho e segue pro cadastro como se tivesse pago", async () => {
    invoke.mockResolvedValue({ data: { valido: true, dias: 7, codigo: "INSTA7" }, error: null });
    const pago = montar();
    fireEvent.click(screen.getByTestId("tenho-codigo"));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: " insta-7 " } });
    fireEvent.click(screen.getByText("Aplicar"));
    await waitFor(() => expect(pago).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("resgatar-codigo", expect.objectContaining({
      body: expect.objectContaining({ codigo: "INSTA7", apenasValidar: true, plataforma: "android" }),
    }));
    expect(localStorage.getItem(CHAVE_CODIGO_PENDENTE)).toBe("INSTA7");
  });

  it("código inválido: mostra o erro, não guarda nada e não segue", async () => {
    invoke.mockResolvedValue({ data: { erro: "invalido" }, error: null });
    const pago = montar();
    fireEvent.click(screen.getByTestId("tenho-codigo"));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "XYZ" } });
    fireEvent.click(screen.getByText("Aplicar"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não existe/i);
    expect(pago).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAVE_CODIGO_PENDENTE)).toBeNull();
  });

  it("no iPhone a porta não existe (3.1.1)", () => {
    plataforma("ios");
    montar();
    expect(screen.queryByTestId("tenho-codigo")).toBeNull();
  });
});

describe("resgate do código guardado (tela Liberando)", () => {
  it("sem código guardado não chama nada", async () => {
    expect(await resgatarPendente()).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("resgatou: limpa o código do aparelho", async () => {
    localStorage.setItem(CHAVE_CODIGO_PENDENTE, "INSTA7");
    invoke.mockResolvedValue({ data: { ok: true, dias: 7, ate: "2026-09-21T00:00:00Z" }, error: null });
    const r = await resgatarPendente();
    expect(r?.ok).toBe(true);
    expect(localStorage.getItem(CHAVE_CODIGO_PENDENTE)).toBeNull();
  });

  it("erro de rede: mantém o código pra tentar na próxima abertura; erro definitivo limpa", async () => {
    localStorage.setItem(CHAVE_CODIGO_PENDENTE, "INSTA7");
    invoke.mockResolvedValue({ data: null, error: new Error("offline") });
    expect((await resgatarPendente())?.erro).toBe("rede");
    expect(localStorage.getItem(CHAVE_CODIGO_PENDENTE)).toBe("INSTA7");

    invoke.mockResolvedValue({ data: { erro: "ja_usado" }, error: null });
    expect((await resgatarPendente())?.erro).toBe("ja_usado");
    expect(localStorage.getItem(CHAVE_CODIGO_PENDENTE)).toBeNull();
  });
});
