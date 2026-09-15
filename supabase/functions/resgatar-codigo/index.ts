/**
 * RESGATE DE CÓDIGO — "segue no Instagram e ganha 7 dias" (14/09).
 *
 * A campanha de seguidores entrega um código pelo Direct; a pessoa instala
 * o app, digita o código no paywall (ou em Planos, se já tem conta) e ganha
 * N dias de acesso SEM cartão e sem passar pela folha do Google. O acesso é
 * uma linha em `subscriptions` com `payment_method = "codigo"` — o
 * check-subscription já lê essa tabela, então nada mais precisa saber do
 * código. Quando `current_period_end` passa, a conta cai no paywall como
 * qualquer conta pós-paywall (sem grace: ver check-subscription).
 *
 * Duas chamadas, mesma rota:
 *  - { codigo, apenasValidar: true } — SEM login. O paywall de entrada roda
 *    antes do cadastro (v48: conta nasce depois de "pagar"), então ele só
 *    confere se o código existe e está no prazo, guarda no aparelho e segue
 *    pro cadastro. Não gasta uso nem cria nada.
 *  - { codigo } — COM login. Cria o acesso. Um código por pessoa, na vida:
 *    quem já resgatou qualquer código ("ja_usado") ou já tem acesso ativo
 *    ("ja_tem_acesso") não ganha de novo.
 *
 * Os códigos moram aqui embaixo (CODIGOS) e/ou no secret CODIGOS_PROMO
 * (JSON com o mesmo formato) — o secret ganha, pra criar código novo sem
 * redeploy. Não existe tabela de códigos: a conta não tem migração (sem
 * senha do banco), e o teto de usos sai da própria `subscriptions`
 * (linhas com billing_period = código).
 *
 * Não roda no iPhone: a Apple proíbe destravar recurso por código próprio
 * (3.1.1) — o app esconde a entrada lá; aqui a regra é a mesma por
 * plataforma declarada no corpo, pra um POST na mão não furar.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface Codigo {
  dias: number;
  /** último dia em que o código pode ser resgatado (YYYY-MM-DD, BRT) */
  ate: string;
  /** máximo de resgates; passou, "esgotado" */
  teto: number;
  /** de onde veio, pro relatório (vai no evento) */
  origem: string;
}

const CODIGOS: Record<string, Codigo> = {
  INSTA7: { dias: 7, ate: "2026-12-31", teto: 5000, origem: "instagram_seguidor" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

const log = (passo: string, d?: unknown) => console.log(`[RESGATAR-CODIGO] ${passo}${d ? " - " + JSON.stringify(d) : ""}`);

const normalizar = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);

const tabela = (): Record<string, Codigo> => {
  let extra: Record<string, Codigo> = {};
  try {
    const cru = Deno.env.get("CODIGOS_PROMO");
    if (cru) extra = JSON.parse(cru);
  } catch (e) {
    log("CODIGOS_PROMO inválido, ignorado", { erro: String(e) });
  }
  return { ...CODIGOS, ...extra };
};

/** hoje em BRT, YYYY-MM-DD — a validade é "até o fim do dia no Brasil" */
const hojeBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const codigo = normalizar(body.codigo);
    const apenasValidar = body.apenasValidar === true;
    if (String(body.plataforma ?? "") === "ios") return json({ erro: "plataforma" }, 400);

    const regra = codigo ? tabela()[codigo] : undefined;
    if (!regra) return json({ erro: "invalido" }, 200);
    if (hojeBRT() > regra.ate) return json({ erro: "vencido" }, 200);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // teto: quantas linhas esse código já gerou
    const { count } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("payment_method", "codigo")
      .eq("billing_period", codigo);
    if ((count ?? 0) >= regra.teto) return json({ erro: "esgotado" }, 200);

    if (apenasValidar) return json({ valido: true, dias: regra.dias, codigo });

    // Daqui pra baixo precisa de quem é
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: authData } = await anon.auth.getUser(token);
    const user = authData?.user;
    if (!user) return json({ erro: "sem_login" }, 401);

    const { data: linhas } = await admin
      .from("subscriptions")
      .select("id, status, current_period_end, payment_method")
      .eq("user_id", user.id);
    const agora = new Date();
    const lista = linhas ?? [];
    if (lista.some((l) => l.payment_method === "codigo")) return json({ erro: "ja_usado" }, 200);
    const ativa = lista.find((l) =>
      ["active", "past_due", "cancel_scheduled"].includes(l.status) &&
      (!l.current_period_end || new Date(l.current_period_end) > agora)
    );
    if (ativa) return json({ erro: "ja_tem_acesso" }, 200);

    const fim = new Date(agora.getTime() + regra.dias * 86400_000);
    const payload = {
      user_id: user.id,
      status: "active",
      plan: "codigo",
      billing_period: codigo,
      payment_method: "codigo",
      customer_email: user.email ?? null,
      amount_cents: 0,
      current_period_start: agora.toISOString(),
      current_period_end: fim.toISOString(),
    };
    // Uma linha por pessoa (é como o liberar_vitalicio e o webhook tratam a
    // tabela): se existe linha vencida/cancelada, vira a do código.
    const existente = lista[0];
    const { error } = existente
      ? await admin.from("subscriptions").update(payload).eq("id", existente.id)
      : await admin.from("subscriptions").insert(payload);
    if (error) {
      log("falha ao gravar", { erro: error.message });
      return json({ erro: "gravar" }, 500);
    }

    // relatório: quantos resgataram por código/origem (sem e-mail no evento)
    await admin.from("analytics_events").insert({
      user_id: user.id,
      session_id: String(body.sessao ?? "").slice(0, 80) || null,
      event_name: "codigo_resgatado",
      event_data: { codigo, dias: regra.dias, origem: regra.origem, plataforma: String(body.plataforma ?? "").slice(0, 20) },
    }).then(({ error: e }) => { if (e) log("evento não gravou", { erro: e.message }); });

    log("resgatado", { uid: user.id, codigo, dias: regra.dias, ate: fim.toISOString() });
    return json({ ok: true, dias: regra.dias, ate: fim.toISOString(), codigo });
  } catch (e) {
    log("erro", { erro: String(e) });
    return json({ erro: "interno" }, 500);
  }
});
