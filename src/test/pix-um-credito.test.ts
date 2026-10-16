/**
 * 1 PEDIDO = 1 CRÉDITO (15/10, revisão da venda da web /assinar).
 *
 * O bloqueio: o MESMO Pix `a97` pago era creditado pelo check da página E pelo webhook da Asaas — o prazo empilhava
 * (2 anos) e saíam 2 boas-vindas. Agora os 3 caminhos (asaas-pix check, asaas-webhook, pix-reconcile) passam por
 * _shared/grant-pix.ts: pedido já numa linha própria = "ja_creditado" (nada se escreve, nada sai) + trava de corrida
 * em webhook_events (`grant:asaas:<pedido>`). Também: o valor pago tem que cobrir o preço da oferta, e a venda-capi
 * só aceita os preços da venda.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditarPedido } from "../../supabase/functions/_shared/grant-pix";
import { TRAVA_VELHA_MS, chaveTrava, valorCobre } from "../../supabase/functions/_shared/trava-grant";
import { decidirGrantPix } from "../../supabase/functions/_shared/linha-pix";
import { VALORES_VENDA, validarPedido } from "../../supabase/functions/_shared/venda-capi";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

/** Banco falso: subscriptions + webhook_events (id = chave primária). Toda operação cede a vez (setTimeout 0), então
 *  dois caminhos AO MESMO TEMPO se intercalam como no servidor de verdade. */
function bancoFalso(opts: { falharInsertVezes?: number } = {}) {
  const db = {
    subscriptions: [] as Array<Record<string, unknown>>,
    webhook_events: new Map<string, string>(),
    falharInsert: opts.falharInsertVezes ?? 0,
  };
  const ceder = () => new Promise((r) => setTimeout(r, 0));
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<[string, unknown]> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Record<string, unknown> } = { tipo: "select" };
    let unico = false;
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
        const achadas = linhas.filter(casa);
        return { data: unico ? achadas[0] ?? null : achadas, error: null };
      }
      if (op.tipo === "insert") {
        if (db.falharInsert > 0) { db.falharInsert--; return { error: { message: "falha simulada" } }; }
        db.subscriptions.push({ id: `l${++seq}`, ...op.dados });
        return { error: null };
      }
      if (op.tipo === "update") { for (const r of db.subscriptions.filter(casa)) Object.assign(r, op.dados); return { error: null }; }
      return { data: db.subscriptions.filter(casa).map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => { op = { tipo: "select" }; return q; },
      insert: (d: Record<string, unknown>) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Record<string, unknown>) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push([k, v]); return q; },
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { db, admin: { from } };
}

const AGORA = new Date("2026-10-15T12:00:00Z");
const A97 = { dias: 365 };
const creditar = (admin: { from: (t: string) => unknown }, orderId = "qr_1", concessao: { dias: number | null } = A97, agora = AGORA) =>
  creditarPedido(admin as never, {
    userId: "u1", orderId, gateway: "asaas", concessao, agora,
    montarPayload: (fim) => ({
      user_id: "u1", status: "active", plan: concessao.dias === null ? "lifetime" : "core-pro",
      billing_period: concessao.dias === null ? "lifetime" : "annual", payment_method: "pix", abacatepay_billing_id: orderId, current_period_end: fim,
    }),
  });
/** "e-mails" = vezes que um caminho voltou creditado com jaLiberado=false (é o que manda boas-vindas/CAPI/UTMify) */
const emails = (rs: Array<{ r: string; jaLiberado?: boolean }>) => rs.filter((x) => x.r === "creditado" && !x.jaLiberado).length;
const fimDe = (row: Record<string, unknown>) => String(row.current_period_end).slice(0, 10);

