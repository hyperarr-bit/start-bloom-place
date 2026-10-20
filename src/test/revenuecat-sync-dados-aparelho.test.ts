/**
 * revenuecat-sync (Deno, imports por URL — o teste lê o FONTE): os dados do
 * aparelho saem dos headers + corpo `aparelho` e são gravados ANTES do upsert
 * em subscriptions (o cron do meta-backfill-app não pode ver a assinatura sem
 * eles), nas duas voltas (assinatura e vitalício).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fonte = readFileSync(resolve(__dirname, "../../supabase/functions/revenuecat-sync/index.ts"), "utf8");

describe("revenuecat-sync: dados do aparelho pro CAPI", () => {
  it("IP e UA vêm dos headers; o corpo só traz `aparelho`", () => {
    expect(fonte).toContain('xff: req.headers.get("x-forwarded-for")');
    expect(fonte).toContain('ua: req.headers.get("user-agent")');
    expect(fonte).toMatch(/dadosDoPedido\(\(corpo as \{ aparelho\?: unknown \} \| null\)\?\.aparelho/);
  });

  it("grava antes do upsert, nas duas voltas", () => {
    const vit = fonte.indexOf("for (const v of vitalicias)");
    const gVit = fonte.indexOf("await gravarDadosAparelho(admin, userId, v.id", vit);
    const upVit = fonte.indexOf('.from("subscriptions").upsert(', vit);
    expect(vit).toBeGreaterThan(0);
    expect(gVit).toBeGreaterThan(vit);
    expect(gVit).toBeLessThan(upVit);

    const viv = fonte.indexOf("for (const s of vivas)");
    const gViv = fonte.indexOf("await gravarDadosAparelho(admin, userId, rcId", viv);
    const upViv = fonte.indexOf('.upsert(payload, { onConflict: "revenuecat_subscription_id" })', viv);
    expect(gViv).toBeGreaterThan(viv);
    expect(gViv).toBeLessThan(upViv);
  });

  it("falha ao gravar nunca derruba o sync (try/catch e só log)", () => {
    const corpo = fonte.slice(fonte.indexOf("async function gravarDadosAparelho"), fonte.indexOf("async function reconciliarRevenueCat"));
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch (e)");
    expect(corpo).not.toMatch(/throw /);
    // nunca loga o valor do IP/UA/IDFA
    expect(corpo).not.toMatch(/log\([^)]*client_ip:/);
  });
});
