/**
 * GATEWAYS ANTIGOS DESLIGADOS (21/10, dono aprovou): AbacatePay e Pagar.me respondem 410 "gateway desativado" antes de
 * qualquer leitura/escrita; o checkout da web não manda mais ninguém pra eles (só Asaas e Cakto).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GATEWAYS_ANTIGOS_DESLIGADOS, respostaGatewayDesativado } from "../../../supabase/functions/_shared/gateway-desativado";
import { bracoDoUsuario, gatewayVivo, FORCE_GATEWAY } from "@/components/paywall/PixCheckout";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", f), "utf8");
const ANTIGOS = ["abacate-pix", "pagarme-pix", "abacate-webhook", "pagarme-webhook", "abacatepay-webhook", "abacatepay-checkout"];

describe("respostaGatewayDesativado", () => {
  it("está desligado", () => {
    expect(GATEWAYS_ANTIGOS_DESLIGADOS).toBe(true);
  });
  it("POST → 410 com o motivo", async () => {
    const r = respostaGatewayDesativado(new Request("https://x/functions/v1/abacate-pix", { method: "POST", body: "{}" }), "abacate-pix");
    expect(r?.status).toBe(410);
    expect(await r!.json()).toEqual({ error: "gateway desativado", gateway: "abacate-pix" });
  });
  it("webhook GET/POST também 410; OPTIONS responde o CORS (o navegador lê o 410 depois)", () => {
    expect(respostaGatewayDesativado(new Request("https://x/", { method: "GET" }), "pagarme-webhook")?.status).toBe(410);
    const o = respostaGatewayDesativado(new Request("https://x/", { method: "OPTIONS" }), "pagarme-pix");
    expect(o?.status).toBe(200);
    expect(o?.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("religado → null (a função segue o caminho dela)", () => {
    expect(respostaGatewayDesativado(new Request("https://x/", { method: "POST" }), "abacate-pix", false)).toBeNull();
  });
});

describe("as 6 funções antigas respondem 410 antes de tocar no banco", () => {
  for (const f of ANTIGOS) {
    it(f, () => {
      const s = fonte(`${f}/index.ts`);
      expect(s).toContain('from "../_shared/gateway-desativado.ts"');
      const inicio = s.indexOf("serve(async (req) => {");
      expect(inicio).toBeGreaterThan(0);
      const corpo = s.slice(inicio);
      const guarda = corpo.indexOf(`respostaGatewayDesativado(req, "${f}")`);
      expect(guarda).toBeGreaterThan(0);
      expect(corpo.indexOf("if (desligado) return desligado;")).toBeGreaterThan(guarda);
      // nada de banco, corpo ou segredo antes da guarda
      for (const antes of ["createClient(", "req.json(", "req.text(", "Deno.env.get("]) {
        const i = corpo.indexOf(antes);
        if (i >= 0) expect(i, `${f}: ${antes} antes da guarda`).toBeGreaterThan(guarda);
      }
    });
  }
});

describe("o checkout da web só usa os gateways vivos", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });
  it("gatewayVivo", () => {
    expect(gatewayVivo("asaas")).toBe(true);
    expect(gatewayVivo("cakto")).toBe(true);
    for (const g of ["pagarme", "abacate", "", null, undefined]) expect(gatewayVivo(g)).toBe(false);
  });
  it("FORCE_GATEWAY continua asaas", () => {
    expect(FORCE_GATEWAY).toBe("asaas");
  });
  it("link antigo ?gw=pagarme / ?gw=abacate e força antiga no aparelho → Asaas", () => {
    window.history.replaceState({}, "", "/inicio?gw=pagarme");
    expect(bracoDoUsuario("u1", "w27")).toBe("asaas");
    expect(sessionStorage.getItem("pix-gw-teste")).toBeNull();
    window.history.replaceState({}, "", "/inicio?gw=abacate");
    expect(bracoDoUsuario("u1", "w27")).toBe("asaas");
    window.history.replaceState({}, "", "/inicio");
    sessionStorage.setItem("pix-gw-teste", "abacate");
    expect(bracoDoUsuario("u1", "w27")).toBe("asaas");
    sessionStorage.clear();
    localStorage.setItem("pix-ab-force", "pagarme");
    expect(bracoDoUsuario("u1", "w27")).toBe("asaas");
  });
  it("?gw=cakto continua valendo pra teste (na w27)", () => {
    window.history.replaceState({}, "", "/inicio?gw=cakto");
    expect(bracoDoUsuario("u1", "w27")).toBe("cakto");
  });
});
