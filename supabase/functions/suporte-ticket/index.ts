import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/**
 * CHAMADO DE SUPORTE ABERTO DE DENTRO DO APP (07/09).
 *
 * Pedido literal de uma cliente pagante, por DM: "faz em algum local suporte
 * e coloca um formulário pra gente por o bug e anexar o print".
 *
 * Grava em `support_tickets` — a MESMA tabela que o fluxo de cancelamento já
 * usa. Duas consequências que mandaram no desenho desta função:
 *
 *  1. NÃO existe migração aqui (o banco é de produção). Então a tabela é a
 *     que está lá: id, user_id, source, message, status, resolved_at,
 *     cancel_attempt_id, created_at. Nada de coluna nova. O diagnóstico e os
 *     links dos prints entram como um RODAPÉ legível no próprio `message` —
 *     é o que o dono vai ler na tela do /admin, então tem que ser texto de
 *     gente, não JSON.
 *  2. O que precisa ser CONSULTÁVEL (filtrar por versão, por plataforma,
 *     contar chamados com print) vai estruturado no `event_data` do
 *     analytics_events `support_ticket_created` — jsonb, sem migração.
 *
 * Service role pra escrever, mas SÓ depois de identificar a pessoa pelo
 * token: chamado anônimo não tem pra quem responder e é porta aberta pra
 * spam. Mesmo par anon/admin que o cancel-subscription-flow usa.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SUPORTE-TICKET] ${step}${d}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

/** Teto do texto e dos anexos. O cliente já limita; o servidor é quem MANDA
 *  (um POST na mão ignora a tela). 4000 caracteres é folgado pra um relato
 *  longo e curto o bastante pra não virar despejo de arquivo na coluna. */
const MAX_MENSAGEM = 4000;
const MAX_ANEXOS = 3;

/** tipo escolhido na tela → coluna `source` (o cancel_flow já ocupa a dele). */
const SOURCE: Record<string, string> = {
  erro: "app_erro",
  duvida: "app_duvida",
  sugestao: "app_sugestao",
};

/** Quem recebe o aviso de chamado novo (mesma lista do admin-suporte). */
const ADMIN_EMAILS = ["jv20101958@gmail.com", "hyperarr@gmail.com"];

const ROTULO: Record<string, string> = {
  erro: "ERRO",
  duvida: "DÚVIDA",
  sugestao: "SUGESTÃO",
};

const BodySchema = z.object({
  tipo: z.enum(["erro", "duvida", "sugestao"]),
  mensagem: z.string().trim().min(1).max(MAX_MENSAGEM),
  anexos: z.array(z.string().url()).max(MAX_ANEXOS).optional().default([]),
  diagnostico: z
    .object({
      versao: z.string().max(60).optional(),
      plataforma: z.string().max(60).optional(),
      aparelho: z.string().max(400).optional(),
      modulo: z.string().max(60).optional(),
      tela: z.string().max(200).optional(),
      idioma: z.string().max(20).optional(),
    })
    .optional()
    .default({}),
});

/**
 * O RODAPÉ. É a única parte do chamado que a pessoa não escreveu, e existe
 * porque quem manda "não está salvando" não sabe (nem deveria) a versão do
 * app nem o modelo do aparelho — e sem isso a primeira resposta do suporte
 * é sempre a mesma ladainha de perguntas.
 *
 * Formato pensado pra ser lido por humano E raspado depois: "Conta:" e as
 * URLs dos anexos ficam em linhas próprias, que é como a tela do /admin
 * extrai e-mail e prints de um chamado antigo.
 */
