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
    expect(fonte).toContain("const aparelho = (corpo as { aparelho?: unknown } | null)?.aparelho;");
    expect(fonte).toContain("const dadosApp = dadosDoPedido(aparelho, cab);");
  });

  it("build antiga (sem `aparelho`): infere pela ficha, só sob demanda; 1.0.17 usa o corpo", () => {
    expect(fonte).toMatch(/const obterDados: ObterDados = aparelho === undefined\s*\?\s*\(\) => \(inferindo \?\?= fichaDoAparelho\(admin, user\.id\)\.then\(\(f\) => \(dadosLog = dadosInferidosDaFicha\(f, cab\)\)\)\)\s*:\s*\(\) => Promise\.resolve\(dadosApp\);/);
    const g = fonte.slice(fonte.indexOf("async function gravarDadosAparelho"), fonte.indexOf("async function reconciliarRevenueCat"));
    // a janela vem antes de qualquer leitura da ficha
    expect(g.indexOf("dentroDaJanela(inicio)")).toBeLessThan(g.indexOf("await obterDados()"));
    // o inferido (ficha do iPhone) não cola em compra de outra loja
    expect(g).toContain('if (dados.att_origem === "inferido_idfa" && loja && loja !== "app_store") return;');
    // a ficha: mesma busca do meta-backfill-app (conta e, na falta, sessões)
    const f = fonte.slice(fonte.indexOf("async function fichaDoAparelho"), fonte.indexOf("async function gravarDadosAparelho"));
    expect(f).toContain('.eq("event_name", "app_device_info")');
    expect(f).toContain('.in("session_id", ids)');
    expect(f).toContain("catch (e)");
  });

  it("grava antes do upsert, nas duas voltas", () => {
    const vit = fonte.indexOf("for (const v of vitalicias)");
    const gVit = fonte.indexOf("await gravarDadosAparelho(admin, userId, v.id, v.inicio, obterDados, v.loja)", vit);
    const upVit = fonte.indexOf('.from("subscriptions").upsert(', vit);
    expect(vit).toBeGreaterThan(0);
    expect(gVit).toBeGreaterThan(vit);
    expect(gVit).toBeLessThan(upVit);

    const viv = fonte.indexOf("for (const s of vivas)");
    const gViv = fonte.indexOf("await gravarDadosAparelho(admin, userId, rcId, s.starts_at ? new Date(s.starts_at).toISOString() : null, obterDados, typeof s.store", viv);
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
