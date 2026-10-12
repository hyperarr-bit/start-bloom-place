/**
 * PORTA v4 (12/10): "teste iniciado" e a 1ª cobrança como evento de SITE (pixel do site), montados no
 * revenuecat-webhook — as partes puras (supabase/functions/_shared/porta-capi.ts) e a chave de desligar.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MARCADOR, decidirCapiPorta, montarEventoCapiPorta, tipoDoEvento, urlDaPagina, type EventoRCPorta } from "../../supabase/functions/_shared/porta-capi";

const UID = "5cd06133-1111-4222-8333-444455556666";
const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
const PORTA = { attr: { landing: "/comece?utm_campaign=lua&fbclid=IwAR_x", fbc: "fb.1.1791000000000.IwAR_x", fbp: "fb.1.1790000000000.987" } };
const trial: EventoRCPorta = {
  id: "EVT-TRIAL-1", type: "INITIAL_PURCHASE", period_type: "TRIAL", store: "APP_STORE", product_id: "core_anual_97",
  price: 0, price_in_purchased_currency: 0, currency: "BRL", app_user_id: UID, transaction_id: "200001", original_transaction_id: "200001",
  purchased_at_ms: Date.parse("2026-10-12T14:00:00Z"),
};
const conversao: EventoRCPorta = {
  id: "EVT-RENEW-1", type: "RENEWAL", period_type: "NORMAL", is_trial_conversion: true, store: "APP_STORE", product_id: "core_anual_97",
  price: 17.6, price_in_purchased_currency: 97.9, currency: "BRL", app_user_id: UID, transaction_id: "200002", original_transaction_id: "200001",
  purchased_at_ms: Date.parse("2026-10-15T14:00:00Z"),
};

describe("que evento do RevenueCat vira evento de site", () => {
  it("INITIAL_PURCHASE de teste → trial; 1ª cobrança do anual → pago; o resto, nada", () => {
    expect(tipoDoEvento(trial)).toBe("trial");
    expect(tipoDoEvento(conversao)).toBe("pago");
    expect(tipoDoEvento({ ...conversao, type: "INITIAL_PURCHASE", period_type: "NORMAL", is_trial_conversion: null })).toBe("pago"); // anual pago direto
    expect(tipoDoEvento({ ...conversao, is_trial_conversion: false })).toBeNull(); // renovação do 2º ano
    expect(tipoDoEvento({ ...conversao, type: "CANCELLATION" })).toBeNull();
    expect(tipoDoEvento({ ...conversao, type: "BILLING_ISSUE" })).toBeNull();
    expect(tipoDoEvento({ ...conversao, product_id: "core_mensal" })).toBeNull();
    expect(tipoDoEvento({ ...trial, type: "UNCANCELLATION" })).toBeNull();
  });

  it("só com a chave ligada, só conta da Porta, 1x (marcador)", () => {
    expect(decidirCapiPorta({ ligado: false, ev: trial, porta: PORTA, jaEnviado: false })).toEqual({ manda: false, motivo: "desligado" });
    expect(decidirCapiPorta({ ligado: true, ev: trial, porta: null, jaEnviado: false })).toEqual({ manda: false, motivo: "sem_porta" });
    expect(decidirCapiPorta({ ligado: true, ev: { ...trial, type: "EXPIRATION" }, porta: PORTA, jaEnviado: false })).toEqual({ manda: false, motivo: "evento_fora" });
    expect(decidirCapiPorta({ ligado: true, ev: trial, porta: PORTA, jaEnviado: true })).toEqual({ manda: false, motivo: "ja_enviado" });
    expect(decidirCapiPorta({ ligado: true, ev: trial, porta: PORTA, jaEnviado: false })).toEqual({ manda: true, tipo: "trial" });
    expect(MARCADOR).toEqual({ trial: "porta_capi_trial", pago: "porta_capi_pago" });
  });
});

describe("o evento montado", () => {
  it("StartTrial: website, URL inteira da chegada, em/external_id em SHA-256, fbc/fbp, SEM IP/UA, event_id determinístico", async () => {
    const e = await montarEventoCapiPorta({ tipo: "trial", ev: trial, uid: UID, email: " Ana@Exemplo.com ", porta: PORTA, agoraMs: Date.parse("2026-10-12T14:00:05Z") });
    expect(e).toEqual({
      event_name: "StartTrial",
      event_time: Math.floor(Date.parse("2026-10-12T14:00:00Z") / 1000),
      event_id: "porta_trial_EVT-TRIAL-1",
      action_source: "website",
      event_source_url: "https://coreaplicativo.com.br/comece?utm_campaign=lua&fbclid=IwAR_x",
      user_data: { external_id: [sha(UID)], em: [sha("ana@exemplo.com")], fbc: PORTA.attr.fbc, fbp: PORTA.attr.fbp },
      custom_data: { content_name: "porta_iphone", currency: "BRL" },
    });
    const ud = e.user_data as Record<string, unknown>;
    expect(ud.client_ip_address).toBeUndefined();
    expect(ud.client_user_agent).toBeUndefined();
    // reenvio do mesmo evento do RevenueCat = o MESMO event_id (a Meta deduplica)
    const de_novo = await montarEventoCapiPorta({ tipo: "trial", ev: trial, uid: UID, email: "ana@exemplo.com", porta: PORTA });
    expect(de_novo.event_id).toBe(e.event_id);
  });

  it("Purchase da conversão: valor 97,90 BRL; event_id porta_pago_<id>; evento velho trava em 6,5 dias", async () => {
    const agora = Date.parse("2026-10-15T14:10:00Z");
    const e = await montarEventoCapiPorta({ tipo: "pago", ev: conversao, uid: UID, email: "ana@exemplo.com", porta: PORTA, agoraMs: agora });
    expect(e).toMatchObject({ event_name: "Purchase", event_id: "porta_pago_EVT-RENEW-1", action_source: "website", custom_data: { content_name: "porta_iphone", currency: "BRL", value: 97.9 } });
    // sem preço em BRL no evento: o preço do produto (core_anual_97)
    const semPreco = await montarEventoCapiPorta({ tipo: "pago", ev: { ...conversao, price_in_purchased_currency: null, currency: "USD" }, uid: UID, email: null, porta: { attr: {} }, agoraMs: agora });
    expect((semPreco.custom_data as { value: number }).value).toBe(97.9);
    expect(semPreco.event_source_url).toBe("https://coreaplicativo.com.br/comece");
    expect((semPreco.user_data as Record<string, unknown>).em).toBeUndefined();
    const velho = await montarEventoCapiPorta({ tipo: "pago", ev: { ...conversao, purchased_at_ms: agora - 10 * 86_400_000 }, uid: UID, email: null, porta: PORTA, agoraMs: agora });
    expect(velho.event_time).toBe(Math.floor(agora / 1000) - Math.floor(6.5 * 86400));
  });

  it("urlDaPagina: caminho vira URL inteira; URL fica; vazio vira /comece", () => {
    expect(urlDaPagina("/comece?x=1")).toBe("https://coreaplicativo.com.br/comece?x=1");
    expect(urlDaPagina("https://coreaplicativo.com.br/comece")).toBe("https://coreaplicativo.com.br/comece");
    expect(urlDaPagina("")).toBe("https://coreaplicativo.com.br/comece");
    expect(urlDaPagina(undefined)).toBe("https://coreaplicativo.com.br/comece");
  });
});

describe("no webhook", () => {
  const fn = readFileSync(join(process.cwd(), "supabase/functions/revenuecat-webhook/index.ts"), "utf8");

  it("só roda com PORTA_CAPI_TRIAL=on, depois da reconciliação, e nunca derruba o webhook", () => {
    expect(fn).toContain('if (Deno.env.get("PORTA_CAPI_TRIAL") === "on") await capiPortaDoSite(admin, ev as EventoRCPorta, u.user).catch(');
    expect(fn.indexOf("capiPortaDoSite(admin, ev")).toBeGreaterThan(fn.indexOf("const r = await reconciliarRevenueCat(admin, uid"));
    // a única chamada nova no fluxo principal é essa
    expect(fn.match(/capiPortaDoSite\(/g)).toHaveLength(2); // a chamada + a definição
  });

  it("pixel do SITE (META_PIXEL_ID/META_CAPI_TOKEN), marca só com a Meta aceitando, 1x por conta", () => {
    const corpo = fn.slice(fn.indexOf("async function capiPortaDoSite"), fn.indexOf("/** Chama a cobranca-recusada"));
    expect(corpo).toContain('Deno.env.get("META_PIXEL_ID")');
    expect(corpo).toContain('Deno.env.get("META_CAPI_TOKEN")');
    expect(corpo).not.toContain("META_APP_DATASET_ID");
    expect(corpo).toContain('.eq("event_name", MARCADOR[tipo]).eq("user_id", user.id)');
    expect(corpo).toMatch(/if \(r\.ok\) \{\s*await admin\.from\("analytics_events"\)\.insert/);
    expect(corpo).not.toMatch(/client_ip_address|client_user_agent/);
  });
});
