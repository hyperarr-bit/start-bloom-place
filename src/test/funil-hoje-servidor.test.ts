/**
 * O FUNIL WEB NOVO (/hoje, 18/10) — o lado do servidor:
 *   · as ofertas (h279, h149, h279k, h149k, hv47, hv27, hc199) saem de UMA fonte (_shared/ofertas-hoje.ts) e entram
 *     nas 3 funções que creditam Pix da Asaas (asaas-pix check, asaas-webhook, pix-reconcile);
 *   · 1 pedido = 1 crédito também nelas; o upsell vitalício (hv47/hv27) ganha LINHA PRÓPRIA — o plano comprado antes
 *     fica intacto (valor e pedido) e um webhook atrasado do plano não credita de novo;
 *   · o "vida a dois" (hc199) não credita quem pagou; a ação `parceiro` libera a outra conta (travas no fonte);
 *   · boas-vindas 1x por pedido (reserva em webhook_events), com as lojas e "entre com este e-mail";
 *   · a venda-capi aceita os valores e a página do /hoje; o pix-vincular move TODAS as linhas de Pix.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditarPedido } from "../../supabase/functions/_shared/grant-pix";
import { reservarBoasVindas, soltarBoasVindas } from "../../supabase/functions/_shared/boas-vindas-hoje";
import {
  CONCESSAO_HOJE, DESCRICAO_HOJE, OFERTAS_PLANO_HOJE, PRECOS_HOJE, ehOfertaCasal, ehPlanoHoje, ehUpsellHoje, temKit,
} from "../../supabase/functions/_shared/ofertas-hoje";
import {
  assuntoParceiro, assuntoVenda, ehOfertaHoje, htmlParceiro, htmlVenda, nomeDoProduto, periodoDoEmailVenda, planoUtmify,
} from "../../supabase/functions/_shared/email-venda";
import { validarPedido } from "../../supabase/functions/_shared/venda-capi";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

/* banco falso mínimo (subscriptions + webhook_events), cedendo a vez a cada operação (corrida de verdade) */
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
const AGORA = new Date("2026-10-18T12:00:00Z");
/** o mesmo payload que o check/webhook montam, com a concessão da oferta (ofertas-hoje) */
const creditar = (admin: { from: (t: string) => unknown }, orderId: string, oferta: keyof typeof PRECOS_HOJE, agora = AGORA) => {
  const c = CONCESSAO_HOJE[oferta];
  const vitalicio = c.dias === null;
  return creditarPedido(admin as never, {
    userId: "u1", orderId, gateway: "asaas", concessao: c, agora, linhaNova: c.linhaNova === true,
    montarPayload: (fim) => ({
      user_id: "u1", status: "active", plan: vitalicio ? "lifetime" : c.plano, billing_period: vitalicio ? "lifetime" : c.periodo,
      payment_method: "pix", abacatepay_billing_id: orderId, current_period_end: fim, amount_cents: PRECOS_HOJE[oferta],
    }),
  });
};

