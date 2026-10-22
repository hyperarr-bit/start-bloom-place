/**
 * UPSELL "SEU 2027 JÁ ORGANIZADO" (21/10) — o lado do servidor.
 *
 * Quem acabou de pagar o vitalício (R$ 27,90) no /inicio ou no /hoje vê a oferta e paga um Pix de R$ 19,90 (oferta
 * `u2027`, Asaas). NÃO é assinatura (fica fora de CONCESSAO): o pagamento confirmado grava a chave da CONTA
 * `core-pacote-2027` em user_data na conta de QUEM PAGOU — o mesmo jeito do Kit Primeiro Mês (`core-kit-primeiro-mes`).
 * O app lê a chave e mostra a aba "SEU 2027" (src/lib/pacote-2027.ts). Sem a chave, nada do pacote aparece.
 *
 * Os 3 caminhos que confirmam Pix da Asaas (asaas-pix `check`, asaas-webhook, pix-reconcile) chamam
 * `confirmarPacote2027`: grava a chave (idempotente) e manda o Purchase 19,90 1x por pedido (trava própria em
 * webhook_events, como o casal e o presente). Conta anônima que depois entra numa conta existente: o pix-vincular copia
 * o user_data da anônima (copiar-dados-anonima) e a página grava a chave de novo na conta final.
 *
 * Sem Deno: o cliente do banco é uma interface mínima (o mesmo jeito do grant-pix.ts) — testado no vitest com um banco
 * falso (src/test/pacote-2027-servidor.test.ts).
 */
import { OFERTA_2027, PRECOS_HOJE, eh2027 } from "./ofertas-hoje.ts";

export { OFERTA_2027, eh2027 };
export const PRECO_2027_CENTAVOS = PRECOS_HOJE[OFERTA_2027];
/** A chave da conta que o app lê (src/lib/pacote-2027.ts CHAVE_PACOTE_2027). */
export const CHAVE_PACOTE_2027 = "core-pacote-2027";
/** Trava do Purchase: o pedido não vira linha de assinatura, então a trava "1 pedido = 1 crédito" não serve. */
export const chaveCapi2027 = (orderId: string): string => `u2027-capi:${orderId}`;

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type Liberacao2027 = "liberado" | "ja_tinha" | "falhou";

/** O pacote liberado na conta? (o mesmo critério do app: só `comprado === true`). */
export const pacoteLiberado = (v: unknown): boolean =>
  !!v && typeof v === "object" && (v as { comprado?: unknown }).comprado === true;

/** Grava o pacote na conta de quem pagou. Idempotente: quem já tem fica como está. Nunca lança. */
export async function liberarPacote2027(
  admin: ClienteMin, a: { userId: string; orderId: string; agora?: Date; origem?: string },
): Promise<Liberacao2027> {
  try {
    const { data } = await admin.from("user_data").select("value").eq("user_id", a.userId).eq("key", CHAVE_PACOTE_2027).maybeSingle();
    if (pacoteLiberado((data as { value?: unknown } | null)?.value)) return "ja_tinha";
    const { error } = await admin.from("user_data").upsert(
      { user_id: a.userId, key: CHAVE_PACOTE_2027, value: { comprado: true, em: (a.agora ?? new Date()).toISOString(), pedido: a.orderId, origem: a.origem ?? "upsell" } },
      { onConflict: "user_id,key" },
    );
    return error ? "falhou" : "liberado";
  } catch { return "falhou"; }
}

/** Reserva o Purchase deste pedido (chave primária em webhook_events = só um caminho manda). */
export async function reservarCapi2027(admin: ClienteMin, orderId: string): Promise<boolean> {
  try {
    const { error } = await admin.from("webhook_events").insert({ id: chaveCapi2027(orderId), source: "hoje", event: "u2027_capi" });
    return !error;
  } catch { return false; }
}

/**
 * O pagamento do pacote confirmado (qualquer um dos 3 caminhos): grava o pacote e, só na 1ª vez por pedido, chama
 * `enviarCompra` (UTMify + CAPI da função). Gravou mal → "falhou" e NÃO manda nada (o próximo caminho tenta de novo).
 */
export async function confirmarPacote2027(
  admin: ClienteMin,
  a: { userId: string; orderId: string; agora?: Date; origem?: string; enviarCompra: () => Promise<unknown> },
): Promise<{ r: Liberacao2027; compraEnviada: boolean }> {
  const r = await liberarPacote2027(admin, a);
  if (r === "falhou") return { r, compraEnviada: false };
  if (!(await reservarCapi2027(admin, a.orderId))) return { r, compraEnviada: false };
  try { await a.enviarCompra(); } catch { /* sinal nunca derruba a entrega */ }
  return { r, compraEnviada: true };
}

/** IP + user-agent do comprador, gravados no `pix_order_created` (o webhook/reconcile são chamados pela Asaas/cron). */
export const ipUaDoPedido = (reg: Record<string, unknown> | null | undefined): { ip: string | null; ua: string | null } => ({
  ip: typeof reg?.client_ip === "string" ? reg.client_ip : null,
  ua: typeof reg?.user_agent === "string" ? reg.user_agent : null,
});
