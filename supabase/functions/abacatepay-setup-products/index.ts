import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://api.abacatepay.com/v2";

const PRODUCTS = [
  {
    configKey: "abacatepay_product_monthly_v2_id",
    externalId: "core-pro-monthly-v2",
    name: "CORE Pro Mensal",
    description: "Assinatura mensal do CORE Pro - acesso completo a todos os módulos (R$ 14,90/mês)",
    price: 1490,
  },
  {
    configKey: "abacatepay_product_annual_v2_id",
    externalId: "core-pro-annual-v2",
    name: "CORE Pro Anual",
    description: "Assinatura anual do CORE Pro - acesso completo a todos os módulos (R$ 46,80/ano)",
    price: 4680,
  },
  {
    configKey: "abacatepay_product_annual_winback80_v2_id",
    externalId: "core-pro-annual-winback80-v2",
    name: "CORE Pro Anual — Oferta Winback",
    description: "Oferta exclusiva de retenção — R$ 2,90/mês equivalente (R$ 34,80/ano)",
    price: 3480,
  },
];

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ABACATEPAY-SETUP-PRODUCTS] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

async function abacateRequest(path: string, apiKey: string, method: "GET" | "POST" = "POST", body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    log("API error", { status: res.status, path, data });
    throw new Error(`AbacatePay API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function findProductByExternalId(apiKey: string, externalId: string): Promise<string | null> {
  try {
    const resp = await abacateRequest("/products/list", apiKey, "GET");
    const list: Array<{ id: string; externalId?: string }> =
      resp?.data || resp?.products || resp || [];
    const match = Array.isArray(list)
      ? list.find((p) => p.externalId === externalId)
      : null;
    return match?.id ?? null;
  } catch (e) {
    log("findProductByExternalId failed", { externalId, error: (e as Error).message });
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── ADMIN AUTH GUARD ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supaAuth = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authErr } = await supaAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !authData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Use service-role client to check role (bypasses RLS safely server-side)
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleErr || !roleRow) {
      log("Forbidden non-admin attempt", { userId: authData.user.id });
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY not configured");

    const result: Record<string, { id: string; created: boolean; name: string }> = {};

    for (const p of PRODUCTS) {
      const { data: existing } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", p.configKey)
        .maybeSingle();

      const existingId = (existing?.value as { id?: string } | null)?.id;
      if (existingId) {
        log("Product already configured", { key: p.configKey, id: existingId });
        result[p.configKey] = { id: existingId, created: false, name: p.name };
        continue;
      }

      let newId: string | null = await findProductByExternalId(apiKey, p.externalId);
      let created = false;

      if (!newId) {
        log("Creating product on AbacatePay", { name: p.name, externalId: p.externalId });
        const payload = {
          name: p.name,
          description: p.description,
          price: p.price,
          currency: "BRL",
          externalId: p.externalId,
        };
        const resp = await abacateRequest("/products/create", apiKey, "POST", payload);
        newId = resp?.data?.id || resp?.id || null;
        if (!newId) throw new Error(`No product id returned for ${p.name}: ${JSON.stringify(resp)}`);
        created = true;
      } else {
        log("Found existing product on AbacatePay", { externalId: p.externalId, id: newId });
      }

      const { error: upsertErr } = await supabase
        .from("app_config")
        .upsert({ key: p.configKey, value: { id: newId, externalId: p.externalId, name: p.name } });
      if (upsertErr) throw new Error(`Failed to save app_config: ${upsertErr.message}`);

      log("Product saved to app_config", { key: p.configKey, id: newId, created });
      result[p.configKey] = { id: newId, created, name: p.name };
    }

    return jsonResponse({ ok: true, products: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return jsonResponse({ error: msg }, 500);
  }
});