const montarRodape = (
  d: Record<string, string | undefined>,
  email: string | null,
  userId: string,
  anexos: string[],
) => {
  const linhas = [
    "",
    "———— diagnóstico automático (não digitado pela pessoa) ————",
    `Conta: ${email ?? "sem e-mail"} (uid ${userId})`,
    `App: ${d.versao || "?"} · ${d.plataforma || "?"}`,
    `Aparelho: ${d.aparelho || "?"}`,
    `Última tela aberta: ${d.modulo || "não entrou em nenhum módulo nesta sessão"}`,
    `Enviado de: ${d.tela || "?"}${d.idioma ? ` · idioma ${d.idioma}` : ""}`,
    `Quando: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (BRT)`,
  ];
  if (anexos.length) {
    linhas.push(`Prints anexados (${anexos.length}):`);
    anexos.forEach((u, i) => linhas.push(`  ${i + 1}. ${u}`));
  } else {
    linhas.push("Prints anexados: nenhum");
  }
  return linhas.join("\n");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return jsonResponse({ error: "nao_autenticado" }, 401);
    const { data: authData } = await anon.auth.getUser(token);
    const user = authData?.user;
    if (!user) return jsonResponse({ error: "nao_autenticado" }, 401);

    const bruto = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(bruto);
    if (!parsed.success) {
      logStep("corpo inválido", { issues: parsed.error.issues.map((i) => i.path.join(".")) });
      return jsonResponse({ error: "dados_invalidos" }, 400);
    }
    const { tipo, mensagem, anexos: anexosBrutos, diagnostico } = parsed.data;

    /*
     * Anexo só vale se estiver no NOSSO Storage. Sem esta trava, `anexos`
     * seria um campo de link livre que qualquer POST na mão usaria pra
     * plantar URL de terceiro dentro de um texto que o dono vai abrir no
     * navegador dele. O upload legítimo sempre volta assinado deste host.
     */
    const anexos = anexosBrutos
      .filter((u) => u.startsWith(`${url}/storage/v1/`))
      .slice(0, MAX_ANEXOS);
    const descartados = anexosBrutos.length - anexos.length;

    const source = SOURCE[tipo];
    const message =
      `[${ROTULO[tipo]}] ${mensagem}\n` +
      montarRodape(diagnostico as Record<string, string | undefined>, user.email ?? null, user.id, anexos);

    const { data: ticket, error: tErr } = await admin
      .from("support_tickets")
      .insert({ user_id: user.id, source, message })
      .select("id")
      .single();
    if (tErr) throw tErr;

    /*
     * O gêmeo consultável. A tabela não tem coluna pra versão/plataforma/
     * anexo, e sem isso ninguém consegue responder "quantos chamados de erro
     * vieram da build 96 no Android" — que é a pergunta que transforma
     * chamado em conserto. event_data é jsonb: cabe sem migração.
     */
    await admin.from("analytics_events").insert({
      user_id: user.id,
      event_name: "support_ticket_created",
      event_data: {
        ticket_id: ticket.id,
        source,
        tipo,
        versao: diagnostico.versao ?? "",
        plataforma: diagnostico.plataforma ?? "",
        aparelho: diagnostico.aparelho ?? "",
        modulo: diagnostico.modulo ?? "",
        tela: diagnostico.tela ?? "",
        email: user.email ?? "",
        anexos,
      },
    });

    /* AVISO PRO DONO (17/09). Chamado que fica esperando no /admin sem ninguém
     * saber é chamado sem resposta: 8 ficaram abertos de 13 a 17/09 sem o dono
     * ver. Um e-mail por chamado, com o texto e o link do painel. Destinatário
     * vem do secret SUPORTE_AVISO_PARA (lista separada por vírgula); sem ele,
     * os mesmos e-mails de admin do admin-suporte. Nunca trava o chamado:
     * falha do Resend só vai pro log. */
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
      const from = Deno.env.get("WELCOME_EMAIL_FROM") || Deno.env.get("RECOVERY_EMAIL_FROM") || "onboarding@resend.dev";
      const para = (Deno.env.get("SUPORTE_AVISO_PARA") || ADMIN_EMAILS.join(",")).split(",").map((e) => e.trim()).filter(Boolean);
      if (resendKey && para.length) {
        const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
        const prints = anexos.length ? `<p>${anexos.length} print(s) anexado(s) — abre no painel.</p>` : "";
        const resumo = mensagem.replace(/\s+/g, " ").slice(0, 60);
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from, to: para,
            subject: `[CORE suporte] ${ROTULO[tipo]}: ${resumo}${mensagem.length > 60 ? "…" : ""}`,
            html:
              `<p><b>${ROTULO[tipo]}</b> · ${esc(user.email ?? "sem e-mail")} · ${esc(String(diagnostico.plataforma ?? ""))} ${esc(String(diagnostico.versao ?? ""))} · tela ${esc(String(diagnostico.modulo ?? diagnostico.tela ?? "?"))}</p>` +
              `<blockquote style="border-left:3px solid #ccc;padding-left:12px;white-space:pre-wrap">${esc(mensagem)}</blockquote>${prints}` +
              `<p><a href="https://coreaplicativo.com.br/admin/suporte">Abrir no painel</a> · responder direto: <a href="mailto:${esc(user.email ?? "")}">${esc(user.email ?? "")}</a></p>`,
          }),
        });
        logStep("aviso por e-mail", { ok: r.ok, status: r.status });
      }
    } catch (e) {
      logStep("aviso por e-mail falhou", { msg: e instanceof Error ? e.message : String(e) });
    }

    logStep("chamado gravado", {
      ticket: ticket.id,
      source,
      anexos: anexos.length,
      descartados,
      versao: diagnostico.versao,
      plataforma: diagnostico.plataforma,
    });

    return jsonResponse({ ok: true, ticketId: ticket.id, email: user.email ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStep("ERRO", { msg });
    return jsonResponse({ error: msg }, 500);
  }
});
