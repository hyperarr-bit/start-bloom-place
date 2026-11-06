/**
 * PAGOU DE NOVO NA LOJA (06/11): compra da App Store/Play numa conta que já tem o vitalício do Pix vira chamado no /admin
 * (e e-mail com a chave em "on"). Fixtures: linha de public.subscriptions e evento do webhook do RevenueCat.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assuntoAviso, avisarCompraLojaSobrePix, chaveCompraLoja, ehCompraNovaDaLoja, htmlAviso, linhasDoAviso, modoAviso, pedidoDoVitalicioPix, type EventoCompraLoja,
} from "../../supabase/functions/_shared/loja-apos-pix";

type Linha = Record<string, unknown>;
const UID = "6f1c2f0e-8c0b-4b52-9a51-0e2f5c1d7a10";
const QR = "b2f7c9d04e1a4c6f8a3d5e7f90123456";

const vitalicioPix = (o: Linha = {}): Linha => ({
  id: "s-pix", user_id: UID, status: "active", plan: "lifetime", billing_period: "lifetime", payment_method: "pix",
  abacatepay_billing_id: QR, current_period_end: "2126-11-03T14:40:12.000Z", revenuecat_subscription_id: null, ...o,
});
const linhaDaLoja = (o: Linha = {}): Linha => ({
  id: "s-loja", user_id: UID, status: "active", plan: "app", billing_period: "annual", payment_method: "play_store",
  abacatepay_billing_id: null, current_period_end: "2027-11-03T14:52:00.000Z", revenuecat_subscription_id: "subAapXYZ", ...o,
});
const compraApple = (o: EventoCompraLoja = {}): EventoCompraLoja => ({
  type: "INITIAL_PURCHASE", store: "APP_STORE", environment: "PRODUCTION", period_type: "NORMAL", product_id: "core_anual_97",
  id: "EVT-1", transaction_id: "200000111", original_transaction_id: "200000111",
  purchased_at_ms: Date.parse("2026-11-03T14:52:00.000Z"), expiration_at_ms: Date.parse("2027-11-03T14:52:00.000Z"),
  price_in_purchased_currency: 97.9, currency: "BRL", ...o,
});

function bancoFalso(subs: Linha[] = [], opts: { falharChamado?: boolean } = {}) {
  const t: Record<string, Linha[]> = { subscriptions: subs.map((s) => ({ ...s })), webhook_events: [], support_tickets: [] };
  const escritas: string[] = [];
  const from = (tabela: string) => {
    const filtros: Array<(r: Linha) => boolean> = [];
    let op: { tipo: string; dados?: Linha } = { tipo: "select" };
    const exec = async () => {
      const lista = (t[tabela] ??= []);
      if (op.tipo === "insert") {
        escritas.push(tabela);
        if (tabela === "support_tickets" && opts.falharChamado) return { error: { message: "fora" } };
        if (tabela === "webhook_events" && lista.some((r) => r.id === op.dados!.id)) return { error: { code: "23505", message: "dup" } };
        lista.push({ ...op.dados });
        return { error: null };
      }
      const achadas = lista.filter((r) => filtros.every((f) => f(r)));
      if (op.tipo === "delete") { escritas.push(tabela); t[tabela] = lista.filter((r) => !achadas.includes(r)); return { error: null }; }
      if (op.tipo === "update") { escritas.push(tabela); return { error: null }; }
      return { data: achadas, error: null };
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
  return { t, escritas, admin: { from } };
}

const avisar = (admin: unknown, modo: "off" | "chamado" | "on", ev = compraApple(), enviar = vi.fn().mockResolvedValue(true), email: string | null = "cliente@exemplo.com") =>
  avisarCompraLojaSobrePix(admin as never, { ev, userId: UID, email, modo, enviar });

describe("quando avisa", () => {
  it("chave: só 'chamado' e 'on' ligam", () => {
    expect(modoAviso("on")).toBe("on");
    expect(modoAviso("chamado")).toBe("chamado");
    for (const v of ["off", "ON", "", undefined, null]) expect(modoAviso(v)).toBe("off");
  });

  it("só compra nova de verdade: fora renovação, cancelamento, sandbox e loja desconhecida", () => {
    expect(ehCompraNovaDaLoja(compraApple())).toBe(true);
    expect(ehCompraNovaDaLoja(compraApple({ type: "NON_RENEWING_PURCHASE", store: "PLAY_STORE" }))).toBe(true);
    expect(ehCompraNovaDaLoja(compraApple({ type: "RENEWAL" }))).toBe(false);
    expect(ehCompraNovaDaLoja(compraApple({ type: "CANCELLATION" }))).toBe(false);
    expect(ehCompraNovaDaLoja(compraApple({ environment: "SANDBOX" }))).toBe(false);
    expect(ehCompraNovaDaLoja(compraApple({ store: "STRIPE" }))).toBe(false);
  });

  it("vitalício do Pix: a linha da loja não conta, a cancelada também não", () => {
    expect(pedidoDoVitalicioPix([vitalicioPix() as never, linhaDaLoja() as never])).toEqual({ tem: true, pedido: QR, viaPix: true });
    expect(pedidoDoVitalicioPix([linhaDaLoja({ billing_period: "lifetime" }) as never]).tem).toBe(false);
    expect(pedidoDoVitalicioPix([vitalicioPix({ status: "canceled" }) as never]).tem).toBe(false);
    expect(pedidoDoVitalicioPix([vitalicioPix({ plan: "web", billing_period: "monthly_prepaid" }) as never]).tem).toBe(false);
  });
});

describe("o que faz", () => {
  it("chave off: não lê nem escreve", async () => {
    const { escritas, admin } = bancoFalso([vitalicioPix()]);
    const from = vi.spyOn(admin, "from");
    expect(await avisar(admin, "off")).toEqual({ r: "fora" });
    expect(from).not.toHaveBeenCalled();
    expect(escritas).toHaveLength(0);
  });

  it("modo chamado: abre o chamado com o rascunho e NÃO manda e-mail", async () => {
    const { t, admin } = bancoFalso([vitalicioPix(), linhaDaLoja()]);
    const enviar = vi.fn().mockResolvedValue(true);
    expect(await avisar(admin, "chamado", compraApple(), enviar)).toEqual({ r: "chamado", email: false });
    expect(enviar).not.toHaveBeenCalled();
    expect(t.support_tickets).toHaveLength(1);
    expect(t.support_tickets[0]).toMatchObject({ user_id: UID, source: "loja_pos_pix", status: "open" });
    const m = String(t.support_tickets[0].message);
    expect(m.split("\n")[0]).toBe("Pagou de novo na loja · App Store · compra · R$ 97,90 · 03/11 11:52");
    expect(m).toContain(`Pedido do Pix: ${QR}`);
    expect(m).toContain("Nada foi cancelado");
    expect(m).toContain("reportaproblem.apple.com");
  });

  it("modo on: manda o e-mail 1x; o RevenueCat reenviando não repete", async () => {
    const { t, admin } = bancoFalso([vitalicioPix()]);
    const enviar = vi.fn().mockResolvedValue(true);
    expect(await avisar(admin, "on", compraApple(), enviar)).toEqual({ r: "chamado", email: true });
    expect(await avisar(admin, "on", compraApple(), enviar)).toEqual({ r: "ja_avisado" });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toBe("cliente@exemplo.com");
    expect(enviar.mock.calls[0][1]).toBe(assuntoAviso());
    expect(t.support_tickets).toHaveLength(1);
    expect(String(t.support_tickets[0].message)).toContain("E-mail com o passo a passo enviado.");
  });

  it("vitalício que não foi no Pix (Stripe, Hotmart): o texto diz 'pelo site'", async () => {
    for (const pm of ["stripe", "hotmart"]) {
      const { t, admin } = bancoFalso([vitalicioPix({ payment_method: pm })]);
      const enviar = vi.fn().mockResolvedValue(true);
      await avisar(admin, "chamado", compraApple(), enviar);
      const m = String(t.support_tickets[0].message);
      expect(m).toContain("comprou o CORE pelo site");
      expect(m).not.toContain("Pix");
    }
  });

  it("nunca escreve em subscriptions", async () => {
    const { t, escritas, admin } = bancoFalso([vitalicioPix(), linhaDaLoja()]);
    await avisar(admin, "on");
    expect(escritas).not.toContain("subscriptions");
    expect(t.subscriptions).toHaveLength(2);
  });

  it("conta sem vitalício do Pix: nada acontece", async () => {
    const { t, admin } = bancoFalso([linhaDaLoja()]);
    expect(await avisar(admin, "on")).toEqual({ r: "sem_pix" });
    expect(t.support_tickets).toHaveLength(0);
    expect(t.webhook_events).toHaveLength(0);
  });

  it("e-mail falhou ou conta sem e-mail: o chamado sai com o rascunho", async () => {
    const a = bancoFalso([vitalicioPix()]);
    expect(await avisar(a.admin, "on", compraApple(), vi.fn().mockResolvedValue(false))).toEqual({ r: "chamado", email: false });
    expect(String(a.t.support_tickets[0].message)).toContain("O e-mail falhou.");
    const b = bancoFalso([vitalicioPix()]);
    const enviar = vi.fn();
    await avisar(b.admin, "on", compraApple(), enviar, null);
    expect(enviar).not.toHaveBeenCalled();
    expect(String(b.t.support_tickets[0].message)).toContain("Conta sem e-mail");
  });

  it("chamado falhou sem e-mail enviado: solta a trava, o reenvio tenta de novo", async () => {
    const { t, admin } = bancoFalso([vitalicioPix()], { falharChamado: true });
    expect((await avisar(admin, "chamado")).r).toBe("erro");
    expect(t.webhook_events.some((e) => e.id === chaveCompraLoja(compraApple()))).toBe(false);
  });

  it("chamado falhou com e-mail já enviado: a trava fica (nunca 2 e-mails)", async () => {
    const { t, admin } = bancoFalso([vitalicioPix()], { falharChamado: true });
    expect(await avisar(admin, "on")).toEqual({ r: "erro", email: true });
    expect(t.webhook_events.some((e) => e.id === chaveCompraLoja(compraApple()))).toBe(true);
  });
});

describe("o texto", () => {
  it("compra cobrada na Apple: reembolso; na Play: reembolso do Google", () => {
    expect(linhasDoAviso(compraApple()).join(" ")).toContain("reportaproblem.apple.com");
    const g = linhasDoAviso(compraApple({ store: "PLAY_STORE" })).join(" ");
    expect(g).toContain("Google Play");
    expect(g).not.toContain("apple.com");
  });

  it("teste grátis: cancelar sem pagar, sem falar em reembolso e sem valor no chamado", async () => {
    const ev = compraApple({ period_type: "TRIAL", price_in_purchased_currency: 0 });
    const texto = linhasDoAviso(ev).join(" ");
    expect(texto).toContain("Cancelar teste");
    expect(texto).not.toContain("reembolso");
    const { t, admin } = bancoFalso([vitalicioPix()]);
    await avisar(admin, "chamado", ev);
    expect(String(t.support_tickets[0].message).split("\n")[0]).toBe("Pagou de novo na loja · App Store · teste grátis · 03/11 11:52");
  });

  it("o HTML escapa e usa o mesmo texto", () => {
    expect(htmlAviso(compraApple())).toContain("Você não precisa dessa segunda compra.");
  });
});

describe("o source do revenuecat-webhook", () => {
  const rc = readFileSync(resolve(__dirname, "../../supabase/functions/revenuecat-webhook/index.ts"), "utf8");

  it("atrás da chave, depois do estado reconciliado, e erro nunca derruba o webhook", () => {
    expect(rc).toMatch(/modoAviso\(Deno\.env\.get\("LOJA_APOS_PIX_AVISO"\)\)/);
    expect(rc.indexOf("reconciliarRevenueCat(admin, uid")).toBeLessThan(rc.indexOf("avisarCompraLojaSobrePix(admin"));
    expect(rc).toMatch(/loja apos pix ERRO/);
  });
});
