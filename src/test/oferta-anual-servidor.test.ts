/**
 * OFERTA "ANUAL" DO /inicio (26/10) — o lado do servidor (_shared/ofertas-anual-inicio.ts):
 *   · OFB_anual27 (2790, 365 dias, annual), OFB_up47 (4790) e OFB_down27 (2790) vitalícios em LINHA NOVA — nos 3
 *     caminhos que creditam Pix da Asaas (pelos mapas do ofertas-hoje.ts) e com a descrição/marcação pedida;
 *   · EXPIRAÇÃO: o anual grava current_period_end = compra + 365 dias; o check-subscription só dá acesso dentro do
 *     período (+7 dias de carência do Pix) e pega a linha que vence por último (a vitalícia, depois do upgrade);
 *   · e-mail/CAPI/UTMify com o nome e o período certos (nada de "vitalício" pro anual).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditarPedido } from "../../supabase/functions/_shared/grant-pix";
import { CONCESSAO_HOJE, DESCRICAO_HOJE, PRECOS_HOJE, ehPlanoHoje, ehUpsellHoje } from "../../supabase/functions/_shared/ofertas-hoje";
import {
  CONCESSAO_ANUAL_INICIO, DESCRICAO_ANUAL_INICIO, PRECOS_ANUAL_INICIO, ehOfertaAnualDoInicio,
} from "../../supabase/functions/_shared/ofertas-anual-inicio";
import {
  assuntoVenda, emailVendaComLojas, htmlVenda, nomeDoProduto, periodoDoEmailVenda, planoUtmify,
} from "../../supabase/functions/_shared/email-venda";
import { decidirGrantPix } from "../../supabase/functions/_shared/linha-pix";
import { VALOR_ANUAL_REAIS, VALOR_DOWN_REAIS, VALOR_UP_REAIS } from "@/lib/oferta-anual";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

function bancoFalso() {
  const db = { subscriptions: [] as Array<Record<string, unknown>>, webhook_events: new Map<string, string>() };
  const ceder = () => new Promise((r) => setTimeout(r, 0));
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<[string, unknown]> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Record<string, unknown> } = { tipo: "select" };
    const casa = (row: Record<string, unknown>) => filtros.every(([k, v]) => row[k] === v);
    const exec = async () => {
      await ceder();
      if (tabela === "webhook_events") {
        const linhas = [...db.webhook_events.entries()].map(([id, processed_at]) => ({ id, processed_at }));
        if (op.tipo === "insert") {
          const id = String(op.dados!.id);
          if (db.webhook_events.has(id)) return { error: { code: "23505", message: "duplicate key" } };
          db.webhook_events.set(id, new Date().toISOString());
          return { error: null };
        }
        if (op.tipo === "delete") { for (const l of linhas.filter(casa)) db.webhook_events.delete(l.id); return { error: null }; }
        return { data: linhas.filter(casa), error: null };
      }
      if (op.tipo === "insert") { db.subscriptions.push({ id: `l${++seq}`, ...op.dados }); return { error: null }; }
      if (op.tipo === "update") { for (const r of db.subscriptions.filter(casa)) Object.assign(r, op.dados); return { error: null }; }
      return { data: db.subscriptions.filter(casa).map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => { op = { tipo: "select" }; return q; },
      insert: (d: Record<string, unknown>) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Record<string, unknown>) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push([k, v]); return q; },
      maybeSingle: () => q,
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { db, admin: { from } };
}
const AGORA = new Date("2026-10-26T15:00:00Z");
/** o mesmo payload que o check/webhook montam (asaas-pix / asaas-webhook) */
const creditar = (admin: { from: (t: string) => unknown }, orderId: string, oferta: string, agora = AGORA) => {
  const c = CONCESSAO_HOJE[oferta];
  const vitalicio = c.dias === null;
  return creditarPedido(admin as never, {
    userId: "u1", orderId, gateway: "asaas", concessao: c, agora, linhaNova: c.linhaNova === true,
    montarPayload: (fim) => ({
      user_id: "u1", status: "active", plan: vitalicio ? "lifetime" : c.plano, billing_period: vitalicio ? "lifetime" : c.periodo,
      payment_method: "pix", abacatepay_billing_id: orderId, current_period_start: agora.toISOString(), current_period_end: fim, amount_cents: PRECOS_HOJE[oferta],
    }),
  });
};

/** A regra do check-subscription (supabase/functions/check-subscription), em miniatura: a linha ativa que vence por
 *  último; dentro do período = acesso; vencida há ≤ 7 dias (Pix) = carência; depois disso, sem acesso. */
