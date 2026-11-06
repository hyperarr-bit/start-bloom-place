// @vitest-environment node
/**
 * As funções DE VERDADE (asaas-webhook e pix-reconcile, o index.ts inteiro) rodando contra um banco falso e uma Asaas falsa,
 * com linhas no formato das tabelas. Nada de rede: `fetch` é trocado e qualquer chamada desconhecida quebra o teste.
 * É aqui que se confere o que os testes das regras não veem: a ordem das etapas dentro do index.ts.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { consultarNestaPassada } from "../../supabase/functions/_shared/pix-recuperacao";

type Linha = Record<string, unknown>;
type Handler = (req: Request) => Promise<Response>;

const UID = "6f1c2f0e-8c0b-4b52-9a51-0e2f5c1d7a10";
const OUTRO = "0a9b8c7d-1111-4222-8333-444455556666";
const QR = "b2f7c9d04e1a4c6f8a3d5e7f90123456";
const SERVICE = "chave-de-servico";
const TOKEN = "token-da-varredura";
const SEGREDO = "segredo-do-webhook";
const MIN = 60_000;
const haMin = (m: number) => new Date(Date.now() - m * MIN).toISOString();

/* ───────────────────────── banco falso (a mesma interface do supabase-js) ───────────────────────── */
let t: Record<string, Linha[]>;
let falharEm: { tabela: string; op: string; vezes: number } | null;
let explodirEm: string | null;
let seq = 0;

function cliente() {
  const from = (tabela: string) => {
    if (tabela === explodirEm) throw new Error("banco fora");
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: string; dados?: Linha | Linha[] } = { tipo: "select" };
    let unico = false, de = 0, ate = 999, desc: string | null = null, asc: string | null = null;
    const exec = async () => {
      await new Promise((r) => setTimeout(r, 0));
      const lista = (t[tabela] ??= []);
      if (falharEm && falharEm.tabela === tabela && falharEm.op === op.tipo && falharEm.vezes > 0) { falharEm.vezes--; return { data: null, error: { message: "falha simulada" } }; }
      if (op.tipo === "insert") {
        for (const d of [op.dados as Linha].flat()) {
          if (tabela === "webhook_events" && lista.some((r) => r.id === d.id)) return { data: null, error: { code: "23505", message: "duplicate key" } };
          lista.push({ id: d.id ?? `id${++seq}`, processed_at: new Date().toISOString(), created_at: new Date().toISOString(), ...d });
        }
        return { data: null, error: null };
      }
      let achadas = lista.filter((r) => filtros.every((f) => f(r)));
      if (op.tipo === "update") { achadas.forEach((r) => Object.assign(r, op.dados)); return { data: null, error: null }; }
      if (op.tipo === "delete") { t[tabela] = lista.filter((r) => !achadas.includes(r)); return { data: null, error: null }; }
      if (desc) achadas = [...achadas].sort((a, b) => String(b[desc!]).localeCompare(String(a[desc!])));
      if (asc) achadas = [...achadas].sort((a, b) => String(a[asc!]).localeCompare(String(b[asc!])));
      achadas = achadas.slice(de, ate + 1).map((r) => ({ ...r })); // o servidor nunca devolve mais de 1.000
      return { data: unico ? achadas[0] ?? null : achadas, error: null };
    };
    const campo = (r: Linha, k: string) => {
      const m = k.match(/^event_data->>(.+)$/);
      return m ? String((r.event_data as Linha | null)?.[m[1]] ?? "") : r[k];
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      upsert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => campo(r, k) === v); return q; },
      neq: (k: string, v: unknown) => { filtros.push((r) => campo(r, k) !== v); return q; },
      gte: (k: string, v: string) => { filtros.push((r) => Date.parse(String(r[k])) >= Date.parse(v)); return q; },
      lt: (k: string, v: string) => { filtros.push((r) => Date.parse(String(r[k])) < Date.parse(v)); return q; },
      in: (k: string, vs: unknown[]) => { filtros.push((r) => vs.includes(campo(r, k))); return q; },
      is: (k: string, v: unknown) => { filtros.push((r) => (r[k] ?? null) === v); return q; },
      contains: (k: string, v: Linha) => { filtros.push((r) => Object.entries(v).every(([c, x]) => (r[k] as Linha | null)?.[c] === x)); return q; },
      order: (k: string, o?: { ascending?: boolean }) => { if (o?.ascending === false) desc = k; else asc = k; return q; },
      range: (a: number, b: number) => { de = a; ate = Math.min(b, a + 999); return q; },
      limit: (n: number) => { ate = de + n - 1; return q; },
      maybeSingle: () => { unico = true; return q; },
      single: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return {
    from,
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: id === OUTRO + "x" ? null : { id, email: "cliente@exemplo.com" } } }) } },
  };
}

