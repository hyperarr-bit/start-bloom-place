/**
 * afiliados — programa de afiliados do CORE (09/10/2026).
 *
 * Três portas, uma função:
 *
 *  1. PAINEL PÚBLICO da afiliada — POST { action: "painel", token }.
 *     O token é o link secreto dela (/afiliado/<token>). Devolve SÓ agregados
 *     (quantas usaram o código, em teste, pagaram, comissão a receber, já
 *     pago, próximo Pix) e uma lista "venda de 05/10 — R$ 40,15 — paga em
 *     13/10". Nunca user_id, e-mail ou nome de cliente — a conta em
 *     _shared/afiliados.ts nem recebe essas colunas.
 *
 *  2. ADMIN — criar/listar/pausar/editar/liberar pagamento segurado/prévia da
 *     semana. Mesma checagem das outras funções de admin (admin-suporte):
 *     JWT do dono + papel admin (has_role) ou e-mail da lista.
 *
 *  3. CRON — { action: "pagar_semana", modo: "cron", segredo }. Toda segunda
 *     ~9h BRT (ver supabase/cron/afiliados-pagar-semana.sql — NÃO ativado).
 *     Soma por afiliada as vendas `pago` com 7+ dias e sem pagamento, aplica
 *     a trava semanal (acima do limite SEGURA e avisa o dono), manda o Pix
 *     pela API de transferências do Asaas (POST /v3/transfers com
 *     pixAddressKey/pixAddressKeyType, header access_token — a mesma chave
 *     ASAAS_API_KEY das funções de cobrança; nunca impressa) e grava
 *     `afiliado_pagamentos`. E-mail de resumo pro dono via Resend.
 *
 * Idempotência do Pix: cada pagamento nasce `enviando` com as vendas já
 * carimbadas (pagamento_id) ANTES da chamada ao Asaas; `externalReference`
 * da transferência = id do pagamento. Um pagamento que ficar em `enviando`
 * (função morreu entre o POST e o update) aparece no /admin como "conferir
 * no Asaas" e NUNCA é reenviado sozinho.
 *
 * verify_jwt = false (config.toml): o painel é público por token e o cron
 * não tem usuário. As duas outras portas autenticam por conta própria.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  DIAS_CARENCIA, LIMITE_SEMANAL_PADRAO_CENTS, diaBRT, linkResgate, normalizarCodigo, planejarSemana, proximaSegunda, resumoPainel, segundaDaSemana,
  type AfiliadoResumido, type PagamentoResumido, type PlanoPagamento, type Venda,
} from "../_shared/afiliados.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ADMIN_EMAILS = ["jv20101958@gmail.com", "hyperarr@gmail.com"];
const ASAAS_API = "https://api.asaas.com/v3";
const PIX_TIPOS = new Set(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]);

type Admin = ReturnType<typeof createClient>;
const log = (step: string, d?: unknown) => console.log(`[AFILIADOS] ${step}${d ? ` - ${JSON.stringify(d)}` : ""}`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
const reais = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const tokenNovo = (): string => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const COLUNAS_AFILIADO = "id, nome, codigo, email, pix_chave, pix_tipo, token_painel, limite_semanal_cents, pausado, criado_em";
const COLUNAS_VENDA_ADMIN = "id, afiliado_id, plataforma, produto, valor_bruto_cents, valor_liquido_cents, comissao_cents, status, motivo, cobrado_em, pagamento_id, criado_em";
/** O painel público só vê isto — nada que identifique a cliente. */
const COLUNAS_VENDA_PAINEL = "status, comissao_cents, cobrado_em, criado_em, pagamento_id";

