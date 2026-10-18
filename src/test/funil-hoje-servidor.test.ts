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
import { CONCESSAO_HOJE, PRECOS_HOJE, ehOfertaCasal, ehPlanoHoje, ehUpsellHoje, temKit } from "../../supabase/functions/_shared/ofertas-hoje";
import {
  assuntoParceiro, assuntoVenda, htmlParceiro, htmlVenda, nomeDoProduto, periodoDoEmailVenda, planoUtmify,
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
    expect(PRECOS_HOJE).toEqual({ h279: 2790, h149: 1490, h279k: 3780, h149k: 2480, hv47: 4700, hv27: 2700, hc199: 1990 });
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