describe("as ofertas do /hoje nas 3 funções (uma fonte só)", () => {
  it("asaas-pix, asaas-webhook e pix-reconcile espalham PRECOS_HOJE e CONCESSAO_HOJE", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
      const s = fonte(f);
      expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\.\.\.PRECOS_HOJE/);
      expect(s).toContain("CONCESSAO_HOJE");
      expect(s).toContain('from "../_shared/ofertas-hoje.ts"');
    }
    expect(fonte("asaas-pix/index.ts")).toContain("...DESCRICAO_HOJE");
  });
  it("preços e prazos (decisão do dono): 27,90 1º ano / 14,90 mês, sem renovação; kit +9,90 no mesmo Pix; 47 e 27 vitalício; 19,90 casal", () => {
    expect(PRECOS_HOJE).toEqual({ h279: 2790, h149: 1490, h279k: 3780, h149k: 2480, hv279: 2790, hv47: 4700, hv27: 2700, hc199: 1990, u2027: 1990 }); // 21/10: + o "Seu 2027" (u2027)
    expect(ehPlanoHoje("h279k")).toBe(true);
    expect(ehUpsellHoje("hv27")).toBe(true);
    expect(ehOfertaCasal("hc199")).toBe(true);
    expect(temKit("h149k")).toBe(true);
    expect(temKit("h149")).toBe(false);
  });
  it("o upsell recebe linhaNova nos 3 caminhos; o casal não cai na tabela de quem pagou", () => {
    expect(fonte("asaas-pix/index.ts")).toContain("linhaNova: concessao.linhaNova === true");
    expect(fonte("asaas-webhook/index.ts")).toContain("linhaNova: concessao.linhaNova === true");
    expect(fonte("pix-reconcile/index.ts")).toContain("linhaNova,");
    expect(fonte("pix-reconcile/index.ts")).toContain("if (ehOfertaCasal(ofertaCrua)) continue;");
    expect(fonte("asaas-webhook/index.ts")).toContain("if (ehOfertaCasal(offer) && valorCobre(pago.value, PRECOS_CENTAVOS[offer]))");
  });
});

describe("1 pedido = 1 crédito e a linha própria do upsell", () => {
  it("h279 pelos 3 caminhos ao mesmo tempo: 1 linha, 365 dias", async () => {
    const { db, admin } = bancoFalso();
    await Promise.all([1, 2, 3].map(() => creditar(admin, "qr_plano", "h279")));
    expect(db.subscriptions).toHaveLength(1);
    expect(String(db.subscriptions[0].current_period_end).slice(0, 10)).toBe("2027-10-18");
    expect(db.subscriptions[0]).toMatchObject({ billing_period: "annual", amount_cents: 2790 });
  });
  it("h149k (mês + kit): 30 dias, R$ 24,80", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_mes", "h149k");
    expect(String(db.subscriptions[0].current_period_end).slice(0, 10)).toBe("2026-11-17");
    expect(db.subscriptions[0]).toMatchObject({ billing_period: "monthly_prepaid", amount_cents: 2480 });
  });
  it("plano + upsell vitalício: 2 linhas — a do plano intacta (2790, o pedido dele), a do upsell vitalícia (4700)", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_plano", "h279");
    const r = await creditar(admin, "qr_up", "hv47");
    expect(r).toMatchObject({ r: "creditado", acao: "inserir" });
    expect(db.subscriptions).toHaveLength(2);
    expect(db.subscriptions[0]).toMatchObject({ abacatepay_billing_id: "qr_plano", amount_cents: 2790, billing_period: "annual" });
    expect(db.subscriptions[1]).toMatchObject({ abacatepay_billing_id: "qr_up", amount_cents: 4700, billing_period: "lifetime", plan: "lifetime" });
    expect(new Date(String(db.subscriptions[1].current_period_end)).getUTCFullYear()).toBe(2126);
  });
  it("webhook ATRASADO do plano depois do upsell: não credita de novo (nem empilha, nem reescreve)", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_plano", "h279");
    await creditar(admin, "qr_up", "hv27");
    const tarde = await creditar(admin, "qr_plano", "h279");
    expect(["preservado", "ja_creditado"]).toContain(tarde.r);
    expect(db.subscriptions).toHaveLength(2);
    expect(db.subscriptions[0]).toMatchObject({ abacatepay_billing_id: "qr_plano", amount_cents: 2790 });
  });
  it("hv27 (o pra sempre por 27): o MESMO vitalício do hv47, R$ 27", async () => {
    const { db, admin } = bancoFalso();
    await creditar(admin, "qr_plano", "h149");
    await creditar(admin, "qr_27", "hv27");
    expect(db.subscriptions[1]).toMatchObject({ billing_period: "lifetime", amount_cents: 2700 });
  });
});