/* ───────────────────────── a Asaas e o resto da rede, falsos ───────────────────────── */
let asaas: (qr: string) => { status: number; corpo: unknown };
let consultas: string[];
let purchases: Array<{ event_id: string; value: number }>;
let emails: string[];
const pagoAsaas = (valor = 27.9) => ({ status: 200, corpo: { object: "list", totalCount: 1, data: [{ id: "pay_1", status: "RECEIVED", value: valor, customer: "cus_1" }] } });
const pendenteAsaas = () => ({ status: 200, corpo: { object: "list", totalCount: 0, data: [] } });

const fetchFalso = async (url: string, init?: RequestInit): Promise<Response> => {
  const u = String(url);
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
  if (u.startsWith("https://api.asaas.com/v3/payments")) {
    const qr = new URL(u).searchParams.get("pixQrCodeId") ?? "";
    consultas.push(qr);
    const r = asaas(qr);
    return json(r.corpo, r.status);
  }
  if (u.startsWith("https://api.asaas.com/v3/customers")) return json({ name: "PAGADOR" });
  if (u.startsWith("https://graph.facebook.com")) {
    const d = JSON.parse(String(init?.body)).data[0];
    purchases.push({ event_id: d.event_id, value: d.custom_data?.value });
    return json({ events_received: 1 });
  }
  if (u.startsWith("https://api.resend.com")) { emails.push(JSON.parse(String(init?.body)).subject); return json({ id: "e1" }); }
  if (u.startsWith("https://api.utmify.com.br")) return json({ ok: true });
  throw new Error(`rede não esperada: ${u.slice(0, 60)}`);
};

let env: Record<string, string>;
const fetchReal = globalThis.fetch;
let pasta: string;
let webhook: Handler;
let reconcile: Handler;

async function carregar(fn: string): Promise<Handler> {
  const r = await build({
    entryPoints: [resolve(__dirname, `../../supabase/functions/${fn}/index.ts`)],
    bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "silent",
    plugins: [{
      name: "deno-https",
      setup(b) {
        b.onResolve({ filter: /^https:\/\// }, (a) => ({ path: a.path, namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
          loader: "js",
          contents: a.path.includes("/http/server")
            ? `export const serve = (h) => { globalThis.__handler = h; };`
            : `export const createClient = () => globalThis.__cliente();`,
        }));
      },
    }],
  });
  const arq = join(pasta, `${fn}.mjs`);
  writeFileSync(arq, r.outputFiles[0].text);
  await import(/* @vite-ignore */ pathToFileURL(arq).href);
  return (globalThis as unknown as { __handler: Handler }).__handler;
}

/* Relógio fixo: a agenda depende da passada. PIX_TESTE_HORA troca a hora, pra rodar o arquivo em várias passadas. */
const RELOGIO = process.env.PIX_TESTE_HORA ?? "2026-11-03T15:07:00.000Z";

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(RELOGIO));
  pasta = mkdtempSync(join(tmpdir(), "pix-integracao-"));
  const g = globalThis as unknown as Record<string, unknown>;
  g.Deno = { env: { get: (k: string) => env[k] } };
  g.__cliente = cliente;
  g.fetch = fetchFalso;
  webhook = await carregar("asaas-webhook");
  reconcile = await carregar("pix-reconcile");
}, 60_000);

afterAll(() => {
  vi.useRealTimers();
  globalThis.fetch = fetchReal;
  rmSync(pasta, { recursive: true, force: true });
});

beforeEach(() => {
  t = { subscriptions: [], webhook_events: [], analytics_events: [], support_tickets: [], profiles: [], user_data: [], presentes: [], push_dono: [] };
  falharEm = null; explodirEm = null;
  asaas = pendenteAsaas; consultas = []; purchases = []; emails = [];
  env = {
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: SERVICE, ASAAS_API_KEY: "k", ASAAS_WEBHOOK_SECRET: SEGREDO,
    RECONCILE_TOKEN: TOKEN, META_PIXEL_ID: "1", META_CAPI_TOKEN: "m", RESEND_API_KEY: "r",
  };
});

