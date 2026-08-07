import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * ONE-OFF de configuração (06/08): registra `core_vitalicio` no RevenueCat e
 * anexa ao entitlement, pra compra única aparecer em /customers/{id}/purchases
 * com produto reconhecido e o Restaurar compras devolver acesso no cliente.
 * Idempotente (409/conflito = já existe, segue). Só admin invoca.
 */
const RC = "https://api.revenuecat.com/v2";
const PROJETO = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "proj1f095041";

serve(async (req) => {
  if (req.method !== "POST") return new Response("método", { status: 405 });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: quem } = await supabase.auth.getUser(jwt);
  if (!quem?.user) return Response.json({ error: "não autenticado" }, { status: 401 });
  const { data: ehAdmin } = await supabase.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
  if (!ehAdmin) return Response.json({ error: "não autorizado" }, { status: 403 });

  const secret = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  if (!secret) return Response.json({ error: "sem REVENUECAT_SECRET_KEY" }, { status: 500 });
  const h = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  const passo: Record<string, unknown> = {};

  // 1) app Android do projeto
  const apps = await (await fetch(`${RC}/projects/${PROJETO}/apps`, { headers: h })).json();
  const appPlay = (apps?.items ?? []).find((a: any) => a?.type === "play_store");
  if (!appPlay) return Response.json({ error: "app play_store não achado", apps }, { status: 500 });
  passo.app = appPlay.id;

  // 2) produto core_vitalicio (cria se não existir)
  const prods = await (await fetch(`${RC}/projects/${PROJETO}/products?limit=100`, { headers: h })).json();
  let prod = (prods?.items ?? []).find((p: any) => p?.store_identifier === "core_vitalicio");
  if (!prod) {
    const r = await fetch(`${RC}/projects/${PROJETO}/products`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        store_identifier: "core_vitalicio",
        app_id: appPlay.id,
        type: "one_time",
        display_name: "CORE vitalício",
      }),
    });
    prod = await r.json();
    passo.produto_criado = r.status;
  } else {
    passo.produto_criado = "ja_existia";
  }
  if (!prod?.id) return Response.json({ error: "produto sem id", prod }, { status: 500 });
  passo.produto = prod.id;

  // 3) anexa ao(s) entitlement(s)
  const ents = await (await fetch(`${RC}/projects/${PROJETO}/entitlements?limit=20`, { headers: h })).json();
  const anexos: Record<string, unknown> = {};
  for (const e of ents?.items ?? []) {
    const r = await fetch(`${RC}/projects/${PROJETO}/entitlements/${e.id}/actions/attach_products`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ product_ids: [prod.id] }),
    });
    anexos[e.lookup_key ?? e.id] = r.status; // 409/422 = já anexado, tudo bem
  }
  passo.entitlements = anexos;

  return Response.json({ ok: true, ...passo });
});
