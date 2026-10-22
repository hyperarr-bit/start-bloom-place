/**
 * DOWNSELL SÓ NO FLUXO CERTO (segurança, 21/10): o vitalício com desconto (R$ 14,90 Asaas / R$ 19,90 Cakto) não pode
 * ser pedido direto por qualquer conta. Vale pra quem já gerou Pix de preço cheio (registro do servidor) ou tem conta de
 * 3+ dias (winback). Regra em supabase/functions/_shared/elegibilidade-downsell.ts; asaas-pix e cakto-pix aplicam no create.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DIAS_WINBACK, MENSAGEM_DOWNSELL_INDISPONIVEL, OFERTAS_PRECO_CHEIO, downsellPermitido, ehDownsell, podePedirDownsell,
} from "../../../supabase/functions/_shared/elegibilidade-downsell";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../../supabase/functions", f), "utf8");
const AGORA = new Date("2026-10-22T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();
const pedido = (offer: string) => ({ event_data: { order_id: `qr_${offer}`, offer } });

describe("downsellPermitido (puro)", () => {
  it("conta nova sem Pix de preço cheio → recusa (o pedido direto)", () => {
    expect(downsellPermitido({ criadoEm: diasAtras(0), agora: AGORA, pedidosAnteriores: [] })).toEqual({ ok: false, motivo: "fora_do_fluxo" });
  });
  it("conta nova que só pediu downsell/upsell antes → continua recusando", () => {
    expect(downsellPermitido({ criadoEm: diasAtras(1), agora: AGORA, pedidosAnteriores: [pedido("downsell"), pedido("pv149"), pedido("u2027"), pedido("pk99")] }).ok).toBe(false);
  });
  it("já gerou o Pix de preço cheio (recuperação / fuga do paywall) → pode", () => {
    for (const o of ["lifetime", "w27", "w97", "hv279", "h279"]) {
      expect(downsellPermitido({ criadoEm: diasAtras(0), agora: AGORA, pedidosAnteriores: [pedido(o)] }), o).toEqual({ ok: true, motivo: "recusou_preco_cheio" });
    }
    expect(OFERTAS_PRECO_CHEIO).not.toContain("downsell");
  });
  it("conta com 3+ dias (winback: o teste acabou) → pode; 2,9 dias não", () => {
    expect(downsellPermitido({ criadoEm: diasAtras(DIAS_WINBACK), agora: AGORA, pedidosAnteriores: [] })).toEqual({ ok: true, motivo: "winback" });
    expect(downsellPermitido({ criadoEm: diasAtras(2.9), agora: AGORA, pedidosAnteriores: [] }).ok).toBe(false);
  });
  it("sem data de criação e sem pedido → recusa (na dúvida ninguém paga o preço errado)", () => {
    expect(downsellPermitido({ criadoEm: null, agora: AGORA, pedidosAnteriores: null }).ok).toBe(false);
    expect(downsellPermitido({ criadoEm: "lixo", agora: AGORA, pedidosAnteriores: [null] }).ok).toBe(false);
  });
  it("ehDownsell", () => {
    expect(ehDownsell("downsell")).toBe(true);
    for (const o of ["lifetime", "w27", "", null, undefined]) expect(ehDownsell(o)).toBe(false);
  });
});

/** Banco falso: analytics_events filtrado por event_name + user_id; auth.admin.getUserById. */
function bancoFalso(linhas: Array<{ event_name: string; user_id: string; event_data: Record<string, unknown> }>, criados: Record<string, string> = {}, falhar = false) {
  const lidos: string[] = [];
  return {
    lidos,
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: criados[id] ? { id, created_at: criados[id] } : null } }) } },
    from: (t: string) => {
      const f: Record<string, string> = {};
      const q = {
        select: () => q,
        eq: (c: string, v: string) => { f[c] = v; return q; },
        limit: async () => {
          lidos.push(t);
          if (falhar) return { data: null, error: { message: "rede" } };
          return { data: linhas.filter((l) => l.event_name === f.event_name && l.user_id === f.user_id), error: null };
        },
      };
      return q;
    },
  };
}

describe("podePedirDownsell (lê os pedidos do servidor)", () => {
  const linhas = [
    { event_name: "pix_order_created", user_id: "viu", event_data: { order_id: "q1", offer: "w27" } },
    { event_name: "pix_generated", user_id: "forjou", event_data: { order_id: "q2", offer: "w27" } }, // evento do cliente não vale
    { event_name: "pix_order_created", user_id: "outra", event_data: { order_id: "q3", offer: "lifetime" } },
  ];
  it("quem gerou o Pix cheio pode; o pedido de OUTRA conta não serve; evento do cliente não serve", async () => {
    expect((await podePedirDownsell(bancoFalso(linhas), { userId: "viu", criadoEm: diasAtras(0), agora: AGORA })).ok).toBe(true);
    expect((await podePedirDownsell(bancoFalso(linhas), { userId: "forjou", criadoEm: diasAtras(0), agora: AGORA })).ok).toBe(false);
    expect((await podePedirDownsell(bancoFalso(linhas), { userId: "nova", criadoEm: diasAtras(0), agora: AGORA })).ok).toBe(false);
  });
  it("sem criadoEm → busca no auth (winback)", async () => {
    const db = bancoFalso([], { velha: diasAtras(10), nova: diasAtras(0) });
    expect(await podePedirDownsell(db, { userId: "velha", agora: AGORA })).toEqual({ ok: true, motivo: "winback" });
    expect((await podePedirDownsell(db, { userId: "nova", agora: AGORA })).ok).toBe(false);
  });
  it("erro de leitura dos pedidos → só a regra do winback (conta nova recusa)", async () => {
    expect((await podePedirDownsell(bancoFalso([], {}, true), { userId: "x", criadoEm: diasAtras(0), agora: AGORA })).ok).toBe(false);
    expect((await podePedirDownsell(bancoFalso([], {}, true), { userId: "x", criadoEm: diasAtras(5), agora: AGORA })).ok).toBe(true);
  });
});

describe("os dois creates aplicam a regra antes de criar o Pix", () => {
  it("asaas-pix: downsell passa por podePedirDownsell antes do QR da Asaas; recusa 403", () => {
    const s = fonte("asaas-pix/index.ts");
    const create = s.indexOf('if (action === "create")');
    const regra = s.indexOf("podePedirDownsell(supabaseAdmin", create);
    expect(regra).toBeGreaterThan(create);
    expect(regra).toBeLessThan(s.indexOf("/pix/qrCodes/static", create));
    expect(s.slice(regra, regra + 400)).toMatch(/MENSAGEM_DOWNSELL_INDISPONIVEL, motivo: v\.motivo \}, 403\)/);
  });
  it("cakto-pix: idem, antes de pedir o Pix à Cakto", () => {
    const s = fonte("cakto-pix/index.ts");
    const corpo = s.indexOf("const body = parsed.data;");
    const regra = s.indexOf("podePedirDownsell(supabaseAdmin", corpo);
    expect(regra).toBeGreaterThan(corpo);
    expect(regra).toBeLessThan(s.indexOf("const offerId = OFFER_IDS[body.offer]", corpo));
    expect(s.slice(regra, regra + 300)).toContain("403");
  });
  it("a mensagem é curta e sem jargão", () => {
    expect(MENSAGEM_DOWNSELL_INDISPONIVEL).toBe("Essa oferta não está disponível pra sua conta.");
  });
});
