/**
 * BOAS-VINDAS DO FUNIL /hoje (18/10) — UMA vez por pedido.
 *
 * No /hoje o Pix nasce numa sessão ANÔNIMA, sem e-mail (decisão do dono: o e-mail vem DEPOIS de pagar). Então quando
 * o pagamento é creditado (check da página, asaas-webhook ou pix-reconcile) quase sempre ainda não existe e-mail pra
 * mandar as boas-vindas. Quem manda é a página, depois que a pessoa salva o e-mail (asaas-pix `boas_vindas`). Se a
 * conta JÁ tinha e-mail na hora do crédito (pessoa logada), o check/webhook mandam na hora.
 *
 * Os dois caminhos podem correr juntos → a reserva é uma chave primária em webhook_events (`hoje-email:<pedido>`):
 * só quem insere manda. Falhou o envio → solta a reserva (a próxima tentativa manda). Erro desconhecido no insert
 * → NÃO manda (melhor faltar um e-mail do que mandar dois; a tela já mostra tudo que o e-mail diz).
 *
 * Puro, a não ser pelo cliente passado (interface mínima) — testado no vitest (src/test/funil-hoje-servidor.test.ts).
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export const chaveBoasVindas = (orderId: string): string => `hoje-email:${orderId}`;

/** true = esta chamada pode mandar (a reserva é dela). */
export async function reservarBoasVindas(admin: ClienteMin, orderId: string): Promise<boolean> {
  if (!orderId) return false;
  try {
    const { error } = await admin.from("webhook_events").insert({ id: chaveBoasVindas(orderId), source: "hoje", event: "boas_vindas" });
    return !error;
  } catch {
    return false;
  }
}

/** O envio falhou: solta a reserva pra a próxima tentativa mandar. */
export async function soltarBoasVindas(admin: ClienteMin, orderId: string): Promise<void> {
  try { await admin.from("webhook_events").delete().eq("id", chaveBoasVindas(orderId)); } catch { /* noop */ }
}
