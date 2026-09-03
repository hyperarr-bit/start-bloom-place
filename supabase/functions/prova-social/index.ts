/**
 * PROVA SOCIAL — contagem REAL de quem já comprou.
 *
 * Por que existe (29/07): o funil /inicio não tem uma única prova social. Nem
 * número, nem depoimento, nem nota — e o paywall é onde mais gente morre
 * (599 chegam, 256 abrem o checkout: 43%). BitePal e Cal AI apoiam a decisão
 * em prova; a gente não apoia em nada.
 *
 * Depoimento inventado está FORA — é review falso, dá problema com a Meta e
 * queima o negócio. O que dá pra mostrar sem mentir é o que já aconteceu:
 * quantas pessoas compraram no total e quantas compraram nas últimas 24h.
 *
 * A tabela subscriptions não é legível pelo anon (RLS), daí a função. Cache de
 * 5 min em memória: a instância atende várias chamadas sem bater no banco, e
 * um número 5 minutos velho não muda decisão nenhuma.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; body: { total: number; dia: number } } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (cache && Date.now() - cache.at < CACHE_MS) return json({ ...cache.body, cached: true });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Só compras de verdade da web: os tickets vitalícios. Fora as contas de
    // teste (+qa) e as linhas de assinatura do app (29,90/97,90) que as
    // sessões de teste do dono geram.
    const conta = async (desde?: string) => {
      let q = supabase.from("subscriptions").select("*", { count: "exact", head: true })
        .in("amount_cents", [9790, 2790, 1490])
        .not("customer_email", "ilike", "%+qa%");
      if (desde) q = q.gte("current_period_start", desde);
      const { count } = await q;
      return count ?? 0;
    };

    const ontem = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [total, dia] = await Promise.all([conta(), conta(ontem)]);

    // Se a contagem vier zerada é falha de leitura, não realidade — devolve o
    // cache velho em vez de exibir "0 pessoas" na tela de venda.
    if (total === 0 && cache) return json({ ...cache.body, stale: true });

    cache = { at: Date.now(), body: { total, dia } };
    return json({ total, dia });
  } catch (e) {
    if (cache) return json({ ...cache.body, stale: true });
    return json({ error: (e as Error).message }, 500);
  }
});
