/**
 * UPSELL DE PRESENTE (21/10) — o lado do servidor (supabase/functions/_shared/presente.ts + as funções):
 *   · o código: 8 letras sem I/L/O/0/1, aleatório; 1 pedido pago = 1 presente, mesmo com 3 caminhos ao mesmo tempo;
 *   · o resgate: 1 vez só; quem já tem o CORE pra sempre recebe "ja_tem" e o código segue valendo; o comprador (a
 *     mesma conta, o mesmo e-mail, ou a conta pra onde a compra foi levada) não resgata; a linha nasce payment_method
 *     "presente", vitalícia, com o pedido e o valor do presente — nunca liberar_vitalicio;
 *   · o downsell (pk99): o kit na conta de QUEM PAGOU, 1 vez;
 *   · o link por e-mail 1 vez por pedido (falhou → solta); Equipe CORE + reply_to contato@; sem "ele/ela";
 *   · as 3 funções que confirmam Pix conhecem pv149/pk99 sem dar acesso a quem pagou; Purchase 1x por pedido;
 *   · migração NÃO aplicada com RLS fechada; presente-resgatar com verify_jwt = false (o `ver` é sem conta).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALFABETO_PRESENTE, CHAVE_KIT_CONTA, PRECOS_PLANO30, PRECOS_PRESENTE, REPLY_TO_PRESENTE, chaveCapiPlano30, chaveCapiPresente, codigoValido, contaDoComprador,
  corpoResend, decidirResgate, garantirPresente, gerarCodigo, htmlPresenteComprador, htmlPresenteRecebido, liberarPlano30, linkDoPresente, mandarLinkPorEmail,
  nomeNoCartao, normalizarCodigo, presentePorCodigo, resgatarPresente, temPraSempre, type Presente,
} from "../../supabase/functions/_shared/presente";
import { nomeDoProduto, planoUtmify } from "../../supabase/functions/_shared/email-venda";
import { CONCESSAO_HOJE } from "../../supabase/functions/_shared/ofertas-hoje";
import { VALOR_PLANO30, VALOR_PRESENTE, linkDoPresente as linkDoSite } from "@/lib/presente";

const raiz = resolve(__dirname, "../..");
const fonte = (f: string) => readFileSync(resolve(raiz, "supabase/functions", f), "utf8");

/* ───────── banco falso: presentes / webhook_events / subscriptions / user_data / analytics_events ───────── */
type Linha = Record<string, unknown>;
const UNICAS: Record<string, string[]> = { presentes: ["codigo", "pedido"], webhook_events: ["id"], user_data: [] };
function bancoFalso(inicial: Partial<Record<string, Linha[]>> = {}) {
  const db: Record<string, Linha[]> = { presentes: [], webhook_events: [], subscriptions: [], user_data: [], analytics_events: [], ...inicial } as Record<string, Linha[]>;
  const ceder = () => new Promise((r) => setTimeout(r, 0));
  let seq = 0;
  const from = (t: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete" | "upsert"; dados?: Linha; selecionar?: boolean } = { tipo: "select" };
    let um = false;
    const exec = async () => {
      await ceder();
      const tab = (db[t] ??= []);
      const casam = () => tab.filter((r) => filtros.every((f) => f(r)));
      if (op.tipo === "insert") {
        for (const k of UNICAS[t] ?? []) if (tab.some((r) => r[k] === op.dados![k])) return { error: { code: "23505", message: `dup ${k}` } };
        tab.push({ id: `l${++seq}`, processed_at: new Date().toISOString(), ...op.dados });
        return { error: null };
      }
      if (op.tipo === "upsert") {
        const ex = tab.find((r) => r.user_id === op.dados!.user_id && r.key === op.dados!.key);
        if (ex) Object.assign(ex, op.dados); else tab.push({ ...op.dados });
        return { error: null };
      }
      if (op.tipo === "update") { const alvo = casam(); for (const r of alvo) Object.assign(r, op.dados); return { data: op.selecionar ? alvo.map((r) => ({ ...r })) : null, error: null }; }
      if (op.tipo === "delete") { db[t] = tab.filter((r) => !filtros.every((f) => f(r))); return { error: null }; }
      const rows = casam().map((r) => ({ ...r }));
      return { data: um ? rows[0] ?? null : rows, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => { if (op.tipo === "update") op.selecionar = true; return q; },
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      upsert: (d: Linha) => { op = { tipo: "upsert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => r[k] === v || (k === "event_name" && r.event_name === v)); return q; },
      is: (k: string, v: unknown) => { filtros.push((r) => (r[k] ?? null) === v); return q; },
      in: (k: string, vs: unknown[]) => { filtros.push((r) => vs.includes(r[k])); return q; },
      limit: () => q,
      maybeSingle: () => { um = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { db, admin: { from } };
}
const AGORA = new Date("2026-10-21T15:00:00Z");
let n = 0;
const sequencia = (...codigos: string[]) => () => codigos[Math.min(n++, codigos.length - 1)];

describe("o código", () => {
  it("8 caracteres do alfabeto sem I, L, O, 0, 1; aleatório", () => {
    expect(ALFABETO_PRESENTE).not.toMatch(/[ILO01]/);
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) { const c = gerarCodigo(); expect(codigoValido(c)).toBe(true); vistos.add(c); }
    expect(vistos.size).toBe(200);
    expect(codigoValido("K7QM2XPA")).toBe(true);
    expect(codigoValido("K7QM2XP0")).toBe(false);
    expect(normalizarCodigo(" k7qm-2xpa ")).toBe("K7QM2XPA");
    expect(linkDoPresente("K7QM2XPA")).toBe("https://www.coreaplicativo.com.br/presente/K7QM2XPA");
    expect(linkDoSite("K7QM2XPA")).toBe(linkDoPresente("K7QM2XPA"));
  });
  it("nome no cartão: limpo, até 40, sem tag; vazio vira null", () => {
    expect(nomeNoCartao("  Ana   Souza ")).toBe("Ana Souza");
    expect(nomeNoCartao("<b>x</b>")).toBe("bx/b");
    expect(nomeNoCartao("   ")).toBeNull();
    expect(nomeNoCartao("a".repeat(80))!.length).toBe(40);
  });
});

describe("1 pedido pago = 1 presente", () => {
  it("o check, o webhook e o reconcile ao mesmo tempo: o mesmo código pra todos, 1 linha", async () => {
    const { db, admin } = bancoFalso();
    n = 0;
    const gerar = sequencia("AAAAAAAA", "BBBBBBBB", "CCCCCCCC");
    const r = await Promise.all([1, 2, 3].map(() => garantirPresente(admin, { orderId: "qr_1", compradorId: "u1", gerar })));
    expect(db.presentes).toHaveLength(1);
    expect(new Set(r.map((x) => x!.codigo)).size).toBe(1);
    expect(r.filter((x) => x!.novo)).toHaveLength(1);
    expect(db.presentes[0]).toMatchObject({ pedido: "qr_1", comprador_id: "u1", valor_centavos: 1490 });
  });
  it("código que já existe (colisão) → outro código", async () => {
    const { db, admin } = bancoFalso({ presentes: [{ codigo: "AAAAAAAA", pedido: "outro", comprador_id: "x", valor_centavos: 1490, resgatado_por: null }] });
    n = 0;
    const p = await garantirPresente(admin, { orderId: "qr_2", compradorId: "u1", gerar: sequencia("AAAAAAAA", "DDDDDDDD") });
    expect(p).toEqual({ codigo: "DDDDDDDD", novo: true });
    expect(db.presentes).toHaveLength(2);
  });
});

const presente = (extra: Partial<Presente> = {}): Presente => ({ codigo: "K7QM2XPA", comprador_id: "comprador", pedido: "qr_pv", valor_centavos: 1490, de_nome: "Ana", resgatado_por: null, resgatado_em: null, ...extra });
const vitalicia = { status: "active", plan: "lifetime", billing_period: "lifetime", current_period_end: "2126-01-01T00:00:00Z" };

describe("o resgate", () => {
  it("decidirResgate: ok · nao_existe · usado · ja_e_seu · proprio · sem_email · ja_tem (o código segue livre)", () => {
    const base = { userId: "bia", userEmail: "bia@x.com", doComprador: false, linhas: [] };
    expect(decidirResgate({ ...base, presente: presente() })).toBe("ok");
    expect(decidirResgate({ ...base, presente: null })).toBe("nao_existe");
    expect(decidirResgate({ ...base, presente: presente({ resgatado_por: "outra" }) })).toBe("usado");
    expect(decidirResgate({ ...base, presente: presente({ resgatado_por: "bia" }) })).toBe("ja_e_seu");
    expect(decidirResgate({ ...base, doComprador: true, presente: presente() })).toBe("proprio");
    expect(decidirResgate({ ...base, userEmail: null, presente: presente() })).toBe("sem_email");
    expect(decidirResgate({ ...base, linhas: [vitalicia], presente: presente() })).toBe("ja_tem");
    // vitalício da LOJA também conta; anual não
    expect(temPraSempre([{ ...vitalicia, plan: "core-pro" }])).toBe(true);
    expect(temPraSempre([{ status: "active", plan: "core-pro", billing_period: "annual" }])).toBe(false);
    expect(temPraSempre([{ ...vitalicia, status: "canceled" }])).toBe(false);
  });
  it("resgatar: marca o código e cria a linha vitalícia 'presente' com o pedido e o valor do presente", async () => {
    const { db, admin } = bancoFalso({ presentes: [presente() as unknown as Linha] });
    const r = await resgatarPresente(admin, { presente: presente(), userId: "bia", userEmail: "bia@x.com", agora: AGORA });
    expect(r.r).toBe("ok");
    expect(db.presentes[0]).toMatchObject({ resgatado_por: "bia", resgatado_em: AGORA.toISOString() });
    expect(db.subscriptions).toHaveLength(1);
    expect(db.subscriptions[0]).toMatchObject({
      user_id: "bia", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "presente",
      abacatepay_billing_id: "qr_pv", amount_cents: 1490, customer_email: "bia@x.com",
    });
    expect(new Date(String(db.subscriptions[0].current_period_end)).getUTCFullYear()).toBe(2126);
    expect(await presentePorCodigo(admin, "K7QM2XPA")).toMatchObject({ resgatado_por: "bia" });
  });
  it("duas pessoas ao mesmo tempo: só uma ganha; a outra recebe 'usado'", async () => {
    const { db, admin } = bancoFalso({ presentes: [presente() as unknown as Linha] });
    const [a, b] = await Promise.all([
      resgatarPresente(admin, { presente: presente(), userId: "bia", userEmail: "bia@x.com", agora: AGORA }),
      resgatarPresente(admin, { presente: presente(), userId: "caio", userEmail: "caio@x.com", agora: AGORA }),
    ]);
    expect([a.r, b.r].sort()).toEqual(["ok", "usado"]);
    expect(db.subscriptions).toHaveLength(1);
  });
  it("conta do comprador: a mesma, o mesmo e-mail, ou a conta pra onde a compra dele foi levada", async () => {
    const { admin } = bancoFalso({ analytics_events: [{ event_name: "pix_order_created", user_id: "anon", event_data: { order_id: "qr_plano" } }] });
    const base = { compradorId: "anon", compradorEmail: null, userEmail: "x@x.com", linhasDoUsuario: [] };
    expect(await contaDoComprador(admin, { ...base, userId: "anon" })).toBe(true);
    expect(await contaDoComprador(admin, { ...base, compradorEmail: "X@x.com", userId: "outra" })).toBe(true);
    expect(await contaDoComprador(admin, { ...base, userId: "final", linhasDoUsuario: [{ abacatepay_billing_id: "qr_plano" }] })).toBe(true);
    expect(await contaDoComprador(admin, { ...base, userId: "bia", linhasDoUsuario: [{ abacatepay_billing_id: "qr_da_bia" }] })).toBe(false);
  });
});

describe("o downsell: plano de 30 dias (pk99)", () => {
  it("grava o kit na conta de QUEM PAGOU, 1 vez (o dia 1 é o da 1ª compra)", async () => {
    const { db, admin } = bancoFalso();
    expect(await liberarPlano30(admin, { userId: "u1", orderId: "qr_pk", agora: AGORA })).toBe("liberado");
    expect(await liberarPlano30(admin, { userId: "u1", orderId: "qr_pk2" })).toBe("ja_tinha");
    expect(db.user_data).toEqual([{ user_id: "u1", key: CHAVE_KIT_CONTA, value: { comprado: true, em: AGORA.toISOString(), pedido: "qr_pk", origem: "downsell_presente" } }]);
    expect(CHAVE_KIT_CONTA).toBe("core-kit-primeiro-mes");
  });
});

describe("o link por e-mail pra quem comprou", () => {
  it("1x por pedido; falhou → solta pro próximo caminho; marca email_enviado_em", async () => {
    const { db, admin } = bancoFalso({ presentes: [presente() as unknown as Linha] });
    const corpos: Array<Record<string, unknown>> = [];
    let ok = false;
    const enviar = async (c: Record<string, unknown>) => { corpos.push(c); return ok; };
    const args = { orderId: "qr_pv", codigo: "K7QM2XPA", para: "ana@x.com", de: "CORE <oi@core>", enviar };
    expect(await mandarLinkPorEmail(admin, args)).toBe("falhou");
    ok = true;
    expect(await mandarLinkPorEmail(admin, args)).toBe("enviado");
    expect(await mandarLinkPorEmail(admin, args)).toBe("ja");
    expect(await mandarLinkPorEmail(admin, { ...args, para: null })).toBe("sem_email");
    expect(corpos).toHaveLength(2);
    expect(corpos[1]).toMatchObject({ to: ["ana@x.com"], reply_to: "contato@coreaplicativo.com.br" });
    expect(String(db.presentes[0].email_enviado_em)).toMatch(/^\d{4}-/);
  });
  it("os e-mails: link + WhatsApp; quem ganhou recebe lojas + 'Entrar sem senha'; Equipe CORE; sem ele/ela", () => {
    const c = htmlPresenteComprador({ codigo: "K7QM2XPA", deNome: "Ana" });
    expect(c).toContain("https://www.coreaplicativo.com.br/presente/K7QM2XPA");
    expect(c).toContain("wa.me/?text=");
    expect(c).toContain("Equipe CORE");
    const g = htmlPresenteRecebido({ email: "bia@x.com", deNome: "Ana" });
    expect(g).toContain("Ana te deu o CORE pra sempre");
    expect(g).toContain("App Store");
    expect(g).toContain("Google Play");
    expect(g).toContain("Entrar sem senha");
    expect(g).toContain("Equipe CORE");
    expect(REPLY_TO_PRESENTE).toBe("contato@coreaplicativo.com.br");
    expect(corpoResend("a", "b", "c", "d")).toMatchObject({ reply_to: "contato@coreaplicativo.com.br" });
    const ELE_ELA = /\b(ela|ele|dela|dele)\b/i;
    expect(c.replace(/<[^>]+>/g, " ")).not.toMatch(ELE_ELA);
    expect(g.replace(/<[^>]+>/g, " ")).not.toMatch(ELE_ELA);
  });
});

describe("as 3 funções que confirmam o Pix", () => {
  it("preços: pv149 = 1490 e pk99 = 990, iguais aos do site; nenhum dos dois concede acesso a quem pagou", () => {
    expect(PRECOS_PRESENTE).toEqual({ pv149: 1490 });
    expect(PRECOS_PLANO30).toEqual({ pk99: 990 });
    expect(Math.round(VALOR_PRESENTE * 100)).toBe(1490);
    expect(Math.round(VALOR_PLANO30 * 100)).toBe(990);
    expect(CONCESSAO_HOJE).not.toHaveProperty("pv149");
    expect(CONCESSAO_HOJE).not.toHaveProperty("pk99");
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
      const s = fonte(f);
      expect(s, f).toMatch(/\.\.\.PRECOS_PRESENTE, \.\.\.PRECOS_PLANO30 \}/);
      expect(s, f).not.toMatch(/CONCESSAO[^\n]*PRESENTE/);
      expect(s, f).toContain("garantirPresente(");
      expect(s, f).toContain("liberarPlano30(");
      expect(s, f).toContain("chaveCapiPresente(");
      expect(s, f).toContain("chaveCapiPlano30(");
    }
    expect(chaveCapiPresente("x")).toBe("presente-capi:x");
    expect(chaveCapiPlano30("x")).toBe("plano30-capi:x");
  });
  it("asaas-pix: o presente só pra quem já é pra sempre (no create) e o check devolve o código", () => {
    const s = fonte("asaas-pix/index.ts");
    expect(s).toMatch(/if \(ehOfertaPresente\(offer\)\) \{\n\s+let praSempre = temPraSempre/);
    expect(s).toContain('"O presente é pra quem já tem o CORE pra sempre."');
    expect(s).toContain("return jsonResponse({ paid: true, status: \"PAID\", presente: true, codigo: presente.codigo });");
    // o branch do presente vem ANTES do crédito (creditarPedido) — quem pagou não ganha linha
    expect(s.indexOf("if (ehOfertaPresente(offer)) {\n        const presente")).toBeLessThan(s.indexOf("const g = await creditarPedido(supabaseAdmin"));
    expect(s.indexOf("if (ehOfertaPlano30(offer)) {")).toBeLessThan(s.indexOf("const g = await creditarPedido(supabaseAdmin"));
  });
  it("webhook: Purchase com IP/UA do pedido (aba fechada), antes do 'oferta desconhecida'", () => {
    const s = fonte("asaas-webhook/index.ts");
    const i = s.indexOf("if (ehOfertaPresente(offer) && valorCobre");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(s.indexOf("Oferta desconhecida — não credita"));
    expect(s.slice(i, i + 2400)).toContain("ip: regData.client_ip ?? null, ua: regData.user_agent ?? null");
  });
  it("nome do produto e UTMify", () => {
    expect(nomeDoProduto({ offer: "pv149" })).toBe("CORE de presente");
    expect(nomeDoProduto({ offer: "pk99" })).toBe("Plano de 30 dias");
    expect(planoUtmify("pv149")).toBe("presente");
    expect(planoUtmify("pk99")).toBe("plano30");
    expect(nomeDoProduto({ offer: "w27" })).toBe("CORE Vitalício");
  });
});

describe("presente-resgatar, config e migração", () => {
  it("as 5 ações; o `ver` sem login; nunca liberar_vitalicio", () => {
    const s = fonte("presente-resgatar/index.ts");
    for (const a of ["ver", "meu", "nome", "email", "resgatar"]) expect(s).toContain(`acao === "${a}"`);
    expect(s.indexOf('acao === "ver"')).toBeLessThan(s.indexOf("anon.auth.getUser(token)"));
    expect(s).not.toContain("liberar_vitalicio(");
    expect(s).toContain("resgatarPresente(admin");
    const cfg = readFileSync(resolve(raiz, "supabase/config.toml"), "utf8");
    expect(cfg).toMatch(/\[functions\.presente-resgatar\]\nverify_jwt = false/);
  });
  it("migração: tabela presentes com RLS ligada e SEM policy (só service_role); código no formato; pedido único", () => {
    const sql = readFileSync(resolve(raiz, "supabase/migrations/20261021120000_presentes.sql"), "utf8");
    expect(sql).toContain("NÃO APLICADA");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toContain("REVOKE ALL ON TABLE public.presentes FROM anon, authenticated");
    expect(sql).toContain("pedido text NOT NULL UNIQUE");
    expect(sql).toContain(`'^[${ALFABETO_PRESENTE}]{8}$'`);
  });
});
