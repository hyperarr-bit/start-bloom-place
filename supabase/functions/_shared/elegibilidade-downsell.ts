/**
 * QUEM PODE PEDIR O DOWNSELL (vitalício com desconto — R$ 14,90 na Asaas, R$ 19,90 na Cakto) — segurança, 21/10.
 *
 * O downsell é o "prêmio" de quem JÁ viu o preço cheio e não comprou: o e-mail de recuperação (/planos?oferta=ds), o
 * winback da web (quem teve o teste e não assinou) e as fugas antigas do paywall (roleta, hoje desligadas). Até aqui o
 * servidor aceitava `offer: "downsell"` de QUALQUER conta — o vitalício saía por R$ 14,90 pra quem pedisse direto.
 *
 * Regra (no servidor, no create): a conta pode pedir o downsell se
 *   1. já gerou um Pix de PREÇO CHEIO (registro `pix_order_created` que só o servidor grava — migração
 *      20261022120000), ou
 *   2. existe há pelo menos DIAS_WINBACK dias (o público do winback: o teste acabou e não assinou).
 * Fora disso: 403 "oferta indisponível". O resto do checkout não muda.
 *
 * Sem Deno: o cliente do banco é uma interface mínima (o mesmo jeito do grant-pix.ts) — testado no vitest
 * (src/test/seguranca/downsell-elegibilidade.test.ts).
 */

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any; auth?: any };

export const OFERTA_DOWNSELL = "downsell";
export const ehDownsell = (o: string | null | undefined): boolean => o === OFERTA_DOWNSELL;

/** As compras principais de preço cheio: ter gerado o Pix de uma delas = viu o preço e não pagou. */
export const OFERTAS_PRECO_CHEIO: readonly string[] = [
  "lifetime", "w97", "w47", "w27", "w25", "a97", "a69", "h279", "h149", "h279k", "h149k", "hv279",
];
/** Idade mínima da conta pro winback (o teste grátis da web é de 3 dias). */
export const DIAS_WINBACK = 3;

export type Veredito = { ok: true; motivo: "recusou_preco_cheio" | "winback" } | { ok: false; motivo: "fora_do_fluxo" };

/** Puro: decide com o que o servidor já leu. */
export function downsellPermitido(a: {
  criadoEm: string | null | undefined;
  agora: Date;
  pedidosAnteriores: Array<{ event_data?: Record<string, unknown> | null } | null> | null | undefined;
}): Veredito {
  const viuCheio = (a.pedidosAnteriores ?? []).some((r) => {
    const o = String((r?.event_data as { offer?: unknown } | null | undefined)?.offer ?? "");
    return OFERTAS_PRECO_CHEIO.includes(o);
  });
  if (viuCheio) return { ok: true, motivo: "recusou_preco_cheio" };
  const t = a.criadoEm ? Date.parse(a.criadoEm) : NaN;
  if (Number.isFinite(t) && a.agora.getTime() - t >= DIAS_WINBACK * 86_400_000) return { ok: true, motivo: "winback" };
  return { ok: false, motivo: "fora_do_fluxo" };
}

/**
 * Lê os pedidos da conta (só os do servidor) e decide. `criadoEm` vem do usuário autenticado; sem ele, busca pelo
 * auth admin. Erro de leitura = não permite (o checkout mostra "oferta indisponível"; ninguém paga o valor errado).
 */
export async function podePedirDownsell(admin: ClienteMin, a: { userId: string; criadoEm?: string | null; agora?: Date }): Promise<Veredito> {
  const agora = a.agora ?? new Date();
  let criadoEm = a.criadoEm ?? null;
  try {
    if (!criadoEm && admin.auth?.admin?.getUserById) {
      const { data } = await admin.auth.admin.getUserById(a.userId);
      criadoEm = (data?.user?.created_at as string | undefined) ?? null;
    }
    const { data, error } = await admin.from("analytics_events")
      .select("event_data").eq("event_name", "pix_order_created").eq("user_id", a.userId).limit(50);
    if (error) return downsellPermitido({ criadoEm, agora, pedidosAnteriores: [] });
    return downsellPermitido({ criadoEm, agora, pedidosAnteriores: data ?? [] });
  } catch {
    return downsellPermitido({ criadoEm, agora, pedidosAnteriores: [] });
  }
}

export const MENSAGEM_DOWNSELL_INDISPONIVEL = "Essa oferta não está disponível pra sua conta.";
