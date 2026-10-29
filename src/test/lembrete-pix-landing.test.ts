/**
 * O LEMBRETE DO PIX NÃO PAGO DA LANDING (29/10) — supabase/functions/_shared/lembrete-pix-landing.ts, que roda no cron do
 * pix-pendente-email (10 em 10 min). Fixtures no formato das linhas de verdade: analytics_events.pix_order_created (como o
 * asaas-pix grava), subscriptions, webhook_events (ln-qr / ln-lembrete) e o GET /payments?pixQrCodeId da Asaas.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  JANELAS, chaveLembrete, chaveQr, linkDeVolta, mensagemDoLembrete, pixPagoNaAsaas, toqueDaIdade, varrerLembretesLanding,
  type Mensagem,
} from "../../supabase/functions/_shared/lembrete-pix-landing";
import { voltaDoLembrete } from "@/landing/regras";

const raiz = resolve(__dirname, "../..");
const fonte = (f: string) => readFileSync(resolve(raiz, f), "utf8");

type Linha = Record<string, unknown>;
function bancoFalso(inicial: Partial<Record<string, Linha[]>> = {}) {
  const tabelas: Record<string, Linha[]> = { subscriptions: [], webhook_events: [], analytics_events: [], ...inicial } as Record<string, Linha[]>;
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "delete"; dados?: Linha } = { tipo: "select" };
    const exec = async () => {
      const t = (tabelas[tabela] ??= []);
      if (op.tipo === "insert") {
        if (tabela === "webhook_events" && t.some((r) => r.id === op.dados!.id)) return { error: { code: "23505", message: "duplicate key" } };
        t.push({ created_at: new Date().toISOString(), ...op.dados });
        return { error: null };
      }
      const achadas = t.filter((r) => filtros.every((f) => f(r)));
      if (op.tipo === "delete") { tabelas[tabela] = t.filter((r) => !achadas.includes(r)); return { error: null }; }
      if (op.tipo === "update") { achadas.forEach((r) => Object.assign(r, op.dados)); return { error: null }; }
      return { data: achadas.map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (d: Linha) => { op = { tipo: "insert", dados: d }; return q; },
      update: (d: Linha) => { op = { tipo: "update", dados: d }; return q; },
      delete: () => { op = { tipo: "delete" }; return q; },
      eq: (k: string, v: unknown) => { filtros.push((r) => r[k] === v); return q; },
      then: (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => exec().then(ok, erro),
    };
    return q;
  };
  return { tabelas, admin: { from } };
}

const AGORA = Date.parse("2026-10-29T15:00:00.000Z");
const MIN = 60_000;
const UID = "a1b2c3d4-0000-4000-8000-000000000001";
const PEDIDO = "pix_qr_8f2c1a7e4b9d4c0e";
const QR = "00020101021226870014br.gov.bcb.pix2565qrcode.asaas.com/pix/v2/1a2b3c4d5204000053039865405279005802BR5904CORE6009SAO PAULO62070503***63041D2E";

/** analytics_events.pix_order_created como o asaas-pix grava */
const pedido = (minAtras: number, o: Partial<Linha> & { order_id?: string; offer?: string; uid?: string } = {}): Linha => ({
  user_id: o.uid ?? UID, created_at: new Date(AGORA - minAtras * MIN).toISOString(),
  event_data: {
    order_id: o.order_id ?? PEDIDO, offer: o.offer ?? "LN_sempre279", amount_cents: 2790, gateway: "asaas",
    fbp: "fb.2.1761750000000.123456789", source_url: "https://www.coreaplicativo.com.br/organizar?utm_source=fb&utm_campaign=organizar",
    client_ip: "189.0.0.1", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) Instagram 400.0",
  },
});

function deps(over: Partial<Parameters<typeof varrerLembretesLanding>[1]> = {}) {
  const enviados: Array<{ para: string; m: Mensagem; tags: Record<string, string> }> = [];
  return {
    enviados,
    d: {
      pedidos: [] as Linha[], agora: AGORA,
      emailDaConta: vi.fn(async () => "maria@email.com" as string | null),
      destino: vi.fn(async () => null as string | null),
      pagoNaAsaas: vi.fn(async () => false as boolean | null),
      enviar: vi.fn(async (para: string, m: Mensagem, tags: Record<string, string>) => { enviados.push({ para, m, tags }); return true; }),
      ...over,
    },
  };
}