const pedido = (o: { uid?: string; order?: string; min?: number; offer?: string; cents?: number; extra?: Linha } = {}): Linha => ({
  id: `ev${++seq}`, user_id: o.uid ?? UID, event_name: "pix_order_created", created_at: haMin(o.min ?? 20),
  event_data: { order_id: o.order ?? QR, offer: o.offer ?? "LN_sempre279", amount_cents: o.cents ?? 2790, source_url: "https://www.coreaplicativo.com.br/organizar", client_ip: "200.1.1.1", user_agent: "iPhone", ...o.extra },
});
const entregar = (id = "evt_1") => webhook(new Request("https://x/asaas-webhook", {
  method: "POST", headers: { "asaas-access-token": SEGREDO },
  body: JSON.stringify({ id, event: "PAYMENT_RECEIVED", payment: { id: "pay_1", pixQrCodeId: QR, value: 27.9, status: "RECEIVED" } }),
}));
const varrer = async (corpo: Linha = { token: TOKEN, hours: 48 }, headers: Record<string, string> = {}) => {
  const r = await reconcile(new Request("https://x/pix-reconcile", { method: "POST", headers, body: JSON.stringify(corpo) }));
  return { status: r.status, out: (await r.json()) as Record<string, any> };
};
const eventos = (nome: string) => t.analytics_events.filter((e) => e.event_name === nome);
const pendencias = () => t.webhook_events.filter((e) => e.source === "pix_pendente");

describe("asaas-webhook de verdade", () => {
  it("reentrega depois da falha: 200, evento solto, depois 1 crédito e 1 Purchase; a 3ª é duplicada", async () => {
    t.analytics_events.push(pedido());
    asaas = () => ({ status: 429, corpo: { errors: [] } });
    const r1 = await entregar();
    expect(r1.status).toBe(200);
    expect(await r1.json()).toMatchObject({ status: "reconfirm_error" });
    expect(consultas).toHaveLength(1); // 429 não insiste
    expect(t.subscriptions).toHaveLength(0);
    expect(pendencias()).toHaveLength(1);

    asaas = () => pagoAsaas();
    expect(await (await entregar()).json()).toMatchObject({ granted: true });
    expect(await (await entregar()).json()).toMatchObject({ duplicate: true });
    expect(t.subscriptions).toHaveLength(1);
    expect(t.subscriptions[0]).toMatchObject({ user_id: UID, status: "active", billing_period: "lifetime", abacatepay_billing_id: QR });
    expect(purchases).toEqual([{ event_id: QR, value: 27.9 }]);
  });

  it("com a chave: 503 pra Asaas reenviar, no máximo 5 por hora; sem a chave, 200", async () => {
    t.analytics_events.push(pedido());
    asaas = pendenteAsaas;
    expect((await entregar("evt_a")).status).toBe(200);
    env.ASAAS_WEBHOOK_REENVIO = "on";
    const st: number[] = [];
    for (let i = 0; i < 7; i++) st.push((await entregar(`evt_b${i}`)).status);
    expect(st).toEqual([503, 503, 503, 503, 503, 200, 200]);
  });

  it("gravar a linha falhou: evento solto e pendência; a reentrega credita 1x", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    falharEm = { tabela: "subscriptions", op: "insert", vezes: 1 };
    expect(await (await entregar()).json()).toMatchObject({ error: "grant_failed" });
    expect(t.webhook_events.some((e) => e.id === "asaas:evt_1")).toBe(false);
    expect(t.webhook_events.some((e) => e.id === `grant:asaas:${QR}`)).toBe(false);
    expect(await (await entregar()).json()).toMatchObject({ granted: true });
    expect(t.subscriptions).toHaveLength(1);
    expect(purchases).toHaveLength(1);
  });

  it("falha DEPOIS do crédito (e-mail, perfil) não solta o evento: reentrega não repete Purchase", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    explodirEm = "profiles";
    expect(await (await entregar()).json()).toMatchObject({ error: "internal" });
    expect(t.subscriptions).toHaveLength(1);
    expect(t.webhook_events.some((e) => e.id === "asaas:evt_1")).toBe(true);
    expect(pendencias()).toHaveLength(0);
    explodirEm = null;
    expect(await (await entregar()).json()).toMatchObject({ duplicate: true });
    expect(t.subscriptions).toHaveLength(1);
  });

  it("evento sem registro do pedido: pendência sem crédito (nunca libera sem dono)", async () => {
    asaas = () => pagoAsaas();
    expect(await (await entregar()).json()).toMatchObject({ warning: "no_user" });
    expect(t.subscriptions).toHaveLength(0);
    expect(pendencias()).toHaveLength(1);
  });
});

