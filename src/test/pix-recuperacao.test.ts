/**
 * PIX PAGO QUE NÃO VIROU ACESSO (06/11, relatório pix-acesso.md).
 *
 * Casos reais de 02–04/11: a passada do pix-reconcile morria perto da 140ª consulta (do pedido mais velho pro mais novo)
 * e o webhook perdia o evento quando a reconfirmação falhava. Aqui: reenvio, falha no meio, duplicidade, pedido antigo e
 * ordem de varredura, com linhas no formato das tabelas de verdade (subscriptions, webhook_events, support_tickets,
 * analytics_events.pix_order_created).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { creditarPedido } from "../../supabase/functions/_shared/grant-pix";
import { CORTE_MARCA_MS, TRAVA_CREDITADA, TRAVA_RECUPERAVEL_MS, TRAVA_VELHA_MS, chaveTrava, pegarTrava } from "../../supabase/functions/_shared/trava-grant";
import {
  ALARME_PENDENTE_MS, CHAVE_VARREDURA_ATIVA, FONTE_PENDENCIA, FONTE_REENVIO, MAX_REENVIOS_HORA, PASSADA_MS, abrirVarredura, alarmarSemCredito, alarmarVarredura,
  TETO_ABRIR_HORA, TETO_ABRIR_MINUTO, antigoPrecisaDeOlho, chaveAlarme, chaveLigada, chavePendencia, conferirPixAoAbrir, consultarNestaPassada, criarOrcamento, fecharVarredura, lerPendencias,
  maisUrgente, marcarPendente, ordenarFila, orientacaoDoChamado, podePedirReenvio, reconfirmarAsaas, resolverPendencia, soltarEvento,
} from "../../supabase/functions/_shared/pix-recuperacao";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../supabase/functions", f), "utf8");

type Linha = Record<string, unknown>;

/** Banco falso com a mesma interface do supabase-js. Toda operação cede a vez, então caminhos juntos se intercalam. */
function bancoFalso(inicial: Partial<Record<string, Linha[]>> = {}, opts: { falharInsertSubs?: number } = {}) {
  const t: Record<string, Linha[]> = { subscriptions: [], webhook_events: [], analytics_events: [], support_tickets: [], ...inicial } as Record<string, Linha[]>;
  let falhar = opts.falharInsertSubs ?? 0;
  let seq = 0;
  const leituras: string[] = [];
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Linha } = { tipo: "select" };
    let unico = false;
    let teto = Infinity;
    const exec = async () => {
      await new Promise((r) => setTimeout(r, 0));
      const lista = (t[tabela] ??= []);
      if (op.tipo === "insert") {
        if (tabela === "subscriptions" && falhar > 0) { falhar--; return { error: { message: "falha simulada" } }; }
        if (tabela === "webhook_events" && lista.some((r) => r.id === op.dados!.id)) return { error: { code: "23505", message: "duplicate key" } };
        lista.push({ id: op.dados!.id ?? `id${++seq}`, processed_at: new Date().toISOString(), created_at: new Date().toISOString(), ...op.dados });
        return { error: null };
      }
      const achadas = lista.filter((r) => filtros.every((f) => f(r)));
      if (op.tipo === "update") { achadas.forEach((r) => Object.assign(r, op.dados)); return { error: null }; }
      if (op.tipo === "delete") { t[tabela] = lista.filter((r) => !achadas.includes(r)); return { error: null }; }
      leituras.push(tabela);
      const fatia = achadas.slice(0, teto).map((r) => ({ ...r }));
      return { data: unico ? fatia[0] ?? null : fatia, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => r[k] === v); return q; },
      gte: (k: string, v: string) => { filtros.push((r) => Date.parse(String(r[k])) >= Date.parse(v)); return q; },
      limit: (n: number) => { teto = n; return q; },
      maybeSingle: () => { unico = true; return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { t, leituras, admin: { from } };
}

