/**
 * "SEU 2027" — o servidor (21/10). Banco falso pro _shared/pacote-2027.ts + leitura da fonte das 3 funções da Asaas:
 *   · o pagamento grava core-pacote-2027 na conta de QUEM PAGOU (idempotente) e o Purchase sai 1x por pedido;
 *   · gravou mal → não manda Purchase (o próximo caminho tenta); u2027 nunca vira assinatura (fora do CONCESSAO);
 *   · check, webhook e reconcile conhecem o u2027 e passam pela mesma função; o nome do produto na CAPI/UTMify.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHAVE_PACOTE_2027, PRECO_2027_CENTAVOS, chaveCapi2027, confirmarPacote2027, eh2027, ipUaDoPedido, liberarPacote2027,
} from "../../supabase/functions/_shared/pacote-2027";
import { CONCESSAO_HOJE, DESCRICAO_HOJE, PRECOS_HOJE, ehPlanoHoje, ehUpsellHoje } from "../../supabase/functions/_shared/ofertas-hoje";
import { nomeDoProduto, planoUtmify } from "../../supabase/functions/_shared/email-venda";
import { CHAVE_PACOTE_2027 as CHAVE_DO_APP } from "@/lib/pacote-2027";

function bancoFalso(opts: { falharUpsert?: boolean } = {}) {
  const userData = new Map<string, unknown>();
  const eventos = new Set<string>();
  const admin = {
    from: (t: string) => {
      if (t === "user_data") {
        const filtros: Record<string, string> = {};
        const q = {
          select: () => q,
          eq: (c: string, v: string) => { filtros[c] = v; return q; },
          maybeSingle: async () => ({ data: userData.has(`${filtros.user_id}|${filtros.key}`) ? { value: userData.get(`${filtros.user_id}|${filtros.key}`) } : null }),
          upsert: async (l: { user_id: string; key: string; value: unknown }) => {
            if (opts.falharUpsert) return { error: { message: "x" } };
            userData.set(`${l.user_id}|${l.key}`, l.value);
            return { error: null };
          },
        };
        return q;
      }
      if (t === "webhook_events") {
        return { insert: async (l: { id: string }) => { if (eventos.has(l.id)) return { error: { code: "23505" } }; eventos.add(l.id); return { error: null }; } };
      }
      throw new Error(t);
    },
  };
  return { admin, userData, eventos };
}

describe("a oferta", () => {
  it("u2027 = R$ 19,90, mesma chave do app, fora do CONCESSAO (não é assinatura), nem plano nem upsell de acesso", () => {
    expect(PRECOS_HOJE.u2027).toBe(1990);
    expect(PRECO_2027_CENTAVOS).toBe(1990);
    expect(CONCESSAO_HOJE.u2027).toBeUndefined();
    expect(DESCRICAO_HOJE.u2027).toBe("CORE seu 2027");
    expect(ehPlanoHoje("u2027")).toBe(false);
    expect(ehUpsellHoje("u2027")).toBe(false);
    expect(eh2027("u2027")).toBe(true);
    expect(eh2027("hv279")).toBe(false);
    expect(CHAVE_PACOTE_2027).toBe(CHAVE_DO_APP);
    expect(nomeDoProduto({ offer: "u2027" })).toBe("CORE Seu 2027");
    expect(planoUtmify("u2027")).toBe("pacote_2027");
    expect(nomeDoProduto({ offer: "hv279" })).not.toBe("CORE Seu 2027");
  });
});

describe("confirmarPacote2027", () => {
  it("grava o pacote na conta de quem pagou e manda o Purchase 1x por pedido (3 caminhos chegando juntos)", async () => {
    const { admin, userData, eventos } = bancoFalso();
    const enviar = vi.fn(async () => {});
    const agora = new Date("2026-10-21T18:00:00Z");
    const r = await Promise.all([1, 2, 3].map(() => confirmarPacote2027(admin, { userId: "u1", orderId: "qr9", agora, enviarCompra: enviar })));
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(r.filter((x) => x.compraEnviada)).toHaveLength(1);
    expect(userData.get(`u1|${CHAVE_PACOTE_2027}`)).toMatchObject({ comprado: true, em: agora.toISOString(), pedido: "qr9" });
    expect(eventos.has(chaveCapi2027("qr9"))).toBe(true);
  });
  it("quem já tem fica como está (o 'em' da 1ª compra); outro pedido manda o Purchase dele", async () => {
    const { admin, userData } = bancoFalso();
    await liberarPacote2027(admin, { userId: "u1", orderId: "qr1", agora: new Date("2026-10-21T10:00:00Z") });
    const enviar = vi.fn(async () => {});
    const r = await confirmarPacote2027(admin, { userId: "u1", orderId: "qr2", enviarCompra: enviar });
    expect(r.r).toBe("ja_tinha");
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(userData.get(`u1|${CHAVE_PACOTE_2027}`)).toMatchObject({ pedido: "qr1", em: "2026-10-21T10:00:00.000Z" });
  });
  it("não gravou → 'falhou' e NÃO manda Purchase (nem reserva: o próximo caminho manda)", async () => {
    const { admin, eventos } = bancoFalso({ falharUpsert: true });
    const enviar = vi.fn(async () => {});
    const r = await confirmarPacote2027(admin, { userId: "u1", orderId: "qr3", enviarCompra: enviar });
    expect(r).toEqual({ r: "falhou", compraEnviada: false });
    expect(enviar).not.toHaveBeenCalled();
    expect(eventos.size).toBe(0);
  });
  it("Purchase que falha não derruba a entrega", async () => {
    const { admin, userData } = bancoFalso();
    const r = await confirmarPacote2027(admin, { userId: "u1", orderId: "qr4", enviarCompra: async () => { throw new Error("meta fora"); } });
    expect(r.r).toBe("liberado");
    expect(userData.size).toBe(1);
  });
  it("IP/UA do pedido (sem o UA a Meta descarta evento de site)", () => {
    expect(ipUaDoPedido({ client_ip: "1.2.3.4", user_agent: "Mozilla" })).toEqual({ ip: "1.2.3.4", ua: "Mozilla" });
    expect(ipUaDoPedido(null)).toEqual({ ip: null, ua: null });
  });
});

describe("as 3 funções da Asaas conhecem o u2027 (fonte)", () => {
  const fonte = (f: string) => readFileSync(join(process.cwd(), "supabase/functions", f), "utf8");
  it("asaas-pix check: confirmarPacote2027 antes do CONCESSAO, com Purchase nos 2 pixels (sendMetaCapi) e PENDING se não gravou", () => {
    const s = fonte("asaas-pix/index.ts");
    const i = s.indexOf("if (eh2027(offer))");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(s.indexOf("const concessao = CONCESSAO[offer];"));
    const bloco = s.slice(i, i + 1600);
    expect(bloco).toMatch(/confirmarPacote2027\(supabaseAdmin/);
    expect(bloco).toMatch(/sendMetaCapi\(/);
    expect(bloco).toMatch(/status: "PENDING"/);
    expect(s).toMatch(/fetchNosPixels/);
  });
  it("asaas-webhook: o mesmo, com IP/UA do pedido, antes da trava de oferta desconhecida", () => {
    const s = fonte("asaas-webhook/index.ts");
    const i = s.indexOf("if (eh2027(offer) && valorCobre(pago.value, PRECOS_CENTAVOS[offer]))");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(s.indexOf("if (!(offer in PRECOS_CENTAVOS) || !CONCESSAO[offer])"));
    expect(s.slice(i, i + 1400)).toMatch(/\.\.\.ipUaDoPedido\(regData\)/);
  });
  it("pix-reconcile: passada própria (fora da varredura de assinatura), Purchase com IP/UA e trava compartilhada", () => {
    const s = fonte("pix-reconcile/index.ts");
    expect(s).toMatch(/if \(eh2027\(ofertaCrua\)\) \{\s*pedidos2027\.push/);
    expect(s.indexOf("if (eh2027(ofertaCrua))")).toBeLessThan(s.indexOf("if (!(ofertaCrua in DIAS_DA_OFERTA))"));
    expect(s).toMatch(/confirmarPacote2027\(admin/);
    expect(s).toMatch(/o\.ip && o\.ua \? \{ client_ip_address: o\.ip, client_user_agent: o\.ua \}/);
    expect(s).toMatch(/\.eq\("key", "core-pacote-2027"\)/);
  });
});