const acesso = (linhas: Array<Record<string, unknown>>, agora: Date) => {
  const vivas = linhas.filter((l) => ["active", "past_due", "cancel_scheduled"].includes(String(l.status)))
    .sort((a, b) => Date.parse(String(b.current_period_end)) - Date.parse(String(a.current_period_end)));
  const l = vivas[0];
  if (!l) return { subscribed: false };
  const fim = new Date(String(l.current_period_end));
  if (fim > agora) return { subscribed: true, billing_period: l.billing_period, grace: false };
  const dias = (agora.getTime() - fim.getTime()) / 86_400_000;
  return dias <= 7 ? { subscribed: true, billing_period: l.billing_period, grace: true } : { subscribed: false };
};

describe("as 3 ofertas no servidor (uma fonte: _shared/ofertas-anual-inicio.ts)", () => {
  it("preços em centavos = os da página; marcação/descrição pedidas", () => {
    expect(PRECOS_ANUAL_INICIO).toEqual({ OFB_anual27: 2790, OFB_up47: 4790, OFB_down27: 2790 });
    expect([VALOR_ANUAL_REAIS, VALOR_UP_REAIS, VALOR_DOWN_REAIS].map((v) => Math.round(v * 100))).toEqual([2790, 4790, 2790]);
    expect(DESCRICAO_ANUAL_INICIO).toEqual({ OFB_anual27: "CORE Anual", OFB_up47: "CORE Vitalicio upgrade", OFB_down27: "CORE Vitalicio upgrade" });
  });

  it("entram nos mapas do ofertas-hoje (que as 3 funções espalham) — sem virar plano/upsell do /hoje", () => {
    for (const k of Object.keys(PRECOS_ANUAL_INICIO)) {
      expect(PRECOS_HOJE[k]).toBe(PRECOS_ANUAL_INICIO[k]);
      expect(CONCESSAO_HOJE[k]).toEqual(CONCESSAO_ANUAL_INICIO[k]);
      expect(DESCRICAO_HOJE[k]).toBe(DESCRICAO_ANUAL_INICIO[k]);
      expect(ehPlanoHoje(k)).toBe(false);
      expect(ehUpsellHoje(k)).toBe(false);
      expect(ehOfertaAnualDoInicio(k)).toBe(true);
    }
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
      expect(fonte(f)).toMatch(/PRECOS_CENTAVOS[^\n]*\.\.\.PRECOS_HOJE/);
      expect(fonte(f)).toContain("CONCESSAO_HOJE");
    }
    // a marcação no Asaas: externalReference `<user>:<oferta>` e a descrição do mapa
    expect(fonte("asaas-pix/index.ts")).toContain("externalReference: `${user.id}:${offer}`");
    expect(fonte("asaas-pix/index.ts")).toContain("...DESCRICAO_HOJE");
    // o reconcile lê o linhaNova do CONCESSAO_HOJE
    expect(fonte("pix-reconcile/index.ts")).toContain("CONCESSAO_HOJE[o.offer]?.linhaNova === true");
  });

  it("a Cakto não vende estas ofertas (o checkout só manda a w27 pra lá)", () => {
    const pix = readFileSync(resolve(__dirname, "../components/paywall/PixCheckout.tsx"), "utf8");
    expect(pix).toContain('const OFERTAS_NA_CAKTO: PixOffer[] = ["w27"];');
  });
});