describe("as janelas", () => {
  it("t12 de 12 a 25 min (o QR vale 30); t20h de 20 a 26 h; fora disso nada", () => {
    expect(toqueDaIdade(11 * MIN)).toBeNull();
    expect(toqueDaIdade(12 * MIN)).toBe("t12");
    expect(toqueDaIdade(24.9 * MIN)).toBe("t12");
    expect(toqueDaIdade(25 * MIN)).toBeNull();
    expect(toqueDaIdade(19.9 * 60 * MIN)).toBeNull();
    expect(toqueDaIdade(20 * 60 * MIN)).toBe("t20h");
    expect(toqueDaIdade(26 * 60 * MIN)).toBeNull();
    expect(JANELAS.t12.ate).toBeLessThanOrEqual(25 * MIN);
  });
});

describe("os e-mails", () => {
  it("t12: assunto com os minutos que faltam, o copia-e-cola e o botão que REABRE o mesmo Pix na página", () => {
    const criadoEm = AGORA - 12 * MIN;
    const link = linkDeVolta({ toque: "t12", orderId: PEDIDO, offer: "LN_sempre279", qrCode: QR, criadoEm });
    const m = mensagemDoLembrete({ toque: "t12", offer: "LN_sempre279", centavos: 2790, link, qrCode: QR, minutosRestantes: 18 });
    expect(m.assunto).toBe("Seu Pix de R$ 27,90 ainda vale por 18 minutos");
    expect(m.html).toContain(QR.replace("***", "***"));
    expect(m.html).toContain("Abrir meu Pix");
    expect(m.html).toContain("7 dias de garantia");
    expect(m.html).toContain("pra sempre por R$ 27,90");
    // o link, aberto na página, reabre o MESMO Pix (o parser da página é o voltaDoLembrete)
    const u = new URL(link);
    expect(u.pathname).toBe("/organizar");
    expect(u.searchParams.get("utm_source")).toBe("lembrete_pix");
    expect(u.searchParams.get("utm_content")).toBe("t12");
    expect(voltaDoLembrete(u.searchParams, AGORA)?.pix).toMatchObject({ orderId: PEDIDO, qrCode: QR, oferta: "LN_sempre279", doEmail: true });
  });
  it("t20h: 'Seu CORE ficou separado', gera outro (sem código no link), resposta pro contato@", () => {
    const link = linkDeVolta({ toque: "t20h", orderId: PEDIDO, offer: "LN_sempre279", qrCode: QR, criadoEm: AGORA - 20 * 60 * MIN });
    const m = mensagemDoLembrete({ toque: "t20h", offer: "LN_sempre279", centavos: 2790, link, qrCode: null, minutosRestantes: -1170 });
    expect(m.assunto).toBe("Seu CORE ficou separado");
    expect(m.html).toContain("Gerar meu Pix de novo");
    expect(m.html).toContain("é só responder este e-mail");
    expect(new URL(link).searchParams.get("pix")).toBeNull();
    expect(fonte("supabase/functions/pix-pendente-email/index.ts")).toContain('reply_to: "contato@coreaplicativo.com.br"');
  });
  it("o braço 'ano' fala de 1 ano", () => {
    const m = mensagemDoLembrete({ toque: "t20h", offer: "LN_ano279", centavos: 2790, link: "https://x", qrCode: null, minutosRestantes: 0 });
    expect(m.html).toContain("1 ano por R$ 27,90");
  });
});