const ANUAL = { offer: "LN_ano279" };
const linhaDoOutroPedido = (o: Linha = {}): Linha => ({
  id: "s1", user_id: UID, status: "active", plan: "core-pro", billing_period: "annual", payment_method: "pix", abacatepay_billing_id: "outro_pedido",
  current_period_end: new Date(Date.now() + 365 * 864e5).toISOString(), ...o,
});
/** Sem marca = trava de antes do corte, com data fixa (o relógio destes testes muda). */
const ANTES_DO_CORTE = "2026-11-01T12:00:00.000+00:00";
const travaDe = (order: string, event: string, min: number) => ({ id: `grant:asaas:${order}`, source: "grant", event, processed_at: event === "creditado" ? haMin(min) : ANTES_DO_CORTE });

describe("crédito duplo (achados do crítico)", () => {
  it("webhook novo em pedido de antes da marca, com a linha reescrita: não empilha, não manda Purchase, vira pendência", async () => {
    t.analytics_events.push(pedido({ ...ANUAL, min: 600 }));
    t.subscriptions.push(linhaDoOutroPedido());
    t.webhook_events.push(travaDe(QR, "asaas", 590));
    const fim = t.subscriptions[0].current_period_end;
    asaas = () => pagoAsaas();
    await entregar("evt_novo");
    expect(t.subscriptions[0]).toMatchObject({ abacatepay_billing_id: "outro_pedido", current_period_end: fim });
    expect(purchases).toHaveLength(0);
    expect(pendencias()).toHaveLength(1);
  });

  it("a varredura abre o chamado desse pedido, com ou sem pendência, em qualquer idade", async () => {
    t.analytics_events.push(pedido({ ...ANUAL, min: 4000 }));
    t.subscriptions.push(linhaDoOutroPedido());
    t.webhook_events.push(travaDe(QR, "asaas", 3990), { id: `pix-pend:${QR}`, source: "pix_pendente", event: "reconfirma_http_429", processed_at: haMin(5) });
    const fim = t.subscriptions[0].current_period_end;
    asaas = () => pagoAsaas();
    const { out } = await varrer();
    expect(out.creditados).toHaveLength(0);
    expect(t.subscriptions[0].current_period_end).toBe(fim);
    expect(purchases).toHaveLength(0);
    expect(String(t.support_tickets[0].message)).toContain("pedido_antigo_conferir");
  });

  it("pendência com 10 h e trava sem marca: chamado, sem crédito", async () => {
    t.analytics_events.push(pedido({ ...ANUAL, min: 600 }));
    t.webhook_events.push(travaDe(QR, "asaas", 590), { id: `pix-pend:${QR}`, source: "pix_pendente", event: "em_andamento", processed_at: haMin(5) });
    asaas = () => pagoAsaas();
    await varrer();
    expect(t.subscriptions).toHaveLength(0);
    expect(String(t.support_tickets[0].message)).toContain("trava_antiga_conferir");
  });

  it("trava depois do corte, sem marca e sem linha (caminho morto), com 5 h: a reentrega credita 1x, sem chamado", async () => {
    vi.setSystemTime(new Date("2026-11-20T12:00:00.000Z"));
    try {
      t.analytics_events.push(pedido({ ...ANUAL, min: 310 }));
      t.webhook_events.push({ id: `grant:asaas:${QR}`, source: "grant", event: "asaas", processed_at: haMin(300) });
      asaas = () => pagoAsaas();
      await entregar("evt_morto");
      await entregar("evt_morto_2");
      expect(t.subscriptions).toHaveLength(1);
      expect(purchases).toHaveLength(1);
      expect(t.support_tickets).toHaveLength(0);
    } finally { vi.setSystemTime(new Date(RELOGIO)); }
  });

  it("o chamado do pedido parado diz o que fazer, e não promete que a varredura resolve", async () => {
    t.analytics_events.push(pedido({ ...ANUAL, min: 600 }));
    t.webhook_events.push(travaDe(QR, "asaas", 590));
    asaas = () => pagoAsaas();
    t.webhook_events.push({ id: `pix-pend:${QR}`, source: "pix_pendente", event: "em_andamento", processed_at: haMin(5) });
    await varrer();
    const m = String(t.support_tickets[0].message);
    expect(m).not.toContain("segue tentando");
    expect(m).toContain("NÃO vai creditar");
    expect(m).toContain(`liberar_vitalicio com o uid desta conta, cents do pedido e billing=${QR}`);
  });

  it("a marca falhou 1x ao gravar: a 2ª tentativa grava; e a reentrega não credita de novo", async () => {
    t.analytics_events.push(pedido(ANUAL));
    asaas = () => pagoAsaas();
    falharEm = { tabela: "webhook_events", op: "update", vezes: 1 };
    await entregar("evt_1");
    expect(t.webhook_events.find((e) => e.id === `grant:asaas:${QR}`)?.event).toBe("creditado");
    await entregar("evt_2");
    expect(t.subscriptions).toHaveLength(1);
    expect(purchases).toHaveLength(1);
  });

  it("a marca não gravou nunca: a próxima passada pela linha conserta", async () => {
    t.analytics_events.push(pedido(ANUAL));
    asaas = () => pagoAsaas();
    falharEm = { tabela: "webhook_events", op: "update", vezes: 2 };
    await entregar("evt_1");
    expect(t.webhook_events.find((e) => e.id === `grant:asaas:${QR}`)?.event).toBe("asaas");
    await entregar("evt_2");
    expect(t.webhook_events.find((e) => e.id === `grant:asaas:${QR}`)?.event).toBe("creditado");
    expect(t.subscriptions).toHaveLength(1);
  });

  it("pedido com a marca e linha reescrita por outro vitalício: nada de 'pago em dobro' falso", async () => {
    t.analytics_events.push(pedido({ min: 30 }));
    t.subscriptions.push(linhaDoOutroPedido({ plan: "lifetime", billing_period: "lifetime" }));
    t.webhook_events.push(travaDe(QR, "creditado", 25));
    asaas = () => pagoAsaas();
    await entregar("evt_j");
    expect(t.support_tickets).toHaveLength(0);
    expect(purchases).toHaveLength(0);
  });

  it("evento atrasado de pedido reembolsado: sai da fila sem chamado", async () => {
    t.analytics_events.push(pedido());
    await entregar("evt_k");
    pendencias()[0].processed_at = haMin(30);
    await varrer();
    expect(t.support_tickets).toHaveLength(0);
    expect(pendencias()).toHaveLength(0);
    expect(t.subscriptions).toHaveLength(0);
  });
});

