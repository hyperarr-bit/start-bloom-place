/**
 * VENDA DA WEB (/assinar, 15/10) — o lado do servidor:
 *   · o anual do Pix (`a97`) é 97,90 e dá 365 dias (NÃO vitalício) nas 3 funções de dinheiro, lido do fonte;
 *   · o cakto-webhook mapeia as ofertas da venda (secrets CAKTO_OFFER_WEB_ANUAL/_MENSAL) pra anual/mensal;
 *   · o e-mail de boas-vindas da venda não diz "vitalício" nem "senha" e ensina o "Entrar sem senha";
 *   · a venda-capi só aceita ViewContent/InitiateCheckout com o event_id do navegador, sem IP;
 *   · o e-mail do "abrir logado" (porta-handoff) tem o passo do código pra conta sem senha.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assuntoVenda, dataBr, htmlVenda, nomeDoProduto } from "../../supabase/functions/_shared/email-venda";
import { montarEventoVenda, validarPedido } from "../../supabase/functions/_shared/venda-capi";
import { htmlPorta } from "../../supabase/functions/_shared/email-porta";
import { decidirGrantPix } from "../../supabase/functions/_shared/linha-pix";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

describe("a97: anual do Pix, 97,90, 1 ano", () => {
  it("asaas-pix e asaas-webhook: 9790 e concessão anual de 365 dias", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts"]) {
      const s = fonte(f);
      expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\ba97: 9790\b/);
      expect(s).toMatch(/a97: \{ plano: "core-pro", periodo: "annual", dias: 365 \}/);
      // a w97 (vitalício) continua igual
      expect(s).toMatch(/w97: \{ plano: "lifetime", periodo: "lifetime", dias: null \}/);
    }
  });

  it("pix-reconcile: 9790, 365 dias e grava anual (não 'monthly_prepaid', não vitalício)", () => {
    const s = fonte("pix-reconcile/index.ts");
    expect(s).toMatch(/PRECOS_CENTAVOS[^\n]*\ba97: 9790\b/);
    expect(s).toMatch(/\ba97: 365\b/);
    expect(s).toMatch(/a97: \{ plano: "core-pro", periodo: "annual" \}/);
  });

  it("o grant de 365 dias empilha sobre o período próprio e nunca rebaixa um vitalício", () => {
    const agora = new Date("2026-10-15T12:00:00Z");
    const novo = decidirGrantPix([], { dias: 365 }, agora);
    expect(novo.acao).toBe("inserir");
    expect((novo as { fim: string }).fim.slice(0, 10)).toBe("2027-10-15");
    const vitalicio = decidirGrantPix([{ id: "l1", status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", current_period_end: "2126-01-01T00:00:00Z" }], { dias: 365 }, agora);
    expect(vitalicio.acao).toBe("preservar");
  });

  it("e-mail e nome do produto: a97 → 'CORE Anual' e o e-mail da venda (sem 'vitalício'); o resto igual", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts"]) {
      const s = fonte(f);
      // 16/10: a escolha do e-mail é por oferta (periodoDoEmailVenda: a97/a69 → anual, w25 → mês pré-pago; o resto, o antigo)
      expect(s).toContain("const periodoVenda = periodoDoEmailVenda(offer);");
      expect(s).toContain("assuntoVenda(periodoVenda)");
      expect(s).toContain('"Seu acesso vitalício ao CORE tá ativo ✅"');
    }
    expect(nomeDoProduto({ offer: "a97" })).toBe("CORE Anual");
    expect(nomeDoProduto({ periodo: "monthly" })).toBe("CORE Mensal");
    expect(nomeDoProduto({ offer: "w97" })).toBe("CORE Vitalício");
    expect(nomeDoProduto({ offer: "downsell", downsell: true })).toBe("CORE Vitalício (oferta)");
  });
});

describe("cakto-webhook: as ofertas do cartão da venda", () => {
  const s = fonte("cakto-webhook/index.ts");
  it("CAKTO_OFFER_WEB_ANUAL → anual (1 ano) e CAKTO_OFFER_WEB_MENSAL → mensal, explícitos (nunca a inferência de vitalício)", () => {
    expect(s).toContain('Deno.env.get("CAKTO_OFFER_WEB_ANUAL")');
    expect(s).toContain('Deno.env.get("CAKTO_OFFER_WEB_MENSAL")');
    expect(s).toMatch(/CAKTO_OFFERS\[WEB_ANUAL_OFFER\.toLowerCase\(\)\] = \{ billing: "annual" \}/);
    expect(s).toMatch(/CAKTO_OFFERS\[WEB_MENSAL_OFFER\.toLowerCase\(\)\] = \{ billing: "monthly" \}/);
  });
  it("e-mail e CAPI da venda: nome do produto pelo período; sinais do clique pelo venda_cakto_redirect", () => {
    expect(s).toContain("htmlVenda({ email, nome: customer.name ?? null");
    expect(s).toContain("content_name: ehVendaWeb ? nomeDoProduto({ periodo: billingPeriod })");
    expect(s).toContain('rows.find((r) => r.event_name === "venda_cakto_redirect")');
  });
});

describe("e-mail de boas-vindas da venda", () => {
  it("anual: 'acesso até', conta sem senha → Entrar sem senha; nunca 'vitalício' nem 'senha que você criou'", () => {
    const h = htmlVenda({ email: "ana@exemplo.com", nome: "Ana Souza", periodo: "annual", fim: "2027-10-15T15:00:00Z" });
    expect(h).toContain("Ana, seu CORE está liberado.");
    expect(h).toContain("plano anual</b> está ativo — acesso até <b>15/10/2027</b>");
    expect(h).toContain("Entrar sem senha — receber código por e-mail");
    expect(h).not.toMatch(/vital[ií]cio/i);
    expect(h).not.toMatch(/senha que você criou/i);
    expect(h).not.toMatch(/sem cart[aã]o/i);
    expect(assuntoVenda("annual")).toBe("Seu plano anual do CORE tá ativo ✅");
  });
  it("mensal: renova no cartão, cancela quando quiser; escapa HTML", () => {
    const h = htmlVenda({ email: "a<b>@x.com", periodo: "monthly" });
    expect(h).toContain("assinatura mensal</b> está ativa");
    expect(h).not.toContain("a<b>@x.com");
    expect(dataBr("2126-01-01T00:00:00Z")).toBeNull();
  });
});

describe("venda-capi", () => {
  it("aceita ViewContent/InitiateCheckout com o prefixo certo; recusa o resto", () => {
    const ok = validarPedido({ evento: "InitiateCheckout", event_id: "venda_ic_1b2c3d4e-aaaa", url: "https://coreaplicativo.com.br/assinar?utm=1", fbp: "fb.1.1700000000000.123456", fbc: "fb.1.1700000000000.IwAR_x", valor: 97.9, conteudo: "core_anual_web" });
    expect(ok).toMatchObject({ evento: "InitiateCheckout", valor: 97.9, conteudo: "core_anual_web" });
    expect(validarPedido({ evento: "Purchase", event_id: "venda_ic_1b2c3d4e" })).toBeNull();
    expect(validarPedido({ evento: "ViewContent", event_id: "venda_ic_1b2c3d4e" })).toBeNull(); // prefixo de outro evento
    expect(validarPedido({ evento: "ViewContent", event_id: "x" })).toBeNull();
    // URL de fora vira a página da venda; fbp malformado cai
    expect(validarPedido({ evento: "ViewContent", event_id: "venda_vc_1b2c3d4e", url: "https://evil.example", fbp: "lixo" })).toMatchObject({ url: "https://coreaplicativo.com.br/assinar", fbp: null });
  });
  it("monta o evento de site com o MESMO event_id, user agent e sem IP", () => {
    const p = validarPedido({ evento: "ViewContent", event_id: "venda_vc_1b2c3d4e-ffff", url: "https://coreaplicativo.com.br/assinar", fbp: "fb.1.1700000000000.123456", conteudo: "venda_web" })!;
    const e = montarEventoVenda(p, "Mozilla/5.0 (iPhone)", 1_760_000_000_000);
    expect(e).toMatchObject({ event_name: "ViewContent", event_id: "venda_vc_1b2c3d4e-ffff", action_source: "website", event_time: 1_760_000_000 });
    const ud = e.user_data as Record<string, unknown>;
    expect(ud.client_user_agent).toBe("Mozilla/5.0 (iPhone)");
    expect(ud.client_ip_address).toBeUndefined();
    expect(ud.fbp).toBe("fb.1.1700000000000.123456");
  });
  it("config.toml: venda-capi sem JWT (sai antes da conta)", () => {
    expect(readFileSync(resolve(__dirname, "../../supabase/config.toml"), "utf8")).toMatch(/\[functions\.venda-capi\]\nverify_jwt = false/);
  });
});

describe("e-mail do 'abrir logado' pra conta sem senha", () => {
  it("metodo 'codigo' → o passo 3 é o Entrar sem senha; os outros não mudam", () => {
    expect(htmlPorta({ email: "a@x.com", metodo: "codigo", codigo: "ABCDEFGHJK" })).toContain("“Entrar sem senha — receber código por e-mail”");
    expect(htmlPorta({ email: "a@x.com", metodo: "senha", codigo: null })).toContain("e a sua senha");
    expect(fonte("porta-handoff/index.ts")).toContain('["senha", "apple", "google", "sessao", "codigo"]');
  });
});
