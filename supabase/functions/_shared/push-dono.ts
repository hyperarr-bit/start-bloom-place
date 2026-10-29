/**
 * Manda um push pra TODOS os aparelhos do dono (tabela push_dono) — usado pelo avisar-venda e pelo "Mandar aviso de
 * teste" do vendas-push. Inscrição morta (404/410) sai da tabela; falha comum soma em `falhas`.
 */
import { enviarPush, type ChavesVapid } from "./webpush.ts";

type Cliente = { from: (t: string) => any };
type Aparelho = { id: string; endpoint: string; p256dh: string; auth: string; falhas: number | null };

export function chavesVapidDoAmbiente(env: { get: (k: string) => string | undefined } = (globalThis as any).Deno?.env): ChavesVapid | null {
  const publica = env?.get("VAPID_PUBLIC_KEY"), privada = env?.get("VAPID_PRIVATE_KEY");
  if (!publica || !privada) return null;
  return { publica, privada, subject: env.get("VAPID_SUBJECT") || "mailto:contato@coreaplicativo.com.br" };
}

export async function mandarParaTodos(admin: Cliente, chaves: ChavesVapid | null, dados: Record<string, unknown>, f: typeof fetch = fetch): Promise<number> {
  if (!chaves) { console.log("[PUSH-DONO] sem_vapid"); return 0; }
  const { data } = await admin.from("push_dono").select("id,endpoint,p256dh,auth,falhas");
  let ok = 0;
  for (const a of (data ?? []) as Aparelho[]) {
    try {
      const r = await enviarPush(a, dados, chaves, f);
      if (r.ok) { ok++; await admin.from("push_dono").update({ ultimo_ok: new Date().toISOString(), falhas: 0 }).eq("id", a.id); }
      else if (r.remover) await admin.from("push_dono").delete().eq("id", a.id);
      else { await admin.from("push_dono").update({ falhas: (a.falhas ?? 0) + 1 }).eq("id", a.id); console.log(`[PUSH-DONO] recusado ${r.status}`); }
    } catch (e) {
      console.log(`[PUSH-DONO] erro ${String(e).slice(0, 120)}`);
    }
  }
  return ok;
}
