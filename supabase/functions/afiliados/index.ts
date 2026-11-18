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
import {
  COMISSAO_POR_AMIGA_CENTS, ENDERECO_RECUPERAR, FRASE_CAMINHO, MOTIVO_DIVIDA, MOTIVO_DIVIDA_DESCONTADA, PRECO_OFERTA_CENTS, comissaoWebCents, compraValeLink,
  descontarDividas, emailComparavel, finalPix, gerarCodigo, hashEmail, ipDaRequisicao, ipDentroDoLimite, linkDaContaPagante,
  linkIndique, linkJaDaConta, linkPainelIndique, reaisBr, reprocessarIndicacaoWeb, validarPix, valorComDesconto,
} from "../_shared/indique.ts";

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
// 23/11 (revisão M6): as colunas novas da migração 20261123120000 são lidas À PARTE e com tolerância — esta função pode subir
// ANTES da migração sem derrubar o programa das influenciadoras (sem a coluna, todo mundo é "influencer" e nada muda).
const COLUNAS_AFILIADO_NOVAS = "id, origem";
type LinhaErro = { data: unknown; error: { code?: string; message?: string } | null };
/** tenta com as colunas novas; se o banco ainda não tem (migração não aplicada), cai na consulta antiga */
async function tolerante(nova: () => PromiseLike<LinhaErro>, antiga: () => PromiseLike<LinhaErro>): Promise<LinhaErro> {
  const r = await nova();
  return r.error ? await antiga() : r;
}
async function origens(admin: Admin): Promise<Map<string, string>> {
  const { data, error } = await admin.from("afiliados").select(COLUNAS_AFILIADO_NOVAS);
  return new Map(error ? [] : ((data ?? []) as Array<{ id: string; origem: string }>).map((x) => [x.id, x.origem]));
}
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

    // ------------------------------------------------------------ 0. indique e ganhe da web (23/11) — env INDIQUE_WEB=on
    if (["indique_link", "indique_pix", "indique_conta", "indique_recuperar"].includes(action)) {
      if (Deno.env.get("INDIQUE_WEB") !== "on") return json({ ok: false, motivo: "desligado" }, 403);
      // críticas 17/11: limite por IP antes de qualquer consulta à Stripe (a mesma chave do checkout — um robô aqui derrubaria as vendas)
      const ip = ipDaRequisicao(req.headers);
      if (action === "indique_link" && !(await ipDentroDoLimite(admin, "indique-link", ip, 20, 10 * 60e3))) return json({ ok: false, motivo: "limite" }, 429);
      if (action === "indique_recuperar" && !(await ipDentroDoLimite(admin, "indique-recuperar", ip, 5, 3600e3))) return json({ ok: true }); // a mesma resposta de sempre
      if (action === "indique_link") return await indiqueLink(admin, body);
      if (action === "indique_pix") return await indiquePix(admin, body);
      if (action === "indique_recuperar") return await indiqueRecuperar(admin, body);
      // indique_conta: a entrada "Indique e ganhe" do app NA WEB — quem está logado pega o painel da própria compra da /oferta
      const jwtConta = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const { data: eu } = await anon.auth.getUser(jwtConta);
      if (!eu?.user) return json({ ok: false, motivo: "login" }, 401);
      return await indiqueConta(admin, eu.user.id, eu.user.email ?? null);
    }

    // ------------------------------------------------------------ 1. painel público
    if (action === "painel") {
      const token = String(body.token ?? "").trim();
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return json({ error: "token" }, 400);
      const { data: af } = await tolerante(
        () => admin.from("afiliados").select("id, nome, codigo, pausado, origem, pix_chave, pix_tipo").eq("token_painel", token).maybeSingle(),
        () => admin.from("afiliados").select("id, nome, codigo, pausado").eq("token_painel", token).maybeSingle(),
      );
      if (!af) return json({ error: "nao_encontrado" }, 404);
      const a = af as { id: string; nome: string; codigo: string; pausado: boolean; origem?: string; pix_chave: string | null; pix_tipo: string | null };
      // 23/11: quem indica pela web (comprador) — o link é a /oferta?ref=, a comissão é 50% do valor pago, e a chave Pix vem pelo painel
      if (a.origem === "comprador") {
        const [{ data: vendas }, { data: pagamentos }] = await Promise.all([
          admin.from("afiliado_vendas").select(COLUNAS_VENDA_PAINEL + ", libera_em").eq("afiliado_id", a.id),
          admin.from("afiliado_pagamentos").select("id, valor_cents, status, criado_em").eq("afiliado_id", a.id),
        ]);
        const resumo = resumoPainel((vendas ?? []) as Venda[], (pagamentos ?? []) as PagamentoResumido[], new Date());
        return json({
          origem: "comprador", codigo: a.codigo, link: linkIndique(a.codigo), pausado: a.pausado, dias_carencia: DIAS_CARENCIA,
          comissao_cents: comissaoWebCents(PRECO_OFERTA_CENTS), preco_cents: PRECO_OFERTA_CENTS,
          pix: { cadastrado: !!a.pix_chave, tipo: a.pix_tipo, final: finalPix(a.pix_chave) },
          ...resumo,
        });
      }
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
      const orig = await origens(admin);
      const lista = ((afs ?? []) as Record<string, unknown>[]).map((a) => ({
        ...a,
        origem: orig.get(String(a.id)) ?? "influencer",
        pix_chave: mascarar(String(a.pix_chave ?? "")),
        link_painel: `/afiliado/${a.token_painel}`,
        link_resgate: orig.get(String(a.id)) === "comprador" ? linkIndique(String(a.codigo)) : linkResgate(String(a.codigo)),
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
      if (!(af as AfiliadoCompleto).pix_chave) return json({ error: "sem_pix" }, 409);
      // 23/11: venda reembolsada DEPOIS de o pagamento ser segurado não entra — o valor é refeito com as que seguem pagas
      // críticas 17/11: as dívidas descontadas neste pagamento (reembolso depois de um Pix) continuam descontadas
      const { data: todas } = await admin.from("afiliado_vendas").select("id, comissao_cents, status, motivo").in("id", p.vendas_ids);
      const linhas = (todas ?? []) as Array<{ id: string; comissao_cents: number; status: string; motivo: string | null }>;
      const valorAgora = valorComDesconto(linhas);
      if (valorAgora <= 0) return json({ error: "nada_a_pagar" }, 409);
      if (valorAgora !== p.valor_cents) {
        const ficam = linhas.filter((v) => v.status === "pago" || v.motivo === MOTIVO_DIVIDA_DESCONTADA).map((v) => v.id);
        await admin.from("afiliado_pagamentos").update({ valor_cents: valorAgora, vendas_ids: ficam }).eq("id", p.id).eq("status", p.status);
        p.valor_cents = valorAgora;
      }
      const r = await transferir(admin, p, af as AfiliadoCompleto, { ensaio: body.ensaio === true });
      return json({ ok: r.status === "enviado", ...r });
    }

    // críticas 17/11: a comissão de uma venda indicada não gravou (alarme "comissão NÃO gravou") → o dono reprocessa pelo PI.
    // Idempotente: lê o PI na Stripe e grava pela mesma regra do webhook (índice único em transaction_id).
    if (action === "indique_reprocessar") {
      const pi = String(body.pi ?? "").trim();
      if (!/^pi_[A-Za-z0-9]+$/.test(pi)) return json({ error: "pi" }, 400);
      const r = await reprocessarIndicacaoWeb(admin, await lerPi(pi), new Date());
      log("indique: reprocessar (admin)", { pi, ...r });
      return json({ ok: ["gravada", "ja", "estornada"].includes(r.r), ...r });
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
  /** 23/11: nulo em quem indica pela web e ainda não cadastrou (o Pix semanal pula) */
  pix_chave: string | null;
  pix_tipo: string | null;
}

/**
 * Críticas 17/11: antes de planejar, tenta de novo as comissões que NÃO gravaram (evento indique_falhou onde "venda", 60 dias).
 * Idempotente (a venda que já existe volta "ja"). No ensaio não grava nada: só conta quantas estão pendentes.
 */
async function reprocessarPendentes(admin: Admin, ensaio: boolean, agora: Date): Promise<Array<{ pi: string; r: string }>> {
  if (Deno.env.get("INDIQUE_WEB") !== "on") return [];
  const desde = new Date(agora.getTime() - 60 * 86400e3).toISOString();
  const { data } = await admin.from("analytics_events").select("event_data").eq("event_name", "indique_falhou").gte("created_at", desde).limit(200);
  const pis = [...new Set(((data ?? []) as Array<{ event_data?: { pi?: string; onde?: string } }>)
    .filter((x) => x.event_data?.onde === "venda" && /^pi_[A-Za-z0-9]+$/.test(String(x.event_data?.pi ?? ""))).map((x) => String(x.event_data!.pi)))];
  const out: Array<{ pi: string; r: string }> = [];
  for (const pi of pis) {
    const { data: ja } = await admin.from("afiliado_vendas").select("id").eq("transaction_id", pi).maybeSingle();
    if (ja) continue;
    if (ensaio) { out.push({ pi, r: "pendente" }); continue; }
    const r = await reprocessarIndicacaoWeb(admin, await lerPi(pi), agora).catch((e) => ({ r: `erro: ${String(e).slice(0, 80)}` }));
    out.push({ pi, r: r.r });
  }
  return out;
}

async function pagarSemana(admin: Admin, { ensaio, agora }: { ensaio: boolean; agora: Date }) {
  const semana = segundaDaSemana(agora);
  const reprocessadas = await reprocessarPendentes(admin, ensaio, agora).catch(() => []);
  const [{ data: afs, error: e1 }, { data: vendas, error: e2 }, { data: presos }] = await Promise.all([
    admin.from("afiliados").select(COLUNAS_AFILIADO),
    tolerante(
      () => admin.from("afiliado_vendas").select("id, afiliado_id, status, cobrado_em, pagamento_id, comissao_cents, libera_em, plataforma, transaction_id, motivo").eq("status", "pago").is("pagamento_id", null),
      () => admin.from("afiliado_vendas").select("id, afiliado_id, status, cobrado_em, pagamento_id, comissao_cents").eq("status", "pago").is("pagamento_id", null),
    ),
    admin.from("afiliado_pagamentos").select("id, afiliado_id, valor_cents, criado_em").eq("status", "enviando"),
  ]);
  if (e1 || e2) throw new Error(`leitura: ${e1?.message ?? e2?.message}`);
  const afiliados = (afs ?? []) as AfiliadoCompleto[];
  const planos = planejarSemana(afiliados, (vendas ?? []) as Venda[], agora);
  await travasIndique(admin, planos, (vendas ?? []) as VendaPix[], await origens(admin));
  // críticas 17/11: devolução DEPOIS de um Pix já pago → o próximo Pix do mesmo link desconta (ou a semana fica segurada)
  const { data: dividas } = await admin.from("afiliado_vendas").select("id, afiliado_id, comissao_cents").eq("plataforma", "web").eq("status", "reembolsado").eq("motivo", MOTIVO_DIVIDA);
  const descontadas = new Set(descontarDividas(planos, (dividas ?? []) as Array<{ id: string; afiliado_id: string; comissao_cents: number }>));
  const porId = new Map(afiliados.map((a) => [a.id, a]));

  const resultados: Array<Record<string, unknown>> = [];
  for (const plano of planos) {
    const a = porId.get(plano.afiliado_id)!;
    // 23/11: quem indica pela web ainda sem chave Pix → as comissões esperam (nada é criado; entram na semana em que a chave chegar)
    if (!a.pix_chave || !a.pix_tipo) { resultados.push({ codigo: a.codigo, decisao: "sem_pix", valor_cents: plano.total_cents, vendas: plano.vendas_ids.length }); continue; }
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
    // a dívida descontada neste Pix não é descontada de novo na semana que vem
    const minhasDividas = plano.vendas_ids.filter((id) => descontadas.has(id));
    if (minhasDividas.length) await admin.from("afiliado_vendas").update({ motivo: MOTIVO_DIVIDA_DESCONTADA }).in("id", minhasDividas).eq("motivo", MOTIVO_DIVIDA);

    if (plano.decisao === "segurar") { resultados.push({ codigo: a.codigo, decisao: "segurado", valor_cents: plano.total_cents, vendas: plano.vendas_ids.length, motivo: plano.motivo, pagamento_id: p.id }); continue; }
    const r = await transferir(admin, p, a, { ensaio: false });
    resultados.push({ codigo: a.codigo, decisao: r.status, valor_cents: plano.total_cents, vendas: plano.vendas_ids.length, pagamento_id: p.id, erro: r.erro ?? undefined });
  }

  const presosLista = ((presos ?? []) as Array<{ id: string; afiliado_id: string; valor_cents: number; criado_em: string }>)
    .map((p) => ({ pagamento_id: p.id, codigo: porId.get(p.afiliado_id)?.codigo ?? "?", valor_cents: p.valor_cents, desde: p.criado_em }));

  const resumo = { ensaio, semana, agora: agora.toISOString(), planos: resultados, presos_em_enviando: presosLista, comissoes_reprocessadas: reprocessadas };
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
  const rotulo: Record<string, string> = { enviado: "Pix enviado", segurado: "SEGURADO", falhou: "FALHOU", pausado: "pausada — não pagou", erro: "ERRO" };
  const linhas = resumo.planos.map((p) =>
    `<tr><td style="padding:6px 10px"><b>${esc(p.codigo)}</b></td><td style="padding:6px 10px">${reais(Number(p.valor_cents ?? 0))}</td><td style="padding:6px 10px">${esc(p.vendas)} venda(s)</td><td style="padding:6px 10px">${esc(rotulo[String(p.decisao)] ?? p.decisao)}${p.motivo ? ` (${esc(p.motivo)})` : ""}${p.erro ? ` — ${esc(p.erro)}` : ""}</td></tr>`,
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

/* ------------------------------------------------------------------ indique e ganhe da web (23/11) */

const SITE_EMAIL = "https://www.coreaplicativo.com.br";

/**
 * "Quero meu link" no pós-pago da /oferta. Sem senha: a prova é a compra da própria aba — { ref, pi } (a mesma do stripe-status
 * e do stripe-presente). Confere na Stripe que o PI é desta ref, da /oferta e está pago; não pode estar estornado. 1 link POR
 * COMPRA (comprador_pi): a mesma aba/compra recebe o mesmo link; uma compra nova é um link novo. (Revisão 23/11 M3: casar pelo
 * e-mail digitado no checkout deixava alguém comprar com o e-mail de outra pessoa e receber o painel DELA.)
 * Guarda da compra de quem indica: e-mail, conta, aparelho, IP e a digital do cartão — as travas de autoindicação.
 */
type PiStripe = {
  id?: string; status?: string; receipt_email?: string | null; metadata?: Record<string, string>;
  latest_charge?: { payment_method_details?: { card?: { fingerprint?: string | null } | null } | null } | string | null;
};
/** o PaymentIntent na Stripe (com a cobrança, pra digital do cartão); null = não deu pra ler */
async function lerPi(pi: string): Promise<PiStripe | null> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!sk || !/^pi_[A-Za-z0-9]+$/.test(pi)) return null;
  const r = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}?expand[]=latest_charge`, { headers: { Authorization: `Bearer ${sk}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return (r?.ok ? await r.json().catch(() => null) : null) as PiStripe | null;
}

type LinkPronto = { codigo: string; token_painel: string; pausado?: boolean; novo: boolean; email: string | null };
/**
 * O link DESTA compra (1 por PaymentIntent — revisão 23/11 M3: nunca casar pelo e-mail digitado no checkout). Quem chama já provou
 * a compra (ref da aba, login da conta, ou o e-mail que recebe). Guarda e-mail, conta, aparelho, IP e a digital do cartão da compra
 * (as travas de autoindicação). null = estornada ou erro.
 */
async function linkDaCompra(admin: Admin, pi: string, j: PiStripe): Promise<LinkPronto | "estornada" | null> {
  const { data: estorno } = await admin.from("webhook_events").select("id").eq("id", `stripe-estorno:${pi}`).maybeSingle();
  if (estorno) return "estornada";
  const md = j.metadata ?? {};
  const email = String(md.email || j.receipt_email || "").trim().toLowerCase() || null;
  const { data: porPi } = await admin.from("afiliados").select("codigo, token_painel, pausado").eq("comprador_pi", pi).maybeSingle();
  if (porPi) return { ...(porPi as { codigo: string; token_painel: string; pausado: boolean }), novo: false, email };
  const aparelho = /^[A-Za-z0-9_-]{8,64}$/.test(String(md.aparelho ?? "")) ? String(md.aparelho) : null;
  const ip = typeof md.ip === "string" && md.ip.length <= 64 ? md.ip : null;
  const lc = j.latest_charge && typeof j.latest_charge === "object" ? j.latest_charge : null;
  const cartaoFp = typeof lc?.payment_method_details?.card?.fingerprint === "string" ? lc.payment_method_details.card.fingerprint : null;
  const { data: sub } = await admin.from("subscriptions").select("user_id").eq("abacatepay_billing_id", pi).eq("payment_method", "stripe").limit(1).maybeSingle();
  const userId = (sub as { user_id?: string } | null)?.user_id ?? null;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = gerarCodigo();
    const token = tokenNovo();
    const { data, error } = await admin.from("afiliados").insert({
      nome: "Indicação web", codigo, email: null, pix_chave: null, pix_tipo: null, token_painel: token, origem: "comprador",
      comprador_pi: pi, comprador_user_id: userId, comprador_email: email, aparelho, ip, cartao_fp: cartaoFp, limite_semanal_cents: LIMITE_SEMANAL_PADRAO_CENTS,
    }).select("codigo, token_painel").single();
    if (!error && data) { log("indique: link criado", { codigo }); return { ...(data as { codigo: string; token_painel: string }), novo: true, email }; }
    if (error?.code !== "23505") { log("indique: criar falhou", { code: error?.code }); return null; }
    // conflito: outra aba criou o link DESTA compra ao mesmo tempo → devolve o dela; senão foi o código → sorteia outro
    const { data: corrida } = await admin.from("afiliados").select("codigo, token_painel, pausado").eq("comprador_pi", pi).maybeSingle();
    if (corrida) return { ...(corrida as { codigo: string; token_painel: string; pausado: boolean }), novo: false, email };
  }
  return null;
}
// críticas 17/11: o e-mail do PAINEL (quem pediu o link, e a página /indique) vale com INDIQUE_WEB=on — a /indique é o caminho
// ensinado em toda tela ("Perdeu o link?"). INDIQUE_EMAIL ficou só pro bloco de divulgação no e-mail de ACESSO (stripe-webhook).
const emailLigado = () => Deno.env.get("INDIQUE_WEB") === "on";

/**
 * "Quero meu link" no pós-pago da /oferta. Sem senha: a prova é a compra da própria aba — { ref, pi } (a mesma do stripe-status
 * e do stripe-presente). Confere na Stripe que o PI é desta ref, da /oferta e está pago; não pode estar estornado.
 */
async function indiqueLink(admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const ref = String(body.ref ?? "");
  const pi = String(body.pi ?? "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(ref) || !/^pi_[A-Za-z0-9]+$/.test(pi)) return json({ ok: false, motivo: "compra" }, 400);
  if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ ok: false, motivo: "indisponivel" }, 503);
  const j = await lerPi(pi);
  if (!compraValeLink(j, ref)) return json({ ok: false, motivo: "compra" }, 404);
  const l = await linkDaCompra(admin, pi, j!);
  if (l === "estornada") return json({ ok: false, motivo: "estornada" }, 409);
  if (!l) return json({ ok: false, motivo: "erro" }, 500);
  let enviado = false;
  if (l.novo && l.email && emailLigado()) enviado = await emailDoPainel(l.email, l.codigo, l.token_painel).then(() => true, (e) => { log("indique: e-mail falhou", { msg: String(e).slice(0, 80) }); return false; });
  return json({ ok: true, novo: l.novo, codigo: l.codigo, link: linkIndique(l.codigo), painel: linkPainelIndique(l.token_painel), email_enviado: enviado, comissao_cents: comissaoWebCents(PRECO_OFERTA_CENTS), pausado: l.pausado === true });
}