describe("o acesso: anual vence em 365 dias; upgrade = vitalício em linha nova", () => {
  it("OFB_anual27: 1 linha annual, R$ 27,90, até compra + 365 dias", async () => {
    const { db, admin } = bancoFalso();
    const r = await creditar(admin, "qr_anual", "OFB_anual27");
    expect(r).toMatchObject({ r: "creditado" });
    expect(db.subscriptions).toHaveLength(1);
    expect(db.subscriptions[0]).toMatchObject({ plan: "core-pro", billing_period: "annual", amount_cents: 2790, payment_method: "pix" });
    expect(String(db.subscriptions[0].current_period_end).slice(0, 10)).toBe("2027-10-26");
  });

  it("os 3 caminhos ao mesmo tempo (check, webhook, reconcile): 1 crédito só", async () => {
    const { db, admin } = bancoFalso();
    await Promise.all([1, 2, 3].map(() => creditar(admin, "qr_anual", "OFB_anual27")));
    expect(db.subscriptions).toHaveLength(1);
  });

  it("EXPIRAÇÃO: com acesso durante o ano, carência de 7 dias depois, e sem acesso a partir do 8º dia", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_anual", "OFB_anual27");
    const dia = (iso: string) => new Date(iso);
    expect(acesso(db.subscriptions, dia("2027-10-25T12:00:00Z"))).toMatchObject({ subscribed: true, billing_period: "annual", grace: false });
    expect(acesso(db.subscriptions, dia("2027-10-30T12:00:00Z"))).toMatchObject({ subscribed: true, grace: true });
    expect(acesso(db.subscriptions, dia("2027-11-03T16:00:00Z"))).toEqual({ subscribed: false });
  });

  it("o check-subscription de verdade segue essa regra (ordem por fim, 7 dias de carência, sem fim = ativo)", () => {
    const s = fonte("check-subscription/index.ts");
    expect(s).toContain('.order("current_period_end", { ascending: false, nullsFirst: false })');
    expect(s).toContain('.in("status", ["active", "past_due", "cancel_scheduled"])');
    expect(s).toContain("if (!endDate || endDate > now)");
    expect(s).toContain("daysSinceExpiry <= GRACE_PERIOD_DAYS");
    expect(fonte("subscription-grace-cleanup/index.ts")).toContain('.update({ status: "canceled" })');
  });

  it("anual + upsell (OFB_up47): 2 linhas — a do anual intacta, a vitalícia (+100 anos, 4790); o acesso vira vitalício pra sempre", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_anual", "OFB_anual27");
    const r = await creditar(admin, "qr_up", "OFB_up47");
    expect(r).toMatchObject({ r: "creditado", acao: "inserir" });
    expect(db.subscriptions).toHaveLength(2);
    expect(db.subscriptions[0]).toMatchObject({ abacatepay_billing_id: "qr_anual", amount_cents: 2790, billing_period: "annual" });
    expect(db.subscriptions[1]).toMatchObject({ abacatepay_billing_id: "qr_up", amount_cents: 4790, billing_period: "lifetime", plan: "lifetime" });
    expect(new Date(String(db.subscriptions[1].current_period_end)).getUTCFullYear()).toBe(2126);
    expect(acesso(db.subscriptions, new Date("2030-01-01T00:00:00Z"))).toMatchObject({ subscribed: true, billing_period: "lifetime" });
  });

  it("anual + downsell (OFB_down27): o mesmo vitalício por 2790; webhook atrasado do anual não credita de novo", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_anual", "OFB_anual27");
    await creditar(admin, "qr_down", "OFB_down27");
    const tarde = await creditar(admin, "qr_anual", "OFB_anual27");
    expect(["preservado", "ja_creditado"]).toContain(tarde.r);
    expect(db.subscriptions).toHaveLength(2);
    expect(db.subscriptions[1]).toMatchObject({ abacatepay_billing_id: "qr_down", amount_cents: 2790, billing_period: "lifetime" });
  });

  it("quem já é vitalício e paga o anual: a linha vitalícia é preservada (caso de reembolso, nunca rebaixa)", () => {
    const d = decidirGrantPix([{ id: "l1", user_id: "u1", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", current_period_end: "2126-01-01T00:00:00Z", abacatepay_billing_id: "x" } as never], CONCESSAO_HOJE.OFB_anual27, AGORA, "qr_novo");
    expect(d.acao).toBe("preservar");
  });
});

describe("e-mail, CAPI e UTMify com o produto certo", () => {
  it("anual: período annual, 'CORE Anual', e-mail com as lojas e 'nada é cobrado sozinho'", () => {
    expect(periodoDoEmailVenda("OFB_anual27")).toBe("annual");
    expect(nomeDoProduto({ offer: "OFB_anual27" })).toBe("CORE Anual");
    expect(planoUtmify("OFB_anual27")).toBe("annual");
    expect(emailVendaComLojas("OFB_anual27")).toBe(true);
    expect(emailVendaComLojas("w27")).toBe(false);
    const html = htmlVenda({ email: "ana@exemplo.com", periodo: "annual", fim: "2027-10-26T15:00:00Z", hoje: emailVendaComLojas("OFB_anual27") });
    expect(html).toContain("26/10/2027");
    expect(html).toContain("Nada é cobrado sozinho");
    expect(html).toContain("App Store");
    expect(html).not.toMatch(/vitalíc|pra sempre/i);
    expect(assuntoVenda("annual")).toBe("Seu plano anual do CORE tá ativo ✅");
  });

  it("upgrade (up/down): 'Seu CORE pra sempre', nome 'CORE Vitalício upgrade', UTMify lifetime", () => {
    for (const o of ["OFB_up47", "OFB_down27"]) {
      expect(periodoDoEmailVenda(o)).toBe("lifetime");
      expect(nomeDoProduto({ offer: o })).toBe("CORE Vitalício upgrade");
      expect(planoUtmify(o)).toBe("lifetime");
    }
  });

  it("o e-mail das boas-vindas passa o bloco das lojas pra oferta anual nos 2 caminhos que mandam (check e webhook)", () => {
    expect(fonte("asaas-pix/index.ts")).toContain("hoje: emailVendaComLojas(offer)");
    expect(fonte("asaas-webhook/index.ts")).toContain("hoje: emailVendaComLojas(offer)");
  });
});