/** Pix: só o fim da chave aparece em resposta de admin ("***1234"). */
const mascarar = (chave: string) => (chave.length <= 4 ? "****" : `***${chave.slice(-4)}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ------------------------------------------------------------ 1. painel público
    if (action === "painel") {
      const token = String(body.token ?? "").trim();
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return json({ error: "token" }, 400);
      const { data: af } = await admin.from("afiliados").select("id, nome, codigo, pausado").eq("token_painel", token).maybeSingle();
      if (!af) return json({ error: "nao_encontrado" }, 404);
      const a = af as { id: string; nome: string; codigo: string; pausado: boolean };
      const [{ data: vendas }, { data: pagamentos }] = await Promise.all([
        admin.from("afiliado_vendas").select(COLUNAS_VENDA_PAINEL).eq("afiliado_id", a.id),
        admin.from("afiliado_pagamentos").select("id, valor_cents, status, criado_em").eq("afiliado_id", a.id),
      ]);
      const resumo = resumoPainel((vendas ?? []) as Venda[], (pagamentos ?? []) as PagamentoResumido[], new Date());
      return json({
        nome: a.nome.split(" ")[0],
        codigo: a.codigo,
        link: linkResgate(a.codigo),
        pausado: a.pausado,
        dias_carencia: DIAS_CARENCIA,
        ...resumo,
      });
    }

    // ------------------------------------------------------------ quem está chamando
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const segredoCron = Deno.env.get("AFILIADOS_CRON_SECRET") ?? "";
    const ehCron = body.modo === "cron" && !!segredoCron && String(body.segredo ?? "") === segredoCron;
    let ehAdmin = false;
    if (!ehCron) {
      const { data: quem } = await anon.auth.getUser(jwt);
      const email = quem?.user?.email?.toLowerCase() ?? "";
      if (quem?.user) {
        const { data: papel } = await admin.rpc("has_role", { _user_id: quem.user.id, _role: "admin" });
        ehAdmin = papel === true || ADMIN_EMAILS.includes(email);
      }
    }
    if (!ehCron && !ehAdmin) return json({ error: "forbidden" }, 403);

    // ------------------------------------------------------------ 3. cron / pagar a semana
    if (action === "pagar_semana") {
      const ensaio = body.ensaio === true;
      const r = await pagarSemana(admin, { ensaio, agora: new Date() });
      return json(r);
    }
    if (ehCron) return json({ error: "cron_so_paga_semana" }, 403);

    // ------------------------------------------------------------ 2. admin
    if (action === "listar") {
      const [{ data: afs }, { data: vendas }, { data: pags }] = await Promise.all([
        admin.from("afiliados").select(COLUNAS_AFILIADO).order("criado_em", { ascending: true }),
        admin.from("afiliado_vendas").select(COLUNAS_VENDA_ADMIN).order("criado_em", { ascending: false }).limit(2000),
        admin.from("afiliado_pagamentos").select("id, afiliado_id, valor_cents, asaas_transfer_id, asaas_status, status, motivo, erro, vendas_ids, semana, criado_em").order("criado_em", { ascending: false }).limit(500),
      ]);
      const lista = ((afs ?? []) as Record<string, unknown>[]).map((a) => ({
        ...a,
        pix_chave: mascarar(String(a.pix_chave ?? "")),
        link_painel: `/afiliado/${a.token_painel}`,
        link_resgate: linkResgate(String(a.codigo)),
      }));
      return json({ afiliados: lista, vendas: vendas ?? [], pagamentos: pags ?? [], proxima_segunda: diaBRT(proximaSegunda(new Date())) });
    }

    if (action === "criar") {
      const nome = String(body.nome ?? "").trim();
      const codigo = normalizarCodigo(body.codigo);
      const email = String(body.email ?? "").trim().toLowerCase() || null;
      const pixChave = String(body.pix_chave ?? "").trim();
      const pixTipo = String(body.pix_tipo ?? "").trim().toUpperCase();
      const limite = Number.isFinite(Number(body.limite_semanal_cents)) ? Math.max(0, Math.round(Number(body.limite_semanal_cents))) : LIMITE_SEMANAL_PADRAO_CENTS;
      if (nome.length < 2) return json({ error: "nome" }, 400);
      if (!codigo) return json({ error: "codigo_invalido", dica: "3 a 64 letras/números, sem acento ou símbolo" }, 400);
      if (!pixChave || !PIX_TIPOS.has(pixTipo)) return json({ error: "pix", dica: "chave + tipo (CPF, CNPJ, EMAIL, PHONE, EVP)" }, 400);
      const { data, error } = await admin.from("afiliados")
        .insert({ nome, codigo, email, pix_chave: pixChave, pix_tipo: pixTipo, token_painel: tokenNovo(), limite_semanal_cents: limite })
        .select(COLUNAS_AFILIADO).single();
      if (error) return json({ error: error.code === "23505" ? "codigo_ja_existe" : error.message }, error.code === "23505" ? 409 : 500);
      log("afiliada criada", { codigo });
      const a = data as Record<string, unknown>;
      return json({ ok: true, afiliado: { ...a, pix_chave: mascarar(pixChave), link_painel: `/afiliado/${a.token_painel}`, link_resgate: linkResgate(codigo) } });
    }

    if (action === "pausar") {
      const id = String(body.id ?? "");
      const pausado = body.pausado !== false;
      const { error } = await admin.from("afiliados").update({ pausado }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, pausado });
    }

    if (action === "editar") {
      const id = String(body.id ?? "");
      const campos: Record<string, unknown> = {};
      if (body.limite_semanal_cents !== undefined) campos.limite_semanal_cents = Math.max(0, Math.round(Number(body.limite_semanal_cents) || 0));
      if (body.pix_chave !== undefined) campos.pix_chave = String(body.pix_chave).trim();
      if (body.pix_tipo !== undefined) {
        const t = String(body.pix_tipo).toUpperCase();
        if (!PIX_TIPOS.has(t)) return json({ error: "pix_tipo" }, 400);
        campos.pix_tipo = t;
      }
      if (body.email !== undefined) campos.email = String(body.email).trim().toLowerCase() || null;
      if (body.nome !== undefined) campos.nome = String(body.nome).trim();
      if (!Object.keys(campos).length) return json({ error: "nada_pra_mudar" }, 400);
      const { error } = await admin.from("afiliados").update(campos).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // o link do painel vazou? gera outro; o antigo morre na hora
    if (action === "novo_token") {
      const id = String(body.id ?? "");
      const token = tokenNovo();
      const { error } = await admin.from("afiliados").update({ token_painel: token }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, link_painel: `/afiliado/${token}` });
    }

    // pagamento SEGURADO (acima do limite) ou que FALHOU: o dono manda de novo
    if (action === "liberar_pagamento") {
      const id = String(body.id ?? "");
      const { data: pg } = await admin.from("afiliado_pagamentos").select("id, afiliado_id, valor_cents, status, vendas_ids, semana").eq("id", id).maybeSingle();
      if (!pg) return json({ error: "nao_encontrado" }, 404);
      const p = pg as { id: string; afiliado_id: string; valor_cents: number; status: string; vendas_ids: string[]; semana: string | null };
      if (p.status !== "segurado" && p.status !== "falhou") return json({ error: `status_${p.status}` }, 409);
      const { data: af } = await admin.from("afiliados").select(COLUNAS_AFILIADO).eq("id", p.afiliado_id).maybeSingle();
      if (!af) return json({ error: "afiliada_nao_encontrada" }, 404);
      const r = await transferir(admin, p, af as AfiliadoCompleto, { ensaio: body.ensaio === true });
      return json({ ok: r.status === "enviado", ...r });
    }

    // o Pix saiu por fora (ou o dono prefere não pagar): fecha o pagamento na mão
    if (action === "marcar_pago_fora") {
      const id = String(body.id ?? "");
      const { error } = await admin.from("afiliado_pagamentos").update({ status: "enviado", asaas_status: "MANUAL", motivo: String(body.motivo ?? "pago_fora_do_sistema").slice(0, 200) })
        .eq("id", id).in("status", ["segurado", "falhou", "enviando"]);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("ERROR", { message: message.slice(0, 200) });
    return json({ error: message }, 500);
  }
});

/* ------------------------------------------------------------------ Pix semanal */

interface AfiliadoCompleto extends AfiliadoResumido {
  email: string | null;
  pix_chave: string;
  pix_tipo: string;
}

async function pagarSemana(admin: Admin, { ensaio, agora }: { ensaio: boolean; agora: Date }) {
  const semana = segundaDaSemana(agora);
  const [{ data: afs, error: e1 }, { data: vendas, error: e2 }, { data: presos }] = await Promise.all([
    admin.from("afiliados").select(COLUNAS_AFILIADO),
    admin.from("afiliado_vendas").select("id, afiliado_id, status, cobrado_em, pagamento_id, comissao_cents").eq("status", "pago").is("pagamento_id", null),
    admin.from("afiliado_pagamentos").select("id, afiliado_id, valor_cents, criado_em").eq("status", "enviando"),
  ]);
  if (e1 || e2) throw new Error(`leitura: ${e1?.message ?? e2?.message}`);
  const afiliados = (afs ?? []) as AfiliadoCompleto[];
  const planos = planejarSemana(afiliados, (vendas ?? []) as Venda[], agora);
  const porId = new Map(afiliados.map((a) => [a.id, a]));

  const resultados: Array<Record<string, unknown>> = [];
  for (const plano of planos) {
    const a = porId.get(plano.afiliado_id)!;
    if (plano.decisao === "pausado") { resultados.push({ codigo: a.codigo, decisao: "pausado", valor_cents: plano.total_cents, vendas: plano.vendas_ids.length }); continue; }
    if (ensaio) { resultados.push({ codigo: a.codigo, decisao: plano.decisao, valor_cents: plano.total_cents, vendas: plano.vendas_ids.length, motivo: plano.motivo }); continue; }

    // nasce `segurado` ou `enviando` — e as vendas já saem da fila AQUI, antes de qualquer rede
    const statusInicial = plano.decisao === "segurar" ? "segurado" : "enviando";
    const { data: pg, error } = await admin.from("afiliado_pagamentos")
      .insert({ afiliado_id: a.id, valor_cents: plano.total_cents, status: statusInicial, motivo: plano.motivo, vendas_ids: plano.vendas_ids, semana })
      .select("id, afiliado_id, valor_cents, status, vendas_ids, semana").single();
    if (error || !pg) { resultados.push({ codigo: a.codigo, decisao: "erro", erro: error?.message?.slice(0, 160) }); continue; }
    const p = pg as { id: string; afiliado_id: string; valor_cents: number; status: string; vendas_ids: string[]; semana: string | null };
    const { error: eCarimbo } = await admin.from("afiliado_vendas").update({ pagamento_id: p.id }).in("id", plano.vendas_ids).is("pagamento_id", null);
    if (eCarimbo) { resultados.push({ codigo: a.codigo, decisao: "erro", erro: `carimbo: ${eCarimbo.message.slice(0, 120)}` }); continue; }

    if (plano.decisao === "segurar") { resultados.push({ codigo: a.codigo, decisao: "segurado", valor_cents: plano.total_cents, vendas: plano.vendas_ids.length, motivo: plano.motivo, pagamento_id: p.id }); continue; }
    const r = await transferir(admin, p, a, { ensaio: false });
    resultados.push({ codigo: a.codigo, decisao: r.status, valor_cents: plano.total_cents, vendas: plano.vendas_ids.length, pagamento_id: p.id, erro: r.erro ?? undefined });
  }

  const presosLista = ((presos ?? []) as Array<{ id: string; afiliado_id: string; valor_cents: number; criado_em: string }>)
    .map((p) => ({ pagamento_id: p.id, codigo: porId.get(p.afiliado_id)?.codigo ?? "?", valor_cents: p.valor_cents, desde: p.criado_em }));

  const resumo = { ensaio, semana, agora: agora.toISOString(), planos: resultados, presos_em_enviando: presosLista };
  log("pagar_semana", { ensaio, planos: resultados.length, presos: presosLista.length });
  if (!ensaio && (resultados.length || presosLista.length)) await avisarDono(resumo).catch((e) => log("email do dono falhou", { msg: String(e).slice(0, 120) }));
  return resumo;
}

/** POST /v3/transfers no Asaas. Atualiza o pagamento pra enviado/falhou. */
async function transferir(
  admin: Admin,
  p: { id: string; afiliado_id: string; valor_cents: number; status: string; vendas_ids: string[]; semana: string | null },
  a: AfiliadoCompleto,
  { ensaio }: { ensaio: boolean },
): Promise<{ status: "enviado" | "falhou" | "ensaio"; asaas_transfer_id?: string | null; asaas_status?: string | null; erro?: string | null }> {
  const apiKey = Deno.env.get("ASAAS_API_KEY") ?? "";
  const payload = {
    value: Math.round(p.valor_cents) / 100,
    pixAddressKey: a.pix_chave,
    pixAddressKeyType: a.pix_tipo,
    description: `CORE afiliados — comissão ${a.codigo} semana ${p.semana ?? ""}`.trim().slice(0, 100),
    externalReference: p.id,
  };
  if (ensaio) return { status: "ensaio", erro: null };
  if (!apiKey) {
    await admin.from("afiliado_pagamentos").update({ status: "falhou", erro: "ASAAS_API_KEY ausente" }).eq("id", p.id);
    return { status: "falhou", erro: "ASAAS_API_KEY ausente" };
  }
  // segurado/falhou → enviando (com guarda: só sai do estado que a gente viu)
  if (p.status !== "enviando") {
    const { data: trocado } = await admin.from("afiliado_pagamentos").update({ status: "enviando", erro: null }).eq("id", p.id).eq("status", p.status).select("id");
    if (!trocado?.length) return { status: "falhou", erro: "pagamento_ja_em_andamento" };
  }
  try {
    const r = await fetch(`${ASAAS_API}/transfers`, {
      method: "POST",
      headers: { access_token: apiKey, "Content-Type": "application/json", "User-Agent": "CORE/1.0 (Supabase Edge)" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await r.text();
    let corpo: Record<string, unknown> = {};
    try { corpo = JSON.parse(texto); } catch { /* sem JSON */ }
    if (!r.ok) {
      const erro = `asaas_${r.status}: ${String((corpo as { errors?: Array<{ description?: string }> }).errors?.[0]?.description ?? texto).slice(0, 200)}`;
      await admin.from("afiliado_pagamentos").update({ status: "falhou", erro }).eq("id", p.id);
      log("transferência recusada", { codigo: a.codigo, status: r.status });
      return { status: "falhou", erro };
    }
    const asaasId = String(corpo.id ?? "") || null;
    const asaasStatus = String(corpo.status ?? "") || null;
    // FAILED/CANCELLED na resposta já é derrota; PENDING/BANK_PROCESSING/DONE é "saiu"
    const falhou = asaasStatus === "FAILED" || asaasStatus === "CANCELLED";
    await admin.from("afiliado_pagamentos").update({
      status: falhou ? "falhou" : "enviado", asaas_transfer_id: asaasId, asaas_status: asaasStatus,
      erro: falhou ? String(corpo.failReason ?? "asaas_failed").slice(0, 200) : null,
    }).eq("id", p.id);
    log("transferência", { codigo: a.codigo, asaasStatus, valor: p.valor_cents });
    return { status: falhou ? "falhou" : "enviado", asaas_transfer_id: asaasId, asaas_status: asaasStatus, erro: falhou ? String(corpo.failReason ?? "") : null };
  } catch (e) {
    // Rede caiu DEPOIS do POST? Não dá pra saber: fica `enviando` e o dono confere no Asaas (externalReference = id).
    const erro = `rede: ${String(e).slice(0, 160)}`;
    await admin.from("afiliado_pagamentos").update({ erro }).eq("id", p.id);
    return { status: "falhou", erro };
  }
}

/** Resumo da segunda pro dono (Resend). Sem chave Pix, sem e-mail de afiliada no corpo. */
async function avisarDono(resumo: { semana: string; planos: Array<Record<string, unknown>>; presos_em_enviando: Array<Record<string, unknown>> }) {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const para = Deno.env.get("AFILIADOS_EMAIL_DONO") || ADMIN_EMAILS[0];
  if (!resendKey) return;
  const from = Deno.env.get("WELCOME_EMAIL_FROM") || "onboarding@resend.dev";
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
  const rotulo: Record<string, string> = { enviado: "Pix enviado", segurado: "SEGURADO (acima do limite)", falhou: "FALHOU", pausado: "pausada — não pagou", erro: "ERRO" };
  const linhas = resumo.planos.map((p) =>
    `<tr><td style="padding:6px 10px"><b>${esc(p.codigo)}</b></td><td style="padding:6px 10px">${reais(Number(p.valor_cents ?? 0))}</td><td style="padding:6px 10px">${esc(p.vendas)} venda(s)</td><td style="padding:6px 10px">${esc(rotulo[String(p.decisao)] ?? p.decisao)}${p.erro ? ` — ${esc(p.erro)}` : ""}</td></tr>`,
  ).join("");
  const presos = resumo.presos_em_enviando.length
    ? `<p style="margin:16px 0 6px;color:#b45309"><b>Conferir no Asaas:</b> ${resumo.presos_em_enviando.length} pagamento(s) ficaram em "enviando" (procure pela referência externa = id do pagamento no /admin).</p>`
    : "";
  const segurados = resumo.planos.filter((p) => p.decisao === "segurado").length;
  const assunto = segurados
    ? `Afiliados — ${segurados} pagamento(s) SEGURADO(S) esperando você (semana ${resumo.semana})`
    : `Afiliados — Pix da semana ${resumo.semana}: ${resumo.planos.length} afiliada(s)`;
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#1c1917;max-width:620px">` +
    `<p style="margin:0 0 12px">Resumo do Pix semanal dos afiliados (${esc(resumo.semana)}):</p>` +
    `<table style="border-collapse:collapse;border:1px solid #e7e5e4">${linhas || `<tr><td style="padding:6px 10px">Nenhuma comissão a pagar esta semana.</td></tr>`}</table>` +
    presos +
    `<p style="margin:16px 0 0;color:#78716c;font-size:12px">Segurado = acima do limite semanal da afiliada; libere na aba Afiliados do /admin. Falhou = o Asaas recusou; o motivo está no /admin.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], subject: assunto, html }),
  });
  if (!r.ok) throw new Error(`resend_${r.status}`);
}

// referência de tipo pra quem ler o arquivo: o plano vem da conta pura
export type { PlanoPagamento };
