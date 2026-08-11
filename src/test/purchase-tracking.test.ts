import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * A Meta contou 2 compras num dia de 1 venda (11/08).
 *
 * O usuário 0c8dcc53 pagou o pedido edeb2c33 (downsell, R$19,90). O pixel
 * disparou Purchase com 05461621 — pedido LIFETIME de OUTRA conta (1bde700e),
 * gerada no MESMO aparelho. Como o event_id saiu diferente do que o CAPI
 * mandou, a Meta não deduplicou: 2 compras e R$47,80 onde entraram R$19,90.
 *
 * Isso importa mais do que parecer erro de relatório: a campanha roda com
 * ROAS mínimo, e o piso decide ENTREGA usando a receita que a Meta enxerga.
 * Receita inflada libera gasto que não se paga — é o mesmo cano que a gente
 * consertou dia 10 vazando pro outro lado.
 *
 * Os três defeitos que se somaram, um teste pra cada:
 *   a) o localStorage é do APARELHO — duas sessões misturam pedidos;
 *   b) a consulta da assinatura não filtrava user_id;
 *   c) sem match, caía no "último gerado vence" — adivinhar na hora errada.
 */

const OUTRO = { user: "1bde700e", order: "05461621", offer: "lifetime" as const };
const DONO = { user: "0c8dcc53", order: "edeb2c33", offer: "downsell" as const };

/** Estado que os mocks leem — cada teste monta o seu antes de importar. */
const cenario = {
  uid: null as string | null,
  /** o que a tabela subscriptions devolve PRA ESSA conta (o webhook grava aqui) */
  pagosPorUsuario: {} as Record<string, string[]>,
  /** true = a consulta explodiu (rede caiu no meio do resgate) */
  consultaFalha: false,
};

const metaEvents: Array<{ event: string; params: Record<string, unknown>; eventID?: string }> = [];
const analytics: Array<{ name: string; data: Record<string, unknown> }> = [];
const googleConv: Array<{ transactionId?: string }> = [];

vi.mock("@/lib/meta-pixel", () => ({
  fireMetaEvent: (event: string, params: Record<string, unknown>, eventID?: string) => {
    metaEvents.push({ event, params, eventID });
  },
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: (name: string, data: Record<string, unknown>) => { analytics.push({ name, data }); },
}));
vi.mock("@/lib/google-ads", () => ({
  firePurchaseConversion: (p: { transactionId?: string }) => { googleConv.push(p); },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: cenario.uid ? { session: { user: { id: cenario.uid } } } : { session: null },
      }),
    },
    from: (tabela: string) => {
      if (tabela !== "subscriptions") throw new Error(`tabela inesperada: ${tabela}`);
      let filtrado: string | null = null;
      const builder = {
        select: () => builder,
        // é ESTE eq que faltava: sem ele a consulta lia "a última assinatura
        // que der pra ver", que pode não ser a de quem está logado.
        eq: (col: string, val: string) => { if (col === "user_id") filtrado = val; return builder; },
        limit: async () => {
          if (cenario.consultaFalha) throw new Error("rede caiu");
          if (filtrado === null) throw new Error("consulta SEM filtro de user_id");
          return { data: (cenario.pagosPorUsuario[filtrado] ?? []).map((id) => ({ abacatepay_billing_id: id })) };
        },
      };
      return builder;
    },
  },
}));

const carregar = async () => {
  vi.resetModules();
  return await import("@/lib/purchase-tracking");
};

/** Grava a marca já com dono, do jeito que ela fica depois do carimbo. */
const semear = (marcas: Array<{ offer: "lifetime" | "downsell"; orderId: string; uid: string | null; at?: number }>) => {
  localStorage.setItem("pix-purchase-pending", JSON.stringify(
    marcas.map((m) => ({ ...m, at: m.at ?? Date.now() })),
  ));
};

beforeEach(() => {
  localStorage.clear();
  metaEvents.length = 0;
  analytics.length = 0;
  googleConv.length = 0;
  cenario.uid = null;
  cenario.pagosPorUsuario = {};
  cenario.consultaFalha = false;
});

