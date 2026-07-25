import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * EXCLUSÃO DE CONTA (24/07) — exigência do Google Play para qualquer app que
 * permite criar conta: a pessoa tem que conseguir apagar conta E dados de
 * dentro do app, e existir uma URL pública explicando o mesmo caminho
 * (/excluir-conta). Sem isso a ficha do app é reprovada na revisão.
 *
 * Como apaga: as tabelas com FK pra auth.users já são ON DELETE CASCADE, mas
 * as que guardam user_id "solto" (analytics, ativações) não somem sozinhas —
 * por isso a varredura explícita antes do deleteUser. Cada delete é
 * best-effort: tabela que não existir mais não pode travar a exclusão.
 *
 * Assinatura ativa da loja NÃO é cancelada por aqui (só o Google/Play pode) —
 * a resposta avisa, e a tela do app repete o aviso antes de confirmar.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DELETE-ACCOUNT] ${step}${d}`);
};

// Tudo que carrega user_id. Ordem não importa (o cascade cobre o resto).
const TABELAS_USER_ID = [
  "analytics_events",
  "module_analytics",
  "user_activations",
  "user_data",
  "subscriptions",
  "cancel_attempts",
  "winback_attempts",
  "retention_offers_used",
  "support_tickets",
  "push_subscriptions",
  "trial_email_schedule",
  "user_roles",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Confirmação explícita no corpo: evita exclusão por chamada acidental
    // (retry de rede, botão duplo) — a tela manda { confirmar: true }.
    const body = await req.json().catch(() => ({}));
    if (body?.confirmar !== true) {
      return new Response(JSON.stringify({ error: "confirmacao_ausente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Excluindo", { user_id: user.id });

    const falhas: string[] = [];
    for (const tabela of TABELAS_USER_ID) {
      const { error } = await admin.from(tabela).delete().eq("user_id", user.id);
      if (error && !/does not exist|schema cache|column/i.test(error.message)) {
        falhas.push(`${tabela}:${error.message}`);
      }
    }
    // profiles usa o id do usuário como PK (não user_id).
    await admin.from("profiles").delete().eq("id", user.id);
    // Indicações referenciam o usuário por dois lados.
    await admin.from("referral_rewards").delete().eq("referrer_id", user.id);
    await admin.from("referral_rewards").delete().eq("referred_id", user.id);

    if (falhas.length) log("Falhas parciais (segue pro deleteUser)", falhas);

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error(`deleteUser: ${delErr.message}`);

    log("Conta excluída", { user_id: user.id });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERRO", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
