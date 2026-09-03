import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/**
 * Operações de SUPORTE do dono (17/07). Primeira: trocar o e-mail de login de
 * uma cliente que perdeu o acesso à caixa antiga. Via GoTrue admin
 * (updateUserById) — mantém auth.users + identities coerentes, coisa que
 * UPDATE na mão não faz. Só a conta interna do dono pode chamar.
 *
 * POST { action: "trocar_email", de, para }  → troca de→para (email_confirm)
 * POST { action: "status", email }           → uid/e-mail/assinatura (conferência)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ADMIN_EMAILS = ["jv20101958@gmail.com", "hyperarr@gmail.com"];

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: authData } = await anon.auth.getUser(token);
    const caller = authData?.user?.email?.toLowerCase() ?? "";
    if (!ADMIN_EMAILS.includes(caller)) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // acha o uid por e-mail: subscriptions primeiro (barato), senão pagina o GoTrue
    const acharUid = async (email: string): Promise<string | null> => {
      const alvo = email.toLowerCase();
      const { data: sub } = await admin.from("subscriptions")
        .select("user_id").ilike("customer_email", alvo).maybeSingle();
      if (sub?.user_id) return sub.user_id as string;
      for (let page = 1; page <= 40; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === alvo);
        if (hit) return hit.id;
        if (data.users.length < 1000) break;
      }
      return null;
    };

    if (action === "status") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const uid = await acharUid(email);
      if (!uid) return json({ found: false });
      const { data: u } = await admin.auth.admin.getUserById(uid);
      const { data: sub } = await admin.from("subscriptions")
        .select("status, plan, customer_email, current_period_start").eq("user_id", uid).maybeSingle();
      // só NOMES + updated_at (nunca o conteúdo) — o updated_at diagnostica
      // "parou de salvar quando?" sem expor dado da pessoa (23/07, caso Daniela)
      const { data: dados } = await admin.from("user_data")
        .select("key, updated_at").eq("user_id", uid).order("updated_at", { ascending: false }).limit(100);
      const keys = (dados ?? []).map((r: { key: string; updated_at: string }) => `${r.key} @ ${r.updated_at}`);
      return json({ found: true, uid, email: u?.user?.email, lastSignIn: u?.user?.last_sign_in_at, sub, userDataRows: keys.length, keys });
    }

    // Caso "cliente criou conta nova com o e-mail desejado": deleta a CASCA
    // (sem assinatura, uid confirmado pelo chamador) e renomeia a conta PAGA
    // pro e-mail novo — assinatura, dados e senha ficam onde sempre estiveram.
    if (action === "absorver") {
      const de = String(body.de ?? "").trim().toLowerCase();
      const para = String(body.para ?? "").trim().toLowerCase();
      const confirmarUid = String(body.confirmarUid ?? "");
      const uidPago = await acharUid(de);
      const uidCasca = await acharUid(para);
      if (!uidPago) return json({ error: "origem_nao_encontrada" }, 404);
      if (!uidCasca) return json({ error: "casca_nao_encontrada" }, 404);
      if (uidCasca !== confirmarUid) return json({ error: "confirmarUid_nao_bate", uidCasca }, 409);
      const { data: subCasca } = await admin.from("subscriptions")
        .select("id").eq("user_id", uidCasca).maybeSingle();
      if (subCasca) return json({ error: "casca_tem_assinatura_abortando" }, 409);

      // NADA é deletado: a casca vai pra um alias +casca (reversível) só pra
      // liberar o e-mail; a conta PAGA assume o e-mail novo.
      const [local, dominio] = para.split("@");
      const alias = `${local}+casca${Date.now()}@${dominio}`;
      const park = await admin.auth.admin.updateUserById(uidCasca, { email: alias, email_confirm: true });
      if (park.error) return json({ error: `parquear_casca: ${park.error.message}` }, 500);

      const { data: upd, error } = await admin.auth.admin.updateUserById(uidPago, { email: para, email_confirm: true });
      if (error) return json({ error: `rename: ${error.message}`, cascaParqueadaEm: alias }, 500);
      await admin.from("subscriptions").update({ customer_email: para }).eq("user_id", uidPago);

      console.log(`[ADMIN-SUPORTE] absorver: casca ${uidCasca} parqueada em ${alias}; ${de} -> ${para} (uid ${uidPago}, por ${caller})`);
      return json({ ok: true, uid: uidPago, email: upd.user?.email, cascaParqueadaEm: alias });
    }

    if (action === "trocar_email") {
      const de = String(body.de ?? "").trim().toLowerCase();
      const para = String(body.para ?? "").trim().toLowerCase();
      if (!de || !para || !para.includes("@")) return json({ error: "de/para inválidos" }, 400);

      const jaExiste = await acharUid(para);
      if (jaExiste) return json({ error: "destino_ja_existe", uidDestino: jaExiste }, 409);

      const uid = await acharUid(de);
      if (!uid) return json({ error: "origem_nao_encontrada" }, 404);

      const { data: upd, error } = await admin.auth.admin.updateUserById(uid, { email: para, email_confirm: true });
      if (error) return json({ error: error.message }, 500);

      // consistência nas tabelas nossas que guardam o e-mail
      await admin.from("subscriptions").update({ customer_email: para }).eq("user_id", uid);

      console.log(`[ADMIN-SUPORTE] email trocado uid=${uid} ${de} -> ${para} (por ${caller})`);
      return json({ ok: true, uid, email: upd.user?.email });
    }

    // Backfill contábil (19/07): downsells de 14,90 gravados como 27,90
    // (check da AbacatePay sem metadata → default lifetime). Lista explícita
    // e auditável de billing_ids; só mexe em amount_cents.
    if (action === "corrigir_valores") {
      const itens = Array.isArray(body.itens) ? body.itens : [];
      let corrigidos = 0;
      for (const it of itens) {
        const billing = String(it.billing ?? "");
        const cents = Number(it.cents);
        if (!billing || !Number.isFinite(cents) || cents < 100) continue;
        const { data: upd } = await admin.from("subscriptions")
          .update({ amount_cents: cents }).eq("abacatepay_billing_id", billing).select("id");
        if (upd?.length) corrigidos++;
      }
      console.log(`[ADMIN-SUPORTE] corrigir_valores: ${corrigidos}/${itens.length} (por ${caller})`);
      return json({ ok: true, corrigidos, total: itens.length });
    }

    // Liberar VITALÍCIO na mão (19/07): cliente que pagou mas o grant não caiu
    // (pagou e fechou antes do polling; sem webhook). Idempotente, mesmo shape
    // do grant do abacate-pix. offer downsell = acesso vitalício por 14,90.
    if (action === "liberar_vitalicio") {
      const uid = String(body.uid ?? "");
      const email = String(body.email ?? "").trim().toLowerCase();
      const billing = body.billing ? String(body.billing) : null;
      /* 03/09: preço único na web (97,90). O padrão do crédito manual segue o
       * preço vigente; os valores antigos continuam aceitos porque o suporte
       * ainda credita compra de quem pagou 27,90 ou 14,90 antes da troca. */
      const centsPedido = Number(body.cents);
      const cents = [1490, 2790, 9790].includes(centsPedido) ? centsPedido : 9790;
      const alvo = uid || (email ? await acharUid(email) : null);
      if (!alvo) return json({ error: "usuario_nao_encontrado" }, 404);

      const { data: u } = await admin.auth.admin.getUserById(alvo);
      const emailConta = u?.user?.email ?? null;
      const now = new Date();
      const fim = new Date(now); fim.setFullYear(fim.getFullYear() + 100);
      const payload = {
        user_id: alvo, status: "active", plan: "lifetime", billing_period: "lifetime",
        payment_method: "pix", customer_email: emailConta, amount_cents: cents,
        ...(billing ? { abacatepay_billing_id: billing } : {}),
        current_period_start: now.toISOString(), current_period_end: fim.toISOString(),
      };
      const { data: existing } = await admin.from("subscriptions").select("id").eq("user_id", alvo).maybeSingle();
      if (existing?.id) await admin.from("subscriptions").update(payload).eq("id", existing.id);
      else await admin.from("subscriptions").insert(payload);

      // boas-vindas (não-bloqueante) — ela já tem login, mas reforça o acesso
      let emailEnviado = false;
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
        const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
        if (resendKey && emailConta && body.enviarEmail !== false) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from, to: [emailConta],
              subject: "Seu acesso vitalício ao CORE tá ativo ✅",
              html: `<p>Oi! Seu acesso vitalício ao CORE já está <b>ativo</b>. É só entrar com <b>${emailConta}</b> e a senha que você criou. Qualquer coisa, é só responder aqui.</p>`,
            }),
          });
          emailEnviado = res.ok;
        }
      } catch { /* ignore */ }

      console.log(`[ADMIN-SUPORTE] liberar_vitalicio uid=${alvo} cents=${cents} billing=${billing ?? "-"} email=${emailEnviado} (por ${caller})`);
      return json({ ok: true, uid: alvo, email: emailConta, cents, billing, emailEnviado });
    }

    // Valida credenciais da CAPI (19/07): manda 1 Purchase de TESTE ao Meta
    // (test_event_code → aba Test Events, não conta como conversão real) e
    // devolve a resposta crua. Só confirma que token+pixel funcionam.
    if (action === "meta_capi_test") {
      const pixelId = Deno.env.get("META_PIXEL_ID");
      const capiToken = Deno.env.get("META_CAPI_TOKEN");
      if (!pixelId || !capiToken) return json({ error: "secrets_ausentes", pixelId: !!pixelId, token: !!capiToken }, 400);
      const sha = async (v: string) => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      };
      const payload = {
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `test_${Date.now()}`,
          action_source: "website",
          event_source_url: "https://www.coreaplicativo.com.br",
          user_data: { em: [await sha("teste@coreaplicativo.com.br")], external_id: [await sha("qa-teste")] },
          custom_data: { value: 27.9, currency: "BRL", content_name: "TESTE CAPI" },
        }],
        test_event_code: String(body.testCode ?? "TEST00000"),
      };
      const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${capiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      return json({ httpStatus: res.status, metaResposta: out });
    }

    // BACKFILL CAPI (25/07): reenvia pra Meta as vendas CAKTO que o webhook
    // não mandou (o sendMetaCapi entrou hoje). event_id = order_id (o MESMO do
    // pixel do navegador) → a Meta deduplica quem já tinha chegado; event_time
    // = hora real do pagamento → atribui ao clique certo (aceita até 7 dias).
    if (action === "meta_capi_backfill") {
      const pixelId = Deno.env.get("META_PIXEL_ID");
      const capiToken = Deno.env.get("META_CAPI_TOKEN");
      if (!pixelId || !capiToken) return json({ error: "secrets_ausentes" }, 400);
      const dryRun = body.dryRun === true;
      const hours = Math.min(Math.max(Number(body.hours) || 48, 1), 168);
      const desde = new Date(Date.now() - hours * 3600e3).toISOString();
      const sha = async (v: string) => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      };
      const { data: subs } = await admin.from("subscriptions")
        .select("user_id, customer_email, current_period_start, amount_cents")
        .gte("current_period_start", desde).order("current_period_start", { ascending: true }).limit(500);
      const enviados: Array<Record<string, unknown>> = [];
      let cakto = 0, pulados = 0, erros = 0, receita = 0;
      for (const sub of subs ?? []) {
        const email = String(sub.customer_email ?? "");
        if (email.includes("+qa")) { pulados++; continue; }
        const { data: evs } = await admin.from("analytics_events")
          .select("event_data, created_at, event_name").eq("user_id", sub.user_id)
          .order("created_at", { ascending: false }).limit(80);
        const rows = (evs ?? []) as Array<{ event_data: Record<string, string>; created_at: string; event_name: string }>;
        const ordem = rows.find((r) => r.event_name === "pix_order_created" && r.event_data?.gateway === "cakto");
        if (!ordem) { pulados++; continue; } // não é venda cakto (ou sem rastro) → pula
        cakto++;
        const eventId = String(ordem.event_data.order_id);
        const offerKind = String(ordem.event_data?.offer ?? "lifetime");
        const amountCents = Number(ordem.event_data?.amount_cents) || Number(sub.amount_cents) || (offerKind === "downsell" ? 1490 : 9790);
        const fbHit = rows.find((r) => r.event_data?.fbclid);
        const fbc = fbHit ? `fb.1.${new Date(fbHit.created_at).getTime()}.${fbHit.event_data.fbclid}` : null;
        const eventTime = Math.floor(new Date(sub.current_period_start).getTime() / 1000);
        receita += amountCents / 100;
        if (dryRun) { enviados.push({ eventId, amountCents, quando: sub.current_period_start, temFbc: !!fbc }); continue; }
        const payload = {
          data: [{
            event_name: "Purchase", event_time: eventTime, event_id: eventId,
            action_source: "website", event_source_url: "https://www.coreaplicativo.com.br",
            user_data: { ...(email ? { em: [await sha(email)] } : {}), external_id: [await sha(sub.user_id)], ...(fbc ? { fbc } : {}) },
            custom_data: { value: amountCents / 100, currency: "BRL", content_name: offerKind === "downsell" ? "CORE Vitalício (oferta)" : "CORE Vitalício" },
          }],
        };
        const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${capiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) erros++;
        enviados.push({ eventId, amountCents, ok: res.ok, recv: (out as { events_received?: number })?.events_received });
      }
      return json({ dryRun, janelaHoras: hours, subsNaJanela: (subs ?? []).length, vendasCakto: cakto, enviados: enviados.length, erros, receita: Number(receita.toFixed(2)), pulados, detalhe: enviados });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
