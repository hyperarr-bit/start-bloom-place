/**
 * INDIQUE E GANHE da web (23/11) — supabase/functions/_shared/indique.ts (regras + banco falso), o ?ref= no pedido do
 * stripe-criar e a captura na página (src/landing/indique.ts).
 *   comissão = 50% do valor pago (R$ 33,95 em R$ 67,90), "a liberar" 7 dias; reembolso/contestação cancela; o reembolso da
 *   compra de QUEM INDICA pausa o link; autoindicação (e-mail, conta, aparelho, CPF, chave Pix) e quem já era cliente não ganham;
 *   1 linha por PaymentIntent; ?ref= vira metadata[indicador] (só /oferta, só letras/números); último clique na página.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  cancelarIndicacaoWeb, comissaoWebCents, compraValeLink, decidirIndicacao, descontarDividas, emailComparavel, gerarCodigo, hashEmail, ipDentroDoLimite, linkIndique,
  registrarIndicacaoWeb, reprocessarIndicacaoWeb, validarPix, valorComDesconto, MOTIVO_DIVIDA, MOTIVO_DIVIDA_DESCONTADA,
  type QuemIndica, type VendaWeb,
} from "../../supabase/functions/_shared/indique";
import { elegivelParaPagar, planejarSemana, resumoPainel } from "../../supabase/functions/_shared/afiliados";
import { metadataDoPedido, validarPedidoStripe } from "../../supabase/functions/_shared/stripe-criar";
import { _zerarIndicador, capturarIndicador, linkWhatsapp } from "@/landing/indique";

type Linha = Record<string, unknown>;
function bancoFalso() {
  const db: Record<string, Linha[]> = { afiliados: [], afiliado_vendas: [], afiliado_pagamentos: [], webhook_events: [], subscriptions: [] };
  let seq = 0;
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update"; dados?: Linha } = { tipo: "select" };
    let unico = false, devolver = false;
    const exec = async () => {
      const tb = db[tabela];
      const casa = (r: Linha) => filtros.every((f) => f(r));
      if (op.tipo === "insert") {
        if (tabela === "afiliado_vendas" && tb.some((r) => r.transaction_id === op.dados!.transaction_id)) return { error: { code: "23505", message: "dup" } };
        tb.push({ id: `l${++seq}`, ...op.dados }); return { error: null };
      }
      if (op.tipo === "update") { const alvo = tb.filter(casa); for (const r of alvo) Object.assign(r, op.dados); return { data: devolver ? alvo.map((r) => ({ id: r.id })) : null, error: null }; }
      const a = tb.filter(casa).map((r) => ({ ...r }));
      return { data: unico ? a[0] ?? null : a, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => { if (op.tipo === "update") devolver = true; return q; },
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => r[k] === v); return q; },
      is: (k: string, v: unknown) => { filtros.push((r) => (r[k] ?? null) === v); return q; },
      neq: (k: string, v: unknown) => { filtros.push((r) => r[k] !== v); return q; },
      in: (k: string, vs: unknown[]) => { filtros.push((r) => vs.includes(r[k])); return q; },
      limit: () => q,
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { db, admin: { from } };
}

const ANA: QuemIndica = { id: "af_ana", pausado: false, email: null, comprador_email: "ana.souza@gmail.com", comprador_user_id: "u_ana", aparelho: "dev_ana_123", pix_chave: null, pix_tipo: null, ip: "200.1.1.1", cartao_fp: "fp_ana" };
const venda = (o: Partial<VendaWeb> = {}): VendaWeb => ({ pi: "pi_bia", valorCents: 6790, email: "bia@exemplo.com", userId: "u_bia", aparelho: "dev_bia_456", cpf: null, jaEraCliente: false, metodo: "pix", cartaoFp: null, ip: "189.9.9.9", ...o });
const AGORA = new Date("2026-11-23T15:00:00Z");

describe("comissão", () => {
  it("50% do valor pago: R$ 67,90 → R$ 33,95; o indicado paga o mesmo (nada muda no preço)", () => {
    expect(comissaoWebCents(6790)).toBe(3395);
    expect(decidirIndicacao(ANA, venda())).toEqual({ status: "pago", motivo: null, comissao_cents: 3395, liberaDias: 10 });
    expect(decidirIndicacao(ANA, venda({ metodo: "card" })).liberaDias).toBe(30); // cartão: contestação chega depois
    expect(decidirIndicacao(ANA, venda({ metodo: null })).liberaDias).toBe(30); // sem saber = o prazo longo
  });
  it("fica a liberar 7 dias e só então entra no Pix da segunda (a régua do programa de 09/10)", () => {
    const v = { status: "pago" as const, cobrado_em: AGORA.toISOString(), pagamento_id: null };
    expect(elegivelParaPagar(v, new Date(AGORA.getTime() + 6.9 * 86400e3))).toBe(false);
    expect(elegivelParaPagar(v, new Date(AGORA.getTime() + 7 * 86400e3))).toBe(true);
    const r = resumoPainel([{ ...v, comissao_cents: 3395, criado_em: AGORA.toISOString() }], [], AGORA);
    expect(r).toMatchObject({ pagaram: 1, a_receber_cents: 3395, ja_recebido_cents: 0 });
    expect(r.linhas[0]).toMatchObject({ situacao: "prevista", pagamento_dia: "2026-12-07" }); // venda seg 12h → libera seg 30/11 12h, depois do Pix das 9h → a segunda seguinte
  });
  it("trava semanal de R$ 500: acima disso a semana fica SEGURADA pro dono", () => {
    const vendas = Array.from({ length: 15 }, (_, i) => ({ id: `v${i}`, afiliado_id: "af_ana", status: "pago" as const, cobrado_em: "2026-11-10T12:00:00Z", pagamento_id: null, comissao_cents: 3395 }));
    const [p] = planejarSemana([{ id: "af_ana", nome: "x", codigo: "ANA7K2", pausado: false, limite_semanal_cents: 50000 }], vendas, AGORA);
    expect(p).toMatchObject({ decisao: "segurar", total_cents: 15 * 3395 });
  });
});

describe("autoindicação e travas", () => {
  it.each([
    ["mesmo e-mail (maiúscula/espaço não engana)", venda({ email: " ANA.SOUZA@gmail.com " }), "autoindicacao_email"],
    ["mesmo e-mail com +apelido e pontos do Gmail", venda({ email: "a.n.a.souza+2@googlemail.com" }), "autoindicacao_email"],
    ["mesma conta", venda({ userId: "u_ana" }), "autoindicacao_conta"],
    ["mesmo cartão (digital da Stripe)", venda({ cartaoFp: "fp_ana", metodo: "card" }), "autoindicacao_cartao"],
    ["já tinha o vitalício (pagou de novo)", venda({ jaEraCliente: true }), "ja_era_cliente"],
  ])("%s → recusada, comissão 0", (_n, v, motivo) => {
    expect(decidirIndicacao(ANA, v)).toMatchObject({ status: "recusado", motivo, comissao_cents: 0 });
  });
  it("mesmo aparelho ou mesmo IP → conta, mas fica pra revisão (pode ser a amiga no celular de quem indicou)", () => {
    expect(decidirIndicacao(ANA, venda({ aparelho: "dev_ana_123" }))).toMatchObject({ status: "pago", motivo: "revisar_aparelho", comissao_cents: 3395 });
    expect(decidirIndicacao(ANA, venda({ ip: "200.1.1.1" }))).toMatchObject({ status: "pago", motivo: "revisar_ip" });
    expect(emailComparavel("Fulana.B+promo@Gmail.com")).toBe("fulanab@gmail.com");
    expect(emailComparavel("fu.la+x@outlook.com")).toBe("fu.la@outlook.com");
  });
  it("mesmo CPF (chave Pix CPF = CPF da compra) e chave Pix e-mail = e-mail da compra", () => {
    expect(decidirIndicacao({ ...ANA, pix_tipo: "CPF", pix_chave: "52998224725" }, venda({ cpf: "529.982.247-25" })).motivo).toBe("autoindicacao_cpf");
    expect(decidirIndicacao({ ...ANA, pix_tipo: "EMAIL", pix_chave: "bia@exemplo.com" }, venda()).motivo).toBe("autoindicacao_pix");
  });
  it("chave Pix: confere e normaliza cada tipo; recusa lixo", () => {
    expect(validarPix("CPF", "529.982.247-25")).toEqual({ tipo: "CPF", chave: "52998224725" });
    expect(validarPix("CPF", "111.111.111-11")).toBeNull();
    expect(validarPix("PHONE", "+55 (11) 98765-4321")).toEqual({ tipo: "PHONE", chave: "11987654321" });
    expect(validarPix("EMAIL", " Ana@Exemplo.com ")).toEqual({ tipo: "EMAIL", chave: "ana@exemplo.com" });
    expect(validarPix("EVP", "123e4567-e89b-12d3-a456-426614174000")?.tipo).toBe("EVP");
    expect(validarPix("CNPJ", "00000000000000")).toBeNull();
    expect(validarPix("BOLETO", "x")).toBeNull();
  });
  it("código: 6 letras/números sem 0/O/1/I/L; link é a /oferta?ref=", () => {
    for (let i = 0; i < 50; i++) expect(gerarCodigo()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(linkIndique("ANA7K2")).toBe("https://www.coreaplicativo.com.br/oferta?ref=ANA7K2");
  });
  it("a prova da compra pro link: mesma ref, /oferta, paga", () => {
    const pi = { id: "pi_1", status: "succeeded", metadata: { ref: "ref-12345678", pagina: "oferta" } };
    expect(compraValeLink(pi, "ref-12345678")).toBe(true);
    expect(compraValeLink(pi, "ref-outra-999")).toBe(false);
    expect(compraValeLink({ ...pi, status: "requires_action" }, "ref-12345678")).toBe(false);
    expect(compraValeLink({ ...pi, metadata: { ref: "ref-12345678", pagina: "lp27" } }, "ref-12345678")).toBe(false);
  });
});

describe("banco: gravar e cancelar", () => {
  let b: ReturnType<typeof bancoFalso>;
  beforeEach(() => {
    b = bancoFalso();
    b.db.afiliados.push({ ...ANA, codigo: "ANA7K2", comprador_pi: "pi_da_ana", origem: "comprador" });
    b.db.afiliados.push({ id: "af_bia_influ", codigo: "BIA", origem: "influencer", pausado: false, email: null });
  });

  it("venda pelo link → 1 linha web 'pago' com R$ 33,95, transaction_id = PI; reenvio não duplica", async () => {
    expect(await registrarIndicacaoWeb(b.admin, "ana7k2", venda(), AGORA)).toMatchObject({ r: "gravada", status: "pago" });
    expect(await registrarIndicacaoWeb(b.admin, "ANA7K2", venda(), AGORA)).toMatchObject({ r: "ja" });
    expect(b.db.afiliado_vendas).toHaveLength(1);
    const l = b.db.afiliado_vendas[0];
    expect(l).toMatchObject({ afiliado_id: "af_ana", plataforma: "web", transaction_id: "pi_bia", status: "pago", comissao_cents: 3395, valor_bruto_cents: 6790, cobrado_em: AGORA.toISOString(), produto: "web_oferta_pix" });
    expect(l.libera_em).toBe(new Date(AGORA.getTime() + 10 * 86400e3).toISOString()); // críticas 17/11: Pix 10 dias (garantia 7 + suporte)
    expect(l.comprador_email_hash).toBe(await hashEmail("bia@exemplo.com"));
    expect(JSON.stringify(l)).not.toContain("bia@exemplo.com"); // o e-mail de quem comprou nunca fica em claro
  });
  it("autoindicação → gravada como recusada (o dono vê), comissão 0", async () => {
    await registrarIndicacaoWeb(b.admin, "ANA7K2", venda({ email: "ana.souza@gmail.com" }), AGORA);
    expect(b.db.afiliado_vendas[0]).toMatchObject({ status: "recusado", motivo: "autoindicacao_email", comissao_cents: 0 });
  });
  it("cartão: libera em 30 dias (e só entra no Pix depois disso)", async () => {
    await registrarIndicacaoWeb(b.admin, "ANA7K2", venda({ metodo: "card" }), AGORA);
    const l = b.db.afiliado_vendas[0];
    expect(l).toMatchObject({ produto: "web_oferta_cartao", libera_em: new Date(AGORA.getTime() + 30 * 86400e3).toISOString() });
    const af = [{ id: "af_ana", nome: "x", codigo: "ANA7K2", pausado: false, limite_semanal_cents: 50000 }];
    expect(planejarSemana(af, b.db.afiliado_vendas as never, new Date(AGORA.getTime() + 10 * 86400e3))).toEqual([]);
    expect(planejarSemana(af, b.db.afiliado_vendas as never, new Date(AGORA.getTime() + 31 * 86400e3))).toHaveLength(1);
  });
  it("estorno que chegou ANTES da venda ser gravada → a venda nasce e já vira reembolsada", async () => {
    b.db.webhook_events.push({ id: "stripe-estorno:pi_bia" });
    expect(await registrarIndicacaoWeb(b.admin, "ANA7K2", venda(), AGORA)).toMatchObject({ r: "estornada" });
    expect(b.db.afiliado_vendas[0].status).toBe("reembolsado");
  });
  it("código de influenciadora (App Store) não vale na web", async () => {
    expect(await registrarIndicacaoWeb(b.admin, "BIA", venda(), AGORA)).toEqual({ r: "codigo_desconhecido" });
  });
  it("código que não existe / sem código → nada", async () => {
    expect(await registrarIndicacaoWeb(b.admin, "NAOEXISTE", venda(), AGORA)).toEqual({ r: "codigo_desconhecido" });
    expect(await registrarIndicacaoWeb(b.admin, "", venda(), AGORA)).toEqual({ r: "sem_indicador" });
    expect(b.db.afiliado_vendas).toHaveLength(0);
  });
  it("reembolso/contestação da venda → 'reembolsado' (sai do Pix e do a receber)", async () => {
    await registrarIndicacaoWeb(b.admin, "ANA7K2", venda(), AGORA);
    expect(await cancelarIndicacaoWeb(b.admin, "pi_bia")).toMatchObject({ venda: "cancelada", pausou: false, comissao_cents: 3395, afiliado_id: "af_ana" });
    expect(b.db.afiliado_vendas[0]).toMatchObject({ status: "reembolsado", motivo: "reembolso" });
    const r = resumoPainel(b.db.afiliado_vendas as never, [], AGORA);
    expect(r).toMatchObject({ a_receber_cents: 0, reembolsadas: 1 });
    expect(planejarSemana([{ id: "af_ana", nome: "x", codigo: "ANA7K2", pausado: false, limite_semanal_cents: 50000 }], b.db.afiliado_vendas as never, new Date("2026-12-30T12:00:00Z"))).toEqual([]);
  });
  it("reembolso DEPOIS do Pix enviado → marcado pro dono (reembolso_depois_do_pix)", async () => {
    await registrarIndicacaoWeb(b.admin, "ANA7K2", venda(), AGORA);
    b.db.afiliado_pagamentos.push({ id: "pg1", status: "enviado" });
    b.db.afiliado_vendas[0].pagamento_id = "pg1";
    expect((await cancelarIndicacaoWeb(b.admin, "pi_bia")).venda).toBe("ja_paga");
    expect(b.db.afiliado_vendas[0].motivo).toBe("reembolso_depois_do_pix");
  });
  it("reembolso da COMPRA de quem indica → o link dela é pausado", async () => {
    expect(await cancelarIndicacaoWeb(b.admin, "pi_da_ana")).toEqual({ venda: "nenhuma", pausou: true });
    expect(b.db.afiliados[0].pausado).toBe(true);
  });
  it("estorno de uma compra EM DOBRO (a conta ainda tem outro vitalício ativo) → o link NÃO é pausado", async () => {
    b.db.subscriptions.push({ id: "s2", user_id: "u_ana", status: "active", plan: "lifetime", abacatepay_billing_id: "pi_outra_da_ana" });
    expect(await cancelarIndicacaoWeb(b.admin, "pi_da_ana")).toEqual({ venda: "nenhuma", pausou: false });
    expect(b.db.afiliados[0].pausado).toBe(false);
  });
});

describe("críticas da subida 17/11: estorno parcial, dívida depois do Pix, reprocessar e limite por IP", () => {
  let b: ReturnType<typeof bancoFalso>;
  beforeEach(() => {
    b = bancoFalso();
    b.db.afiliados.push({ ...ANA, codigo: "ANA7K2", comprador_pi: "pi_da_ana", origem: "comprador" });
  });

  it("devolução PARCIAL cancela a comissão (antes: R$ 33,95 cheios ficavam) e não pausa ninguém", async () => {
    await registrarIndicacaoWeb(b.admin, "ANA7K2", venda(), AGORA);
    expect(await cancelarIndicacaoWeb(b.admin, "pi_bia", { parcial: true })).toMatchObject({ venda: "cancelada", pausou: false });
    expect(b.db.afiliado_vendas[0]).toMatchObject({ status: "reembolsado", motivo: "reembolso_parcial" });
    // parcial na compra DE QUEM INDICA: o link continua
    expect(await cancelarIndicacaoWeb(b.admin, "pi_da_ana", { parcial: true })).toMatchObject({ venda: "nenhuma", pausou: false });
    expect(b.db.afiliados[0].pausado).toBe(false);
  });

  it("devolução DEPOIS do Pix: o próximo Pix do mesmo link desconta; se não cobre, a semana fica SEGURADA", () => {
    const planos = [
      { afiliado_id: "af_ana", total_cents: 3 * 3395, vendas_ids: ["v1", "v2", "v3"], decisao: "pagar", motivo: null },
      { afiliado_id: "af_bia", total_cents: 3395, vendas_ids: ["v9"], decisao: "pagar", motivo: null },
      { afiliado_id: "af_cau", total_cents: 3395, vendas_ids: ["v7"], decisao: "pausado", motivo: "afiliada_pausada" },
    ];
    const usadas = descontarDividas(planos, [
      { id: "d1", afiliado_id: "af_ana", comissao_cents: 3395 },
      { id: "d2", afiliado_id: "af_bia", comissao_cents: 3395 },
      { id: "d3", afiliado_id: "af_cau", comissao_cents: 3395 },
    ]);
    expect(usadas).toEqual(["d1"]);
    expect(planos[0]).toMatchObject({ total_cents: 2 * 3395, vendas_ids: ["v1", "v2", "v3", "d1"], decisao: "pagar", motivo: "desconto_reembolso" });
    expect(planos[1]).toMatchObject({ total_cents: 3395, decisao: "segurar", motivo: "divida_reembolso" }); // não cobre: o dono decide
    expect(planos[2]).toMatchObject({ decisao: "pausado" });
    // o liberar_pagamento refaz o valor e mantém o desconto (e tira uma venda reembolsada depois)
    expect(valorComDesconto([
      { status: "pago", comissao_cents: 3395 }, { status: "reembolsado", motivo: "reembolso", comissao_cents: 3395 },
      { status: "pago", comissao_cents: 3395 }, { status: "reembolsado", motivo: MOTIVO_DIVIDA_DESCONTADA, comissao_cents: 3395 },
    ])).toBe(3395);
    expect(MOTIVO_DIVIDA).toBe("reembolso_depois_do_pix");
  });

  it("reprocessar: comissão que não gravou no webhook é gravada pelo PI (idempotente: 2× = 1 linha)", async () => {
    b.db.subscriptions.push({ id: "s1", user_id: "u_bia", customer_email: "bia@exemplo.com", abacatepay_billing_id: "pi_bia", payment_method: "stripe", status: "active" });
    const pi = { id: "pi_bia", status: "succeeded", amount: 6790, amount_received: 6790, metadata: { pagina: "oferta", indicador: "ANA7K2", ip: "189.9.9.9", aparelho: "dev_bia_456" },
      latest_charge: { payment_method_details: { type: "pix" } } };
    expect(await reprocessarIndicacaoWeb(b.admin, pi, AGORA)).toMatchObject({ r: "gravada", status: "pago" });
    expect(await reprocessarIndicacaoWeb(b.admin, pi, AGORA)).toMatchObject({ r: "ja" });
    expect(b.db.afiliado_vendas).toHaveLength(1);
    expect(b.db.afiliado_vendas[0]).toMatchObject({ transaction_id: "pi_bia", comissao_cents: 3395, produto: "web_oferta_pix", user_id: "u_bia" });
    // sem indicador, não pago, outra página, sem a linha da compra → nada gravado
    expect((await reprocessarIndicacaoWeb(b.admin, { ...pi, id: "pi_x", metadata: { pagina: "oferta" } }, AGORA)).r).toBe("sem_indicador");
    expect((await reprocessarIndicacaoWeb(b.admin, { ...pi, id: "pi_x", status: "processing" }, AGORA)).r).toBe("nao_pago");
    expect((await reprocessarIndicacaoWeb(b.admin, { ...pi, id: "pi_x", metadata: { pagina: "lp27", indicador: "ANA7K2" } }, AGORA)).r).toBe("outra_pagina");
    expect((await reprocessarIndicacaoWeb(b.admin, { ...pi, id: "pi_sem_linha" }, AGORA)).r).toBe("sem_linha_da_compra");
    expect(await reprocessarIndicacaoWeb(b.admin, null, AGORA)).toEqual({ r: "sem_pi" });
    expect(b.db.afiliado_vendas).toHaveLength(1);
  });

  it("limite por IP: passa até o limite, recusa depois, outra janela zera; o IP não vai cru pro banco; banco fora = deixa passar", async () => {
    const ids: string[] = [];
    let fora = false;
    const admin = { from: () => {
      let prefixo = "", ehContagem = false;
      const q: Record<string, unknown> = {
        insert: (d: { id: string }) => { if (!fora) ids.push(d.id); return Promise.resolve({ error: fora ? { message: "x" } : null }); },
        select: () => { ehContagem = true; return q; },
        like: (_k: string, p: string) => { prefixo = p.replace(/%$/, ""); return q; },
        then: (ok: (v: unknown) => unknown) => Promise.resolve(ehContagem ? { count: ids.filter((i) => i.startsWith(prefixo)).length, error: null } : {}).then(ok),
      };
      return q;
    } };
    let n = 0;
    const al = () => String(++n);
    const janela = 10 * 60e3, t0 = 1_800_000_000_000;
    for (let i = 0; i < 3; i++) expect(await ipDentroDoLimite(admin, "indique-link", "200.1.1.1", 3, janela, t0, al)).toBe(true);
    expect(await ipDentroDoLimite(admin, "indique-link", "200.1.1.1", 3, janela, t0, al)).toBe(false);
    expect(await ipDentroDoLimite(admin, "indique-link", "200.2.2.2", 3, janela, t0, al)).toBe(true); // outro IP
    expect(await ipDentroDoLimite(admin, "indique-link", "200.1.1.1", 3, janela, t0 + janela, al)).toBe(true); // próxima janela
    expect(ids.join(" ")).not.toContain("200.1.1.1");
    expect(await ipDentroDoLimite(admin, "indique-link", null, 3, janela, t0, al)).toBe(true); // sem IP: não trava
    fora = true;
    expect(await ipDentroDoLimite(admin, "indique-link", "200.1.1.1", 3, janela, t0, al)).toBe(true); // banco fora: nunca derruba
  });
});

describe("o ?ref= no pedido (stripe-criar)", () => {
  const base = { ref: "0f8a5c2e-1111-4222-8333-944455556666", email: "bia@exemplo.com" };
  const args = { userId: null, ip: null, ua: null, agoraIso: "2026-11-23T15:00:00.000Z" };
  it("/oferta: atrib.indicador vira metadata[indicador] (normalizado)", () => {
    const p = validarPedidoStripe({ ...base, atrib: { indicador: "ana7k2", utm_source: "ig" } })!;
    expect(metadataDoPedido(p, args)).toMatchObject({ indicador: "ANA7K2", utm_source: "ig", pagina: "oferta" });
  });
  it("lixo, curto demais, ou outra oferta (lp27/app_web) → sem indicador", () => {
    expect(metadataDoPedido(validarPedidoStripe({ ...base, atrib: { indicador: "<x>" } })!, args)).not.toHaveProperty("indicador");
    expect(metadataDoPedido(validarPedidoStripe({ ...base, atrib: { indicador: 123 } })!, args)).not.toHaveProperty("indicador");
    expect(metadataDoPedido(validarPedidoStripe({ ...base, pagina: "lp27", atrib: { indicador: "ANA7K2" } })!, args)).not.toHaveProperty("indicador");
  });
  it("sem indicador = o pedido de hoje (nenhuma chave nova)", () => {
    const md = metadataDoPedido(validarPedidoStripe({ ...base, atrib: { utm_source: "ig" } })!, args);
    expect(Object.keys(md).sort()).toEqual(["criado_em", "email", "pagina", "ref", "utm_source"]);
  });
});

describe("a captura na página (último clique)", () => {
  const mem = () => { const s: Record<string, string> = {}; return { s, st: { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v; } } }; };
  const biscoito = () => { const c: Record<string, string> = {}; return { c, ck: { ler: (n: string) => c[n] ?? null, gravar: (n: string, v: string) => { c[n] = v; } } }; };
  beforeEach(() => _zerarIndicador());
  it("?ref= guarda (storage + cookie); sem ?ref= volta o guardado; um ?ref= novo substitui (último clique)", () => {
    const { st } = mem(); const { ck } = biscoito();
    expect(capturarIndicador("?ref=ana7k2&utm_source=ig", st, ck, 1000)).toBe("ANA7K2");
    _zerarIndicador();
    expect(capturarIndicador("", st, ck, 2000)).toBe("ANA7K2");
    expect(capturarIndicador("?ref=BIA999", st, ck, 3000)).toBe("BIA999");
    _zerarIndicador();
    expect(capturarIndicador("", st, ck, 4000)).toBe("BIA999");
  });
  it("Instagram zerou o storage: o cookie (e a memória da página) seguram; depois de 30 dias, nada", () => {
    const { st } = mem(); const { ck } = biscoito();
    capturarIndicador("?ref=ANA7K2", st, ck, 1000);
    expect(capturarIndicador("", null, ck, 2000)).toBe("ANA7K2"); // memória
    _zerarIndicador();
    expect(capturarIndicador("", { getItem: () => null, setItem: () => {} }, ck, 2000)).toBe("ANA7K2"); // cookie
    _zerarIndicador();
    expect(capturarIndicador("", null, ck, 1000 + 31 * 86400e3)).toBeNull();
  });
  it("WhatsApp: mensagem pronta com o link", () => {
    expect(decodeURIComponent(linkWhatsapp("https://www.coreaplicativo.com.br/oferta?ref=ANA7K2"))).toContain("oferta?ref=ANA7K2");
  });
});