/** as compras da /oferta (Stripe, vitalício ativo) de uma conta ou de um e-mail — a mais nova primeiro */
async function comprasDaOferta(admin: Admin, filtro: { userId?: string; email?: string }): Promise<string[]> {
  let q = admin.from("subscriptions").select("abacatepay_billing_id, created_at").eq("payment_method", "stripe").eq("status", "active").eq("plan", "lifetime");
  q = filtro.userId ? q.eq("user_id", filtro.userId) : q.eq("customer_email", String(filtro.email));
  const { data } = await q.order("created_at", { ascending: false }).limit(5);
  return ((data ?? []) as Array<{ abacatepay_billing_id?: string }>).map((x) => String(x.abacatepay_billing_id ?? "")).filter((x) => /^pi_[A-Za-z0-9]+$/.test(x));
}
/** o link da 1ª compra que vale (da /oferta, paga, não estornada) */
async function linkDeAlgumaCompra(admin: Admin, pis: string[]): Promise<LinkPronto | null> {
  for (const pi of pis) {
    const j = await lerPi(pi);
    if (!j || j.status !== "succeeded" || !["oferta", "planos"].includes(j.metadata?.pagina ?? "oferta")) continue; // 18/11: e o vitalício da /escolha
    const l = await linkDaCompra(admin, pi, j);
    if (l && l !== "estornada") return l;
  }
  return null;
}

