/**
 * O FUNIL DO APP NA WEB (/assinatura, 16/10) — o lado do servidor da escada:
 *   · `a69` (o presente anual de R$ 69,90) em TODAS as funções que conhecem ofertas da Asaas: preço 6990 e 365 dias
 *     (não vitalício) no asaas-pix, no asaas-webhook e no pix-reconcile; nome "CORE Anual"; e-mail da venda (anual);
 *   · o mensal do Pix é a `w25` que já existia (2490, 30 dias, "monthly_prepaid") — agora com o e-mail da venda que diz
 *     "sem renovação automática" (o antigo dizia "acesso vitalício" e "a senha que você criou");
 *   · 1 pedido = 1 crédito também pro a69 (365 dias, 1 linha, 1 e-mail) e pro w25 (30 dias);
 *   · oferta desconhecida NUNCA vira vitalício (check, webhook e reconcile); o valor pago confere com o preço DA oferta;
 *   · a venda-capi aceita 69,90 e a página /assinatura como origem.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditarPedido } from "../../supabase/functions/_shared/grant-pix";
import { valorCobre } from "../../supabase/functions/_shared/trava-grant";
import {
  assuntoVenda, ehAnualDaVenda, htmlVenda, nomeDoProduto, periodoDoEmailVenda, planoUtmify,
} from "../../supabase/functions/_shared/email-venda";
import { validarPedido } from "../../supabase/functions/_shared/venda-capi";
import { OFERTAS } from "@/pages/funis/app-web/conteudo";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

/* banco falso mínimo (subscriptions + webhook_events), com a vez cedida a cada operação (corrida de verdade) */
function bancoFalso() {
  const db = { subscriptions: [] as Array<Record<string, unknown>>, webhook_events: new Map<string, string>() };
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
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { db, admin: { from } };
}
const AGORA = new Date("2026-10-16T12:00:00Z");
const creditar = (admin: { from: (t: string) => unknown }, orderId: string, dias: number, periodo: string, centavos: number) =>
  creditarPedido(admin as never, {
    userId: "u1", orderId, gateway: "asaas", concessao: { dias }, agora: AGORA,
    montarPayload: (fim) => ({ user_id: "u1", status: "active", plan: dias === 30 ? "web" : "core-pro", billing_period: periodo, payment_method: "pix", abacatepay_billing_id: orderId, current_period_end: fim, amount_cents: centavos }),
  });
const emails = (rs: Array<{ r: string; jaLiberado?: boolean }>) => rs.filter((x) => x.r === "creditado" && !x.jaLiberado).length;

describe("a69: o presente anual de R$ 69,90 nas 3 funções da Asaas", () => {
  it("asaas-pix e asaas-webhook: 6990 e concessão anual de 365 dias (a97 e w25 iguais)", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts"]) {
      const s = fonte(f);
      expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\ba69: 6990\b/);
      expect(s).toMatch(/a69: \{ plano: "core-pro", periodo: "annual", dias: 365 \}/);
      expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\ba97: 9790\b/);
      expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\bw25: 2490\b/);
      expect(s).toMatch(/w25: \{ plano: "web", periodo: "monthly_prepaid", dias: 30 \}/);
    }
    expect(fonte("asaas-pix/index.ts")).toMatch(/a69: "CORE anual"/);
  });
  it("pix-reconcile: 6990, 365 dias e grava anual", () => {
    const s = fonte("pix-reconcile/index.ts");
    expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\ba69: 6990\b/);
    expect(s).toMatch(/\ba69: 365\b/);
    expect(s).toMatch(/a69: \{ plano: "core-pro", periodo: "annual" \}/);
  });
  it("o preço da página bate com o do servidor (69,90 ↔ 6990; 97,90 ↔ 9790; 24,90 ↔ 2490)", () => {
    const s = fonte("asaas-pix/index.ts");
    for (const o of Object.values(OFERTAS)) expect(s).toMatch(new RegExp(`PRECOS_CENTAVOS[^\\n]*\\b${o.oferta}: ${Math.round(o.valor * 100)}\\b`));
  });
});

describe("1 pedido = 1 crédito: a69 e w25", () => {
  it("a69 creditado pelos 3 caminhos ao mesmo tempo: 1 linha, 365 dias, 1 e-mail", async () => {
    const { db, admin } = bancoFalso();
    const rs = await Promise.all([1, 2, 3].map(() => creditar(admin, "qr_a69", 365, "annual", 6990)));
    const r4 = await creditar(admin, "qr_a69", 365, "annual", 6990);
    expect(db.subscriptions).toHaveLength(1);
    expect(String(db.subscriptions[0].current_period_end).slice(0, 10)).toBe("2027-10-16");
    expect(db.subscriptions[0]).toMatchObject({ billing_period: "annual", amount_cents: 6990 });
    expect(emails([...rs, r4])).toBe(1);
    expect(r4.r).toBe("ja_creditado");
  });
  it("w25 (o mensal do Pix): 30 dias, uma vez só", async () => {
    const { db, admin } = bancoFalso();
    const rs = await Promise.all([creditar(admin, "qr_w25", 30, "monthly_prepaid", 2490), creditar(admin, "qr_w25", 30, "monthly_prepaid", 2490)]);
    expect(db.subscriptions).toHaveLength(1);
    expect(String(db.subscriptions[0].current_period_end).slice(0, 10)).toBe("2026-11-15");
    expect(emails(rs)).toBe(1);
  });
});

