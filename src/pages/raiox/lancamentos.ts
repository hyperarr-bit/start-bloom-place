/**
 * Lançamentos do extrato na conta — o mesmo carimbo do ImportExtrato, pra o "Desfazer" achar.
 * Só roda depois do pagamento E do checkbox. Antes disso, nada daqui é chamado.
 */
import { supabase } from "@/integrations/supabase/client";
import { suggestPaymentMethod } from "@/lib/extrato-parser";
import type { TxClassificada } from "./vazamentos";

/** A mesma string de CHAVE_ULTIMA_IMPORTACAO em components/finance/ImportExtrato.tsx. */
export const CHAVE_ULTIMA_IMPORTACAO = "finance-ultima-importacao";
export const CHAVE_GASTOS = "finance-expenses";

export function montarGastos(txs: TxClassificada[], stamp: number) {
  return txs.map((r, i) => {
    const metodo = suggestPaymentMethod(r.description);
    return {
      id: `${stamp}-e${i}`,
      date: r.date.slice(0, 10),
      value: Math.abs(r.amount),
      description: r.description.slice(0, 60),
      category: r.category || "outros",
      paymentMethod: metodo,
    };
  });
}

export async function gravarLancamentosNaConta(txs: TxClassificada[], stamp = Date.now()): Promise<boolean> {
  if (!txs.length) return false;
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return false;
  const gastos = montarGastos(txs, stamp);
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => { maybeSingle: () => Promise<{ data: { value?: unknown } | null }> } } };
      upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: { message?: string } | null }>;
    };
  };
  let atuais: unknown[] = [];
  try {
    const { data: row } = await client.from("user_data").select("value").eq("user_id", uid).eq("key", CHAVE_GASTOS).maybeSingle();
    if (Array.isArray(row?.value)) atuais = row.value;
  } catch { /* conta nova: começa vazio */ }
  const lista = [...atuais, ...gastos];
  const up1 = await client.from("user_data").upsert({ user_id: uid, key: CHAVE_GASTOS, value: lista }, { onConflict: "user_id,key" });
  const up2 = await client.from("user_data").upsert(
    { user_id: uid, key: CHAVE_ULTIMA_IMPORTACAO, value: { stamp, gastos: gastos.length, receitas: 0, quando: new Date().toISOString() } },
    { onConflict: "user_id,key" },
  );
  return !up1.error && !up2.error;
}
