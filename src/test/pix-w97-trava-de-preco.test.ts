/**
 * TRAVA DE PREÇO da w97 (01/10): tela, QR e servidor cobram o MESMO valor.
 * - a tela mostra PIX_PRICES.w97 = "97,90";
 * - o checkout manda a w97 pela ASAAS (a Cakto só faz a w27; lá a chave
 *   apontaria pra 27,90 — a tela prometeria 97,90 e o QR cobraria outro);
 * - o servidor (asaas-pix / asaas-webhook / pix-reconcile) tem w97 = 9790 e
 *   concessão vitalícia — lido do fonte, pra ninguém trocar um lado só.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PIX_PRICES, OFERTA_VITALICIA, bracoDoUsuario } from "@/components/paywall/PixCheckout";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

describe("w97: um preço só, do e-mail ao banco", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it("tela: 97,90, vitalícia", () => {
    expect(PIX_PRICES.w97).toBe("97,90");
    expect(OFERTA_VITALICIA.w97).toBe(true);
  });

  it("gateway: a w97 vai pela Asaas, venha o braço de onde vier; a w27 segue a regra da web", () => {
    expect(bracoDoUsuario("u1", "w97")).toBe("asaas");
    expect(bracoDoUsuario(null, "w97")).toBe("asaas");
    expect(["asaas", "cakto"]).toContain(bracoDoUsuario("u1", "w27"));
  });

  it("servidor: w97 = 9790 centavos e concessão vitalícia nas 3 funções de dinheiro", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts"]) {
      const s = fonte(f);
      expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\bw97: 9790\b/);
      expect(s).toMatch(/w97: \{ plano: "lifetime", periodo: "lifetime", dias: null \}/);
    }
    expect(fonte("pix-reconcile/index.ts")).toMatch(/\bw97: 9790\b/);
  });

  it("o e-mail do Pix e o /planos falam do mesmo 97,90", () => {
    expect(fonte("_shared/email-cobranca-pix.ts")).toMatch(/PRECO_PIX = "97,90"/);
    expect(fonte("cobranca-recusada/index.ts")).toMatch(/\/planos\?oferta=w97/);
  });
});
