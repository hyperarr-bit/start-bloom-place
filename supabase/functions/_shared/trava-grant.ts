/**
 * TRAVA DO GRANT DE UM PEDIDO + CONFERÊNCIA DO VALOR (15/10, revisão da venda da web).
 *
 * O problema: o MESMO Pix pago passa por até 3 caminhos que creditam — o `check` da página (asaas-pix, a cada 3 s),
 * o webhook da Asaas e o pix-reconcile (cron). Cada um lia as linhas e escrevia; dois ao mesmo tempo viam "nada
 * creditado" e os dois creditavam (oferta com prazo: 2 anos + 2 e-mails). A regra de `ja_creditado`
 * (linha-pix.ts) cobre quem chega DEPOIS; esta trava cobre quem chega JUNTO:
 *
 *   · antes de escrever, insere `grant:<gateway>:<pedido>` em webhook_events (chave primária = só um consegue);
 *   · conseguiu → credita; deu erro no grant → SOLTA a trava (o próximo caminho tenta de novo);
 *   · não conseguiu (outro está creditando ou já creditou) → quem chamou relê as linhas: tem a linha do pedido =
 *     "já creditado" (não escreve, não manda e-mail/CAPI/UTMify); não tem = em andamento (o check tenta de novo);
 *   · trava sem linha há mais de TRAVA_VELHA_MS (o caminho morreu no meio) é velha: apaga e tenta 1x de novo.
 *   · erro desconhecido no insert (tabela fora) → segue SEM trava (o comportamento de antes): melhor creditar do que
 *     prender um pagamento.
 *
 * Valor: grant só se o pagamento cobre o preço da OFERTA DELE (centavos de cada oferta, nunca um número fixo).
 *
 * Puro, a não ser pelo cliente passado (interface mínima) — testado no vitest (src/test/pix-um-credito.test.ts).
 */
export const TRAVA_VELHA_MS = 2 * 60_000;

export const chaveTrava = (gateway: string, orderId: string): string => `grant:${gateway}:${orderId}`;

/** O pagamento cobre o preço da oferta? `valorReais` como vem do gateway (Asaas: `value` em reais). */
export function valorCobre(valorReais: unknown, precoCentavos: number | null | undefined): boolean {
  const v = typeof valorReais === "number" ? valorReais : typeof valorReais === "string" ? Number(valorReais) : NaN;
  if (!Number.isFinite(v) || !precoCentavos || precoCentavos <= 0) return false;
  return Math.round(v * 100) >= precoCentavos;
}

type Erro = { code?: string; message?: string } | null;
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type Trava = "pegou" | "ocupada" | "sem_trava";

/** Tenta pegar a trava do pedido. */
export async function pegarTrava(admin: ClienteMin, gateway: string, orderId: string, agoraMs: number = Date.now()): Promise<Trava> {
  const id = chaveTrava(gateway, orderId);
  const inserir = async (): Promise<Erro> => {
    try {
      const { error } = await admin.from("webhook_events").insert({ id, source: "grant", event: gateway });
      return (error as Erro) ?? null;
    } catch (e) {
      return { message: String(e) };
    }
  };
  let erro = await inserir();
  if (!erro) return "pegou";
  if (erro.code !== "23505") return "sem_trava";
  // já existe: velha (o caminho morreu no meio)? apaga só ESSA (mesmo processed_at) e tenta de novo, 1x
  try {
    const { data } = await admin.from("webhook_events").select("processed_at").eq("id", id).maybeSingle();
    const em = data?.processed_at ? Date.parse(String(data.processed_at)) : NaN;
    if (Number.isFinite(em) && agoraMs - em > TRAVA_VELHA_MS) {
      await admin.from("webhook_events").delete().eq("id", id).eq("processed_at", data.processed_at);
      erro = await inserir();
      if (!erro) return "pegou";
      if (erro.code !== "23505") return "sem_trava";
    }
  } catch { /* fica ocupada */ }
  return "ocupada";
}

/** Solta a trava (grant falhou): o próximo caminho pode creditar. Nunca lança. */
export async function soltarTrava(admin: ClienteMin, gateway: string, orderId: string): Promise<void> {
  try { await admin.from("webhook_events").delete().eq("id", chaveTrava(gateway, orderId)); } catch { /* noop */ }
}