describe("pix-reconcile de verdade", () => {
  it("o e-mail de acesso sai pela varredura, 1 por pedido, junto com a página e o webhook", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    await varrer();
    await varrer();
    await entregar();
    expect(emails).toHaveLength(1);
    expect(t.webhook_events.some((e) => e.id === `hoje-email:${QR}`)).toBe(true);
  });

  it("e-mail falhou: a reserva solta e o crédito fica", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    env.RESEND_API_KEY = "";
    await varrer();
    expect(t.subscriptions).toHaveLength(1);
    expect(t.webhook_events.some((e) => e.id === `hoje-email:${QR}`)).toBe(false);
  });

  it("anon: sem e-mail, IP e UA na resposta; 10 chamadas juntas fazem 1 passada; sem dryRun e sem janela maior", async () => {
    env.SUPABASE_ANON_KEY = "anon";
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    const anon = { Authorization: "Bearer anon" };
    const rs = await Promise.all(Array.from({ length: 10 }, () => varrer({ hours: 168 }, anon)));
    expect(consultas).toHaveLength(1);
    expect(rs.filter((r) => r.out.pulada)).toHaveLength(9);
    const texto = JSON.stringify(rs.map((r) => r.out));
    for (const dado of ["cliente@exemplo.com", "200.1.1.1", "iPhone", UID, QR, "RECEIVED"]) expect(texto).not.toContain(dado);
    expect(rs.find((r) => !r.out.pulada)?.out).toEqual({ ok: true, sondadas: 1, totalCreditados: 1, totalFalhas: 0 });
    expect((await varrer({ hours: 48 }, anon)).out.pulada).toBe(true); // intervalo mínimo
    expect((await varrer({ dryRun: true }, anon)).status).toBe(401);
    const dry = await varrer({ token: TOKEN, dryRun: true });
    for (const dado of ["200.1.1.1", "iPhone"]) expect(JSON.stringify(dry.out)).not.toContain(dado);
  });

  it("depois de 10 min o cron passa de novo", async () => {
    env.SUPABASE_ANON_KEY = "anon";
    await varrer({ hours: 48 }, { Authorization: "Bearer anon" });
    t.webhook_events.find((e) => e.id === "pix-varredura:ativa")!.processed_at = haMin(15);
    expect((await varrer({ hours: 48 }, { Authorization: "Bearer anon" })).out.pulada).toBeUndefined();
  });

  it("ordem: quem pagou agora é consultado primeiro, antes de 300 pedidos velhos", async () => {
    for (let i = 0; i < 300; i++) t.analytics_events.push(pedido({ uid: `u-${i}`, order: `velho${i}`, min: 200 + i }));
    t.analytics_events.push(pedido({ min: 15 }));
    asaas = (qr) => (qr === QR ? pagoAsaas() : pendenteAsaas());
    const { out } = await varrer();
    expect(consultas[0]).toBe(QR);
    expect(consultas.length).toBeLessThan(140);
    expect(out.foraDaAgenda).toBeGreaterThan(150);
    expect(out.creditados).toHaveLength(1);
    expect(t.subscriptions).toHaveLength(1);
    expect(purchases).toEqual([{ event_id: QR, value: 27.9 }]);
    expect(eventos("pix_reconciled")).toHaveLength(1);
  });

  it("nunca libera sem pagamento confirmado", async () => {
    t.analytics_events.push(pedido());
    const { out } = await varrer();
    expect(out.creditados).toHaveLength(0);
    expect(t.subscriptions).toHaveLength(0);
    expect(purchases).toHaveLength(0);
  });

  it("duas passadas e webhook no mesmo pedido: 1 linha, 1 Purchase", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    await varrer();
    await varrer();
    await entregar();
    expect(t.subscriptions).toHaveLength(1);
    expect(purchases).toHaveLength(1);
  });

  it("429 da Asaas: para a passada, entra em falhas, não vira 'não pagou' calado, e avisa", async () => {
    for (let i = 0; i < 20; i++) t.analytics_events.push(pedido({ uid: `u-${i}`, order: `q${i}`, min: 10 + i }));
    asaas = () => ({ status: 429, corpo: {} });
    const { out } = await varrer();
    expect(consultas).toHaveLength(1);
    expect(out.falhas).toEqual([{ orderId: consultas[0], erro: "gateway_http_429" }]);
    expect(out).toMatchObject({ parou: "cota_429", puladas: 19 });
    expect(eventos("pix_varredura_alerta")).toHaveLength(1);
  });

  it("pendência do webhook: crédito sai mesmo fora da janela e a fila esvazia", async () => {
    t.analytics_events.push(pedido());
    asaas = () => ({ status: 500, corpo: {} });
    await entregar();
    expect(pendencias()).toHaveLength(1);
    t.analytics_events[0].created_at = haMin(4 * 1440); // fora das 48 h, sem a chave do antigo
    asaas = () => pagoAsaas();
    const { out } = await varrer();
    expect(out.creditados).toHaveLength(1);
    expect(pendencias()).toHaveLength(0);
    expect(t.subscriptions).toHaveLength(1);
  });

  it("pendência de pedido já creditado pela página: sai da fila sem escrever nem mandar nada", async () => {
    t.analytics_events.push(pedido());
    t.subscriptions.push({ id: "s1", user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: QR, current_period_end: "2126-11-03T00:00:00.000Z" });
    t.webhook_events.push({ id: `pix-pend:${QR}`, source: "pix_pendente", event: "em_andamento", processed_at: haMin(16) });
    asaas = () => pagoAsaas();
    await varrer();
    expect(pendencias()).toHaveLength(0);
    expect(t.subscriptions).toHaveLength(1);
    expect(purchases).toHaveLength(0);
    expect(t.support_tickets).toHaveLength(0);
  });

  it("pendência sem solução há mais de 20 min: chamado 1x, e segue na fila", async () => {
    t.analytics_events.push(pedido());
    t.webhook_events.push({ id: `pix-pend:${QR}`, source: "pix_pendente", event: "reconfirma_http_500", processed_at: haMin(25) });
    asaas = () => ({ status: 500, corpo: {} });
    await varrer();
    await varrer();
    expect(t.support_tickets).toHaveLength(1);
    expect(t.support_tickets[0]).toMatchObject({ source: "pix_sem_credito", user_id: UID });
    expect(pendencias()).toHaveLength(1);
  });

  it("pago a menos: não credita e abre chamado", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas(10);
    await varrer();
    expect(t.subscriptions).toHaveLength(0);
    expect(t.support_tickets[0]).toMatchObject({ source: "pix_sem_credito" });
    expect(String(t.support_tickets[0].message)).toContain("pagou menos");
  });

  it("vitalício com pendência de outro pedido pago: linha preservada, chamado de devolução, sem Purchase", async () => {
    t.analytics_events.push(pedido());
    t.subscriptions.push({ id: "s1", user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: "pedido_valido", current_period_end: "2126-11-03T00:00:00.000Z" });
    t.webhook_events.push({ id: `pix-pend:${QR}`, source: "pix_pendente", event: "grant_falhou", processed_at: haMin(5) });
    asaas = () => pagoAsaas();
    await varrer();
    expect(t.subscriptions).toHaveLength(1);
    expect(t.subscriptions[0].abacatepay_billing_id).toBe("pedido_valido");
    expect(t.support_tickets[0]).toMatchObject({ source: "pix_em_dobro" });
    expect(purchases).toHaveLength(0);
    expect(pendencias()).toHaveLength(0);
  });

  it("registros em conflito (linha forjada): pendência não credita ninguém", async () => {
    t.analytics_events.push(pedido(), pedido({ uid: OUTRO }));
    t.webhook_events.push({ id: `pix-pend:${QR}`, source: "pix_pendente", event: "sem_registro_do_pedido", processed_at: haMin(5) });
    asaas = () => pagoAsaas();
    await varrer();
    expect(t.subscriptions).toHaveLength(0);
  });

  describe("pedido antigo (3 dias)", () => {
    /** O id que cai na passada de agora, escolhido pela agenda (1x por dia por pedido). */
    const idDaPassada = (min: number) => {
      for (let i = 0; i < 5000; i++) {
        if (consultarNestaPassada({ orderId: `${QR}${i}`, criadoEm: haMin(min), agora: Date.now(), antigoLigado: true })) return `${QR}${i}`;
      }
      throw new Error("nenhum id");
    };

    it("chave desligada: nem consulta", async () => {
      t.analytics_events.push(pedido({ min: 3 * 1440, order: idDaPassada(3 * 1440) }));
      asaas = () => pagoAsaas();
      await varrer();
      expect(consultas).toHaveLength(0);
    });

    it("chave ligada e histórico limpo: credita, com Purchase", async () => {
      env.PIX_RESGATE_ANTIGO = "on";
      const id = idDaPassada(3 * 1440);
      t.analytics_events.push(pedido({ min: 3 * 1440, order: id }));
      asaas = () => pagoAsaas();
      await varrer();
      expect(t.subscriptions).toHaveLength(1);
      expect(t.subscriptions[0].abacatepay_billing_id).toBe(id);
      expect(purchases).toEqual([{ event_id: id, value: 27.9 }]);
    });

    it("chave ligada, trava sem marca e sem linha: não credita, abre chamado", async () => {
      env.PIX_RESGATE_ANTIGO = "on";
      const id = idDaPassada(3 * 1440);
      t.analytics_events.push(pedido({ min: 3 * 1440, order: id }));
      t.webhook_events.push(travaDe(id, "asaas", 0));
      asaas = () => pagoAsaas();
      await varrer();
      expect(t.subscriptions).toHaveLength(0);
      expect(String(t.support_tickets[0].message)).toContain("pedido_antigo_conferir");
    });
  });

  describe("varredura de uma conta", () => {
    it("a anon key não entra; com a chave de serviço, só a conta pedida", async () => {
      env.SUPABASE_ANON_KEY = "anon";
      t.analytics_events.push(pedido(), pedido({ uid: OUTRO, order: "de_outro" }));
      asaas = () => pagoAsaas();
      expect((await varrer({ soUsuario: UID }, { Authorization: "Bearer anon" })).status).toBe(401);
      expect(consultas).toHaveLength(0);
      const { status, out } = await varrer({ soUsuario: UID }, { Authorization: `Bearer ${SERVICE}` });
      expect(status).toBe(200);
      expect(out.creditados).toHaveLength(1);
      expect(consultas).toEqual([QR]);
      expect(t.subscriptions.map((s) => s.user_id)).toEqual([UID]);
    });

    it("registro de outra conta no mesmo pedido: não credita (a leitura por conta não pode esconder o conflito)", async () => {
      t.analytics_events.push(pedido({ uid: UID }), pedido({ uid: OUTRO }));
      asaas = () => pagoAsaas();
      const { out } = await varrer({ soUsuario: OUTRO, token: TOKEN });
      expect(out.creditados).toHaveLength(0);
      expect(t.subscriptions).toHaveLength(0);
      expect(consultas).toHaveLength(0);
    });

    it("olha todos os pedidos recentes até o teto, e nada além de 2 h", async () => {
      for (let i = 0; i < 4; i++) t.analytics_events.push(pedido({ order: `q${i}`, min: 10 + i }));
      t.analytics_events.push(pedido({ order: "velho", min: 200 }));
      await varrer({ soUsuario: UID, token: TOKEN });
      expect([...consultas].sort()).toEqual(["q0", "q1", "q2", "q3"]);
      t.analytics_events.push(...[5, 6, 7].map((i) => pedido({ order: `q${i}`, min: 2 + i })));
      consultas = [];
      await varrer({ soUsuario: UID, token: TOKEN });
      expect(consultas).toHaveLength(5);
    });

    it("não mexe na marca da passada nem nas pendências", async () => {
      t.webhook_events.push({ id: "pix-varredura:ativa", source: "pix_alarme", event: "em_curso", processed_at: haMin(1) });
      const { out } = await varrer({ soUsuario: UID, token: TOKEN });
      expect(out.pendencias).toBe(0);
      expect(t.webhook_events.find((e) => e.id === "pix-varredura:ativa")?.event).toBe("em_curso");
    });
  });

  it("dryRun: fila inteira, sem agenda; lista o que creditaria, o que já valeu e o que pede conferência", async () => {
    t.analytics_events.push(
      pedido({ uid: "u-novo", order: "novo", min: 10 }),
      ...Array.from({ length: 12 }, (_, i) => pedido({ uid: `u-${i}`, order: `meio${i}`, min: 600 + i })),
      pedido({ uid: "u-cancelou", order: "valeu", min: 700 }),
      pedido({ uid: "u-menor", order: "menor", min: 800 }),
    );
    t.subscriptions.push({ id: "s9", user_id: "u-cancelou", status: "canceled", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: "valeu", current_period_end: "2126-11-03T00:00:00.000Z" });
    asaas = (q) => (q === "menor" ? pagoAsaas(10) : pagoAsaas());
    const { out } = await varrer({ token: TOKEN, dryRun: true });
    expect(out.foraDaAgenda).toBe(0);
    expect(consultas).toHaveLength(15);
    const por = Object.fromEntries(out.creditados.map((c: Linha) => [c.orderId, c.previsao]));
    expect(por.novo).toBe("creditaria");
    expect(por.meio7).toBe("creditaria");
    expect(por.valeu).toBe("ja_creditado");
    expect(out.conferir).toEqual([{ orderId: "menor", uid: "u-menor", motivo: "valor_menor", cents: 2790 }]);
    expect(t.subscriptions).toHaveLength(1);
    expect(t.support_tickets).toHaveLength(0);
    expect(purchases).toHaveLength(0);
  });

  it("dryRun por páginas: `pular` continua de onde parou", async () => {
    for (let i = 0; i < 6; i++) t.analytics_events.push(pedido({ uid: `u-${i}`, order: `q${i}`, min: 10 + i }));
    await varrer({ token: TOKEN, dryRun: true, pular: 4 });
    expect(consultas).toEqual(["q4", "q5"]);
  });

  it("e-mail da pendência: a data é a do fim decidido, não a contada do QR", async () => {
    const corpos: string[] = [];
    const fetchAntes = globalThis.fetch;
    globalThis.fetch = (async (u: string, i?: RequestInit) => { if (String(u).includes("resend")) corpos.push(String(i?.body)); return fetchAntes(u, i); }) as typeof fetch;
    try {
      t.analytics_events.push(pedido({ ...ANUAL, order: "pend" }));
      t.subscriptions.push({ id: "s1", user_id: UID, status: "active", plan: "web", billing_period: "monthly_prepaid", payment_method: "pix", abacatepay_billing_id: "outro", current_period_end: new Date(Date.now() + 200 * 864e5).toISOString() });
      t.webhook_events.push({ id: "pix-pend:pend", source: "pix_pendente", event: "grant_falhou", processed_at: haMin(5) });
      asaas = () => pagoAsaas();
      await varrer();
      const fim = new Date(String(t.subscriptions[0].current_period_end));
      expect(fim.getTime()).toBeGreaterThan(Date.now() + 500 * 864e5); // empilhou sobre o vigente
      const dia = fim.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      expect(corpos).toHaveLength(1);
      expect(corpos[0]).toContain(dia);
    } finally { globalThis.fetch = fetchAntes; }
  });

  it("dryRun não escreve nada", async () => {
    t.analytics_events.push(pedido());
    asaas = () => pagoAsaas();
    const { out } = await varrer({ token: TOKEN, dryRun: true });
    expect(out.creditados).toHaveLength(1);
    expect(t.subscriptions).toHaveLength(0);
    expect(t.webhook_events).toHaveLength(0);
    expect(purchases).toHaveLength(0);
  });

  it("passada normal fecha a própria marca; a que ficou em curso vira alarme", async () => {
    await varrer();
    expect(t.webhook_events.find((e) => e.id === "pix-varredura:ativa")?.event).toBe("fim");
    t.webhook_events = [{ id: "pix-varredura:ativa", source: "pix_alarme", event: "em_curso", processed_at: haMin(15) }];
    await varrer();
    expect(eventos("pix_varredura_alerta")[0].event_data).toMatchObject({ motivo: "passada_anterior_morreu" });
  });
});