/**
 * O link de uma CONTA (17/11, subida): 1) o que ela já tem (da /oferta ou pela conta, não pausado); 2) o da compra da /oferta;
 * 3) cliente pagante de qualquer jeito (Pix, cartão, loja) → o link pela conta (_shared/indique.ts, linkDaContaPagante).
 * "nao_pagante" = sem assinatura paga viva (teste grátis da loja e código grátis não contam).
 */
async function linkDaConta(admin: Admin, userId: string, email: string | null): Promise<{ codigo: string; token_painel: string; novo?: boolean } | "nao_pagante" | null> {
  const ja = await linkJaDaConta(admin, userId);
  if (ja) return ja;
  const daOferta = await linkDeAlgumaCompra(admin, await comprasDaOferta(admin, { userId }));
  if (daOferta) return daOferta;
  return await linkDaContaPagante(admin, userId, email, new Date(), { codigo: () => gerarCodigo(), token: tokenNovo });
}

/** A entrada "Indique e ganhe" do app na WEB (logado): o painel de QUALQUER cliente pagante (web ou loja), sem senha — a prova é o login. */
async function indiqueConta(admin: Admin, userId: string, email: string | null): Promise<Response> {
  const l = await linkDaConta(admin, userId, email);
  if (l === "nao_pagante") return json({ ok: false, motivo: "sem_compra" });
  if (!l) return json({ ok: false, motivo: "erro" }, 500);
  if (l.novo) log("indique: link pela conta", { codigo: l.codigo });
  return json({ ok: true, painel: linkPainelIndique(l.token_painel), link: linkIndique(l.codigo) });
}