describe("valor e oferta desconhecida", () => {
  it("o pagamento cobre o preço DA oferta: 69,90 cobre o a69, não cobre o a97", () => {
    expect(valorCobre(69.9, 6990)).toBe(true);
    expect(valorCobre(69.89, 6990)).toBe(false);
    expect(valorCobre(69.9, 9790)).toBe(false);
    expect(valorCobre(24.9, 2490)).toBe(true);
  });
  it("oferta desconhecida nunca vira vitalício: check, webhook e reconcile recusam em vez de cair em 'lifetime'", () => {
    const pix = fonte("asaas-pix/index.ts");
    expect(pix).not.toContain('declarado in PRECOS_CENTAVOS ? declarado : "lifetime"');
    expect(pix).not.toContain("CONCESSAO[offer] ?? CONCESSAO.lifetime");
    expect(pix).toContain('status: "OFERTA_DESCONHECIDA"');
    const wh = fonte("asaas-webhook/index.ts");
    expect(wh).not.toContain('if (!(offer in PRECOS_CENTAVOS)) offer = "lifetime";');
    expect(wh).not.toContain("CONCESSAO[offer] ?? CONCESSAO.lifetime");
    expect(wh).toContain('warning: "oferta_desconhecida"');
    const rc = fonte("pix-reconcile/index.ts");
    expect(rc).not.toMatch(/ofertaCrua === "downsell" \? "downsell" : "lifetime"/);
    expect(rc).toContain("if (!(ofertaCrua in DIAS_DA_OFERTA)) { ofertasDesconhecidas++; continue; }");
  });
});

describe("e-mail, nome do produto e UTMify por oferta", () => {
  it("a97/a69 → anual; w25 → mês pré-pago; o resto → o e-mail antigo", () => {
    expect(periodoDoEmailVenda("a97")).toBe("annual");
    expect(periodoDoEmailVenda("a69")).toBe("annual");
    expect(periodoDoEmailVenda("w25")).toBe("monthly_prepaid");
    expect(periodoDoEmailVenda("lifetime")).toBeNull();
    expect(periodoDoEmailVenda("w97")).toBeNull();
    expect(ehAnualDaVenda("a69")).toBe(true);
    expect(nomeDoProduto({ offer: "a69" })).toBe("CORE Anual");
    expect(nomeDoProduto({ offer: "w25" })).toBe("CORE 1 mês");
    expect(nomeDoProduto({ offer: "w97" })).toBe("CORE Vitalício");
    expect(planoUtmify("a69")).toBe("annual");
    expect(planoUtmify("w25")).toBe("monthly_prepaid");
    expect(planoUtmify("lifetime")).toBe("lifetime");
  });
  it("o e-mail do a69 é o anual da venda ('acesso até', sem 'vitalício' nem senha)", () => {
    const h = htmlVenda({ email: "ana@exemplo.com", nome: "Ana", periodo: periodoDoEmailVenda("a69")!, fim: "2027-10-16T15:00:00Z" });
    expect(h).toContain("plano anual</b> está ativo — acesso até <b>16/10/2027</b>");
    expect(h).not.toMatch(/vital[ií]cio/i);
    expect(h).not.toMatch(/senha que você criou/i);
    expect(assuntoVenda("annual")).toBe("Seu plano anual do CORE tá ativo ✅");
  });
  it("o e-mail do mês (w25) diz 30 dias e SEM renovação automática; nunca 'vitalício', 'renova' no cartão nem 'sem cartão'", () => {
    const h = htmlVenda({ email: "ana@exemplo.com", nome: "Ana", periodo: "monthly_prepaid", fim: "2026-11-15T15:00:00Z" });
    expect(h).toContain("30 dias de CORE</b> estão ativos — acesso até <b>15/11/2026</b>");
    expect(h).toContain("Sem renovação automática: pra continuar, é só pagar de novo.");
    expect(h).not.toMatch(/vital[ií]cio/i);
    expect(h).not.toMatch(/Renova todo mês/i);
    expect(h).not.toMatch(/sem cart[aã]o/i);
    expect(assuntoVenda("monthly_prepaid")).toBe("Seus 30 dias de CORE tão ativos ✅");
  });
  it("as funções escolhem o e-mail pela oferta (periodoDoEmailVenda), nos 2 caminhos que mandam e-mail", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts"]) {
      const s = fonte(f);
      expect(s).toContain("const periodoVenda = periodoDoEmailVenda(offer);");
      expect(s).toContain("htmlVenda({ email");
      expect(s).toContain("planName: planoUtmify(args.offer)");
    }
    expect(fonte("pix-reconcile/index.ts")).toContain('content_name: nomeDoProduto({ offer: o.offer, downsell: o.offer === "downsell" })');
  });
});

describe("venda-capi: o presente e a página nova", () => {
  it("InitiateCheckout de 69,90 com o conteúdo do presente; /assinatura é origem válida", () => {
    const p = validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_1b2c3d4e-aaaa", valor: 69.9, conteudo: "core_anual69_web", url: "https://www.coreaplicativo.com.br/assinatura?utm_source=meta" });
    expect(p).toMatchObject({ valor: 69.9, conteudo: "core_anual69_web", url: "https://www.coreaplicativo.com.br/assinatura?utm_source=meta" });
    expect(validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_1b2c3d4e-aaaa", valor: 24.9, conteudo: "core_mensal_pix_web" })).toMatchObject({ conteudo: "core_mensal_pix_web" });
    // o /assinar segue igual; endereço de fora vira a /assinar
    expect(validarPedido({ evento: "ViewContent", event_id: "venda_vc_1b2c3d4e", url: "https://coreaplicativo.com.br/assinar?x=1" })).toMatchObject({ url: "https://coreaplicativo.com.br/assinar?x=1" });
    expect(validarPedido({ evento: "ViewContent", event_id: "venda_vc_1b2c3d4e", url: "https://coreaplicativo.com.br/assinaturaX" })).toMatchObject({ url: "https://coreaplicativo.com.br/assinar" });
  });
});