describe("boas-vindas 1x por pedido", () => {
  it("dois caminhos juntos: só um reserva; soltar libera de novo", async () => {
    const { admin } = bancoFalso();
    const rs = await Promise.all([reservarBoasVindas(admin, "qr_1"), reservarBoasVindas(admin, "qr_1")]);
    expect(rs.filter(Boolean)).toHaveLength(1);
    await soltarBoasVindas(admin, "qr_1");
    expect(await reservarBoasVindas(admin, "qr_1")).toBe(true);
    expect(await reservarBoasVindas(admin, "")).toBe(false);
  });
  it("o check e o webhook mandam a do /hoje só com a reserva; upsell não manda e-mail próprio; a ação boas_vindas existe", () => {
    const pix = fonte("asaas-pix/index.ts");
    const wh = fonte("asaas-webhook/index.ts");
    for (const s of [pix, wh]) {
      expect(s).toMatch(/reservarBoasVindas\((supabaseAdmin|admin), (id|qrCodeId)\)/);
      expect(s).toContain("ehUpsellHoje(offer)");
    }
    expect(pix).toContain('action === "boas_vindas"');
    expect(pix).toContain('.eq("user_id", user.id).eq("abacatepay_billing_id", id)');
  });
  it("a ação parceiro: pedido DESTA conta, pago com o valor certo, 1 conta por pedido, nunca a própria", () => {
    const pix = fonte("asaas-pix/index.ts");
    expect(pix).toContain('action === "parceiro"');
    expect(pix).toContain("if (!dono || dono !== user.id || !ehOfertaCasal(offer))");
    expect(pix).toContain("if (!r.ok || !r.pago)");
    expect(pix).toContain("chaveParceiro(id)");
    expect(pix).toContain("email_confirm: true");
    expect(pix).toContain("parceiroId === user.id");
  });
});

describe("e-mail, nome do produto e UTMify", () => {
  it("período do e-mail: 1º ano (com ou sem kit) = anual; mês = mês pré-pago; upsell = nenhum", () => {
    expect(periodoDoEmailVenda("h279")).toBe("annual");
    expect(periodoDoEmailVenda("h279k")).toBe("annual");
    expect(periodoDoEmailVenda("h149")).toBe("monthly_prepaid");
    expect(periodoDoEmailVenda("h149k")).toBe("monthly_prepaid");
    expect(periodoDoEmailVenda("hv47")).toBeNull();
    expect(planoUtmify("hc199")).toBe("casal");
    expect(planoUtmify("hv27")).toBe("lifetime");
  });
  it("nomes: kit, pra sempre, a dois", () => {
    expect(nomeDoProduto({ offer: "h279" })).toBe("CORE Anual");
    expect(nomeDoProduto({ offer: "h279k" })).toBe("CORE Anual + Kit");
    expect(nomeDoProduto({ offer: "h149k" })).toBe("CORE 1 mês + Kit");
    expect(nomeDoProduto({ offer: "hv47" })).toBe("CORE pra sempre");
    expect(nomeDoProduto({ offer: "hv27" })).toBe("CORE pra sempre");
    expect(nomeDoProduto({ offer: "hc199" })).toBe("CORE a dois");
    // os antigos não mudam
    expect(nomeDoProduto({ offer: "a97" })).toBe("CORE Anual");
    expect(nomeDoProduto({ offer: "lifetime" })).toBe("CORE Vitalício");
  });
  it("boas-vindas do /hoje: lojas (App Store + Google Play) + 'entre com este e-mail' + nada cobrado sozinho", () => {
    const h = htmlVenda({ email: "mari@exemplo.com", periodo: "annual", fim: "2027-10-18T15:00:00Z", hoje: true });
    expect(h).toContain("Seu CORE também no celular");
    expect(h).toContain("https://apps.apple.com/br/app/id6806913181");
    expect(h).toContain("play.google.com/store/apps/details?id=br.com.coreaplicativo.app");
    expect(h).toContain("entre com este e-mail: <b style=\"color:#16121c;\">mari@exemplo.com</b>");
    expect(h).toContain("Nada é cobrado sozinho");
    expect(h).toContain("18/10/2027");
    expect(h).not.toMatch(/vital[ií]cio|senha que voc[eê] criou/i);
    // o /assinar não muda
    expect(htmlVenda({ email: "a@b.com", periodo: "annual" })).not.toContain("Seu CORE também no celular");
  });
  it("com o upsell: 'pra sempre'", () => {
    expect(assuntoVenda("lifetime")).toBe("Seu CORE pra sempre tá ativo ✅");
    expect(htmlVenda({ email: "a@b.com", periodo: "lifetime", hoje: true })).toContain("pra sempre");
  });
  it("e-mail de quem ganhou a 2ª conta: lojas + código, sem senha, sem cobrança", () => {
    const h = htmlParceiro({ email: "rafa@exemplo.com", fim: "2027-10-18T15:00:00Z" });
    expect(assuntoParceiro()).toContain("CORE");
    expect(h).toContain("rafa@exemplo.com");
    expect(h).toContain("apps.apple.com");
    expect(h).toContain("Entrar sem senha");
    expect(h).toContain("Nada é cobrado de você");
  });
});