/**
 * /indique (sem token): "perdi meu link". A pessoa digita o e-mail da compra; se ele comprou na /oferta, o link do painel vai PRA ESSE
 * E-MAIL (quem recebe é a prova). A resposta é SEMPRE a mesma — nunca diz se o e-mail existe. 1 envio por e-mail por hora.
 * Vale com INDIQUE_WEB=on (críticas 17/11; antes pedia INDIQUE_EMAIL). Limite: 1 envio por e-mail por hora e 5 pedidos por IP por hora.
 */
async function indiqueRecuperar(admin: Admin, body: Record<string, unknown>): Promise<Response> {
  if (!emailLigado()) return json({ ok: false, motivo: "desligado" });
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return json({ ok: false, motivo: "email" }, 400);
  const igual = { ok: true };
  const hora = new Date().toISOString().slice(0, 13);
  const h = await hashEmail(email);
  const { error: jaFoi } = await admin.from("webhook_events").insert({ id: `indique-recuperar:${h}:${hora}`, source: "indique", event: "recuperar" });
  if (jaFoi) return json(igual); // repetido nesta hora (ou o banco recusou): a mesma resposta
  try {
    let l: { codigo: string; token_painel: string } | null = null;
    const { data: ja } = await admin.from("afiliados").select("codigo, token_painel").eq("origem", "comprador").eq("comprador_email", email).limit(1);
    l = ((ja ?? []) as Array<{ codigo: string; token_painel: string }>)[0] ?? null;
    if (!l) l = await linkDeAlgumaCompra(admin, await comprasDaOferta(admin, { email }));
    // 17/11 (subida): cliente pagante que não comprou na /oferta (loja, Pix antigo…) — a conta com esse e-mail (quem recebe é a prova)
    if (!l) {
      const { data: contas } = await admin.from("subscriptions").select("user_id").eq("customer_email", email).not("user_id", "is", null).limit(5);
      for (const uid of [...new Set(((contas ?? []) as Array<{ user_id: string }>).map((x) => x.user_id))]) {
        const c = await linkDaConta(admin, uid, email);
        if (c && c !== "nao_pagante") { l = c; break; }
      }
    }
    if (l) await emailDoPainel(email, l.codigo, l.token_painel);
    log("indique: recuperar", { achou: !!l });
  } catch (e) { log("indique: recuperar falhou", { msg: String(e).slice(0, 80) }); }
  return json(igual);
}