describe("1 pedido = 1 crédito (check da página × webhook × reconcile)", () => {
  it("a97 creditado 2x em sequência (check e depois webhook): 365 dias, 1 linha, 1 e-mail", async () => {
    const { db, admin } = bancoFalso();
    const r1 = await creditar(admin);
    const r2 = await creditar(admin, "qr_1", A97, new Date("2026-10-15T12:00:05Z"));
    expect(r1).toMatchObject({ r: "creditado", acao: "inserir", jaLiberado: false });
    expect(r2).toEqual({ r: "ja_creditado" });
    expect(db.subscriptions).toHaveLength(1);
    expect(fimDe(db.subscriptions[0])).toBe("2027-10-15");
    expect(emails([r1, r2])).toBe(1);
    expect(db.webhook_events.has(chaveTrava("asaas", "qr_1"))).toBe(true);
  });

  it("a97 creditado AO MESMO TEMPO por 3 caminhos: 1 linha, 365 dias, 1 e-mail", async () => {
    const { db, admin } = bancoFalso();
    const rs = await Promise.all([creditar(admin), creditar(admin), creditar(admin)]);
    expect(rs.filter((x) => x.r === "creditado")).toHaveLength(1);
    expect(rs.every((x) => ["creditado", "ja_creditado", "em_andamento"].includes(x.r))).toBe(true);
    expect(db.subscriptions).toHaveLength(1);
    expect(fimDe(db.subscriptions[0])).toBe("2027-10-15");
    expect(emails(rs)).toBe(1);
  });

  it("w25 (mês pré-pago) tem a mesma proteção: 30 dias uma vez só, mesmo junto", async () => {
    const { db, admin } = bancoFalso();
    const rs = await Promise.all([creditar(admin, "qr_w25", { dias: 30 }), creditar(admin, "qr_w25", { dias: 30 })]);
    const r3 = await creditar(admin, "qr_w25", { dias: 30 });
    expect(r3.r).toBe("ja_creditado");
    expect(db.subscriptions).toHaveLength(1);
    expect(fimDe(db.subscriptions[0])).toBe("2026-11-14");
    expect(emails([...rs, r3])).toBe(1);
  });

  it("um pedido NOVO da mesma pessoa continua empilhando (renovar antes de vencer não perde dias)", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_1");
    const r = await creditar(admin, "qr_2");
    expect(r).toMatchObject({ r: "creditado", acao: "atualizar" });
    expect(db.subscriptions).toHaveLength(1);
    expect(fimDe(db.subscriptions[0])).toBe("2028-10-14");
  });

  it("vitalício: +100 anos e 1 e-mail, como sempre; a 2ª passada do MESMO pedido não reescreve nem manda nada", async () => {
    const { db, admin } = bancoFalso();
    const rs = await Promise.all([creditar(admin, "qr_v", { dias: null }), creditar(admin, "qr_v", { dias: null })]);
    const r3 = await creditar(admin, "qr_v", { dias: null });
    expect(db.subscriptions).toHaveLength(1);
    expect(new Date(String(db.subscriptions[0].current_period_end)).getUTCFullYear()).toBe(2126);
    expect(emails([...rs, r3])).toBe(1);
    expect(r3.r).toBe("ja_creditado");
    // outro pedido vitalício de quem já é vitalício: como antes (escreve, jaLiberado → sem e-mail)
    const r4 = await creditar(admin, "qr_v2", { dias: null });
    expect(r4).toMatchObject({ r: "creditado", jaLiberado: true });
    // vitalício que paga o mês: preservado, como antes
    expect((await creditar(admin, "qr_mes", { dias: 30 })).r).toBe("preservado");
  });

  it("grant que falha SOLTA a trava: o próximo caminho credita", async () => {
    const { db, admin } = bancoFalso({ falharInsertVezes: 1 });
    const r1 = await creditar(admin);
    expect(r1.r).toBe("erro");
    expect(db.webhook_events.has(chaveTrava("asaas", "qr_1"))).toBe(false);
    const r2 = await creditar(admin);
    expect(r2).toMatchObject({ r: "creditado", jaLiberado: false });
    expect(db.subscriptions).toHaveLength(1);
  });

  it("trava nova sem linha = em andamento (não escreve); trava velha sem linha (o caminho morreu) é retomada", async () => {
    const { db, admin } = bancoFalso();
    db.webhook_events.set(chaveTrava("asaas", "qr_1"), new Date().toISOString());
    expect((await creditar(admin)).r).toBe("em_andamento");
    expect(db.subscriptions).toHaveLength(0);
    db.webhook_events.set(chaveTrava("asaas", "qr_1"), new Date(Date.now() - TRAVA_VELHA_MS - 1000).toISOString());
    expect((await creditar(admin)).r).toBe("creditado");
    expect(db.subscriptions).toHaveLength(1);
  });

  it("linha da LOJA com o mesmo id não conta como creditado; sem o id do pedido nada muda", () => {
    const loja = { id: "loja", status: "active", payment_method: "play_store", revenuecat_subscription_id: "subA", abacatepay_billing_id: "qr_1", current_period_end: "2026-12-01T00:00:00Z" };
    expect(decidirGrantPix([loja], A97, AGORA, "qr_1").acao).toBe("inserir");
    expect(decidirGrantPix([{ id: "p", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_1" }], A97, AGORA).acao).toBe("atualizar");
    expect(decidirGrantPix([{ id: "p", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_1" }], A97, AGORA, "qr_1").acao).toBe("ja_creditado");
  });

  it("os 3 caminhos da Asaas usam o creditarPedido com a MESMA chave de trava e conferem o valor", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
      const s = fonte(f);
      expect(s).toContain("creditarPedido(");
      expect(s).toContain("valorCobre(");
    }
    expect(fonte("asaas-pix/index.ts")).toContain('gateway: "asaas"');
    expect(fonte("asaas-webhook/index.ts")).toContain('gateway: "asaas"');
    expect(fonte("pix-reconcile/index.ts")).toMatch(/: "asaas";/);
    expect(fonte("_shared/linha-pix.ts")).toContain("revenuecat_subscription_id, abacatepay_billing_id");
  });
});

describe("valor pago × preço da oferta", () => {
  it("cobre só se o valor (em reais) >= o preço da oferta DELE, em centavos", () => {
    expect(valorCobre(97.9, 9790)).toBe(true);
    expect(valorCobre("97.90", 9790)).toBe(true);
    expect(valorCobre(97.89, 9790)).toBe(false);
    expect(valorCobre(1, 9790)).toBe(false);
    expect(valorCobre(24.9, 2490)).toBe(true); // w25
    expect(valorCobre(14.9, 1490)).toBe(true); // downsell da Asaas
    expect(valorCobre(27.9, 2790)).toBe(true); // w27
    expect(valorCobre(undefined, 9790)).toBe(false);
    expect(valorCobre(97.9, undefined)).toBe(false);
  });
  it("cada função confere com o preço da PRÓPRIA oferta; o reconcile pelo valor DO PEDIDO (amount_cents do create)", () => {
    expect(fonte("asaas-pix/index.ts")).toContain("valorCobre((r.pago as { value?: unknown }).value, PRECOS_CENTAVOS[offer])");
    expect(fonte("asaas-webhook/index.ts")).toContain("valorCobre(pago.value, amountCents)");
    expect(fonte("pix-reconcile/index.ts")).toContain("valorCobre(v.valorReais, o.amountCents ?? PRECOS_CENTAVOS[o.offer])");
  });
});

describe("venda-capi: só os valores da venda", () => {
  it("InitiateCheckout só com 97,90, 69,90 (16/10: o presente do /assinatura) ou 24,90; ViewContent sem valor; o resto recusa", () => {
    expect(VALORES_VENDA).toEqual([97.9, 69.9, 24.9]);
    expect(validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_1b2c3d4e-aaaa", valor: 69.9 })).not.toBeNull();
    expect(validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_1b2c3d4e-aaaa", valor: 69.91 })).toBeNull();
    const base = { evento: "InitiateCheckout", event_id: "venda_ic_1b2c3d4e-aaaa" };
    expect(validarPedido({ ...base, valor: 97.9 })).not.toBeNull();
    expect(validarPedido({ ...base, valor: 24.9 })).not.toBeNull();
    expect(validarPedido({ ...base, valor: 979 })).toBeNull();
    expect(validarPedido({ ...base, valor: 97.91 })).toBeNull();
    expect(validarPedido({ ...base, valor: "97.9" })).toBeNull();
    expect(validarPedido(base)).toBeNull();
    expect(validarPedido({ evento: "ViewContent", event_id: "venda_vc_1b2c3d4e", valor: 97.9 })).toBeNull();
    expect(validarPedido({ evento: "ViewContent", event_id: "venda_vc_1b2c3d4e" })).not.toBeNull();
  });
});
