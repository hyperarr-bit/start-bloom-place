/**
 * event_id do StartTrial do iPhone no CAPI de app (1.0.19, 25/10) — DESLIGADO por padrão.
 *
 * A 1.0.19 manda "StartTrial" TAMBÉM pelo SDK da Meta no aparelho (pro SKAdNetwork), com
 * event_id = id da transação da Apple (na 1ª compra de uma assinatura = original_transaction_id,
 * que a API v2 do RevenueCat devolve como `store_subscription_identifier`). A Meta junta SDK ×
 * CAPI quando os dois têm o MESMO event_id e o mesmo nome, em até 48 h.
 *
 * Hoje o servidor usa event_id = id da assinatura NO REVENUECAT ("sub…"), que o aparelho não
 * conhece → sem esta chave, os dois NÃO se juntam (a Meta conta 2 inícios de teste por pessoa
 * que comprou num app 1.0.19 com o SDK configurado).
 *
 * Com META_STARTTRIAL_ID_DA_LOJA=on (secret da function), o StartTrial de assinatura da App
 * Store passa a sair com event_id = store_subscription_identifier. Android (play_store), Pix,
 * vitalício e o Purchase NÃO mudam. O marcador de "já enviado" continua pelo tx de sempre.
 *
 * Arquivo puro (sem Deno/URL imports) pra o vitest ler.
 */
export type AssinaturaRC = { id?: string; store?: string | null; store_subscription_identifier?: string | null } | null | undefined;

export const chaveIdDaLojaLigada = (valor: string | null | undefined): boolean =>
  String(valor ?? "").trim().toLowerCase() === "on";

/** O event_id do StartTrial: o original_transaction_id da Apple (chave ligada + App Store), senão o tx de sempre. */
export function eventIdDoStartTrial(txId: string, assinatura: AssinaturaRC, ligado: boolean): string {
  if (!ligado || !assinatura) return txId;
  if (assinatura.id && assinatura.id !== txId) return txId; // outra assinatura: não arrisca
  if (assinatura.store !== "app_store") return txId;
  const loja = String(assinatura.store_subscription_identifier ?? "").trim();
  return /^\d{6,}$/.test(loja) ? loja : txId;
}