/**
 * Antes do Pix da semana, só pra quem indica pela web (revisões 23/11 A1, A2, M5) — mexe nos planos no lugar:
 *  - venda com a marca de estorno da Stripe (stripe-estorno:<pi>) que ficou "pago" (o cancelamento falhou) → reembolsada e fora;
 *  - venda marcada "revisar_*" (mesmo aparelho / mesmo IP de quem indica) → a semana fica SEGURADA pro dono olhar;
 *  - o 1º Pix de cada link → SEGURADO (o dono aprova no /admin; depois disso, sai sozinho).
 */
type VendaPix = { id: string; afiliado_id: string; comissao_cents: number; plataforma?: string; transaction_id?: string; motivo?: string | null };
async function travasIndique(admin: Admin, planos: PlanoPagamento[], vendas: VendaPix[], orig: Map<string, string>): Promise<void> {
  const porId = new Map(vendas.map((v) => [v.id, v]));
  for (let i = planos.length - 1; i >= 0; i--) {
    const plano = planos[i];
    if (orig.get(plano.afiliado_id) !== "comprador") continue;
    const minhas = plano.vendas_ids.map((id) => porId.get(id)).filter((v): v is VendaPix => !!v);
    const marcas = minhas.filter((v) => v.plataforma === "web" && v.transaction_id).map((v) => `stripe-estorno:${v.transaction_id}`);
    if (marcas.length) {
      const { data: est } = await admin.from("webhook_events").select("id").in("id", marcas);
      const estornados = new Set(((est ?? []) as Array<{ id: string }>).map((x) => x.id.replace(/^stripe-estorno:/, "")));
      const fora = minhas.filter((v) => v.transaction_id && estornados.has(v.transaction_id));
      if (fora.length) {
        await admin.from("afiliado_vendas").update({ status: "reembolsado", motivo: "reembolso" }).in("id", fora.map((v) => v.id));
        plano.vendas_ids = plano.vendas_ids.filter((id) => !fora.some((v) => v.id === id));
        plano.total_cents = plano.vendas_ids.reduce((s, id) => s + (porId.get(id)?.comissao_cents ?? 0), 0);
        if (plano.total_cents <= 0) { planos.splice(i, 1); continue; }
      }
    }
    if (plano.decisao === "pausado") continue;
    if (minhas.some((v) => String(v.motivo ?? "").startsWith("revisar_"))) { plano.decisao = "segurar"; plano.motivo = "revisar_autoindicacao"; continue; }
    if (plano.decisao === "pagar") {
      const { data: antes } = await admin.from("afiliado_pagamentos").select("id").eq("afiliado_id", plano.afiliado_id).eq("status", "enviado").limit(1);
      if (!((antes ?? []) as unknown[]).length) { plano.decisao = "segurar"; plano.motivo = "primeiro_pix"; }
    }
  }
}