describe("venda-capi e pix-vincular", () => {
  it("InitiateCheckout do /hoje: 27,90 / 14,90 / 37,80 / 24,80 com a página /hoje", () => {
    for (const valor of [27.9, 14.9, 37.8, 24.8]) {
      const p = validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_12345678-aaaa", url: "https://coreaplicativo.com.br/hoje?utm_source=meta", valor, conteudo: "core_anual_hoje" });
      expect(p).toMatchObject({ valor, url: "https://coreaplicativo.com.br/hoje?utm_source=meta", conteudo: "core_anual_hoje" });
    }
    expect(validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_12345678-aaaa", url: "x", valor: 9.9 })).toBeNull();
  });
  it("pix-vincular move TODAS as linhas de Pix da sessão anônima (plano + upsell)", () => {
    const s = fonte("pix-vincular/index.ts");
    expect(s).toContain('.in("id", todasDe.map((l) => l.id))');
    expect(s).not.toContain(".limit(1).maybeSingle();\n    if (!subDe");
  });
});

/* ───────── o e-mail OPCIONAL da tela do Pix (destino) ───────── */
import { encaminharParaDestino, lerDestino, salvarDestino } from "../../supabase/functions/_shared/destino-hoje";

/** banco falso com webhook_events (insert/update/select), subscriptions (select/update/insert) e auth.admin */
function bancoComAuth(usuarios: Array<{ id: string; email: string | null }>) {
  const { db, admin } = bancoFalso();
  const eventos = new Map<string, string>();
  const analytics: unknown[] = [];
  const from = (tabela: string) => {
    if (tabela === "analytics_events") return { insert: (d: unknown) => { analytics.push(d); return Promise.resolve({ error: null }); } };
    if (tabela !== "webhook_events" || !destinoLigado) return admin.from(tabela);
    const filtros: Array<[string, unknown]> = [];
    let op: { tipo: string; dados?: Record<string, unknown> } = { tipo: "select" };
    const q: Record<string, unknown> = {
      select: () => { op = { tipo: "select" }; return q; },
      insert: (d: Record<string, unknown>) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Record<string, unknown>) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push([k, v]); return q; },
      then: (ok: (v: unknown) => unknown) => {
        const id = String(op.dados?.id ?? filtros.find(([k]) => k === "id")?.[1] ?? "");
        if (op.tipo === "insert") { if (eventos.has(id)) return Promise.resolve({ error: { code: "23505" } }).then(ok); eventos.set(id, String(op.dados?.event ?? "")); return Promise.resolve({ error: null }).then(ok); }
        if (op.tipo === "update") { eventos.set(id, String(op.dados?.event ?? "")); return Promise.resolve({ error: null }).then(ok); }
        if (op.tipo === "delete") { eventos.delete(id); return Promise.resolve({ error: null }).then(ok); }
        return Promise.resolve({ data: eventos.has(id) ? [{ id, event: eventos.get(id) }] : [], error: null }).then(ok);
      },
    };
    return q;
  };
  const destinoLigado = true;
  const auth = { admin: {
    getUserById: async (id: string) => ({ data: { user: usuarios.find((u) => u.id === id) ?? null } }),
    listUsers: async () => ({ data: { users: usuarios }, error: null }),
  } };
  return { db, eventos, analytics, admin: { from, auth } };
}

