/**
 * STRIPE-STATUS (04/11) — /oferta: a página pergunta se o PaymentIntent dela pagou ({ref, pi}). Só responde se o PI for daquela
 * ref (metadata gravada pelo stripe-criar) e só devolve status/pago/método — nada de e-mail, valor ou cliente.
 * Deploy (NÃO feito): `supabase functions deploy stripe-status`. Secret: STRIPE_SECRET_KEY.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { respostaStatus } from "../_shared/stripe-criar.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false }, 405);
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ref = typeof b.ref === "string" && /^[A-Za-z0-9-]{8,64}$/.test(b.ref) ? b.ref : null;
    const pi = typeof b.pi === "string" && /^pi_[A-Za-z0-9]+$/.test(b.pi) ? b.pi : null;
    if (!ref || !pi) return json({ ok: false }, 400);
    const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!sk) return json({ ok: false }, 503);
    const r = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}?expand[]=latest_charge`, { headers: { Authorization: `Bearer ${sk}` } });
    if (!r.ok) return json({ ok: false }, 404);
    return json(respostaStatus(await r.json(), ref));
  } catch {
    return json({ ok: false }, 500);
  }
});
