import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Diagnóstico de ATRIBUIÇÃO DO APP (08/08): descobre, com o token de anúncios
 * que já existe no projeto, qual App ID da Meta a campanha de instalação
 * promove e quais fontes de dados (datasets) esse app tem. Sem isso, ligar
 * CAPI de app vira caça ao tesouro no painel.
 *
 * Read-only, admin-only. Não manda evento nenhum pra Meta.
 */
const G = "https://graph.facebook.com/v21.0";

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

  const token = Deno.env.get("META_ADS_TOKEN") ?? "";
  const conta = Deno.env.get("META_AD_ACCOUNT_ID") ?? "";
  if (!token || !conta) return Response.json({ error: "faltam META_ADS_TOKEN/META_AD_ACCOUNT_ID" }, { status: 500 });

  const pegar = async (path: string) => {
    try {
      const r = await fetch(`${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${token}`);
      const j = await r.json();
      return j?.error ? { erro: j.error.message?.slice(0, 160) } : j;
    } catch (e) {
      return { erro: String(e).slice(0, 120) };
    }
  };

  const out: Record<string, unknown> = {};

  // 1) campanhas ativas e o que elas promovem (promoted_object traz o application_id)
  const camps = await pegar(`${conta}/campaigns?fields=name,objective,status,promoted_object&limit=25`);
  out.campanhas = (camps?.data ?? camps);

  // 2) apps que a conta pode anunciar
  out.apps_da_conta = await pegar(`${conta}/advertisable_applications?fields=id,name,object_store_urls&limit=25`);

  // 3) datasets (fontes de dados) da conta — o pixel da web aparece aqui também
  out.datasets_da_conta = await pegar(`${conta}/adspixels?fields=id,name&limit=25`);

  // 4) se achou app id, detalha o app e procura dataset dele
  const appIds = new Set<string>();
  for (const c of (camps?.data ?? [])) {
    const a = c?.promoted_object?.application_id;
    if (a) appIds.add(String(a));
  }
  for (const a of (out.apps_da_conta as any)?.data ?? []) if (a?.id) appIds.add(String(a.id));
  out.app_ids_encontrados = [...appIds];
  const detalhes: Record<string, unknown> = {};
  for (const id of appIds) {
    detalhes[id] = {
      app: await pegar(`${id}?fields=id,name,namespace,object_store_urls`),
      datasets: await pegar(`${id}/dataset?fields=id,name`),
    };
  }
  out.detalhe_dos_apps = detalhes;

  return Response.json(out);
});