describe("e-mail opcional da tela do Pix: pagou e fechou a aba → a compra vai pra conta do e-mail", () => {
  it("destino salvo + e-mail que já tem conta: no crédito, as linhas da anônima vão pra essa conta e o acesso sai por e-mail (1x)", async () => {
    const b = bancoComAuth([{ id: "anon", email: null }, { id: "conta-ana", email: "ana@exemplo.com" }]);
    expect(await salvarDestino(b.admin as never, "anon", " Ana@Exemplo.com ")).toBe(true);
    expect(await lerDestino(b.admin as never, "anon")).toBe("ana@exemplo.com");
    // o plano é creditado na anônima (sem e-mail, ela nunca abriu o pós-compra)
    b.db.subscriptions.push({ id: "l1", user_id: "anon", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_plano", billing_period: "annual", plan: "core-pro", current_period_end: "2027-10-18T12:00:00Z", amount_cents: 2790 });
    const enviados: Array<{ para: string; html: string }> = [];
    const enviar = async (para: string, _a: string, html: string) => { enviados.push({ para, html }); return true; };
    const r = await encaminharParaDestino(b.admin as never, { uidAnonimo: "anon", orderId: "qr_plano", offer: "h279", enviar });
    expect(r).toMatchObject({ r: "movido", para: "conta-ana", linhas: 1, email: true });
    expect(b.db.subscriptions[0]).toMatchObject({ user_id: "conta-ana", customer_email: "ana@exemplo.com", amount_cents: 2790 });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe("ana@exemplo.com");
    expect(enviados[0].html).toContain("Seu CORE também no celular");
    // o webhook atrasado do MESMO pedido não credita de novo na anônima (a linha está em outra conta)
    const tarde = await creditar(b.admin as never, "qr_plano", "h279");
    expect(tarde.r).toBe("ja_creditado");
    expect(b.db.subscriptions).toHaveLength(1);
    // um 2º caminho encaminhando o mesmo pedido não manda 2º e-mail
    b.db.subscriptions.push({ id: "l2", user_id: "anon", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_up", billing_period: "lifetime", plan: "lifetime", current_period_end: "2126-10-18T12:00:00Z", amount_cents: 2700 });
    const up = await encaminharParaDestino(b.admin as never, { uidAnonimo: "anon", orderId: "qr_up", offer: "hv27", enviar });
    expect(up).toMatchObject({ r: "movido", email: false }); // upsell vai junto, sem e-mail próprio
    expect(b.db.subscriptions.every((l) => l.user_id === "conta-ana")).toBe(true);
    await encaminharParaDestino(b.admin as never, { uidAnonimo: "anon", orderId: "qr_plano", offer: "h279", enviar });
    expect(enviados).toHaveLength(1);
  });
  it("sem destino, ou a anônima já ganhou o e-mail dela (caminho normal), ou o e-mail não tem conta: nada se move", async () => {
    const enviar = async () => true;
    const b1 = bancoComAuth([{ id: "anon", email: null }]);
    expect((await encaminharParaDestino(b1.admin as never, { uidAnonimo: "anon", orderId: "q", offer: "h279", enviar })).r).toBe("sem_destino");
    const b2 = bancoComAuth([{ id: "anon", email: "mari@exemplo.com" }, { id: "x", email: "ana@exemplo.com" }]);
    await salvarDestino(b2.admin as never, "anon", "ana@exemplo.com");
    expect((await encaminharParaDestino(b2.admin as never, { uidAnonimo: "anon", orderId: "q", offer: "h279", enviar })).r).toBe("anonima_tem_email");
    const b3 = bancoComAuth([{ id: "anon", email: null }]);
    await salvarDestino(b3.admin as never, "anon", "ninguem@exemplo.com");
    expect((await encaminharParaDestino(b3.admin as never, { uidAnonimo: "anon", orderId: "q", offer: "h279", enviar })).r).toBe("sem_conta");
    expect(await salvarDestino(b3.admin as never, "anon", "nao-e-email")).toBe(false);
  });
  it("os 3 caminhos de crédito encaminham; a ação email_pedido existe e encaminha se já foi pago", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) expect(fonte(f)).toContain("encaminharParaDestino(");
    const pix = fonte("asaas-pix/index.ts");
    expect(pix).toContain('action === "email_pedido"');
    expect(pix).toContain("if (user.email) return jsonResponse({ ok: false, motivo: \"conta_tem_email\" });");
  });
});

describe("Purchase do upsell pago com a aba fechada chega na Meta (19/10)", () => {
  it("o create guarda IP + user-agent do comprador no pix_order_created (juntos)", () => {
    const s = fonte("asaas-pix/index.ts");
    expect(s).toMatch(/clientIp && userAgent \? \{ client_ip: clientIp, user_agent: userAgent\.slice\(0, 400\) \}/);
  });
  it("o webhook manda client_ip_address + client_user_agent do registro (sem o UA a Meta descarta evento de site)", () => {
    const s = fonte("asaas-webhook/index.ts");
    expect(s).toMatch(/args\.ip && args\.ua \? \{ client_ip_address: args\.ip, client_user_agent: args\.ua \}/);
    expect(s.match(/ip: regData\.client_ip \?\? null, ua: regData\.user_agent \?\? null/g)?.length).toBe(2);
  });
  it("o pix-reconcile lê os mesmos campos", () => {
    const s = fonte("pix-reconcile/index.ts");
    expect(s).toContain("q.event_data?.client_ip");
    expect(s).toContain("q.event_data?.user_agent");
  });
});

/* ───────── 20/10: o VITALÍCIO R$ 27,90 como PLANO do /hoje (hv279, OFERTA_HOJE = "vitalicio") ───────── */
describe("hv279 — o plano vitalício do /hoje (a mesma oferta do /inicio)", () => {
  it("é PLANO (boas-vindas, destino, CAPI/UTMify como o h279), não upsell nem kit; 2790; vitalício na linha do Pix (sem linhaNova)", () => {
    expect(PRECOS_HOJE.hv279).toBe(2790);
    expect(CONCESSAO_HOJE.hv279).toEqual({ plano: "lifetime", periodo: "lifetime", dias: null });
    expect(DESCRICAO_HOJE.hv279).toBe("CORE vitalicio");
    expect(ehPlanoHoje("hv279")).toBe(true);
    expect(ehOfertaHoje("hv279")).toBe(true); // a ação boas_vindas do asaas-pix aceita
    expect(ehUpsellHoje("hv279")).toBe(false);
    expect(ehOfertaCasal("hv279")).toBe(false);
    expect(temKit("hv279")).toBe(false);
  });
  it("TODO plano do /hoje tem período de e-mail (check/webhook/destino usam `periodoDoEmailVenda(offer)!`)", () => {
    for (const o of OFERTAS_PLANO_HOJE) expect(periodoDoEmailVenda(o)).not.toBeNull();
    expect(periodoDoEmailVenda("hv279")).toBe("lifetime");
    expect(assuntoVenda(periodoDoEmailVenda("hv279")!)).toBe("Seu CORE pra sempre tá ativo ✅");
    const h = htmlVenda({ email: "mari@exemplo.com", periodo: periodoDoEmailVenda("hv279")!, fim: "2126-10-20T12:00:00Z", hoje: true });
    expect(h).toContain("pra sempre");
    expect(h).toContain("Seu CORE também no celular");
    expect(h).toContain("apps.apple.com");
    expect(h).not.toMatch(/plano anual|renova|30 dias/i);
  });
  it("UTMify 'lifetime' e nome 'CORE Vitalício' (o mesmo do w27 do /inicio)", () => {
    expect(planoUtmify("hv279")).toBe("lifetime");
    expect(nomeDoProduto({ offer: "hv279" })).toBe("CORE Vitalício");
    expect(nomeDoProduto({ offer: "w27" })).toBe("CORE Vitalício");
  });
  it("3 caminhos ao mesmo tempo: 1 linha só, vitalícia (+100 anos), R$ 27,90, o pedido dele", async () => {
    const { db, admin } = bancoFalso();
    const rs = await Promise.all([1, 2, 3].map(() => creditar(admin, "qr_vit", "hv279")));
    expect(rs.filter((r) => r.r === "creditado")).toHaveLength(1);
    expect(db.subscriptions).toHaveLength(1);
    expect(db.subscriptions[0]).toMatchObject({ abacatepay_billing_id: "qr_vit", plan: "lifetime", billing_period: "lifetime", amount_cents: 2790 });
    expect(new Date(String(db.subscriptions[0].current_period_end)).getUTCFullYear()).toBe(2126);
    // webhook atrasado do mesmo pedido: nada muda
    const tarde = await creditar(admin, "qr_vit", "hv279");
    expect(["preservado", "ja_creditado"]).toContain(tarde.r);
    expect(db.subscriptions).toHaveLength(1);
  });
  it("as 3 funções conhecem o hv279 pela fonte única (preço, concessão, descrição do Pix) — o reconcile tira os dias de CONCESSAO_HOJE", () => {
    expect(fonte("pix-reconcile/index.ts")).toContain("...Object.fromEntries(Object.entries(CONCESSAO_HOJE).map(([k, c]) => [k, c.dias]))");
    // a derivação do reconcile: dias null = vitalício; fora do mapa de período (que só tem ofertas com prazo)
    const dias = Object.fromEntries(Object.entries(CONCESSAO_HOJE).map(([k, c]) => [k, c.dias]));
    expect("hv279" in dias && dias.hv279 === null).toBe(true);
  });
  it("e-mail da tela do Pix (destino): a compra vitalícia vai pra conta e o e-mail diz 'pra sempre'", async () => {
    const b = bancoComAuth([{ id: "anon", email: null }, { id: "conta-ana", email: "ana@exemplo.com" }]);
    await salvarDestino(b.admin as never, "anon", "ana@exemplo.com");
    b.db.subscriptions.push({ id: "l1", user_id: "anon", status: "active", payment_method: "pix", abacatepay_billing_id: "qr_vit", billing_period: "lifetime", plan: "lifetime", current_period_end: "2126-10-20T12:00:00Z", amount_cents: 2790 });
    const enviados: Array<{ assunto: string; html: string }> = [];
    const r = await encaminharParaDestino(b.admin as never, { uidAnonimo: "anon", orderId: "qr_vit", offer: "hv279", enviar: async (_p, assunto, html) => { enviados.push({ assunto, html }); return true; } });
    expect(r).toMatchObject({ r: "movido", para: "conta-ana", email: true });
    expect(enviados[0].assunto).toBe("Seu CORE pra sempre tá ativo ✅");
    expect(enviados[0].html).toContain("pra sempre");
  });
  it("venda-capi: InitiateCheckout 27,90 com o conteúdo core_vitalicio_hoje", () => {
    const p = validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_12345678-bbbb", url: "https://coreaplicativo.com.br/hoje", valor: 27.9, conteudo: "core_vitalicio_hoje" });
    expect(p).toMatchObject({ valor: 27.9, conteudo: "core_vitalicio_hoje" });
  });
});
