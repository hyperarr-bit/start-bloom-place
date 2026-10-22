/**
 * DE QUEM É ESTE PIX? (revisão de segurança 21/10)
 *
 * O QR estático da Asaas (e o pedido da Cakto da web anônima) não carrega o nosso usuário: o único elo pedido↔conta é
 * o registro `pix_order_created` que o create grava em analytics_events (user_id + order_id + offer). O problema:
 * analytics_events ACEITA insert do próprio cliente (a policy "Users insert own events" deixa qualquer sessão gravar
 * linha com o PRÓPRIO user_id, e qualquer event_name). Os ids da Asaas são quase sequenciais. Com `.limit(1)` sem
 * ordem, uma linha forjada com o id de um pedido alheio podia ser "a" linha lida — e o webhook/check/reconcile
 * creditaria o Pix de outra pessoa na conta de quem forjou (ou com a oferta errada).
 *
 * A trava definitiva é a migração 20261022120000_seguranca_eventos_servidor.sql (cliente não grava mais
 * `pix_order_created` nem os outros eventos que só o servidor escreve). Esta é a segunda trava, no código, que vale
 * mesmo antes da migração e para as linhas que já existem: lê TODAS as linhas do pedido (até 10) e só aceita se elas
 * concordam em conta e oferta. Discordou → ninguém leva (o pedido fica pro suporte/reconcile, com alarme no log).
 * Linha com user_id nulo (o que o papel anon consegue gravar) não conta.
 *
 * Sem Deno: o cliente do banco é uma interface mínima (o mesmo jeito do grant-pix.ts) — testado no vitest
 * (src/test/seguranca/registro-pedido.test.ts).
 */

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export type RegistroPix = { user_id: string | null; event_data: Record<string, unknown> | null };

/** Quantas linhas do mesmo pedido lemos pra conferir se concordam (o create grava UMA). */
export const LIMITE_REGISTROS = 10;

const ofertaDe = (r: RegistroPix): string => String((r.event_data as { offer?: unknown } | null)?.offer ?? "");

/** As linhas de um pedido concordam? Devolve [a linha] ou [] (sem registro ou em conflito). Puro. */
export function escolherRegistro(linhas: RegistroPix[] | null | undefined): { linhas: RegistroPix[]; conflito: boolean } {
  const comDono = (linhas ?? []).filter((r) => !!r && typeof r.user_id === "string" && r.user_id.length > 0);
  if (!comDono.length) return { linhas: [], conflito: false };
  const donos = new Set(comDono.map((r) => r.user_id));
  const ofertas = new Set(comDono.map(ofertaDe).filter(Boolean));
  if (donos.size > 1 || ofertas.size > 1) return { linhas: [], conflito: true };
  return { linhas: [comDono[0]], conflito: false };
}

/**
 * O registro do create deste pedido, no mesmo formato do antigo `{ data: reg }` (array com 0 ou 1 linha), pra trocar
 * a consulta sem mexer no resto de quem chama: `const reg = await registroDoPedido(admin, id)`.
 */
export async function registroDoPedido(
  admin: ClienteMin,
  orderId: string,
  log?: (passo: string, d?: unknown) => void,
): Promise<RegistroPix[]> {
  if (!orderId) return [];
  try {
    const { data } = await admin.from("analytics_events")
      .select("user_id, event_data").eq("event_name", "pix_order_created")
      .contains("event_data", { order_id: orderId }).limit(LIMITE_REGISTROS);
    const r = escolherRegistro((data ?? []) as RegistroPix[]);
    if (r.conflito) log?.("ALARME registro do pedido em conflito (linha forjada?) — não credita", { orderId: orderId.slice(0, 24) });
    return r.linhas;
  } catch {
    return [];
  }
}

/** Pedidos com registros que discordam (pro reconcile, que lê os registros em lote). Puro. */
export function pedidosEmConflito(linhas: Array<{ user_id?: string | null; event_data?: Record<string, unknown> | null }> | null | undefined): Set<string> {
  const porPedido = new Map<string, RegistroPix[]>();
  for (const l of linhas ?? []) {
    const oid = String((l?.event_data as { order_id?: unknown } | null)?.order_id ?? "");
    if (!oid) continue;
    if (!porPedido.has(oid)) porPedido.set(oid, []);
    porPedido.get(oid)!.push({ user_id: l.user_id ?? null, event_data: l.event_data ?? null });
  }
  const out = new Set<string>();
  for (const [oid, ls] of porPedido) if (escolherRegistro(ls).conflito) out.add(oid);
  return out;
}