const UID = "6f1c2f0e-8c0b-4b52-9a51-0e2f5c1d7a10";
const QR = "b2f7c9d04e1a4c6f8a3d5e7f90123456";
const EVT = "evt_05d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5&1234567";
const AGORA_MS = Date.parse("2026-11-03T15:00:00.000Z");
const AGORA = new Date(AGORA_MS);
/* o que o create grava em analytics_events */
const pedidoCriado = (o: Linha = {}): Linha => ({
  user_id: UID, event_name: "pix_order_created", created_at: "2026-11-03T14:40:12.000+00:00",
  event_data: { order_id: QR, offer: "LN_sempre279", amount_cents: 2790, source_url: "https://www.coreaplicativo.com.br/organizar", ...o },
});
const payloadVitalicio = (orderId: string) => (fim: string) => ({
  user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: orderId,
  customer_email: "cliente@exemplo.com", amount_cents: 2790, current_period_start: AGORA.toISOString(), current_period_end: fim,
});
const creditar = (admin: unknown, orderId = QR, agora = AGORA, offer = "LN_sempre279") =>
  creditarPedido(admin as never, { userId: UID, orderId, gateway: "asaas", concessao: { dias: null }, agora, protegerVitalicio: true, offer, montarPayload: payloadVitalicio(orderId) });

/** O começo do asaas-webhook, na mesma ordem do index.ts: trava do evento → reconfirmação → crédito ou devolve o evento. */
async function entregar(admin: never, reconfirma: () => Promise<{ erro: string | null; pago: unknown }>) {
  const { error } = await (admin as { from: (t: string) => { insert: (d: Linha) => Promise<{ error: { code?: string } | null }> } }).from("webhook_events")
    .insert({ id: `asaas:${EVT}`, source: "asaas", event: "PAYMENT_RECEIVED" });
  if (error?.code === "23505") return "duplicado";
  const chk = await reconfirma();
  if (chk.erro || !chk.pago) {
    await soltarEvento(admin, EVT);
    await marcarPendente(admin, QR, chk.erro ? `reconfirma_${chk.erro}` : "nao_pago_na_reconfirmacao");
    return "pendente";
  }
  return (await creditar(admin)).r;
}

