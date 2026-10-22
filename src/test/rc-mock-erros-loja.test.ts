/**
 * 1.0.18 — o mock da loja (só no build de teste do Simulador) ensaia os ERROS DA LOJA do iPhone, pra o QA de aparelho
 * ver a retentativa automática e a caixa "Tentar de novo" do paywall: modo por `window.__rcModo` ou
 * `localStorage.__rc_mock_modo`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const carregar = async () => {
  vi.resetModules();
  return (await import("@/dev/rc-plugin-mock")).Purchases as unknown as {
    purchasePackage: (o: unknown) => Promise<unknown>;
    purchaseStoreProduct: (o: unknown) => Promise<unknown>;
  };
};
const pacote = { aPackage: { product: { identifier: "core_anual:coreanual" } } };

afterEach(() => {
  localStorage.clear();
  delete (window as unknown as { __rcModo?: string }).__rcModo;
});

describe("mock da loja: erros do iPhone (1.0.18)", () => {
  it("sem modo, compra", async () => {
    const P = await carregar();
    await expect(P.purchasePackage(pacote)).resolves.toBeTruthy();
  });

  it.each([
    ["erro-loja", "2", /problem with the App Store/],
    ["erro-rede", "10", /Error performing request/],
    ["bloqueado", "3", /not allowed to make the purchase/],
  ])("%s pelo localStorage lança o código %s", async (modo, codigo, msg) => {
    localStorage.setItem("__rc_mock_modo", modo);
    const P = await carregar();
    const e = await P.purchasePackage(pacote).catch((x) => x);
    expect(e.code).toBe(codigo);
    expect(e.message).toMatch(msg);
    const e2 = await P.purchaseStoreProduct({ product: { identifier: "core_anual" } }).catch((x) => x);
    expect(e2.code).toBe(codigo);
  });

  it("erro-loja-1x: a 1ª folha falha e a 2ª compra (a retentativa resolve)", async () => {
    (window as unknown as { __rcModo?: string }).__rcModo = "erro-loja-1x";
    const P = await carregar();
    const e = await P.purchasePackage(pacote).catch((x) => x);
    expect(e.code).toBe("2");
    await expect(P.purchasePackage(pacote)).resolves.toBeTruthy();
    expect(localStorage.getItem("__rc_mock_assinante")).toBe("1");
  });

  it("window.__rcModo vence o localStorage", async () => {
    localStorage.setItem("__rc_mock_modo", "erro-loja");
    (window as unknown as { __rcModo?: string }).__rcModo = "cancela";
    const P = await carregar();
    const e = await P.purchasePackage(pacote).catch((x) => x);
    expect(e.code).toBe("1");
  });
});
