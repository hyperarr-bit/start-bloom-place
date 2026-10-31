/**
 * LIBERAR PIX e TROCAR EMAIL (30/10) — o lado do servidor do /admin/suporte.
 *
 * O que estas travas protegem:
 *   · Liberar Pix só MOVE a linha que já existe (transferirCompraPix). Não cria
 *     assinatura, não chama a concessão de vitalício, não manda e-mail.
 *   · Trocar email grava o login novo no auth (email_confirm, sem convite),
 *     no perfil quando a coluna existe, na assinatura e no destino do Pix
 *     anônimo. E-mail inválido ou de outra conta não muda nada.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  liberarPix, resolverColisao, trocarEmailAdmin, transferirCompraPix,
} from "../../supabase/functions/_shared/admin-acoes-suporte";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");
const ui = (f: string) => readFileSync(resolve(__dirname, "../pages/admin", f), "utf8");

type Row = Record<string, unknown>;
type User = { id: string; email: string | null; is_anonymous?: boolean; user_metadata?: Record<string, unknown> };

function banco(opts?: { perfilComEmail?: boolean }) {
  const perfilComEmail = opts?.perfilComEmail === true;
  const db = {
    subscriptions: [] as Row[],
    profiles: [] as Row[],
    webhook_events: [] as Row[],
    analytics_events: [] as Row[],
    support_tickets: [] as Row[],
    user_data: [] as Row[],
    users: [] as User[],
  };
  const authUpdates: Array<{ id: string; attrs: Record<string, unknown> }> = [];
  const colunaAusente = { message: "Could not find the 'email' column of 'profiles' in the schema cache" };

  const from = (tabela: string) => {
    const bag = () => {
      if (tabela === "subscriptions") return db.subscriptions;
      if (tabela === "profiles") return db.profiles;
      if (tabela === "webhook_events") return db.webhook_events;
      if (tabela === "analytics_events") return db.analytics_events;
      if (tabela === "support_tickets") return db.support_tickets;
      if (tabela === "user_data") return db.user_data;
      throw new Error(`tabela ${tabela}`);
    };
    const filtros: Array<{ op: "eq" | "ilike" | "like" | "contains" | "in"; k: string; v: unknown }> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete" | "upsert"; dados?: Row | Row[] } = { tipo: "select" };
    let unico = false;
    let limite = Infinity;
    let ordem: { k: string; asc: boolean } | null = null;
    const casa = (row: Row) => filtros.every((f) => {
      const val = row[f.k];
      if (f.op === "eq") return val === f.v;
      if (f.op === "ilike") {
        const raw = String(f.v ?? "");
        if (!raw.includes("%")) return String(val ?? "").toLowerCase() === raw.toLowerCase();
        const re = new RegExp("^" + raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");
        return re.test(String(val ?? ""));
      }
      if (f.op === "in") return Array.isArray(f.v) && f.v.includes(val);
      if (f.op === "like") {
        const re = new RegExp("^" + String(f.v).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$");
        return re.test(String(val ?? ""));
      }
      const obj = (val ?? {}) as Record<string, unknown>;
      return Object.entries(f.v as Record<string, unknown>).every(([k, v]) => obj[k] === v);
    });
    const exec = async () => {
      if (tabela === "profiles" && !perfilComEmail && ((op.tipo === "update" && !!op.dados && "email" in op.dados) || op.tipo === "select")) {
        return { data: null, error: colunaAusente, count: null };
      }
      const linhas = bag();
      if (op.tipo === "insert" || op.tipo === "upsert") {
        const itens = Array.isArray(op.dados) ? op.dados : [op.dados as Row];
        for (const item of itens) {
          if (op.tipo === "upsert") {
            const i = linhas.findIndex((r) => r.user_id === item.user_id && r.key === item.key);
            if (i >= 0) { Object.assign(linhas[i], item); continue; }
          }
          linhas.push({ ...item });
        }
        return { data: null, error: null, count: itens.length };
      }
      let achadas = linhas.filter(casa);
      if (ordem) {
        const { k, asc } = ordem;
        achadas = [...achadas].sort((a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? "")));
        if (!asc) achadas.reverse();
      }
      if (op.tipo === "delete") {
        for (const r of achadas) linhas.splice(linhas.indexOf(r), 1);
        return { data: null, error: null, count: achadas.length };
      }
      if (op.tipo === "update") {
        for (const r of achadas) Object.assign(r, op.dados);
        return { data: achadas.map((r) => ({ ...r })), error: null, count: achadas.length };
      }
      const fatia = achadas.slice(0, limite);
      if (unico) {
        if (fatia.length > 1) return { data: null, error: { message: "multiple" }, count: fatia.length };
        return { data: fatia[0] ?? null, error: null, count: fatia.length };
      }
      return { data: fatia.map((r) => ({ ...r })), error: null, count: fatia.length };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (d: Row) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Row) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push({ op: "eq", k, v }); return q; },
      ilike: (k: string, v: unknown) => { filtros.push({ op: "ilike", k, v }); return q; },
      like: (k: string, v: unknown) => { filtros.push({ op: "like", k, v }); return q; },
      contains: (k: string, v: unknown) => { filtros.push({ op: "contains", k, v }); return q; },
      in: (k: string, v: unknown) => { filtros.push({ op: "in", k, v }); return q; },
      upsert: (d: Row | Row[]) => { op = { tipo: "upsert", dados: d }; return q; },
      order: (k: string, o?: { ascending?: boolean }) => { ordem = { k, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { limite = n; return q; },
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };

  const admin = {
    from,
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: db.users.find((u) => u.id === id) ?? null }, error: null }),
        listUsers: async ({ page }: { page: number; perPage: number }) => ({
          data: { users: page === 1 ? db.users : [] }, error: null,
        }),
        createUser: async (attrs: { email?: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) => {
          const email = String(attrs.email ?? "").toLowerCase();
          if (db.users.some((u) => (u.email ?? "").toLowerCase() === email)) {
            return { data: { user: null }, error: { message: "already been registered" } };
          }
          const u: User = { id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(db.users.length + 1).padStart(12, "0")}`, email, is_anonymous: false, user_metadata: attrs.user_metadata ?? {} };
          db.users.push(u);
          authUpdates.push({ id: u.id, attrs: { ...attrs, email_confirm: attrs.email_confirm } });
          return { data: { user: u }, error: null };
        },
        updateUserById: async (id: string, attrs: Record<string, unknown>) => {
          const u = db.users.find((x) => x.id === id);
          if (!u) return { data: { user: null }, error: { message: "not found" } };
          authUpdates.push({ id, attrs });
          if (typeof attrs.email === "string") u.email = attrs.email;
          if (attrs.user_metadata && typeof attrs.user_metadata === "object") {
            u.user_metadata = { ...(u.user_metadata ?? {}), ...(attrs.user_metadata as Record<string, unknown>) };
          }
          return { data: { user: { ...u } }, error: null };
        },
      },
    },
  };
  return { db, admin, authUpdates };
}

/** strictNullChecks está desligado: o `ok: false` não estreita a união. */
const erroDe = (r: { ok: boolean; erro?: string }): string => (r.ok ? "" : r.erro ?? "");