describe("webhook: reenvio e falha no meio", () => {
  it("reconfirmação falhou: o evento é solto, a reentrega credita e sai 1 crédito só", async () => {
    const { t, admin } = bancoFalso();
    expect(await entregar(admin as never, async () => ({ erro: "http_429", pago: null }))).toBe("pendente");
    expect(t.subscriptions).toHaveLength(0);
    expect(t.webhook_events.some((e) => e.id === `asaas:${EVT}`)).toBe(false);
    expect(t.webhook_events.find((e) => e.id === chavePendencia(QR))).toMatchObject({ source: FONTE_PENDENCIA, event: "reconfirma_http_429" });
    expect(await entregar(admin as never, async () => ({ erro: null, pago: { status: "RECEIVED", value: 27.9 } }))).toBe("creditado");
    expect(await entregar(admin as never, async () => ({ erro: null, pago: { status: "RECEIVED", value: 27.9 } }))).toBe("duplicado");
    expect(t.subscriptions).toHaveLength(1);
  });

  it("a Asaas diz que não pagou: não credita nada e o pedido fica pra varredura conferir", async () => {
    const { t, admin } = bancoFalso();
    expect(await entregar(admin as never, async () => ({ erro: null, pago: null }))).toBe("pendente");
    expect(t.subscriptions).toHaveLength(0);
    expect((await lerPendencias(admin))[0]).toMatchObject({ orderId: QR, motivo: "nao_pago_na_reconfirmacao" });
  });

  it("gravar a linha falhou no meio: a trava solta e a nova tentativa credita 1x", async () => {
    const { t, admin } = bancoFalso({}, { falharInsertSubs: 1 });
    expect((await creditar(admin)).r).toBe("erro");
    expect(t.webhook_events.some((e) => e.id === chaveTrava("asaas", QR))).toBe(false);
    expect((await creditar(admin)).r).toBe("creditado");
    expect(t.subscriptions).toHaveLength(1);
  });

  it("o source do webhook: erro da Asaas não vira 'não pago', e depois do crédito nada solta o evento", () => {
    const wh = fonte("asaas-webhook/index.ts");
    expect(wh).not.toMatch(/Not paid on reconfirm/);
    expect(wh).toMatch(/if \(chk\.erro\) return await falhou/);
    expect(wh).toMatch(/if \(travado && qrCodeId && !creditou\) return await falhou\("excecao"/);
    expect(wh.indexOf("creditou = true;\n      const kit")).toBeGreaterThan(-1);
    // 503 só pela chave, com teto
    expect(wh).toMatch(/podePedirReenvio\(admin, chaveLigada\(Deno\.env\.get\("ASAAS_WEBHOOK_REENVIO"\)\)\)/);
  });
});

describe("1 pedido = 1 crédito com o reenvio", () => {
  it("3 caminhos ao mesmo tempo + reentrega: 1 linha e 1 'creditado' (o único que manda Purchase e e-mail)", async () => {
    const { t, admin } = bancoFalso();
    const rs = await Promise.all([creditar(admin), creditar(admin), creditar(admin)]);
    const depois = await creditar(admin);
    expect([...rs, depois].filter((r) => r.r === "creditado")).toHaveLength(1);
    expect(depois.r).toBe("ja_creditado");
    expect(t.subscriptions).toHaveLength(1);
  });

  it("depois do crédito a trava fica marcada", async () => {
    const { t, admin } = bancoFalso();
    await creditar(admin);
    expect(t.webhook_events.find((e) => e.id === chaveTrava("asaas", QR))?.event).toBe(TRAVA_CREDITADA);
  });

  it("outro pedido reescreveu a linha: a pendência velha do 1º NÃO credita de novo", async () => {
    const velha = new Date(AGORA_MS - 10 * 60_000).toISOString();
    const { t, admin } = bancoFalso({
      webhook_events: [{ id: chaveTrava("asaas", QR), source: "grant", event: TRAVA_CREDITADA, processed_at: velha }],
      subscriptions: [{ id: "s1", user_id: UID, status: "active", plan: "web", billing_period: "monthly_prepaid", payment_method: "pix", abacatepay_billing_id: "outro_pedido", current_period_end: "2026-12-03T00:00:00.000Z" }],
    });
    const r = await creditarPedido(admin as never, {
      userId: UID, orderId: QR, gateway: "asaas", concessao: { dias: 30 }, agora: AGORA,
      montarPayload: (fim) => ({ abacatepay_billing_id: QR, current_period_end: fim }),
    });
    expect(r).toEqual({ r: "ja_creditado" });
    expect(t.subscriptions[0].current_period_end).toBe("2026-12-03T00:00:00.000Z"); // o prazo não empilhou
  });

  it("trava sem marca depois do corte é caminho morto: recuperável em qualquer idade; antes do corte, não", async () => {
    const trava = (em: number) => bancoFalso({ webhook_events: [{ id: chaveTrava("asaas", QR), source: "grant", event: "asaas", processed_at: new Date(em).toISOString() }] });
    const dias = 5 * 864e5;
    expect(await pegarTravaComFiltro(trava(CORTE_MARCA_MS + 1000).admin, CORTE_MARCA_MS + dias)).toBe("pegou");
    expect(await pegarTravaComFiltro(trava(CORTE_MARCA_MS - 1000).admin, CORTE_MARCA_MS + dias)).toBe("ocupada");
    const marcada = bancoFalso({ webhook_events: [{ id: chaveTrava("asaas", QR), source: "grant", event: TRAVA_CREDITADA, processed_at: new Date(CORTE_MARCA_MS + 1000).toISOString() }] });
    expect(await pegarTravaComFiltro(marcada.admin, CORTE_MARCA_MS + dias)).toBe("creditada");
  });

  it("trava SEM a marca: de 2 min a 2 h é recuperável (o caminho morreu); passou de 2 h, fica ocupada", async () => {
    const trava = (idadeMs: number) => bancoFalso({ webhook_events: [{ id: chaveTrava("asaas", QR), source: "grant", event: "asaas", processed_at: new Date(AGORA_MS - idadeMs).toISOString() }] });
    expect(await pegarTravaComFiltro(trava(TRAVA_VELHA_MS - 1000).admin, AGORA_MS)).toBe("ocupada");
    expect(await pegarTravaComFiltro(trava(TRAVA_VELHA_MS + 1000).admin, AGORA_MS)).toBe("pegou");
    expect(await pegarTravaComFiltro(trava(TRAVA_RECUPERAVEL_MS - 1000).admin, AGORA_MS)).toBe("pegou");
    const velha = trava(TRAVA_RECUPERAVEL_MS + 1000);
    expect(await pegarTravaComFiltro(velha.admin, AGORA_MS)).toBe("ocupada");
    expect(velha.t.webhook_events).toHaveLength(1);
  });

  it("vitalício que já tem a linha e paga outro pedido: preservado + chamado de devolução (a pendência forçada não reescreve)", async () => {
    const { t, admin } = bancoFalso({
      subscriptions: [{ id: "s1", user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: "pedido_valido", current_period_end: "2126-11-03T00:00:00.000Z" }],
    });
    const r = await creditar(admin);
    expect(r).toMatchObject({ r: "preservado", motivo: "vitalicio_pagou_de_novo" });
    expect(t.subscriptions[0].abacatepay_billing_id).toBe("pedido_valido");
    expect(t.support_tickets[0]).toMatchObject({ source: "pix_em_dobro", user_id: UID });
  });
});

const pegarTravaComFiltro = (admin: unknown, agora: number) => pegarTrava(admin as never, "asaas", QR, agora);

describe("ordem e agenda da varredura", () => {
  const idade = (min: number) => new Date(AGORA_MS - min * 60_000).toISOString();
  const passadas = (n: number, a: Omit<Parameters<typeof consultarNestaPassada>[0], "agora">) =>
    Array.from({ length: n }, (_, i) => consultarNestaPassada({ ...a, agora: AGORA_MS + i * PASSADA_MS })).filter(Boolean).length;

  it("até 2 h entra em toda passada", () => {
    expect(passadas(8, { orderId: QR, criadoEm: idade(5) })).toBe(8);
  });

  it("de 2 h a 48 h entra 1x por hora (1 passada em 4)", () => {
    expect(passadas(4, { orderId: QR, criadoEm: idade(600) })).toBe(1);
    expect(passadas(4, { orderId: "outro", criadoEm: idade(600) })).toBe(1);
  });

  it("os pedidos do meio se espalham pelas passadas (não caem todos juntos)", () => {
    const n = Array.from({ length: 400 }, (_, i) => `qr${i}`).filter((orderId) => consultarNestaPassada({ orderId, criadoEm: idade(600), agora: AGORA_MS })).length;
    expect(n).toBeGreaterThan(60);
    expect(n).toBeLessThan(140);
  });

  it("depois de 48 h: nada com a chave desligada; 1x por dia com ela ligada; depois de 7 dias, nada", () => {
    expect(passadas(96, { orderId: QR, criadoEm: idade(3 * 1440) })).toBe(0);
    expect(passadas(96, { orderId: QR, criadoEm: idade(3 * 1440), antigoLigado: true })).toBe(1);
    expect(passadas(96, { orderId: QR, criadoEm: idade(8 * 1440), antigoLigado: true })).toBe(0);
  });

  it("pendência entra sempre, em qualquer idade", () => {
    expect(passadas(4, { orderId: QR, criadoEm: idade(9 * 1440), forcado: true })).toBe(4);
  });

  it("os upsells: mesma ordem (pendência, depois o mais novo) e sem a agenda antiga da hora cheia", () => {
    const lista = [{ criadoEm: idade(900) }, { criadoEm: idade(5) }, { criadoEm: idade(2000), forcado: true }].sort(maisUrgente);
    expect(lista.map((o) => o.criadoEm)).toEqual([idade(2000), idade(5), idade(900)]);
    expect(fonte("pix-reconcile/index.ts")).not.toMatch(/consultarUpsellAgora/);
  });

  it("a fila: pendência primeiro, depois o pedido mais novo; dentro da pessoa a ordem não muda", () => {
    const o = (id: string, criadoEm: string, forcado = false) => ({ orderId: id, criadoEm, forcado });
    const fila = ordenarFila([
      ["velho", [o("a", idade(2000))]],
      ["novo", [o("b1", idade(300)), o("b2", idade(5))]],
      ["pendente", [o("c", idade(1000), true)]],
    ]);
    expect(fila.map(([u]) => u)).toEqual(["pendente", "novo", "velho"]);
    expect(fila[1][1].map((x) => x.orderId)).toEqual(["b1", "b2"]);
  });

  it("o caso de 03/11: 444 na fila, a passada só alcança 140, e o pedido pago há 15 min é visto", () => {
    const fila: Array<[string, Array<{ orderId: string; criadoEm: string }>]> = Array.from({ length: 444 }, (_, i) => [`u${i}`, [{ orderId: `q${i}`, criadoEm: idade(2800 - i * 6) }]]);
    fila[443] = ["pagou", [{ orderId: QR, criadoEm: idade(15) }]];
    const antes = fila.slice(0, 140).map(([u]) => u); // do mais velho pro mais novo, como era
    expect(antes).not.toContain("pagou");
    const devidos = fila.filter(([, [o]]) => consultarNestaPassada({ ...o, agora: AGORA_MS }));
    expect(devidos.length).toBeLessThan(140); // a fila inteira da passada cabe no que ela alcança
    expect(ordenarFila(devidos)[0][0]).toBe("pagou");
  });

  it("o source: sem limit do mais velho pro mais novo, com páginas, e a passada principal antes dos upsells", () => {
    const rc = fonte("pix-reconcile/index.ts");
    expect(rc).not.toMatch(/ascending: true/);
    expect(rc).toMatch(/\.range\(de, de \+ 999\)/);
    expect(rc).toMatch(/ordenarFila\(\[\.\.\.porUser\]\)/);
    expect(rc.indexOf("ordenarFila([...porUser])")).toBeLessThan(rc.indexOf("await passada2027()"));
    expect((rc.match(/erro: true/g) ?? []).length).toBeGreaterThanOrEqual(4); // os 4 gateways
    expect((rc.match(/orcamento\.podeConsultar\(\)/g) ?? []).length).toBe(4); // as 4 passadas
  });

  it("o source: a varredura de uma conta não aceita a anon key", () => {
    const rc = fonte("pix-reconcile/index.ts");
    const bloco = rc.slice(rc.indexOf("if (soUsuario) {"), rc.indexOf("const agora = Date.now()"));
    expect(bloco).toMatch(/if \(!confiavel\) return jsonResponse\(\{ error: "unauthorized" \}, 401\)/);
    expect(rc).toMatch(/const confiavel = !!\(\(esperado && String\(body\.token \?\? ""\) === esperado\) \|\| \(papelServico && bearer === papelServico\)\);/);
  });
});

describe("orçamento da passada", () => {
  it("`pular` deixa as N primeiras de fora sem contar como puladas", () => {
    const o = criarOrcamento({ pular: 2 });
    expect([o.podeConsultar(), o.podeConsultar(), o.podeConsultar()]).toEqual([false, false, true]);
    expect(o.estado().puladas).toBe(0);
  });

  it("para no tempo e conta o que ficou", () => {
    let t = 0;
    const o = criarOrcamento({ relogio: () => t, limiteMs: 100 });
    expect(o.podeConsultar()).toBe(true);
    t = 101;
    expect(o.podeConsultar()).toBe(false);
    expect(o.podeConsultar()).toBe(false);
    expect(o.estado()).toMatchObject({ parou: "tempo", puladas: 2 });
  });

  it("429 para na hora; outros erros, depois de 5 seguidos; resposta boa zera", () => {
    const a = criarOrcamento();
    a.registrar({ erro: true, status: "http_429" });
    expect(a.podeConsultar()).toBe(false);
    expect(a.estado()).toMatchObject({ parou: "cota_429", erros: 1 });

    const b = criarOrcamento();
    for (let i = 0; i < 4; i++) b.registrar({ erro: true, status: "http_500" });
    b.registrar({ status: "PENDING" });
    for (let i = 0; i < 4; i++) b.registrar({ erro: true, status: "http_500" });
    expect(b.podeConsultar()).toBe(true);
    b.registrar({ erro: true, status: "http_500" });
    expect(b.podeConsultar()).toBe(false);
    expect(b.estado()).toMatchObject({ parou: "erros_seguidos", erros: 9 });
  });
});

describe("reconfirmação na Asaas", () => {
  const resp = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo });
  const pago = { object: "list", totalCount: 1, data: [{ id: "pay_1", status: "RECEIVED", value: 27.9, customer: "cus_1", pixQrCodeId: QR }] };

  it("pago de primeira", async () => {
    const r = await reconfirmarAsaas(async () => resp(200, pago), "k", QR, 0);
    expect(r.erro).toBeNull();
    expect(r.pago).toMatchObject({ status: "RECEIVED", value: 27.9 });
  });

  it("500 e depois pago: tenta de novo", async () => {
    const b = vi.fn().mockResolvedValueOnce(resp(500, {})).mockResolvedValueOnce(resp(200, pago));
    expect((await reconfirmarAsaas(b, "k", QR, 0)).pago).toBeTruthy();
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("429: não insiste e devolve erro, não 'não pago'", async () => {
    const b = vi.fn().mockResolvedValue(resp(429, { errors: [] }));
    expect(await reconfirmarAsaas(b, "k", QR, 0)).toEqual({ erro: "http_429", pago: null });
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("rede caiu 3x: erro; PENDING com resposta boa: sem erro e sem pago", async () => {
    expect((await reconfirmarAsaas(async () => { throw new Error("x"); }, "k", QR, 0)).erro).toBe("rede");
    expect(await reconfirmarAsaas(async () => resp(200, { data: [{ status: "PENDING" }] }), "k", QR, 0)).toEqual({ erro: null, pago: null });
  });
});

describe("pendências, reenvio e alarmes", () => {
  it("a 2ª falha do mesmo pedido mantém a data da 1ª; resolver tira da fila", async () => {
    const { t, admin } = bancoFalso();
    await marcarPendente(admin, QR, "reconfirma_http_500");
    const [p1] = await lerPendencias(admin);
    await marcarPendente(admin, QR, "grant_falhou");
    expect(await lerPendencias(admin)).toEqual([p1]);
    await resolverPendencia(admin, QR);
    expect(t.webhook_events).toHaveLength(0);
  });

  it("503 só com a chave, e no máximo 5 por hora", async () => {
    const { t, admin } = bancoFalso();
    expect(await podePedirReenvio(admin, false, AGORA_MS)).toBe(false);
    expect(t.webhook_events).toHaveLength(0);
    for (let i = 0; i < MAX_REENVIOS_HORA; i++) expect(await podePedirReenvio(admin, true, AGORA_MS)).toBe(true);
    expect(await podePedirReenvio(admin, true, AGORA_MS)).toBe(false);
    expect(t.webhook_events.every((e) => e.source === FONTE_REENVIO)).toBe(true);
  });

  it("só 'on' liga uma chave", () => {
    expect(chaveLigada("on")).toBe(true);
    for (const v of ["off", "ON", "1", "", null, undefined]) expect(chaveLigada(v)).toBe(false);
  });

  it("pago sem crédito: 1 chamado, 1 push, por pedido", async () => {
    const { t, admin } = bancoFalso();
    const avisar = vi.fn().mockResolvedValue(1);
    const a = { orderId: QR, userId: UID, motivo: "grant_falhou", amountCents: 2790, agora: AGORA_MS, avisar };
    expect(await alarmarSemCredito(admin, a)).toBe(true);
    expect(await alarmarSemCredito(admin, a)).toBe(false);
    expect(t.support_tickets).toHaveLength(1);
    expect(t.support_tickets[0]).toMatchObject({ user_id: UID, source: "pix_sem_credito", status: "open" });
    expect(String(t.support_tickets[0].message).split("\n")[0]).toBe("Pix sem crédito · R$ 27,90 · 03/11 12:00");
    expect(String(t.support_tickets[0].message)).toContain(`Pedido: ${QR}`);
    expect(String(t.support_tickets[0].message)).toContain("transferir_pix");
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(t.webhook_events.some((e) => e.id === chaveAlarme(QR))).toBe(true);
  });

  it("pedido sem dono: sem chamado (user_id é obrigatório), mas o push sai; push quebrado não derruba", async () => {
    const { t, admin } = bancoFalso();
    const avisar = vi.fn().mockRejectedValue(new Error("sem vapid"));
    expect(await alarmarSemCredito(admin, { orderId: QR, userId: null, motivo: "sem_registro_do_pedido", avisar })).toBe(true);
    expect(t.support_tickets).toHaveLength(0);
    expect(t.analytics_events[0]).toMatchObject({ event_name: "pix_sem_credito_alerta" });
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("varredura com problema: no máximo 1 aviso a cada 6 h", async () => {
    const { t, admin } = bancoFalso();
    const a = { motivo: "cota_429", agora: AGORA_MS };
    expect(await alarmarVarredura(admin, a)).toBe(true);
    expect(await alarmarVarredura(admin, { ...a, agora: AGORA_MS + 900_000 })).toBe(false);
    expect(await alarmarVarredura(admin, { ...a, agora: AGORA_MS + 7 * 3600_000 })).toBe(true);
    expect(t.analytics_events).toHaveLength(2);
  });

  it("a marca da passada: em curso segura todos; fechada só segura o cron; a que ficou em curso é passada morta", async () => {
    const { t, admin } = bancoFalso();
    const marca = () => t.webhook_events.find((e) => e.id === CHAVE_VARREDURA_ATIVA)!;
    const depois = (min: number) => Date.parse(String(marca().processed_at)) + min * 60_000;
    expect(await abrirVarredura(admin, AGORA_MS)).toEqual({ pular: false, anteriorMorreu: false });
    expect(await abrirVarredura(admin, depois(1))).toEqual({ pular: true, anteriorMorreu: false });
    await fecharVarredura(admin);
    expect(marca().event).toBe("fim");
    expect((await abrirVarredura(admin, depois(1), { respeitarIntervalo: true })).pular).toBe(true);
    expect(await abrirVarredura(admin, depois(1))).toEqual({ pular: false, anteriorMorreu: false }); // token: pode
    expect(await abrirVarredura(admin, depois(15), { respeitarIntervalo: true })).toEqual({ pular: false, anteriorMorreu: true });
    expect(t.webhook_events.filter((e) => e.id === CHAVE_VARREDURA_ATIVA)).toHaveLength(1);
  });

  it("marca vencida que não sai (delete com erro ou sem efeito): a varredura segue, não para pra sempre", async () => {
    const velha = new Date(AGORA_MS - 15 * 60_000).toISOString();
    const marca = { id: CHAVE_VARREDURA_ATIVA, source: "pix_alarme", event: "em_curso", processed_at: velha };
    const comErro = bancoFalso({ webhook_events: [{ ...marca }] });
    const deErro = { from: (x: string) => { const q = comErro.admin.from(x) as Record<string, unknown>; return { ...q, then: q.then, delete: () => ({ eq: () => ({ eq: async () => ({ error: { message: "fora" } }) }) }) }; } };
    expect(await abrirVarredura(deErro, AGORA_MS, { respeitarIntervalo: true })).toEqual({ pular: false, anteriorMorreu: true });
    const semEfeito = bancoFalso({ webhook_events: [{ ...marca }] });
    const naoApaga = { from: (x: string) => { const q = semEfeito.admin.from(x) as Record<string, unknown>; return { ...q, then: q.then, delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }; } };
    expect(await abrirVarredura(naoApaga, AGORA_MS, { respeitarIntervalo: true })).toEqual({ pular: false, anteriorMorreu: true });
  });

  it("o chamado diz o que fazer em cada motivo", () => {
    expect(orientacaoDoChamado("pedido_antigo_conferir", QR).join(" ")).toContain(`billing=${QR}`);
    expect(orientacaoDoChamado("trava_antiga_conferir", QR).join(" ")).not.toContain("segue tentando");
    expect(orientacaoDoChamado("valor_menor", QR).join(" ")).toContain("pagou menos");
    expect(orientacaoDoChamado("grant_falhou", QR).join(" ")).toContain("segue tentando");
  });

  it("duas passadas ao mesmo tempo: só uma entra", async () => {
    const { admin } = bancoFalso();
    const rs = await Promise.all([abrirVarredura(admin, AGORA_MS), abrirVarredura(admin, AGORA_MS)]);
    expect(rs.filter((r) => !r.pular)).toHaveLength(1);
  });

  it("o tempo do alarme da pendência é maior que uma passada", () => {
    expect(ALARME_PENDENTE_MS).toBeGreaterThan(PASSADA_MS);
  });
});

describe("pedido antigo (mais de 48 h)", () => {
  const trava = chaveTrava("asaas", QR);

  it("sem linha e sem trava: limpo, pode creditar", async () => {
    const { admin } = bancoFalso();
    expect(await antigoPrecisaDeOlho(admin, trava, QR)).toBe(false);
    expect((await creditar(admin)).r).toBe("creditado");
  });

  it("trava sem a marca e sem linha (crédito de antes desta versão, linha apagada): não credita sozinho", async () => {
    const { admin } = bancoFalso({ webhook_events: [{ id: trava, source: "grant", event: "asaas", processed_at: "2026-10-30T12:00:00.000+00:00" }] });
    expect(await antigoPrecisaDeOlho(admin, trava, QR)).toBe(true);
  });

  it("com a linha do pedido (até cancelada): não é alarme, o crédito responde ja_creditado", async () => {
    const { admin } = bancoFalso({
      webhook_events: [{ id: trava, source: "grant", event: "asaas", processed_at: "2026-10-30T12:00:00.000+00:00" }],
      subscriptions: [{ id: "s1", user_id: UID, status: "canceled", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: QR, current_period_end: "2126-10-30T00:00:00.000Z" }],
    });
    expect(await antigoPrecisaDeOlho(admin, trava, QR)).toBe(false);
    expect((await creditar(admin)).r).toBe("ja_creditado");
  });

  it("trava sem marca depois do corte: caminho morto, pode creditar", async () => {
    const { admin } = bancoFalso({ webhook_events: [{ id: trava, source: "grant", event: "asaas", processed_at: new Date(CORTE_MARCA_MS + 1000).toISOString() }] });
    expect(await antigoPrecisaDeOlho(admin, trava, QR)).toBe(false);
  });

  it("erro de leitura segura o crédito", async () => {
    const admin = { from: () => { throw new Error("fora"); } };
    expect(await antigoPrecisaDeOlho(admin, trava, QR)).toBe(true);
  });
});

describe("conferir na Asaas quando a conta sem acesso abre o app", () => {
  const comPedido = () => bancoFalso({ analytics_events: [pedidoCriado({})] });
  const base = { userId: UID, agora: Date.parse("2026-11-03T15:00:00.000+00:00") };

  it("chave desligada: não consulta nada", async () => {
    const { leituras, admin } = comPedido();
    const varrer = vi.fn();
    expect(await conferirPixAoAbrir(admin, { ...base, ligado: false, varrer })).toBe(false);
    expect(leituras).toHaveLength(0);
    expect(varrer).not.toHaveBeenCalled();
  });

  it("conta sem Pix recente (a maioria no paywall): não gasta a Asaas", async () => {
    const { admin } = bancoFalso();
    const varrer = vi.fn();
    expect(await conferirPixAoAbrir(admin, { ...base, ligado: true, varrer })).toBe(false);
    expect(varrer).not.toHaveBeenCalled();
  });

  it("pedido com mais de 2 h: não confere", async () => {
    const { admin } = bancoFalso({ analytics_events: [pedidoCriado({})] });
    const varrer = vi.fn();
    expect(await conferirPixAoAbrir(admin, { ...base, agora: base.agora + 3 * 3600_000, ligado: true, varrer })).toBe(false);
    expect(varrer).not.toHaveBeenCalled();
  });

  it("teto global: 10 por minuto e 100 por hora, somando todas as contas", async () => {
    const agora = base.agora;
    const abrir = (n: number, minAtras: number) => Array.from({ length: n }, (_, i) => ({ id: `pix-abrir:c${minAtras}-${i}`, source: "pix_abrir", event: "check", processed_at: new Date(agora - minAtras * 60_000).toISOString() }));
    const varrer = vi.fn().mockResolvedValue(true);
    const cheioMinuto = bancoFalso({ analytics_events: [pedidoCriado({})], webhook_events: abrir(TETO_ABRIR_MINUTO, 0) });
    expect(await conferirPixAoAbrir(cheioMinuto.admin, { ...base, ligado: true, varrer })).toBe(false);
    const cheioHora = bancoFalso({ analytics_events: [pedidoCriado({})], webhook_events: abrir(TETO_ABRIR_HORA, 30) });
    expect(await conferirPixAoAbrir(cheioHora.admin, { ...base, ligado: true, varrer })).toBe(false);
    expect(varrer).not.toHaveBeenCalled();
    const livre = bancoFalso({ analytics_events: [pedidoCriado({})], webhook_events: abrir(TETO_ABRIR_MINUTO, 5) });
    expect(await conferirPixAoAbrir(livre.admin, { ...base, ligado: true, varrer })).toBe(true);
  });

  it("no máximo 1 pedido a cada 2 min por conta", async () => {
    const { admin } = comPedido();
    const varrer = vi.fn().mockResolvedValue(true);
    expect(await conferirPixAoAbrir(admin, { ...base, ligado: true, varrer })).toBe(true);
    expect(await conferirPixAoAbrir(admin, { ...base, ligado: true, varrer })).toBe(false);
    expect(varrer).toHaveBeenCalledTimes(1);
  });

  it("erro na varredura nunca derruba o check-subscription", async () => {
    const { admin } = comPedido();
    expect(await conferirPixAoAbrir(admin, { ...base, ligado: true, varrer: async () => { throw new Error("timeout"); } })).toBe(false);
  });

  it("o source: quem credita é o pix-reconcile, o check-subscription não escreve assinatura", () => {
    const cs = fonte("check-subscription/index.ts");
    expect(cs).toMatch(/functions\/v1\/pix-reconcile/);
    expect(cs).not.toMatch(/creditarPedido/);
    expect(cs).not.toMatch(/\.insert\(|\.update\(|\.upsert\(/);
  });
});