/**
 * A chave Pix, pelo painel (token = a senha do painel). Só a PRIMEIRA vez: trocar depois é pelo suporte (um token vazado não
 * desvia o dinheiro). Recusa: chave inválida, chave já usada por outro link, e chave = e-mail de alguém que comprou pelo link.
 */
async function indiquePix(admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const token = String(body.token ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return json({ ok: false, motivo: "token" }, 400);
  const pix = validarPix(body.pix_tipo, body.pix_chave);
  if (!pix) return json({ ok: false, motivo: "chave_invalida" }, 400);
  const { data: af } = await admin.from("afiliados").select("id, origem, pix_chave").eq("token_painel", token).maybeSingle();
  const a = af as { id: string; origem: string; pix_chave: string | null } | null;
  if (!a || a.origem !== "comprador") return json({ ok: false, motivo: "token" }, 404);
  if (a.pix_chave) return json({ ok: false, motivo: "ja_tem" }, 409);
  if (pix.tipo === "EMAIL") {
    const h = await hashEmail(emailComparavel(pix.chave) ?? pix.chave);
    const { data: igual } = await admin.from("afiliado_vendas").select("id").eq("afiliado_id", a.id).eq("comprador_email_hash", h).limit(1);
    if ((igual ?? []).length) return json({ ok: false, motivo: "chave_de_cliente" }, 409);
  }
  const { data: trocou, error } = await admin.from("afiliados").update({ pix_chave: pix.chave, pix_tipo: pix.tipo }).eq("id", a.id).is("pix_chave", null).select("id");
  if (error) return json({ ok: false, motivo: error.code === "23505" ? "chave_em_uso" : "erro" }, error.code === "23505" ? 409 : 500);
  if (!trocou?.length) return json({ ok: false, motivo: "ja_tem" }, 409);
  log("indique: chave Pix cadastrada", { tipo: pix.tipo });
  return json({ ok: true, pix: { cadastrado: true, tipo: pix.tipo, final: finalPix(pix.chave) } });
}

/** O link do painel no e-mail de quem pediu (o navegador do Instagram apaga o que fica só na aba). Env INDIQUE_EMAIL=on. */
async function emailDoPainel(para: string, codigo: string, token: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) return;
  const from = Deno.env.get("WELCOME_EMAIL_FROM") || "onboarding@resend.dev";
  const painel = `${SITE_EMAIL}/indique/${token}`;
  const link = linkIndique(codigo);
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#262626;max-width:520px">` +
    `<p style="margin:0 0 12px"><b>Seu link de indicação do CORE está pronto.</b></p>` +
    `<p style="margin:0 0 12px">Cada amiga que comprar o CORE pelo seu link = <b>${reaisBr(COMISSAO_POR_AMIGA_CENTS)} no seu Pix</b> (50% de cada compra, sem limite de amigas).</p>` +
    `<p style="margin:0 0 6px">Seu link pra mandar:</p><p style="margin:0 0 16px"><a href="${link}">${link}</a></p>` +
    `<p style="margin:0 0 16px"><a href="${painel}" style="display:inline-block;background:#d02c7d;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">Ver meu painel</a></p>` +
    `<p style="margin:0 0 10px;color:#6b6670;font-size:13px">O painel mostra suas vendas e é onde você cadastra a chave Pix. Não repasse o link do painel: ele é só seu.</p>` +
    `<p style="margin:0;color:#6b6670;font-size:13px">Perdeu este e-mail? Entre em <a href="${SITE_EMAIL}/indique">${ENDERECO_RECUPERAR}</a> e digite seu e-mail. ${FRASE_CAMINHO.charAt(0).toUpperCase()}${FRASE_CAMINHO.slice(1)}.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], subject: `Seu link do CORE: ${reaisBr(COMISSAO_POR_AMIGA_CENTS)} por amiga`, html }),
  });
  if (!r.ok) throw new Error(`resend_${r.status}`);
}

// referência de tipo pra quem ler o arquivo: o plano vem da conta pura
export type { PlanoPagamento };