describe("Purchase do Pix: só dispara o que dá pra provar", () => {
  it("o caso de 11/08 não se repete: pedido de outra conta no mesmo aparelho é ignorado", async () => {
    // as duas contas geraram Pix no mesmo celular; quem pagou foi o DONO
    semear([
      { offer: OUTRO.offer, orderId: OUTRO.order, uid: OUTRO.user },
      { offer: DONO.offer, orderId: DONO.order, uid: DONO.user },
      // e o outro gerou mais um DEPOIS — era este que o "último gerado vence" pegava
      { offer: OUTRO.offer, orderId: "05461621-b", uid: OUTRO.user },
    ]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = [DONO.order];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(true);

    expect(metaEvents).toHaveLength(1);
    // o event_id TEM que ser o mesmo order_id que o CAPI manda, senão a Meta
    // conta duas vezes — foi exatamente o que aconteceu
    expect(metaEvents[0].eventID).toBe(DONO.order);
    expect(metaEvents[0].params.value).toBe(19.9);
    expect(metaEvents[0].params.content_name).toBe("downsell");
  });

  it("sem conseguir provar qual pedido foi pago, NÃO dispara (o CAPI cobre)", async () => {
    // dois Pix da mesma pessoa e nenhum bate com a assinatura: o antigo
    // fallback mandaria o último e inventaria R$27,90
    semear([
      { offer: "downsell", orderId: "aaa", uid: DONO.user },
      { offer: "lifetime", orderId: "bbb", uid: DONO.user },
    ]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = ["outro-pedido-qualquer"];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(false);

    expect(metaEvents).toHaveLength(0);
    expect(googleConv).toHaveLength(0);
    const pulou = analytics.find((e) => e.name === "pix_purchase_skipped");
    expect(pulou?.data.motivo).toBe("pedido_pago_nao_confirmado");
    expect(pulou?.data.candidatos).toBe(2);
  });

  it("Pix gerado e NÃO pago não vira venda quando a pessoa assina por outra via", async () => {
    // candidato único: o atalho antigo dispararia. Ela virou assinante pela
    // loja/cortesia, e a assinatura não aponta pra este pedido.
    semear([{ offer: "lifetime", orderId: "nunca-pago", uid: DONO.user }]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = [];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(false);
    expect(metaEvents).toHaveLength(0);
  });

  it("caminho feliz: um Pix, pago, dispara com o order id certo e o valor certo", async () => {
    semear([{ offer: "lifetime", orderId: "ped-1", uid: DONO.user }]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = ["ped-1"];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("checkout")).toBe(true);
    expect(metaEvents[0].eventID).toBe("ped-1");
    expect(metaEvents[0].params.value).toBe(27.9);
    expect(googleConv[0].transactionId).toBe("ped-1");
  });

  it("marca antiga sem dono ainda vale — desde que a assinatura confirme", async () => {
    // compatibilidade: quem tinha a marca gravada antes deste deploy não perde
    // o disparo, mas continua precisando do match (nunca vence por chute)
    semear([{ offer: "downsell", orderId: "ped-legado", uid: null }]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = ["ped-legado"];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(true);
    expect(metaEvents[0].eventID).toBe("ped-legado");
  });

  it("deslogado não dispara nada — sem saber quem é, não dá pra afirmar", async () => {
    semear([{ offer: "lifetime", orderId: "ped-1", uid: null }]);
    cenario.uid = null;

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(false);
    expect(metaEvents).toHaveLength(0);
  });

  it("marca de mais de 24h não dispara num login futuro", async () => {
    semear([{ offer: "lifetime", orderId: "ped-velho", uid: DONO.user, at: Date.now() - 25 * 60 * 60 * 1000 }]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = ["ped-velho"];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(false);
    expect(metaEvents).toHaveLength(0);
  });

  it("consulta falhou (rede caiu no resgate): não adivinha, pula", async () => {
    semear([{ offer: "lifetime", orderId: "ped-1", uid: DONO.user }]);
    cenario.uid = DONO.user;
    cenario.consultaFalha = true;

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("rescue")).toBe(false);
    expect(metaEvents).toHaveLength(0);
  });

  it("dispara UMA vez só — a segunda chamada não repete a compra", async () => {
    semear([{ offer: "lifetime", orderId: "ped-1", uid: DONO.user }]);
    cenario.uid = DONO.user;
    cenario.pagosPorUsuario[DONO.user] = ["ped-1"];

    const { firePixPurchaseOnce } = await carregar();
    expect(await firePixPurchaseOnce("checkout")).toBe(true);
    expect(await firePixPurchaseOnce("rescue")).toBe(false);
    expect(metaEvents).toHaveLength(1);
  });

  it("markPixPurchasePending grava na hora e carimba o dono logo depois", async () => {
    cenario.uid = DONO.user;
    const { markPixPurchasePending, temPixEmConfirmacao } = await carregar();

    markPixPurchasePending({ offer: "lifetime", orderId: "ped-novo" });
    // síncrono de propósito: o portão do app consulta isso no render seguinte
    // e não pode mostrar paywall pra quem acabou de gerar o Pix
    expect(temPixEmConfirmacao()).toBe(true);

    await vi.waitFor(() => {
      const marcas = JSON.parse(localStorage.getItem("pix-purchase-pending") ?? "[]");
      expect(marcas[0].uid).toBe(DONO.user);
    });
  });
});
