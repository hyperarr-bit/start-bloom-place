/**
 * A entrada fixa "Dar o CORE de presente" (15/11) e a /presente/dar no preço da /oferta:
 *   chave off no código; só o site (iPhone/Android da loja nunca, nem com o QA); vitalício web pix OU stripe; presente/loja não;
 *   a resposta do stripe-presente vira o formato do dia 3 (pago sem código ainda = espera, nunca um cartão vazio).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRESENTE_ENTRADA, compraQueLiberaEntrada, entradaLigadaAqui, forcaDaEntrada } from "@/lib/presente-entrada";
import { stripeComoDia3 } from "@/pages/presente/DarPresente";

describe("a entrada fixa do presente", () => {
  it("off no código; só o site", () => {
    expect(PRESENTE_ENTRADA).toBe("off");
    expect(entradaLigadaAqui({ plataforma: "web", forca: null })).toBe(false);
    expect(entradaLigadaAqui({ plataforma: "web", forca: null, modo: "web" })).toBe(true);
    expect(entradaLigadaAqui({ plataforma: "web", forca: "on" })).toBe(true);
    expect(entradaLigadaAqui({ plataforma: "ios", forca: "on", modo: "web" })).toBe(false);
    expect(entradaLigadaAqui({ plataforma: "android", forca: "on", modo: "web" })).toBe(false);
  });
  it("?presente-entrada=on|off fica no aparelho; auto desfaz", () => {
    localStorage.clear();
    expect(forcaDaEntrada("?presente-entrada=on")).toBe("on");
    expect(forcaDaEntrada("")).toBe("on");
    expect(forcaDaEntrada("?presente-entrada=auto")).toBeNull();
  });
  it("vitalício pago na web (Pix ou Stripe); presente recebido, loja e mensal não", () => {
    const vit = (pm: string, extra: Record<string, unknown> = {}) => ({ payment_method: pm, status: "active", billing_period: "lifetime", amount_cents: 6790, ...extra });
    expect(compraQueLiberaEntrada([vit("stripe")])).toBe(true);
    expect(compraQueLiberaEntrada([vit("pix", { amount_cents: 2790 })])).toBe(true);
    expect(compraQueLiberaEntrada([vit("presente")])).toBe(false);
    expect(compraQueLiberaEntrada([vit("play_store")])).toBe(false);
    expect(compraQueLiberaEntrada([vit("stripe", { billing_period: "monthly" })])).toBe(false);
    expect(compraQueLiberaEntrada([vit("stripe", { status: "canceled" })])).toBe(false);
  });
  it("mora no lugar do aviso (nunca os dois) e nunca na Home", () => {
    const aviso = readFileSync(resolve(__dirname, "../presente/AvisoPresente.tsx"), "utf8");
    expect(aviso).toMatch(/entrada \? <EntradaPresente estilo=\{estilo\} \/> : <AvisoFechavel estilo=\{estilo\} \/>/);
    for (const f of ["../pages/Home.tsx", "../components/home/HomeHeader.tsx"]) {
      try { expect(readFileSync(resolve(__dirname, f), "utf8")).not.toContain("EntradaPresente"); } catch { /* arquivo não existe */ }
    }
  });
});

describe("/presente/dar no preço da /oferta", () => {
  it("stripe-presente → formato do dia 3", () => {
    expect(stripeComoDia3(null)).toEqual({ ok: false, motivo: "rede" });
    expect(stripeComoDia3({ ok: false, motivo: "token" })).toEqual({ ok: false, motivo: "token" });
    expect(stripeComoDia3({ ok: true, pago: true, pedido: "pi_1", codigo: null })).toEqual({ ok: true, pago: false, pix: null });
    expect(stripeComoDia3({ ok: true, pago: true, pedido: "pi_1", codigo: "ABCDEFGH", de: null })).toMatchObject({ ok: true, pago: true, codigo: "ABCDEFGH" });
    expect(stripeComoDia3({ ok: true, pago: false, pix: { orderId: "pi_1", qrCode: "PIX", expiresAt: "2026-11-16T00:00:00Z" } })).toMatchObject({ ok: true, pago: false, pix: { orderId: "pi_1", qrCode: "PIX", qrCodeBase64: null } });
  });
});