describe("a passada do cron", () => {
  it("12 min: manda 1x com o copia-e-cola guardado; o 2º cron não manda de novo", async () => {
    const { tabelas, admin } = bancoFalso({ webhook_events: [{ id: chaveQr(PEDIDO), source: "landing", event: QR }] });
    const { d, enviados } = deps({ pedidos: [pedido(13)] });
    const r1 = await varrerLembretesLanding(admin, d);
    expect(r1).toMatchObject({ enviados: 1, t12: 1, t20h: 0 });
    expect(enviados[0].para).toBe("maria@email.com");
    expect(enviados[0].m.html).toContain(QR);
    expect(enviados[0].tags).toEqual({ lembrete: "t12", oferta: "LN_sempre279" });
    expect(tabelas.webhook_events.some((w) => w.id === chaveLembrete("t12", PEDIDO))).toBe(true);
    expect(tabelas.analytics_events).toEqual([expect.objectContaining({
      user_id: UID, event_name: "landing_lembrete_enviado",
      event_data: { order_id: PEDIDO, toque: "t12", offer: "LN_sempre279", via: "conta", com_codigo: true },
    })]);
    // nada de e-mail no evento
    expect(JSON.stringify(tabelas.analytics_events)).not.toContain("@");
    const r2 = await varrerLembretesLanding(admin, { ...d, agora: AGORA + 10 * MIN - 1 }); // 23 min: ainda na janela
    expect(r2).toMatchObject({ enviados: 0, jaAvisados: 1 });
    expect(enviados).toHaveLength(1);
  });

  it("20 h: o 2º toque (sem código), também 1x", async () => {
    const { admin } = bancoFalso({ webhook_events: [{ id: chaveLembrete("t12", PEDIDO), source: "landing", event: "lembrete_pix" }] });
    const { d, enviados } = deps({ pedidos: [pedido(20 * 60 + 5)] });
    expect(await varrerLembretesLanding(admin, d)).toMatchObject({ enviados: 1, t20h: 1 });
    expect(enviados[0].m.assunto).toBe("Seu CORE ficou separado");
    expect(await varrerLembretesLanding(admin, d)).toMatchObject({ enviados: 0, jaAvisados: 1 });
  });

  it("para se pagou: pedido creditado, outra compra viva depois do Pix, vitalício, ou a Asaas já diz pago", async () => {
    const linha = { id: "s1", user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix", abacatepay_billing_id: PEDIDO, current_period_end: "2126-10-29T14:58:00Z", created_at: new Date(AGORA - 5 * MIN).toISOString() };
    for (const subs of [
      [linha],
      [{ ...linha, abacatepay_billing_id: "outro_pedido", plan: "core-pro", billing_period: "annual", current_period_end: "2027-10-29T00:00:00Z" }],
      [{ ...linha, abacatepay_billing_id: "antigo", created_at: "2026-01-01T00:00:00Z" }],
    ]) {
      const { admin } = bancoFalso({ subscriptions: subs as Linha[] });
      const { d, enviados } = deps({ pedidos: [pedido(13)] });
      expect(await varrerLembretesLanding(admin, d)).toMatchObject({ enviados: 0, pagos: 1 });
      expect(enviados).toHaveLength(0);
    }
    const { admin } = bancoFalso();
    const { d, enviados } = deps({ pedidos: [pedido(13)], pagoNaAsaas: vi.fn(async () => true) });
    expect(await varrerLembretesLanding(admin, d)).toMatchObject({ enviados: 0, pagos: 1 });
    expect(enviados).toHaveLength(0);
  });

  it("assinatura antiga e CANCELADA não conta como pago (manda)", async () => {
    const { admin } = bancoFalso({ subscriptions: [{ user_id: UID, status: "canceled", plan: "core-pro", billing_period: "annual", abacatepay_billing_id: null, current_period_end: "2026-09-01T00:00:00Z", created_at: "2025-09-01T00:00:00Z" }] });
    const { d } = deps({ pedidos: [pedido(13)] });
    expect(await varrerLembretesLanding(admin, d)).toMatchObject({ enviados: 1 });
  });

  it("não manda sem e-mail (anônima crua, sem destino); manda pro destino do e-mail opcional (conta que já existia)", async () => {
    const { admin } = bancoFalso();
    const sem = deps({ pedidos: [pedido(13)], emailDaConta: vi.fn(async () => null) });
    expect(await varrerLembretesLanding(admin, sem.d)).toMatchObject({ enviados: 0, semEmail: 1 });
    expect(sem.d.enviar).not.toHaveBeenCalled();
    const { tabelas, admin: a2 } = bancoFalso();
    const dest = deps({ pedidos: [pedido(13)], emailDaConta: vi.fn(async () => null), destino: vi.fn(async () => "joana@email.com") });
    expect(await varrerLembretesLanding(a2, dest.d)).toMatchObject({ enviados: 1 });
    expect(dest.enviados[0].para).toBe("joana@email.com");
    expect((tabelas.analytics_events[0].event_data as Linha).via).toBe("destino");
  });

  it("só o pedido MAIS NOVO da conta; fora da landing, fora da janela e e-mail de teste ficam de fora", async () => {
    const { admin } = bancoFalso();
    const { d, enviados } = deps({
      pedidos: [
        pedido(14, { order_id: "velho" }), pedido(5, { order_id: "novo" }), // o novo ainda não tem 12 min → nada (nem do velho)
        pedido(13, { uid: "u2", offer: "h279", order_id: "hoje" }), // /hoje: não é da landing
        pedido(40, { uid: "u3", order_id: "fora" }), // 40 min: entre os toques
      ],
    });
    expect(await varrerLembretesLanding(admin, d)).toMatchObject({ candidatos: 0, enviados: 0 });
    expect(enviados).toHaveLength(0);
    const t = deps({ pedidos: [pedido(13)], emailDaConta: vi.fn(async () => "maria+teste@email.com") });
    expect(await varrerLembretesLanding(bancoFalso().admin, t.d)).toMatchObject({ testes: 1, enviados: 0 });
  });

  it("envio falhou → a reserva sai (o próximo cron tenta); pedido de antes do deploy (sem ln-qr) vai sem código", async () => {
    const { tabelas, admin } = bancoFalso();
    const falha = deps({ pedidos: [pedido(13)], enviar: vi.fn(async () => false) });
    expect(await varrerLembretesLanding(admin, falha.d)).toMatchObject({ falhas: 1, enviados: 0 });
    expect(tabelas.webhook_events.some((w) => String(w.id).startsWith("ln-lembrete:"))).toBe(false);
    const ok = deps({ pedidos: [pedido(13)] });
    expect(await varrerLembretesLanding(admin, ok.d)).toMatchObject({ enviados: 1 });
    expect(ok.enviados[0].m.html).not.toContain("000201");
    expect(new URL(ok.enviados[0].m.html.match(/href="([^"]+)"/)![1].replace(/&amp;/g, "&")).searchParams.get("pix")).toBeNull();
  });
});

describe("Asaas e o cano", () => {
  it("pixPagoNaAsaas: RECEIVED/CONFIRMED = pago; PENDING = não; erro = não sei", async () => {
    const resp = (status: string) => vi.fn(async () => ({ ok: true, json: async () => ({ object: "list", totalCount: 1, data: [{ object: "payment", id: "pay_123", status, billingType: "PIX", value: 27.9, pixQrCodeId: PEDIDO }] }) }));
    expect(await pixPagoNaAsaas(resp("RECEIVED"), "k", PEDIDO)).toBe(true);
    expect(await pixPagoNaAsaas(resp("CONFIRMED"), "k", PEDIDO)).toBe(true);
    expect(await pixPagoNaAsaas(resp("PENDING"), "k", PEDIDO)).toBe(false);
    expect(await pixPagoNaAsaas(vi.fn(async () => ({ ok: false, json: async () => ({}) })), "k", PEDIDO)).toBeNull();
  });
  it("o asaas-pix guarda o copia-e-cola só das ofertas da landing; o pix-pendente-email roda a passada com chave de desligar", () => {
    const pix = fonte("supabase/functions/asaas-pix/index.ts");
    expect(pix).toMatch(/if \(ehOfertaLanding\(offer\)\) \{\s*await supabaseAdmin\.from\("webhook_events"\)\.insert\(\{ id: chaveQr\(out\.id\)/);
    const cron = fonte("supabase/functions/pix-pendente-email/index.ts");
    expect(cron).toContain('Deno.env.get("LEMBRETE_PIX_LANDING") ?? "on") !== "off"');
    expect(cron).toContain('.in("event_data->>offer", [...OFERTAS_PLANO_LANDING])');
    expect(cron).toContain("varrerLembretesLanding(supabase");
    // sem teto na busca: o pedido mais novo (ainda < 12 min) precisa chegar pra calar o lembrete dos velhos
    expect(cron).not.toMatch(/\.lt\("created_at", new Date\(agora - JANELAS\.t12\.de\)/);
  });
});