const ANON = "11111111-1111-4111-8111-111111111111";
const DEST = "22222222-2222-4222-8222-222222222222";
const OUTRA = "33333333-3333-4333-8333-333333333333";

function cenario() {
  const b = banco();
  b.db.users.push(
    { id: ANON, email: null, is_anonymous: true, user_metadata: {} },
    { id: DEST, email: "maria@exemplo.com", is_anonymous: false, user_metadata: { email: "maria@exemplo.com" } },
  );
  b.db.subscriptions.push({
    id: "pix-1", user_id: ANON, status: "active", plan: "lifetime", billing_period: "lifetime",
    payment_method: "pix", amount_cents: 2790, customer_email: null,
    abacatepay_billing_id: "qr_landing_1", current_period_end: "2126-01-01T00:00:00.000Z",
    created_at: "2026-10-29T11:00:00.000Z",
  });
  b.db.profiles.push({ id: DEST, display_name: "Maria" }, { id: ANON, display_name: null });
  return b;
}

describe("liberarPix", () => {
  it("move o Pix do pedido pra conta do e-mail e registra; não cria linha", async () => {
    const b = cenario();
    const r = await liberarPix(b.admin, { pedido: "qr_landing_1", email: "Maria@exemplo.com", caller: "dono@core.com" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.detalhe.plan).toBe("lifetime");
    expect(r.detalhe.amount_cents).toBe(2790);
    expect(b.db.subscriptions).toHaveLength(1);
    expect(b.db.subscriptions[0]).toMatchObject({ id: "pix-1", user_id: DEST, customer_email: "maria@exemplo.com", plan: "lifetime", amount_cents: 2790 });
    const nomes = b.db.analytics_events.map((e) => e.event_name);
    expect(nomes).toContain("compra_vinculada");
    expect(nomes).toContain("admin_transferir_pix");
    const log = b.db.analytics_events.find((e) => e.event_name === "admin_transferir_pix");
    expect(log?.event_data).toMatchObject({ deUid: ANON, para: "maria@exemplo.com", pedido: "qr_landing_1", como: "movido", por: "dono@core.com" });
  });

  it("no chamado: deUid da conta anônima + e-mail, com o pedido conferido", async () => {
    const b = cenario();
    const r = await liberarPix(b.admin, { deUid: ANON, pedido: "qr_landing_1", email: "maria@exemplo.com", caller: "dono@core.com" });
    expect(r.ok).toBe(true);
    expect(b.db.subscriptions[0].user_id).toBe(DEST);
  });

  it("deUid + paraUid (o contrato antigo) continua movendo a mesma linha", async () => {
    const b = cenario();
    const r = await transferirCompraPix(b.admin, ANON, DEST);
    expect(r.erro).toBeNull();
    expect(b.db.subscriptions[0].user_id).toBe(DEST);
  });

  it("e-mail sem conta recebe a linha que já existe; pedido inexistente, e-mail inválido e pedido de outra conta não criam acesso", async () => {
    const criado = cenario();
    const semConta = await liberarPix(criado.admin, { pedido: "qr_landing_1", email: "ninguem@exemplo.com", caller: "d" });
    expect(semConta.ok).toBe(true);
    if (semConta.ok) expect(semConta.detalhe.como).toBe("batizado");
    expect(criado.db.subscriptions).toHaveLength(1);
    expect(criado.db.subscriptions[0]).toMatchObject({ id: "pix-1", user_id: ANON, plan: "lifetime", amount_cents: 2790, customer_email: "ninguem@exemplo.com" });
    expect(criado.db.users).toHaveLength(2);
    expect(criado.db.users.find((u) => u.id === ANON)?.email).toBe("ninguem@exemplo.com");
    expect(criado.authUpdates.some((u) => u.attrs.email_confirm === true && u.attrs.email === "ninguem@exemplo.com")).toBe(true);

    const b = cenario();
    const semPedido = await liberarPix(b.admin, { pedido: "nao_existe", email: "maria@exemplo.com", caller: "d" });
    expect(erroDe(semPedido)).toBe("sem_prova_de_pagamento");
    const emailRuim = await liberarPix(b.admin, { pedido: "qr_landing_1", email: "nao-e-email", caller: "d" });
    expect(erroDe(emailRuim)).toBe("email_invalido");
    const outro = await liberarPix(b.admin, { deUid: DEST, pedido: "qr_landing_1", email: "maria@exemplo.com", caller: "d" });
    expect(erroDe(outro)).toBe("pedido_nao_bate");
    expect(b.db.subscriptions[0].user_id).toBe(ANON);
    expect(b.db.users.some((u) => u.email === "nao-e-email")).toBe(false);
  });

  it("destino que já tem acesso próprio não recebe o Pix; casca vencida sai; linha da loja fica", async () => {
    const comAcesso = cenario();
    comAcesso.db.subscriptions.push({ id: "ja", user_id: DEST, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", current_period_end: "2126-01-01T00:00:00.000Z" });
    const bloqueou = await liberarPix(comAcesso.admin, { pedido: "qr_landing_1", email: "maria@exemplo.com", caller: "d" });
    expect(erroDe(bloqueou)).toBe("destino_ja_tem_assinatura");
    expect(comAcesso.db.subscriptions.find((s) => s.id === "pix-1")?.user_id).toBe(ANON);

    const casca = cenario();
    casca.db.subscriptions.push({ id: "casca", user_id: DEST, status: "canceled", plan: "web", billing_period: "monthly_prepaid", payment_method: "pix", current_period_end: "2020-01-01T00:00:00.000Z" });
    expect((await liberarPix(casca.admin, { pedido: "qr_landing_1", email: "maria@exemplo.com", caller: "d" })).ok).toBe(true);
    expect(casca.db.subscriptions.map((s) => s.id).sort()).toEqual(["pix-1"]);
    expect(casca.db.subscriptions[0].user_id).toBe(DEST);

    const loja = cenario();
    loja.db.subscriptions.push({ id: "loja", user_id: DEST, status: "active", plan: "annual", billing_period: "annual", payment_method: "play_store", revenuecat_subscription_id: "subAapXYZ", current_period_end: "2026-12-01T00:00:00.000Z" });
    expect((await liberarPix(loja.admin, { pedido: "qr_landing_1", email: "maria@exemplo.com", caller: "d" })).ok).toBe(true);
    expect(loja.db.subscriptions.find((s) => s.id === "loja")).toMatchObject({ user_id: DEST, payment_method: "play_store" });
    expect(loja.db.subscriptions.find((s) => s.id === "pix-1")?.user_id).toBe(DEST);
  });

  it("conta do Pix que já tem e-mail não é movida; pedido só no registro, sem linha, não inventa acesso", async () => {
    const b = cenario();
    b.db.users[0].email = "anon@exemplo.com";
    b.db.users[0].is_anonymous = false;
    const r = await liberarPix(b.admin, { pedido: "qr_landing_1", email: "maria@exemplo.com", caller: "d" });
    expect(erroDe(r)).toBe("origem_tem_email");
    expect(b.db.subscriptions[0].user_id).toBe(ANON);

    const semLinha = banco();
    semLinha.db.users.push({ id: ANON, email: null, is_anonymous: true }, { id: DEST, email: "maria@exemplo.com" });
    semLinha.db.analytics_events.push({ user_id: ANON, event_name: "pix_order_created", event_data: { order_id: "qr_so_registro", offer: "ln279" } });
    const s = await liberarPix(semLinha.admin, { pedido: "qr_so_registro", email: "maria@exemplo.com", caller: "d" });
    expect(erroDe(s)).toBe("sem_prova_de_pagamento");
    expect(semLinha.db.subscriptions).toHaveLength(0);
  });

  it("conta anônima ainda viva ganha o e-mail (não cria outra conta)", async () => {
    const b = banco();
    b.db.users.push({ id: ANON, email: null, is_anonymous: true, user_metadata: {} });
    b.db.subscriptions.push({
      id: "pix-1", user_id: ANON, status: "active", plan: "lifetime", billing_period: "lifetime",
      payment_method: "pix", amount_cents: 2790, customer_email: null, abacatepay_billing_id: "qr_landing_1",
      current_period_end: "2126-01-01T00:00:00.000Z",
    });
    const r = await liberarPix(b.admin, { deUid: ANON, pedido: "qr_landing_1", email: "adryanfelipe1022@gmail.com", caller: "d" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detalhe.como).toBe("batizado");
    expect(b.db.users).toHaveLength(1);
    expect(b.db.users[0]).toMatchObject({ id: ANON, email: "adryanfelipe1022@gmail.com" });
    expect(b.db.subscriptions[0]).toMatchObject({ user_id: ANON, customer_email: "adryanfelipe1022@gmail.com", plan: "lifetime" });
    expect(b.authUpdates[0].attrs).toMatchObject({ email: "adryanfelipe1022@gmail.com", email_confirm: true });
  });

  it("anônima sumiu: regrava a oferta do pedido pago, anual não vira vitalício, e QR sem pagamento não cria conta", async () => {
    const pago = (offer: string) => {
      const b = banco();
      b.db.webhook_events.push({ id: `ln-sem-email:NATALIAD00000729107474ASA`, processed_at: "2026-10-29T14:40:00.000Z", event: "pago_sem_email" });
      b.db.analytics_events.push({
        user_id: ANON, event_name: "pix_order_created",
        event_data: { order_id: "NATALIAD00000729107474ASA", offer, amount_cents: 2790 },
      });
      b.db.support_tickets.push({
        user_id: ANON, source: "pix_sem_email", created_at: "2026-10-29T14:50:00.000Z",
        message: "Pix pago sem e-mail · R$ 27,90\nPedido: NATALIAD00000729107474ASA",
      });
      return b;
    };
    const sempre = pago("LN_sempre279");
    const r = await liberarPix(sempre.admin, { deUid: ANON, pedido: "NATALIAD00000729107474ASA", email: "adryanfelipe1022@gmail.com", caller: "d" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detalhe.como).toBe("restaurado");
    expect(sempre.db.subscriptions).toHaveLength(1);
    expect(sempre.db.subscriptions[0]).toMatchObject({
      plan: "lifetime", billing_period: "lifetime", amount_cents: 2790, payment_method: "pix",
      abacatepay_billing_id: "NATALIAD00000729107474ASA", customer_email: "adryanfelipe1022@gmail.com",
    });
    expect(String(sempre.db.subscriptions[0].current_period_start)).toBe("2026-10-29T14:40:00.000Z");

    const ano = pago("LN_ano279");
    const a = await liberarPix(ano.admin, { pedido: "NATALIAD00000729107474ASA", email: "adryanfelipe1022@gmail.com", caller: "d" });
    expect(a.ok).toBe(true);
    expect(ano.db.subscriptions[0]).toMatchObject({ plan: "core-pro", billing_period: "annual", amount_cents: 2790 });
    expect(ano.db.subscriptions[0].plan).not.toBe("lifetime");

    const soQr = banco();
    soQr.db.analytics_events.push({ user_id: ANON, event_name: "pix_order_created", event_data: { order_id: "qr_aberto", offer: "LN_sempre279", amount_cents: 2790 } });
    const nao = await liberarPix(soQr.admin, { pedido: "qr_aberto", email: "adryanfelipe1022@gmail.com", caller: "d" });
    expect(erroDe(nao)).toBe("sem_prova_de_pagamento");
    expect(soQr.db.users).toHaveLength(0);
    expect(soQr.db.subscriptions).toHaveLength(0);

    const orfa = banco();
    orfa.db.subscriptions.push({
      id: "pix-orfa", user_id: ANON, status: "active", plan: "lifetime", billing_period: "lifetime",
      payment_method: "pix", amount_cents: 2790, customer_email: null,
      abacatepay_billing_id: "NATALIAD00000729107474ASA", current_period_end: "2126-01-01T00:00:00.000Z",
    });
    const m = await liberarPix(orfa.admin, { deUid: ANON, pedido: "NATALIAD00000729107474ASA", email: "adryanfelipe1022@gmail.com", caller: "d" });
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.detalhe.como).toBe("conta_criada");
    expect(orfa.db.subscriptions).toHaveLength(1);
    expect(orfa.db.subscriptions[0].user_id).not.toBe(ANON);
    expect(orfa.db.subscriptions[0]).toMatchObject({ plan: "lifetime", amount_cents: 2790, customer_email: "adryanfelipe1022@gmail.com" });
  });
});

describe("duas contas no mesmo e-mail", () => {
  const typo = "dasilvakarine228@gmail.con";
  const certo = "dasilvakarine228@gmail.com";
  const montar = () => {
    const b = banco();
    b.db.users.push(
      { id: DEST, email: typo, user_metadata: {} },
      { id: OUTRA, email: certo, user_metadata: {} },
    );
    b.db.subscriptions.push({
      id: "paga", user_id: DEST, customer_email: typo, status: "active", plan: "lifetime", billing_period: "lifetime",
      payment_method: "pix", amount_cents: 2790, current_period_end: "2126-01-01T00:00:00.000Z",
    });
    b.db.user_data.push({ user_id: DEST, key: "financas", value: { saldo: 1 } });
    return b;
  };

  it("mostra as duas e recomenda liberar o e-mail quando a conta certa está vazia", async () => {
    const b = montar();
    const r = await trocarEmailAdmin(b.admin, { de: DEST, para: certo, caller: "d" });
    expect(erroDe(r)).toBe("destino_ja_existe");
    if (r.ok) return;
    const contas = r.detalhe?.contas as Array<{ uid: string; temAcesso: boolean; chaves: number }>;
    expect(contas.map((c) => c.uid)).toEqual([DEST, OUTRA]);
    expect(contas[0].temAcesso).toBe(true);
    expect(contas[1].temAcesso).toBe(false);
    expect(r.detalhe?.recomendacao).toMatchObject({ modo: "liberar_email", quemFica: DEST, quemSai: OUTRA });
    expect(b.db.users.find((u) => u.id === DEST)?.email).toBe(typo);
  });

  it("liberar o e-mail estaciona a conta vazia e a conta paga fica com o e-mail certo", async () => {
    const b = montar();
    const sem = await resolverColisao(b.admin, { modo: "liberar_email", quemFica: DEST, quemSai: OUTRA, email: certo, confirmar: "nao", caller: "d" });
    expect(erroDe(sem)).toBe("confirmar");
    const r = await resolverColisao(b.admin, { modo: "liberar_email", quemFica: DEST, quemSai: OUTRA, email: certo, confirmar: OUTRA, caller: "d" });
    expect(r.ok).toBe(true);
    expect(b.db.users.find((u) => u.id === DEST)?.email).toBe(certo);
    expect(String(b.db.users.find((u) => u.id === OUTRA)?.email)).toContain("+casca");
    expect(b.db.subscriptions[0]).toMatchObject({ user_id: DEST, customer_email: certo });
    expect(b.authUpdates.every((u) => u.attrs.email_confirm === true)).toBe(true);
  });

  it("mover o acesso leva a linha e os dados pra conta do e-mail certo; casca com acesso não é estacionada", async () => {
    const b = montar();
    const r = await resolverColisao(b.admin, { modo: "mover_acesso", quemFica: OUTRA, quemSai: DEST, email: certo, confirmar: DEST, caller: "d" });
    expect(r.ok).toBe(true);
    expect(b.db.subscriptions[0]).toMatchObject({ user_id: OUTRA, customer_email: certo });
    expect(b.db.users.find((u) => u.id === DEST)?.email).toBe(typo);
    expect(b.db.user_data.some((d) => d.user_id === OUTRA && d.key === "financas")).toBe(true);

    const cheia = montar();
    cheia.db.subscriptions.push({ id: "loja", user_id: OUTRA, status: "active", plan: "annual", billing_period: "annual", payment_method: "pix", current_period_end: "2126-01-01T00:00:00.000Z" });
    const bloqueou = await resolverColisao(cheia.admin, { modo: "liberar_email", quemFica: DEST, quemSai: OUTRA, email: certo, confirmar: OUTRA, caller: "d" });
    expect(erroDe(bloqueou)).toBe("casca_tem_acesso");
    expect(cheia.db.users.find((u) => u.id === OUTRA)?.email).toBe(certo);
  });
});

describe("trocarEmailAdmin", () => {
  it("troca o login pelo e-mail atual e pelo id: auth, metadata, assinatura e destino; o user_id fica", async () => {
    const b = banco({ perfilComEmail: true });
    b.db.users.push({ id: DEST, email: "antiga@exemplo.com", user_metadata: { email: "antiga@exemplo.com", display_name: "Maria" } });
    b.db.profiles.push({ id: DEST, email: "antiga@exemplo.com", display_name: "Maria" });
    b.db.subscriptions.push(
      { id: "s1", user_id: DEST, customer_email: "antiga@exemplo.com", status: "active", plan: "lifetime" },
      { id: "s2", user_id: DEST, customer_email: "antiga@exemplo.com", status: "active", plan: "web" },
      { id: "alheia", user_id: OUTRA, customer_email: "outra@exemplo.com", status: "active" },
    );
    b.db.webhook_events.push(
      { id: `hoje-destino:${ANON}`, event: "antiga@exemplo.com", source: "hoje" },
      { id: `hoje-destino:${OUTRA}`, event: "outra@exemplo.com", source: "hoje" },
      { id: "hoje-email:qr_1", event: "boas_vindas", source: "hoje" },
    );

    const r = await trocarEmailAdmin(b.admin, { de: "Antiga@exemplo.com", para: "Nova@exemplo.com", caller: "dono@core.com" });
    expect(r.ok).toBe(true);
    expect(b.db.users[0].email).toBe("nova@exemplo.com");
    expect(b.db.users[0].user_metadata).toMatchObject({ email: "nova@exemplo.com", display_name: "Maria" });
    expect(b.authUpdates[0].attrs).toMatchObject({ email: "nova@exemplo.com", email_confirm: true });
    expect(b.db.profiles[0].email).toBe("nova@exemplo.com");
    expect(b.db.subscriptions.find((s) => s.id === "s1")?.customer_email).toBe("nova@exemplo.com");
    expect(b.db.subscriptions.find((s) => s.id === "s2")?.customer_email).toBe("nova@exemplo.com");
    expect(b.db.subscriptions.find((s) => s.id === "alheia")?.customer_email).toBe("outra@exemplo.com");
    expect(b.db.subscriptions.every((s) => s.user_id === DEST || s.user_id === OUTRA)).toBe(true);
    expect(b.db.webhook_events.find((w) => w.id === `hoje-destino:${ANON}`)?.event).toBe("nova@exemplo.com");
    expect(b.db.webhook_events.find((w) => w.id === `hoje-destino:${OUTRA}`)?.event).toBe("outra@exemplo.com");
    expect(b.db.webhook_events.find((w) => w.id === "hoje-email:qr_1")?.event).toBe("boas_vindas");
    expect(b.db.analytics_events.find((e) => e.event_name === "admin_trocar_email")?.event_data).toMatchObject({
      uid: DEST, para: "nova@exemplo.com", por: "dono@core.com", perfil: "atualizado",
    });

    const deNovo = banco();
    deNovo.db.users.push({ id: DEST, email: "antiga@exemplo.com", user_metadata: {} });
    deNovo.db.subscriptions.push({ id: "s1", user_id: DEST, customer_email: "antiga@exemplo.com", status: "active" });
    const porId = await trocarEmailAdmin(deNovo.admin, { de: DEST, para: "nova@exemplo.com", caller: "dono@core.com" });
    expect(porId.ok).toBe(true);
    expect(deNovo.db.users[0].email).toBe("nova@exemplo.com");
    expect(deNovo.db.subscriptions[0]).toMatchObject({ user_id: DEST, customer_email: "nova@exemplo.com" });
    expect(porId.ok && porId.detalhe.perfil).toBe("sem_coluna");
  });

  it("põe e-mail numa conta anônima (o acesso continua nela) quando o e-mail está livre", async () => {
    const b = banco();
    b.db.users.push({ id: ANON, email: null, is_anonymous: true, user_metadata: {} });
    b.db.subscriptions.push({ id: "pix-1", user_id: ANON, customer_email: null, status: "active", plan: "lifetime", payment_method: "pix" });
    const r = await trocarEmailAdmin(b.admin, { de: ANON, para: "ela@exemplo.com", caller: "d" });
    expect(r.ok).toBe(true);
    expect(b.db.users[0].email).toBe("ela@exemplo.com");
    expect(b.db.subscriptions[0]).toMatchObject({ user_id: ANON, customer_email: "ela@exemplo.com" });
    expect(b.db.subscriptions).toHaveLength(1);
  });

  it("recusa e-mail inválido, o mesmo e-mail, conta inexistente e e-mail de outra conta — sem gravar", async () => {
    const b = banco({ perfilComEmail: true });
    b.db.users.push(
      { id: DEST, email: "antiga@exemplo.com", user_metadata: { email: "antiga@exemplo.com" } },
      { id: OUTRA, email: "ocupado@exemplo.com", user_metadata: {} },
    );
    b.db.subscriptions.push({ id: "s1", user_id: DEST, customer_email: "antiga@exemplo.com", status: "active" });
    b.db.profiles.push({ id: OUTRA, email: "so-no-perfil@exemplo.com" });

    for (const args of [
      { de: "antiga@exemplo.com", para: "sem-arroba" },
      { de: "nao-e-email", para: "nova@exemplo.com" },
      { de: "antiga@exemplo.com", para: "antiga@exemplo.com" },
      { de: "ninguem@exemplo.com", para: "nova@exemplo.com" },
      { de: "antiga@exemplo.com", para: "ocupado@exemplo.com" },
      { de: "antiga@exemplo.com", para: "so-no-perfil@exemplo.com" },
    ]) {
      const r = await trocarEmailAdmin(b.admin, { ...args, caller: "d" });
      expect(r.ok).toBe(false);
    }
    expect((await trocarEmailAdmin(b.admin, { de: "antiga@exemplo.com", para: "ocupado@exemplo.com", caller: "d" })) ).toMatchObject({ ok: false, erro: "destino_ja_existe" });
    const soAssinatura = banco();
    soAssinatura.db.users.push({ id: DEST, email: "antiga@exemplo.com" });
    soAssinatura.db.subscriptions.push(
      { id: "s1", user_id: DEST, customer_email: "antiga@exemplo.com", status: "active" },
      { id: "s2", user_id: OUTRA, customer_email: "preso@exemplo.com", status: "active" },
    );
    expect(await trocarEmailAdmin(soAssinatura.admin, { de: DEST, para: "preso@exemplo.com", caller: "d" })).toMatchObject({ ok: false, erro: "destino_ja_existe" });

    expect(b.db.users[0].email).toBe("antiga@exemplo.com");
    expect(b.db.subscriptions[0].customer_email).toBe("antiga@exemplo.com");
    expect(b.authUpdates).toHaveLength(0);
    expect(b.db.analytics_events).toHaveLength(0);
  });
});

describe("o painel não concede vitalício e não manda e-mail", () => {
  it("a ação nova chama transferir_pix / trocar_email e não a concessão manual", () => {
    const shared = fonte("_shared/admin-acoes-suporte.ts");
    expect(shared).not.toContain("liberar_vitalicio");
    expect(shared).not.toMatch(/resend|api\.resend\.com|inviteUserByEmail|generateLink|enviarEmail/);
    expect(shared).toContain("email_confirm: true");
    expect(shared).toContain("createUser");
    expect(shared).toContain("export async function transferirCompraPix");
    expect(shared).toContain("email_confirm: true");

    const idx = fonte("admin-suporte/index.ts");
    const pix = idx.slice(idx.indexOf('action === "transferir_pix"'), idx.indexOf('action === "trocar_email"'));
    expect(pix).toContain("liberarPix(admin");
    expect(pix).not.toContain("liberar_vitalicio");
    const email = idx.slice(idx.indexOf('action === "trocar_email"'), idx.indexOf('action === "corrigir_valores"'));
    expect(email).toContain("trocarEmailAdmin(admin");
    expect(email).not.toMatch(/resend|fetch\(/);

    for (const f of ["acoes-suporte.tsx", "acoes-suporte-api.ts", "AdminSuporte.tsx"]) {
      const s = ui(f);
      expect(s).not.toContain("liberar_vitalicio");
    }
    const tela = ui("acoes-suporte.tsx") + ui("acoes-suporte-api.ts");
    expect(tela).toContain('action: "transferir_pix"');
    expect(tela).toContain('action: "trocar_email"');
    expect(ui("AdminSuporte.tsx")).toContain("LiberarPixChamado");
    expect(ui("AdminSuporte.tsx")).toContain("<AcoesSuporte />");
  });
});
