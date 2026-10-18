/**
 * OS DADOS DO DIA 1 VÃO JUNTO COM A COMPRA (funil da missão, 18/10).
 *
 * No /missao a convidada monta o dia 1 SEM conta (guest:* no navegador). "Pagar com Pix" abre a sessão ANÔNIMA e o
 * useUserData sobe tudo pro user_data dela (e apaga os guest:*). Se depois ela digita um e-mail que JÁ TEM conta, entra
 * nessa conta com o código — e o pix-vincular (ou o destino do e-mail opcional da tela do Pix, destino-hoje) leva a
 * COMPRA. Sem este passo, o que ela montou (renda, contas, a rotina, o 1º gasto…) ficava preso na anônima.
 *
 * Regra: copia da anônima pra conta de destino SÓ as chaves que o destino não tem — ou que tem VAZIAS (null, [], {},
 * ""). Nunca sobrescreve dado de verdade da conta antiga. A anônima não é apagada (o suporte ainda enxerga).
 * Nunca lança: devolve quantas chaves copiou (ou -1 se a leitura/escrita falhou).
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any };

export const vazio = (v: unknown): boolean =>
  v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

export async function copiarDadosDaAnonima(admin: Admin, de: string, para: string): Promise<number> {
  if (!de || !para || de === para) return 0;
  try {
    const { data: origem, error: e1 } = await admin.from("user_data").select("key, value").eq("user_id", de).limit(2000);
    if (e1) return -1;
    const linhas = ((origem ?? []) as Array<{ key: string; value: unknown }>).filter((r) => !vazio(r.value));
    if (!linhas.length) return 0;
    const { data: destino, error: e2 } = await admin.from("user_data").select("key, value").eq("user_id", para).in("key", linhas.map((r) => r.key));
    if (e2) return -1;
    const cheias = new Set(((destino ?? []) as Array<{ key: string; value: unknown }>).filter((r) => !vazio(r.value)).map((r) => r.key));
    const novas = linhas.filter((r) => !cheias.has(r.key)).map((r) => ({ user_id: para, key: r.key, value: r.value }));
    for (let i = 0; i < novas.length; i += 50) {
      const { error } = await admin.from("user_data").upsert(novas.slice(i, i + 50), { onConflict: "user_id,key" });
      if (error) return -1;
    }
    return novas.length;
  } catch {
    return -1;
  }
}
