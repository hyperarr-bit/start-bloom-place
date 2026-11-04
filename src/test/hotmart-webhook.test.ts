/**
 * HOTMART-WEBHOOK (04/11, /vida) — as regras de supabase/functions/_shared/hotmart.ts com um banco falso:
 *   hottok errado/ausente → 401 e nada; aprovado → libera o vitalício (linha "hotmart", valor da Hotmart) + 1 e-mail + 1 Purchase
 *   (event_id = transação, valor real) + aviso; repetido (e o COMPLETE depois) → nada em dobro; reembolso/chargeback → desliga;
 *   a conta: pela ref (anônima ganha o e-mail) × e-mail × nova; o e-mail da ref já de outra conta → vai pra outra.
 * E as contas do /vendas: taxa Hotmart 9,9% + R$ 1,00 (97,90 → 87,21), a venda Hotmart é venda do site e avisa o dono.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tratarHotmart, lerCompraHotmart, hottokOk, mascararEmail, escolherRegistroHotmart, type DepsHotmart } from "../../supabase/functions/_shared/hotmart";
import { validarInicio, linhaDoPedidoHotmart } from "../../supabase/functions/_shared/hotmart-iniciar";
import { vendaPix, tituloVenda } from "../../supabase/functions/_shared/aviso-venda";
import { funilLanding, resumoDoDia, taxaSiteCents, vendasDoDia } from "../../supabase/functions/_shared/vendas-painel";

const SECRET = "tok_hotmart_123";
type Linha = Record<string, unknown>;

function bancoFalso() {
  const db = {
    subscriptions: [] as Linha[],
    webhook_events: new Map<string, string>(),
    analytics_events: [] as Linha[],
    users: new Map<string, { id: string; email: string | null }>(),
  };
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Linha } = { tipo: "select" };
    let unico = false;
    const exec = async () => {
      await new Promise((r) => setTimeout(r, 0));
      const casa = (r: Linha) => filtros.every((f) => f(r));
      if (tabela === "webhook_events") {
        if (op.tipo === "insert") {
          const id = String(op.dados!.id);
          if (db.webhook_events.has(id)) return { error: { code: "23505", message: "duplicate" } };
          db.webhook_events.set(id, new Date().toISOString()); return { error: null };
        }
        const linhas = [...db.webhook_events.entries()].map(([id, processed_at]) => ({ id, processed_at }));
        if (op.tipo === "delete") { for (const l of linhas.filter(casa)) db.webhook_events.delete(l.id); return { error: null }; }
        const a = linhas.filter(casa); return { data: unico ? a[0] ?? null : a, error: null };
      }
      const t = tabela === "subscriptions" ? db.subscriptions : db.analytics_events;
      if (op.tipo === "insert") { t.push({ id: `l${++seq}`, created_at: new Date().toISOString(), ...op.dados }); return { error: null }; }
      if (op.tipo === "update") { for (const r of t.filter(casa)) Object.assign(r, op.dados); return { error: null }; }
      const a = t.filter(casa).map((r) => ({ ...r }));
      return { data: unico ? a[0] ?? null : a, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => { if (op.tipo !== "update") op = { tipo: "select" }; return q; },
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => r[k] === v); return q; },
      contains: (k: string, v: Record<string, unknown>) => { filtros.push((r) => Object.entries(v).every(([kk, vv]) => (r[k] as Linha | undefined)?.[kk] === vv)); return q; },
      limit: () => q,
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  const auth = { admin: {
    getUserById: async (id: string) => ({ data: { user: db.users.get(id) ?? null }, error: null }),
    updateUserById: async (id: string, a: Linha) => {
      const e = String(a.email ?? "");
      if ([...db.users.values()].some((u) => u.email === e && u.id !== id)) return { data: null, error: { message: "already registered" } };
      const u = db.users.get(id)!; u.email = e; return { data: { user: u }, error: null };
    },
    createUser: async (a: Linha) => { const id = `u_novo${++seq}`; const u = { id, email: String(a.email) }; db.users.set(id, u); return { data: { user: u }, error: null }; },
  } };
  return { db, admin: { from, auth } };
}

function montar(db = bancoFalso()) {
  const saida = { emails: [] as Array<{ para: string; assunto: string; html: string }>, capi: [] as Linha[], avisos: [] as string[], logs: [] as string[] };
  const deps: DepsHotmart = {
    admin: db.admin as never, secret: SECRET,
    acharConta: async (email) => [...db.db.users.values()].find((u) => u.email === email.toLowerCase())?.id ?? null,
    enviarEmail: async (para, assunto, html) => { saida.emails.push({ para, assunto, html }); return true; },
    mandarCapi: async (c) => { saida.capi.push(c); return true; },
    avisarVenda: async (id) => { saida.avisos.push(id); },
    log: (p, d) => { saida.logs.push(`${p} ${JSON.stringify(d ?? {})}`); },
    agora: () => new Date("2026-11-04T15:00:00Z"),
  };
  return { ...db, deps, saida };
}

const compra = (o: { evento?: string; tx?: string; email?: string | null; sck?: string | null; valor?: number; status?: string } = {}) => ({
  id: `evt-${Math.random()}`, creation_date: 1762268400000, event: o.evento ?? "PURCHASE_APPROVED", version: "2.0.0",
  data: {
    product: { id: 123456, name: "CORE vitalício" },
    buyer: { email: o.email === undefined ? "Maria@Exemplo.com" : o.email, name: "Maria Souza" },
    purchase: {
      transaction: o.tx ?? "HP17715690036014", status: o.status ?? "APPROVED",
      price: { value: o.valor ?? 97.9, currency_value: "BRL" }, full_price: { value: 102.5, currency_value: "BRL" },
      payment: { type: "PIX", installments_number: 1 }, origin: { sck: o.sck === undefined ? null : o.sck, src: "criativo_7" },
    },
  },
});
const REF = "0f8a5c2e-1111-4222-8333-944455556666";
const registrar = (db: ReturnType<typeof bancoFalso>["db"], userId: string | null, extra: Linha = {}) =>
  db.analytics_events.push({ id: `a${db.analytics_events.length}`, event_name: "hotmart_order_created", user_id: userId, created_at: "2026-11-04T14:58:00.000Z",
    event_data: { ref: REF, gateway: "hotmart", fbp: "fb.1.1.abc", fbclid: "IwAR_x", client_ip: "200.1.2.3", user_agent: "Mozilla/5.0 iPhone", source_url: "https://www.coreaplicativo.com.br/vida?utm_content=criativo_7", ...extra } });

describe("hottok", () => {
  it("errado, ausente ou sem secret → 401 e nada acontece", async () => {
    const m = montar();
    expect((await tratarHotmart(m.deps, { hottok: "errado", body: compra() })).status).toBe(401);
    expect((await tratarHotmart(m.deps, { hottok: null, body: compra() })).status).toBe(401);
    expect((await tratarHotmart({ ...m.deps, secret: null }, { hottok: SECRET, body: compra() })).status).toBe(401);
    expect((await tratarHotmart({ ...m.deps, secret: "" }, { hottok: "", body: compra() })).status).toBe(401);
    expect(m.db.subscriptions).toHaveLength(0);
    expect(m.db.webhook_events.size).toBe(0);
    expect(m.saida.capi).toHaveLength(0);
    expect(hottokOk(SECRET, SECRET)).toBe(true);
    expect(hottokOk(`${SECRET}x`, SECRET)).toBe(false);
  });
});

describe("compra aprovada", () => {
  it("libera o VITALÍCIO na linha da Hotmart (valor da Hotmart), 1 e-mail da compra, 1 Purchase (event_id = transação, valor real, sinais do pedido) e o aviso", async () => {
    const m = montar();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    registrar(m.db, "u_anon");
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ sck: REF }) });
    expect(r).toMatchObject({ status: 200, corpo: { liberado: true, novo: true, via: "ref_batizada" } });
    expect(m.db.subscriptions).toHaveLength(1);
    const l = m.db.subscriptions[0];
    expect(l).toMatchObject({ user_id: "u_anon", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "hotmart", abacatepay_billing_id: "HP17715690036014", amount_cents: 9790, customer_email: "maria@exemplo.com" });
    expect(Date.parse(String(l.current_period_end))).toBeGreaterThan(Date.parse("2120-01-01"));
    expect(m.db.users.get("u_anon")!.email).toBe("maria@exemplo.com"); // a anônima da sessão ganhou o e-mail (os dados dela ficam)
    expect(m.saida.emails).toHaveLength(1);
    expect(m.saida.emails[0].para).toBe("maria@exemplo.com");
    expect(m.saida.emails[0].html).toContain("pra sempre");
    expect(m.saida.emails[0].html).toContain("Já tenho conta?");
    expect(m.saida.capi).toHaveLength(1);
    const ev = (m.saida.capi[0].data as Linha[])[0] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ev).toMatchObject({ event_name: "Purchase", event_id: "HP17715690036014", action_source: "website", event_source_url: "https://www.coreaplicativo.com.br/vida?utm_content=criativo_7" });
    expect(ev.custom_data).toMatchObject({ value: 97.9, currency: "BRL" });
    expect(ev.user_data).toMatchObject({ fbp: "fb.1.1.abc", client_ip_address: "200.1.2.3", client_user_agent: "Mozilla/5.0 iPhone" });
    expect(ev.user_data.fbc).toBe(`fb.1.${Date.parse("2026-11-04T14:58:00.000Z")}.IwAR_x`); // sem _fbc: montado do fbclid + hora do pedido
    expect(ev.user_data.em[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(m.saida.avisos).toEqual([l.id]);
    expect(m.saida.logs.join("\n")).not.toContain("maria@exemplo.com"); // e-mail mascarado no log
    expect(m.saida.logs.join("\n")).not.toContain(SECRET);
  });

  it("o valor do Purchase e da linha é o da compra (nada fixo): R$ 69,90 com cupom → 6990", async () => {
    const m = montar();
    await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ valor: 69.9 }) });
    expect(m.db.subscriptions[0].amount_cents).toBe(6990);
    expect(((m.saida.capi[0].data as Linha[])[0].custom_data as Linha).value).toBe(69.9);
  });

  it("repetido (mesmo evento 2×) e o PURCHASE_COMPLETE depois → nada em dobro (1 linha, 1 e-mail, 1 Purchase, 1 aviso)", async () => {
    const m = montar();
    await tratarHotmart(m.deps, { hottok: SECRET, body: compra() });
    const r2 = await tratarHotmart(m.deps, { hottok: SECRET, body: compra() });
    expect(r2.corpo).toMatchObject({ duplicado: true });
    const r3 = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ evento: "PURCHASE_COMPLETE", status: "COMPLETE" }) });
    expect(r3).toMatchObject({ status: 200, corpo: { novo: false } });
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.saida.emails).toHaveLength(1);
    expect(m.saida.capi).toHaveLength(1);
    expect(m.saida.avisos).toHaveLength(1);
  });

  it("os 2 ao mesmo tempo (APPROVED + COMPLETE chegando juntos) → 1 crédito só", async () => {
    const m = montar();
    const rs = await Promise.all([
      tratarHotmart(m.deps, { hottok: SECRET, body: compra() }),
      tratarHotmart(m.deps, { hottok: SECRET, body: compra({ evento: "PURCHASE_COMPLETE", status: "COMPLETE" }) }),
    ]);
    expect(m.db.subscriptions).toHaveLength(1);
    expect(m.saida.capi.length + m.saida.emails.length).toBe(2);
    // quem chegou junto e não creditou devolve 500 (a Hotmart reenvia) ou "nada a creditar" — nunca um 2º crédito
    for (const r of rs) expect([200, 500]).toContain(r.status);
  });

  it("evento de pago com valor zero/moeda estranha ou status não pago → não libera", async () => {
    const m = montar();
    await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ tx: "HP1", valor: 0 }) });
    const b = compra({ tx: "HP2" }); (b.data.purchase.price as Linha).currency_value = "USD";
    await tratarHotmart(m.deps, { hottok: SECRET, body: b });
    await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ tx: "HP3", status: "WAITING_PAYMENT" }) });
    expect(m.db.subscriptions).toHaveLength(0);
  });

  it("outros eventos (boleto impresso, atrasado, expirou) → 200 e nada", async () => {
    const m = montar();
    for (const e of ["PURCHASE_BILLET_PRINTED", "PURCHASE_DELAYED", "PURCHASE_EXPIRED", "PURCHASE_PROTEST", "SUBSCRIPTION_CANCELLATION"]) {
      expect(await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ evento: e }) })).toMatchObject({ status: 200, corpo: { ignorado: "evento" } });
    }
    expect(m.db.subscriptions).toHaveLength(0);
    expect(m.db.webhook_events.size).toBe(0);
  });

  it("HOTMART_PRODUTO_ID configurado: outro produto é ignorado", async () => {
    const m = montar();
    const r = await tratarHotmart({ ...m.deps, produtoId: "999" }, { hottok: SECRET, body: compra() });
    expect(r.corpo).toMatchObject({ ignorado: "outro_produto" });
    expect(m.db.subscriptions).toHaveLength(0);
  });

  it("erro nosso no meio → 500 e a chave é solta (o reenvio da Hotmart credita)", async () => {
    const m = montar();
    const quebrado = { ...m.deps, admin: { ...m.deps.admin, from: (t: string) => (t === "subscriptions" ? (() => { throw new Error("banco fora"); })() : (m.admin.from as (t: string) => unknown)(t)) } } as DepsHotmart;
    expect((await tratarHotmart(quebrado, { hottok: SECRET, body: compra() })).status).toBe(500);
    expect([...m.db.webhook_events.keys()].some((k) => k.startsWith("hotmart:HP"))).toBe(false);
    expect((await tratarHotmart(m.deps, { hottok: SECRET, body: compra() })).corpo).toMatchObject({ novo: true });
  });
});

describe("de quem é a compra", () => {
  it("pela REF: conta da sessão que já tem e-mail fica com a compra (mesmo com outro e-mail no checkout)", async () => {
    const m = montar();
    m.db.users.set("u_ref", { id: "u_ref", email: "ana@exemplo.com" });
    registrar(m.db, "u_ref");
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ sck: REF }) });
    expect(r.corpo).toMatchObject({ via: "ref" });
    expect(m.db.subscriptions[0]).toMatchObject({ user_id: "u_ref", customer_email: "ana@exemplo.com" });
    expect(m.saida.emails[0].para).toBe("ana@exemplo.com");
  });

  it("pela REF sem e-mail, mas o e-mail do comprador já é de OUTRA conta → a compra vai pra outra (e fica no log)", async () => {
    const m = montar();
    m.db.users.set("u_anon", { id: "u_anon", email: null });
    m.db.users.set("u_maria", { id: "u_maria", email: "maria@exemplo.com" });
    registrar(m.db, "u_anon");
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ sck: REF }) });
    expect(r.corpo).toMatchObject({ via: "email_outra_conta" });
    expect(m.db.subscriptions[0].user_id).toBe("u_maria");
    expect(m.db.users.get("u_anon")!.email).toBeNull();
    expect(m.saida.logs.some((l) => l.includes("email_outra_conta"))).toBe(true);
  });

  it("sem ref (ou ref desconhecida): pelo E-MAIL do comprador", async () => {
    const m = montar();
    m.db.users.set("u_maria", { id: "u_maria", email: "maria@exemplo.com" });
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ sck: "ref-que-nao-existe" }) });
    expect(r.corpo).toMatchObject({ via: "email" });
    expect(m.db.subscriptions[0].user_id).toBe("u_maria");
  });

  it("ninguém com esse e-mail: CRIA a conta (e-mail confirmado) e libera nela", async () => {
    const m = montar();
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra() });
    expect(r.corpo).toMatchObject({ via: "nova" });
    const u = [...m.db.users.values()].find((x) => x.email === "maria@exemplo.com")!;
    expect(m.db.subscriptions[0].user_id).toBe(u.id);
  });

  it("registro em conflito (2 contas na mesma ref) → ninguém leva pela ref; vai pelo e-mail", async () => {
    const m = montar();
    m.db.users.set("u_a", { id: "u_a", email: null }); m.db.users.set("u_b", { id: "u_b", email: null });
    registrar(m.db, "u_a"); registrar(m.db, "u_b");
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ sck: REF }) });
    expect(r.corpo).toMatchObject({ via: "nova" });
    expect(escolherRegistroHotmart([{ user_id: "a" }, { user_id: "b" }]).conflito).toBe(true);
    expect(escolherRegistroHotmart([{ user_id: null, event_data: { fbp: "x" } }])).toMatchObject({ userId: null, dados: { fbp: "x" } });
  });

  it("vitalício que compra de novo pela Hotmart: a linha dele não é reescrita, nada sai (vira chamado, como no Pix)", async () => {
    const m = montar();
    m.db.users.set("u_maria", { id: "u_maria", email: "maria@exemplo.com" });
    m.db.subscriptions.push({ id: "antiga", user_id: "u_maria", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: "qr_velho", current_period_end: "2126-01-01T00:00:00Z" });
    const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra() });
    expect(r.corpo).toMatchObject({ novo: false });
    expect(m.db.subscriptions.filter((s) => s.payment_method === "hotmart")).toHaveLength(0);
    expect(m.saida.capi).toHaveLength(0);
  });
});

describe("reembolso / chargeback / cancelada", () => {
  for (const e of ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED"]) {
    it(`${e} → a linha da transação vira canceled (só ela)`, async () => {
      const m = montar();
      await tratarHotmart(m.deps, { hottok: SECRET, body: compra() });
      m.db.subscriptions.push({ id: "outra", user_id: "x", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_1" });
      const r = await tratarHotmart(m.deps, { hottok: SECRET, body: compra({ evento: e, status: "REFUNDED" }) });
      expect(r.corpo).toMatchObject({ desligado: true });
      expect(m.db.subscriptions.find((s) => s.abacatepay_billing_id === "HP17715690036014")!.status).toBe("canceled");
      expect(m.db.subscriptions.find((s) => s.id === "outra")!.status).toBe("active");
    });
  }
});

describe("puros: leitura do corpo, hotmart-iniciar, máscaras", () => {
  it("lerCompraHotmart pega os campos da doc 2.0.0 (price, não full_price)", () => {
    const c = lerCompraHotmart(compra({ sck: REF }));
    expect(c).toMatchObject({ evento: "PURCHASE_APPROVED", tx: "HP17715690036014", status: "APPROVED", valorCents: 9790, moeda: "BRL", email: "maria@exemplo.com", sck: REF, src: "criativo_7", produtoId: "123456", pagamento: "PIX" });
    expect(lerCompraHotmart(null)).toMatchObject({ tx: null, evento: "" });
    expect(mascararEmail("maria@exemplo.com")).toBe("ma***@exemplo.com");
  });
  it("hotmart-iniciar: ref obrigatória no formato; URL só do site; IP+UA juntos; atrib só as chaves conhecidas", () => {
    expect(validarInicio({ ref: "x" })).toBeNull();
    expect(validarInicio({ ref: "a b c d e f g h" })).toBeNull();
    const p = validarInicio({ ref: REF, fbp: "fb.1", url: "https://evil.com/x", atrib: { utm_content: "c7", lixo: "z" }, preco_centavos: 9790 })!;
    expect(p.url).toBeNull();
    expect(p.atrib).toEqual({ utm_content: "c7" });
    const l = linhaDoPedidoHotmart(p, { userId: null, ip: "1.2.3.4", ua: null });
    expect(l).toMatchObject({ event_name: "hotmart_order_created", user_id: null, event_data: { ref: REF, fbp: "fb.1", utm_content: "c7", preco_centavos: 9790 } });
    expect(l.event_data).not.toHaveProperty("client_ip");
    expect(linhaDoPedidoHotmart(validarInicio({ ref: REF, url: "https://www.coreaplicativo.com.br/vida?a=1" })!, { userId: "u", ip: "1.2.3.4", ua: "UA" }).event_data).toMatchObject({ source_url: "https://www.coreaplicativo.com.br/vida?a=1", client_ip: "1.2.3.4", user_agent: "UA" });
  });
  it("a função e a migração existem e não chamam nada de verdade no teste; config sem JWT só no webhook", () => {
    const raiz = resolve(__dirname, "../..");
    const wh = readFileSync(resolve(raiz, "supabase/functions/hotmart-webhook/index.ts"), "utf8");
    expect(wh).toContain('req.headers.get("x-hotmart-hottok")');
    expect(wh).toContain('Deno.env.get("HOTMART_HOTTOK")');
    expect(wh).toContain("fetchNosPixels");
    expect(readFileSync(resolve(raiz, "supabase/config.toml"), "utf8")).toMatch(/\[functions\.hotmart-webhook\]\nverify_jwt = false/);
    const mig = readFileSync(resolve(raiz, "supabase/migrations/20261104120000_hotmart_pedido_servidor.sql"), "utf8");
    expect(mig.match(/'pix_order_created', 'hotmart_order_created', 'pix_reconciled'/g)).toHaveLength(2); // nas 2 policies (authenticated e anon)
  });
});

describe("/vendas e o aviso: Hotmart é venda do site, com a taxa da Hotmart", () => {
  const linhaHm = { id: "s1", status: "active", payment_method: "hotmart", amount_cents: 9790, abacatepay_billing_id: "HP1", billing_period: "lifetime", plan: "lifetime", current_period_start: "2026-11-04T15:00:00Z", current_period_end: "2126-11-04T15:00:00Z", created_at: "2026-11-04T15:00:00Z", customer_email: "maria@exemplo.com" };
  it("vendaPix aceita a linha da Hotmart (gateway hotmart) e o título diz Hotmart", () => {
    const v = vendaPix(linhaHm)!;
    expect(v).toMatchObject({ origem: "pix", gateway: "hotmart", valor_cents: 9790, plano: "vitalício" });
    expect(tituloVenda(v)).toBe("💰 Venda · R$ 97,90 · Hotmart do site (vitalício)");
    expect(vendaPix({ ...linhaHm, payment_method: "pix" })!.gateway).toBeUndefined();
  });
  it("taxa: Hotmart 9,9% + R$ 1,00 (97,90 → 87,21 líquido); Pix segue 1,99", () => {
    expect(taxaSiteCents({ valor_cents: 9790, gateway: "hotmart" })).toBe(1069);
    expect(9790 - taxaSiteCents({ valor_cents: 9790, gateway: "hotmart" })).toBe(8721);
    expect(taxaSiteCents({ valor_cents: 2790 })).toBe(199);
    const vendas = vendasDoDia([linhaHm, { ...linhaHm, id: "s2", payment_method: "pix", amount_cents: 2790, abacatepay_billing_id: "qr2" }], [], new Map(), [], "2026-11-04");
    expect(vendas.itens.find((i) => i.valor_cents === 9790)!.gateway).toBe("hotmart");
    const r = resumoDoDia(vendas, "2026-11-04", 0, { testes: 0, pagaram: 0, situacao: "aberta", liquido: 0, gasto: 0 });
    expect(r.site.vendas).toBe(2);
    expect(r.site.bruto).toBe(125.8);
    expect(r.site.liquido).toBe(Math.round((87.21 + 25.91) * 100) / 100);
  });
  it("funil: a /vida (pagina:'vida') nunca entra no do /organizar; foiHotmart conta o toque", () => {
    const ev = [
      { event_name: "landing_html", sid: "a" }, { event_name: "landing_oferta_vista", sid: "a" },
      { event_name: "landing_html", sid: "v", pagina: "vida" }, { event_name: "landing_oferta_vista", sid: "v", pagina: "vida" }, { event_name: "landing_hotmart_redirect", sid: "v", pagina: "vida" },
    ];
    expect(funilLanding(ev)).toMatchObject({ sessoes: 1, viuOferta: 1, foiHotmart: 0 });
    expect(funilLanding(ev, new Set(), "vida")).toMatchObject({ sessoes: 1, viuOferta: 1, foiHotmart: 1 });
  });
});
