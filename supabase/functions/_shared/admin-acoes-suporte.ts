/**
 * AÇÕES DO /admin → Suporte (30/10).
 *
 * Duas operações que o painel chama na função admin-suporte. Nenhuma das duas
 * manda e-mail ao cliente (sem Resend, sem convite, sem link de confirmação:
 * o updateUserById vai com email_confirm, que grava o e-mail já confirmado).
 *
 *   · liberarPix        o "Pix pago sem e-mail". O e-mail entra na conta que
 *                       já tem a linha; se essa conta sumiu, cria uma conta
 *                       silenciosa e regrava a oferta daquele pedido. Não
 *                       duplica a venda.
 *   · resolverColisao   duas contas no mesmo e-mail: estaciona a vazia ou
 *                       move o acesso. A tela mostra as duas antes.
 *   · trocarEmailAdmin  troca o e-mail de LOGIN. `de` é o e-mail atual ou o
 *                       id da conta. Atualiza o auth (users + a identity de
 *                       e-mail, via updateUserById), o user_metadata.email
 *                       quando a conta guarda um, public.profiles.email quando
 *                       a coluna existe, subscriptions.customer_email (o
 *                       fallback dos webhooks que acham a pessoa pelo e-mail)
 *                       e o destino `hoje-destino:<uid>` que aponta uma compra
 *                       anônima pra esse e-mail. O acesso continua no mesmo
 *                       user_id.
 *
 * Sem Deno: o cliente do banco é o mínimo que as duas funções usam — testado
 * no vitest (src/test/admin-acoes-suporte.test.ts).
 */
import { copiarDadosDaAnonima } from "./copiar-dados-anonima.ts";
import { chaveSemEmail } from "./landing-travas.ts";
import { COLUNAS_DECISAO, linhasProprias, type LinhaAssinatura } from "./linha-pix.ts";
import { CONCESSAO_HOJE, PRECOS_HOJE } from "./ofertas-hoje.ts";
import { registroDoPedido } from "./registro-pedido.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; auth: { admin: any } };

export const EMAIL_CONTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UUID_CONTA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const limparEmail = (e: string): string => e.trim().toLowerCase();

type UsuarioAuth = {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown> | null;
};

export type Falha = { ok: false; erro: string; status: number; detalhe?: Record<string, unknown> };
export type Ok = { ok: true; detalhe: Record<string, unknown> };
export type ResultadoAcao = Ok | Falha;

const falha = (erro: string, status: number, detalhe?: Record<string, unknown>): Falha =>
  ({ ok: false, erro, status, ...(detalhe ? { detalhe } : {}) });

const lista = (data: unknown): Array<Record<string, unknown>> =>
  Array.isArray(data) ? data as Array<Record<string, unknown>> : [];

/** Coluna `profiles.email` não está no schema atual; se um dia voltar, o update pega. */
const colunaEmailAusente = (msg: string): boolean =>
  /could not find the 'email' column|column "?email"? of relation|PGRST204/i.test(msg);

async function registrar(admin: Admin, uid: string, event_name: string, event_data: Record<string, unknown>): Promise<void> {
  try {
    await admin.from("analytics_events").insert({ user_id: uid, event_name, event_data }).then(() => {}, () => {});
  } catch { /* o registro é trilha; a ação já aconteceu */ }
}

/** Login de verdade: só auth.users. customer_email velho de outra pessoa não é conta. */
export async function acharLoginPorEmail(admin: Admin, email: string): Promise<string | null> {
  const alvo = limparEmail(email);
  if (!EMAIL_CONTA.test(alvo)) return null;
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const users = (data?.users ?? []) as UsuarioAuth[];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === alvo);
    if (hit) return hit.id;
    if (users.length < 1000) return null;
  }
  return null;
}

/**
 * O e-mail já é de outra conta? Confere o login, a assinatura (customer_email)
 * e o perfil, quando a coluna existe. A própria conta não conta.
 */
export async function emailDeOutraConta(admin: Admin, email: string, uid: string): Promise<string | null> {
  const alvo = limparEmail(email);
  const login = await acharLoginPorEmail(admin, alvo);
  if (login && login !== uid) return login;
  const { data: subs } = await admin.from("subscriptions").select("user_id, customer_email").ilike("customer_email", alvo).limit(20);
  const outroSub = lista(subs).find((s) => String(s.user_id ?? "") !== uid && String(s.customer_email ?? "").toLowerCase() === alvo);
  if (outroSub?.user_id) return String(outroSub.user_id);
  try {
    const { data, error } = await admin.from("profiles").select("id, email").ilike("email", alvo).limit(20);
    if (!error) {
      const outro = lista(data).find((p) => String(p.id ?? "") !== uid && String(p.email ?? "").toLowerCase() === alvo);
      if (outro?.id) return String(outro.id);
    }
  } catch { /* sem coluna */ }
  return null;
}

/** Dono do Pix: a linha da assinatura (billing ou subscription id) ou o registro do pedido. */
export async function uidDoPedido(admin: Admin, pedido: string): Promise<string | null> {
  const id = pedido.trim();
  if (!id) return null;
  const cols = "user_id, status, payment_method";
  const ler = async (coluna: string) => {
    const { data } = await admin.from("subscriptions").select(cols).eq(coluna, id).limit(10);
    return lista(data);
  };
  const linhas = [...await ler("abacatepay_billing_id"), ...await ler("abacatepay_subscription_id")];
  const pix = linhas.find((l) => l.payment_method === "pix" && l.status === "active") ?? linhas[0];
  if (pix?.user_id) return String(pix.user_id);
  const reg = await registroDoPedido(admin, id);
  return reg[0]?.user_id ? String(reg[0].user_id) : null;
}

/** Move a assinatura Pix de uma conta anônima pra conta que a pessoa usa.
 *  Regras: origem sem e-mail (ou is_anonymous), com assinatura pix ativa;
 *  destino existe e NÃO tem assinatura ativa (uma casca expirada/cancelada
 *  no destino dá lugar à linha paga). A linha paga nunca é apagada. */
export async function transferirCompraPix(
  admin: Admin, deUid: string, paraUid: string,
): Promise<{ erro: string | null; status?: number; detalhe?: Record<string, unknown> }> {
  const { data: de } = await admin.auth.admin.getUserById(deUid);
  if (!de?.user) return { erro: "origem_nao_encontrada", status: 404 };
  const origemAnonima = de.user.is_anonymous === true || !de.user.email;
  if (!origemAnonima) return { erro: "origem_tem_email", detalhe: { dica: "não é uma conta anônima — usar absorver/trocar_email" } };
  const { data: para } = await admin.auth.admin.getUserById(paraUid);
  if (!para?.user) return { erro: "destino_nao_encontrado", status: 404 };

  const { data: subDe } = await admin.from("subscriptions")
    .select("id, plan, billing_period, amount_cents, status, payment_method, created_at")
    .eq("user_id", deUid).eq("payment_method", "pix").eq("status", "active")
    .order("current_period_end", { ascending: false }).limit(1).maybeSingle();
  if (!subDe || subDe.status !== "active") return { erro: "origem_sem_pix_ativo" };
  /* 01/10: no destino só as linhas PRÓPRIAS contam — a da App Store/Play é do
   * RevenueCat: nem barra a transferência (quem está na carência da Apple e
   * pagou o Pix anônimo PRECISA receber a linha) nem pode ser apagada. */
  const { data: todasPara } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", paraUid);
  const propriasPara = linhasProprias((todasPara ?? []) as LinhaAssinatura[]);
  if (propriasPara.some((l) => l.status === "active")) return { erro: "destino_ja_tem_assinatura" };
  for (const casca of propriasPara) await admin.from("subscriptions").delete().eq("id", casca.id);

  const emailPara = para.user.email ?? null;
  const { error } = await admin.from("subscriptions")
    .update({ user_id: paraUid, customer_email: emailPara }).eq("id", subDe.id);
  if (error) return { erro: `update: ${error.message}`, status: 500 };
  await admin.from("analytics_events").insert({
    user_id: paraUid, event_name: "compra_vinculada",
    event_data: { de: deUid, plan: subDe.plan, amount_cents: subDe.amount_cents, pago_em: subDe.created_at },
  }).then(() => {}, () => {});
  return { erro: null, detalhe: { uid: paraUid, plan: subDe.plan, billing_period: subDe.billing_period, amount_cents: subDe.amount_cents, pago_em: subDe.created_at, email: emailPara ? "ok" : "sem_email" } };
}

const VIVA = new Set(["active", "past_due", "cancel_scheduled"]);

export type AssinaturaResumo = {
  id: string; status: string; plan: string | null; billing_period: string | null;
  payment_method: string | null; amount_cents: number | null; current_period_end: string | null; pedido: string | null;
};

export type ResumoConta = {
  encontrada: boolean; uid: string | null; email: string | null; criado: string | null; ultimoLogin: string | null;
  anonima: boolean; temAcesso: boolean; chaves: number; assinaturas: AssinaturaResumo[];
};

const acessoVivo = (s: { status?: string | null; current_period_end?: string | null }, agora = Date.now()): boolean => {
  if (!VIVA.has(String(s.status ?? ""))) return false;
  const fim = s.current_period_end ? Date.parse(s.current_period_end) : NaN;
  return !Number.isFinite(fim) || fim > agora;
};

async function lerUsuario(admin: Admin, id: string): Promise<UsuarioAuth | null> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error && !/not found/i.test(String(error.message ?? ""))) return null;
  return (data?.user ?? null) as UsuarioAuth | null;
}

const pedidoNoTexto = (msg: string): string | null => msg.match(/^Pedido:\s*(\S+)/m)?.[1] ?? null;

async function pedidoPeloChamado(admin: Admin, uid: string): Promise<string | null> {
  const { data } = await admin.from("support_tickets").select("message, created_at").eq("user_id", uid).eq("source", "pix_sem_email").limit(5);
  for (const t of lista(data)) {
    const p = pedidoNoTexto(String(t.message ?? ""));
    if (p) return p;
  }
  return null;
}

type LinhaPix = {
  id: string; user_id: string; status: string; plan: string | null; billing_period: string | null;
  payment_method: string | null; amount_cents: number | null; current_period_end: string | null;
  current_period_start: string | null; abacatepay_billing_id: string | null; revenuecat_subscription_id: string | null;
};

async function linhasPorColuna(admin: Admin, coluna: string, valor: string): Promise<LinhaPix[]> {
  const { data } = await admin.from("subscriptions").select("id, user_id, status, plan, billing_period, payment_method, amount_cents, current_period_end, current_period_start, abacatepay_billing_id, revenuecat_subscription_id").eq(coluna, valor).limit(10);
  return lista(data) as unknown as LinhaPix[];
}

async function linhaDoPedido(admin: Admin, pedido: string): Promise<LinhaPix | null> {
  const linhas = [...await linhasPorColuna(admin, "abacatepay_billing_id", pedido), ...await linhasPorColuna(admin, "abacatepay_subscription_id", pedido)];
  return linhas.find((l) => l.payment_method === "pix" && l.status === "active") ?? linhas[0] ?? null;
}

/** O pedido foi pago de verdade? QR criado (pix_order_created) sozinho não conta. */
async function provaDoPedido(admin: Admin, pedido: string): Promise<{ ok: boolean; pagoEm: string | null }> {
  const { data: trava } = await admin.from("webhook_events").select("id, processed_at").eq("id", chaveSemEmail(pedido)).limit(1);
  const marca = lista(trava)[0];
  if (marca) return { ok: true, pagoEm: typeof marca.processed_at === "string" ? marca.processed_at : null };
  const { data: tickets } = await admin.from("support_tickets").select("user_id, message, created_at, source").eq("source", "pix_sem_email").ilike("message", `%Pedido: ${pedido}%`).limit(5);
  const chamado = lista(tickets).find((t) => pedidoNoTexto(String(t.message ?? "")) === pedido);
  if (chamado) return { ok: true, pagoEm: typeof chamado.created_at === "string" ? chamado.created_at : null };
  return { ok: false, pagoEm: null };
}

async function ofertaDoPedido(admin: Admin, pedido: string): Promise<{ offer: string; amount: number } | null> {
  const reg = await registroDoPedido(admin, pedido);
  const dados = (reg[0]?.event_data ?? {}) as { offer?: unknown; amount_cents?: unknown };
  const offer = String(dados.offer ?? "");
  if (!offer || !CONCESSAO_HOJE[offer]) return null;
  const gravado = Number(dados.amount_cents);
  const amount = Number.isFinite(gravado) && gravado > 0 ? gravado : PRECOS_HOJE[offer];
  if (!amount) return null;
  return { offer, amount };
}

const fimDoAcesso = (dias: number | null, inicio: Date): string => {
  const fim = new Date(inicio.getTime());
  if (dias === null) fim.setUTCFullYear(fim.getUTCFullYear() + 100);
  else fim.setUTCDate(fim.getUTCDate() + dias);
  return fim.toISOString();
};

async function destinoBloqueado(admin: Admin, dest: string, linhaId: string | null): Promise<boolean> {
  const { data } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", dest);
  return linhasProprias((lista(data) as unknown) as LinhaAssinatura[]).some((l) => l.status === "active" && l.id !== linhaId);
}

async function limparCascas(admin: Admin, dest: string): Promise<void> {
  const { data } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", dest);
  for (const casca of linhasProprias((lista(data) as unknown) as LinhaAssinatura[])) {
    if (casca.status !== "active") await admin.from("subscriptions").delete().eq("id", casca.id);
  }
}

async function criarContaSilenciosa(admin: Admin, email: string): Promise<{ uid: string | null; erro: string | null }> {
  const criado = await admin.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { origem: "pix_sem_email" },
  });
  const uid = criado?.data?.user?.id ? String(criado.data.user.id) : null;
  if (uid) return { uid, erro: null };
  const msg = String(criado?.error?.message ?? "");
  if (/already|registered|exists/i.test(msg)) {
    const existente = await acharLoginPorEmail(admin, email);
    if (existente) return { uid: existente, erro: null };
  }
  return { uid: null, erro: msg || "nao_criou_conta" };
}

/**
 * Põe o Pix JÁ PAGO neste e-mail. Se a pessoa não tem conta, cria uma (confirmada,
 * sem e-mail e sem senha — ela entra depois com o código). Se a conta anônima
 * ainda existe, o e-mail entra nela. Se a linha sumiu junto com a anônima, regrava
 * a MESMA oferta do pedido (não uma concessão genérica). Sem e-mail ao cliente.
 */
export async function vincularPixPago(admin: Admin, args: {
  deUid?: string; pedido?: string; email: string; caller: string;
}): Promise<ResultadoAcao> {
  let pedido = String(args.pedido ?? "").trim();
  const deUid = String(args.deUid ?? "").trim();
  const email = limparEmail(args.email);
  if (pedido && (pedido.length > 200 || /\s/.test(pedido))) return falha("pedido_invalido", 400);
  if (!EMAIL_CONTA.test(email) || email.length > 254) return falha("email_invalido", 400);
  if (!pedido && deUid) pedido = (await pedidoPeloChamado(admin, deUid)) ?? "";
  if (!pedido && !deUid) return falha("deUid/paraUid inválidos", 400);

  const linha = pedido ? await linhaDoPedido(admin, pedido) : null;
  const holderId = linha?.user_id ?? (deUid || null);
  if (linha && deUid && linha.user_id !== deUid) {
    const holderAinda = await lerUsuario(admin, deUid);
    if (holderAinda) return falha("pedido_nao_bate", 409, { deUid, dono: linha.user_id });
  }
  const prova = pedido ? await provaDoPedido(admin, pedido) : { ok: false, pagoEm: null };
  if (!linha && !prova.ok) return falha("sem_prova_de_pagamento", 404);
  const oferta = linha ? null : await ofertaDoPedido(admin, pedido);
  if (!linha && !oferta) return falha("sem_oferta", 409, { pedido });

  let dest = await acharLoginPorEmail(admin, email);
  let como: "batizado" | "conta_criada" | "movido" | "restaurado" = dest ? "movido" : "conta_criada";
  const holder = holderId ? await lerUsuario(admin, holderId) : null;
  if (holder?.email && holder.email.toLowerCase() !== email && holder.id !== dest) return falha("origem_tem_email", 409);

  if (!dest && holder && !holder.email) {
    const upd = await admin.auth.admin.updateUserById(holder.id, { email, email_confirm: true });
    if (!upd?.error) {
      dest = holder.id;
      como = "batizado";
    } else if (!/already|registered|exists/i.test(String(upd.error.message ?? ""))) {
      return falha(String(upd.error.message), 500);
    } else {
      dest = await acharLoginPorEmail(admin, email);
    }
  }
  if (!dest) {
    const criada = await criarContaSilenciosa(admin, email);
    if (!criada.uid) return falha(criada.erro ?? "nao_criou_conta", 500);
    dest = criada.uid;
    como = "conta_criada";
  }

  if (linha) {
    if (linha.user_id !== dest) {
      if (await destinoBloqueado(admin, dest, linha.id)) return falha("destino_ja_tem_assinatura", 409);
      await limparCascas(admin, dest);
      const { error } = await admin.from("subscriptions").update({ user_id: dest, customer_email: email }).eq("id", linha.id);
      if (error) return falha(`update: ${error.message}`, 500);
      if (holder && holder.id !== dest) await copiarDadosDaAnonima(admin, holder.id, dest);
      await admin.from("analytics_events").insert({
        user_id: dest, event_name: "compra_vinculada",
        event_data: { de: linha.user_id, plan: linha.plan, amount_cents: linha.amount_cents, via: "admin" },
      }).then(() => {}, () => {});
    } else {
      await admin.from("subscriptions").update({ customer_email: email }).eq("user_id", dest);
      if (como === "conta_criada") como = "batizado";
    }
  } else {
    const ja = await linhaDoPedido(admin, pedido);
    if (ja) {
      if (ja.user_id !== dest) {
        if (await destinoBloqueado(admin, dest, ja.id)) return falha("destino_ja_tem_assinatura", 409);
        const { error } = await admin.from("subscriptions").update({ user_id: dest, customer_email: email }).eq("id", ja.id);
        if (error) return falha(`update: ${error.message}`, 500);
      }
    } else {
      if (await destinoBloqueado(admin, dest, null)) return falha("destino_ja_tem_assinatura", 409);
      const c = CONCESSAO_HOJE[oferta!.offer];
      const ini = prova.pagoEm ? new Date(prova.pagoEm) : new Date();
      const inicio = Number.isFinite(ini.getTime()) ? ini : new Date();
      const { error } = await admin.from("subscriptions").insert({
        user_id: dest, status: "active", plan: c.plano, billing_period: c.periodo, payment_method: "pix",
        abacatepay_billing_id: pedido, customer_email: email, amount_cents: oferta.amount,
        current_period_start: inicio.toISOString(), current_period_end: fimDoAcesso(c.dias, inicio),
      });
      if (error) return falha(`restaurar: ${error.message}`, 500);
      como = "restaurado";
    }
  }

  const { data: ficou } = await admin.from("subscriptions").select("plan, billing_period, amount_cents, abacatepay_billing_id").eq("user_id", dest).eq("payment_method", "pix").limit(5);
  const desta = lista(ficou).find((s) => !pedido || s.abacatepay_billing_id === pedido) ?? lista(ficou)[0];
  const detalhe: Record<string, unknown> = {
    uid: dest, deUid: holderId, para: email, pedido: pedido || null, como,
    plan: desta?.plan ?? null, billing_period: desta?.billing_period ?? null, amount_cents: desta?.amount_cents ?? null,
  };
  console.log(`[ADMIN-SUPORTE] transferir_pix ${holderId ?? "?"} -> ${dest} (${detalhe.plan}, ${detalhe.amount_cents}, ${como}) por ${args.caller}`);
  await registrar(admin, dest, "admin_transferir_pix", { ...detalhe, por: args.caller });
  return { ok: true, detalhe };
}

/**
 * Resolve o chamado (deUid) ou o formulário avulso (pedido + e-mail).
 * deUid+paraUid (os dois já existem) continua só movendo a linha.
 */
export async function liberarPix(admin: Admin, args: {
  deUid?: string; paraUid?: string; pedido?: string; email?: string; caller: string;
}): Promise<ResultadoAcao> {
  const email = limparEmail(String(args.email ?? ""));
  const paraUid = String(args.paraUid ?? "").trim();
  const deUid = String(args.deUid ?? "").trim();
  if (!email && paraUid) {
    if (!deUid || deUid === paraUid) return falha("deUid/paraUid inválidos", 400);
    const r = await transferirCompraPix(admin, deUid, paraUid);
    if (r.erro) return falha(r.erro, r.status ?? 409, r.detalhe);
    const detalhe: Record<string, unknown> = { ...r.detalhe, deUid, como: "movido", para: null, pedido: String(args.pedido ?? "") || null };
    console.log(`[ADMIN-SUPORTE] transferir_pix ${deUid} -> ${paraUid} (${detalhe.plan}, ${detalhe.amount_cents}) por ${args.caller}`);
    await registrar(admin, paraUid, "admin_transferir_pix", { de: deUid, para: paraUid, por: args.caller, plan: detalhe.plan ?? null, amount_cents: detalhe.amount_cents ?? null, como: "movido" });
    return { ok: true, detalhe };
  }
  return vincularPixPago(admin, { deUid, pedido: args.pedido, email, caller: args.caller });
}

/**
 * Troca o e-mail de login. `de` = e-mail atual ou id da conta. Recusa e-mail
 * inválido e e-mail que já é de outra conta. Não manda e-mail.
 */
export async function trocarEmailAdmin(admin: Admin, args: { de: string; para: string; caller: string }): Promise<ResultadoAcao> {
  const bruto = String(args.de ?? "").trim();
  const para = limparEmail(String(args.para ?? ""));
  if (!EMAIL_CONTA.test(para) || para.length > 254) return falha("email_invalido", 400);

  const porId = UUID_CONTA.test(bruto);
  if (!porId && !EMAIL_CONTA.test(limparEmail(bruto))) return falha("origem_invalida", 400);

  let uid: string | null = null;
  let user: UsuarioAuth | null = null;
  if (porId) {
    const { data } = await admin.auth.admin.getUserById(bruto);
    user = data?.user ?? null;
    uid = user?.id ?? null;
  } else {
    uid = await acharLoginPorEmail(admin, limparEmail(bruto));
    if (uid) {
      const { data } = await admin.auth.admin.getUserById(uid);
      user = data?.user ?? null;
    }
  }
  if (!uid || !user) return falha("origem_nao_encontrada", 404);

  const antigo = (user.email ?? "").toLowerCase();
  if (antigo && antigo === para) return falha("mesmo_email", 409);

  const outra = await emailDeOutraConta(admin, para, uid);
  if (outra) {
    const contas = [await resumoConta(admin, uid), await resumoConta(admin, outra)];
    return falha("destino_ja_existe", 409, { uidDestino: outra, contas, recomendacao: recomendarResolucao(contas[0], contas[1], para) });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const attrs: Record<string, unknown> = { email: para, email_confirm: true };
  if (typeof meta.email === "string") attrs.user_metadata = { email: para };
  const upd = await admin.auth.admin.updateUserById(uid, attrs);
  if (upd?.error) return falha(String(upd.error.message || "auth"), 500);
  const emailAuth = String(upd?.data?.user?.email ?? para).toLowerCase();

  const { error: subErr, count } = await admin.from("subscriptions").update({ customer_email: para }).eq("user_id", uid);
  if (subErr) return falha("assinatura_nao_atualizou", 500, { uid, auth: true, mensagem: String(subErr.message ?? "") });

  let perfil: "atualizado" | "sem_coluna" = "atualizado";
  const perfilUpd = await admin.from("profiles").update({ email: para }).eq("id", uid);
  if (perfilUpd?.error) {
    const msg = String(perfilUpd.error.message ?? "");
    if (!colunaEmailAusente(msg)) return falha("perfil_nao_atualizou", 500, { uid, auth: true, mensagem: msg });
    perfil = "sem_coluna";
  }

  let destinos = 0;
  if (antigo) {
    const { data: rows } = await admin.from("webhook_events").select("id, event").like("id", "hoje-destino:%").eq("event", antigo);
    for (const row of lista(rows)) {
      if (String(row.event ?? "").toLowerCase() !== antigo) continue;
      const u = await admin.from("webhook_events").update({ event: para }).eq("id", row.id);
      if (!u?.error) destinos += 1;
    }
  }

  const detalhe = {
    uid, email: emailAuth, de: antigo || null, para,
    assinaturas: typeof count === "number" ? count : null,
    perfil, destinos,
  };
  console.log(`[ADMIN-SUPORTE] email trocado uid=${uid} ${antigo || "(sem e-mail)"} -> ${para} (por ${args.caller})`);
  await registrar(admin, uid, "admin_trocar_email", { ...detalhe, por: args.caller });
  return { ok: true, detalhe };
}

const assinaturaResumo = (s: Record<string, unknown>): AssinaturaResumo => ({
  id: String(s.id ?? ""), status: String(s.status ?? ""), plan: (s.plan as string | null) ?? null,
  billing_period: (s.billing_period as string | null) ?? null, payment_method: (s.payment_method as string | null) ?? null,
  amount_cents: s.amount_cents == null ? null : Number(s.amount_cents),
  current_period_end: (s.current_period_end as string | null) ?? null,
  pedido: (s.abacatepay_billing_id as string | null) ?? null,
});

/** O que a conta tem, sem o conteúdo dos dados — só a contagem de chaves. */
export async function resumoConta(admin: Admin, ref: string): Promise<ResumoConta> {
  const bruto = ref.trim();
  const vazio: ResumoConta = { encontrada: false, uid: UUID_CONTA.test(bruto) ? bruto : null, email: null, criado: null, ultimoLogin: null, anonima: false, temAcesso: false, chaves: 0, assinaturas: [] };
  let user: (UsuarioAuth & { created_at?: string; last_sign_in_at?: string }) | null = null;
  if (UUID_CONTA.test(bruto)) user = await lerUsuario(admin, bruto) as typeof user;
  else if (EMAIL_CONTA.test(limparEmail(bruto))) {
    const uid = await acharLoginPorEmail(admin, limparEmail(bruto));
    if (uid) user = await lerUsuario(admin, uid) as typeof user;
  }
  const uid = user?.id ?? vazio.uid;
  if (!uid) return vazio;
  const { data: subs } = await admin.from("subscriptions").select("id, status, plan, billing_period, payment_method, amount_cents, current_period_end, abacatepay_billing_id").eq("user_id", uid).limit(20);
  const assinaturas = lista(subs).map(assinaturaResumo);
  const { data: dados } = await admin.from("user_data").select("key").eq("user_id", uid).limit(2000);
  return {
    encontrada: !!user, uid, email: user?.email ?? null,
    criado: user?.created_at ?? null, ultimoLogin: user?.last_sign_in_at ?? null,
    anonima: user?.is_anonymous === true || !user?.email,
    temAcesso: assinaturas.some((s) => acessoVivo(s)),
    chaves: lista(dados).length,
    assinaturas,
  };
}

export function recomendarResolucao(origem: ResumoConta, donaDoEmail: ResumoConta, email: string): {
  modo: "liberar_email" | "mover_acesso" | null; quemFica: string | null; quemSai: string | null; motivo: string;
} {
  if (!origem.uid || !donaDoEmail.uid || origem.uid === donaDoEmail.uid) return { modo: null, quemFica: null, quemSai: null, motivo: "mesma_conta" };
  if ((donaDoEmail.email ?? "").toLowerCase() !== limparEmail(email)) return { modo: null, quemFica: null, quemSai: null, motivo: "email_nao_bate" };
  if (donaDoEmail.temAcesso && origem.temAcesso) return { modo: null, quemFica: null, quemSai: null, motivo: "as_duas_tem_acesso" };
  if (donaDoEmail.temAcesso && !origem.temAcesso) return { modo: null, quemFica: donaDoEmail.uid, quemSai: null, motivo: "acesso_ja_no_email" };
  if (!donaDoEmail.temAcesso && donaDoEmail.chaves > 0 && origem.chaves === 0 && origem.temAcesso) {
    return { modo: "mover_acesso", quemFica: donaDoEmail.uid, quemSai: origem.uid, motivo: "a_conta_do_email_ja_tem_dados" };
  }
  if (!donaDoEmail.temAcesso) return { modo: "liberar_email", quemFica: origem.uid, quemSai: donaDoEmail.uid, motivo: "a_conta_do_email_esta_vazia" };
  return { modo: null, quemFica: null, quemSai: null, motivo: "sem_acao_segura" };
}

const aliasDaCasca = (email: string): string => {
  const [local, dominio] = email.split("@");
  return `${local}+casca${Date.now()}@${dominio}`;
};

/**
 * As duas contas disputam um e-mail. `confirmar` tem que ser o uid que vai
 * sair do caminho (ou perder a linha). Não manda e-mail.
 *   liberar_email — a casca (sem acesso) vai pra um alias +casca; a outra fica com o e-mail.
 *   mover_acesso  — as linhas próprias e os dados vazios no destino vão pra conta que já tem o e-mail.
 */
export async function resolverColisao(admin: Admin, args: {
  modo: string; quemFica: string; quemSai: string; email: string; confirmar: string; caller: string;
}): Promise<ResultadoAcao> {
  const email = limparEmail(args.email);
  const quemFica = String(args.quemFica ?? "").trim();
  const quemSai = String(args.quemSai ?? "").trim();
  const modo = String(args.modo ?? "");
  if (!EMAIL_CONTA.test(email)) return falha("email_invalido", 400);
  if (!UUID_CONTA.test(quemFica) || !UUID_CONTA.test(quemSai) || quemFica === quemSai) return falha("contas_invalidas", 400);
  if (args.confirmar !== quemSai) return falha("confirmar", 400);
  const fica = await resumoConta(admin, quemFica);
  const sai = await resumoConta(admin, quemSai);
  if (!fica.encontrada || !sai.encontrada) return falha("origem_nao_encontrada", 404);

  if (modo === "liberar_email") {
    if ((sai.email ?? "").toLowerCase() !== email) return falha("email_nao_bate", 409, { emailDaCasca: sai.email });
    if (sai.temAcesso) return falha("casca_tem_acesso", 409);
    const alias = aliasDaCasca(email);
    const park = await admin.auth.admin.updateUserById(quemSai, { email: alias, email_confirm: true });
    if (park?.error) return falha(`parquear_casca: ${park.error.message}`, 500);
    const troca = await trocarEmailAdmin(admin, { de: quemFica, para: email, caller: args.caller });
    if (!troca.ok) return troca;
    const detalhe = { ...troca.detalhe, modo, casca: quemSai, cascaParqueadaEm: alias };
    console.log(`[ADMIN-SUPORTE] resolver_email liberar_email casca ${quemSai} -> ${alias}; ${quemFica} fica com ${email} (por ${args.caller})`);
    await registrar(admin, quemFica, "admin_resolver_email", { modo, quemFica, quemSai, email, alias, por: args.caller });
    return { ok: true, detalhe };
  }

  if (modo === "mover_acesso") {
    if ((fica.email ?? "").toLowerCase() !== email) return falha("email_nao_bate", 409, { emailDoDestino: fica.email });
    if (fica.temAcesso) return falha("destino_ja_tem_assinatura", 409);
    if (!sai.temAcesso) return falha("origem_sem_acesso", 409);
    const { data } = await admin.from("subscriptions").select(COLUNAS_DECISAO).eq("user_id", quemSai);
    const proprias = linhasProprias((lista(data) as unknown) as LinhaAssinatura[]).filter((l) => l.status === "active" || l.status === "past_due" || l.status === "cancel_scheduled");
    if (!proprias.length) return falha("origem_sem_acesso", 409);
    for (const l of proprias) {
      const { error } = await admin.from("subscriptions").update({ user_id: quemFica, customer_email: email }).eq("id", l.id);
      if (error) return falha(`mover: ${error.message}`, 500);
    }
    const dados = await copiarDadosDaAnonima(admin, quemSai, quemFica);
    const detalhe = { modo, uid: quemFica, de: quemSai, email, linhas: proprias.length, dados };
    console.log(`[ADMIN-SUPORTE] resolver_email mover_acesso ${quemSai} -> ${quemFica} (${proprias.length} linhas, ${dados} chaves) por ${args.caller}`);
    await registrar(admin, quemFica, "admin_resolver_email", { ...detalhe, por: args.caller });
    return { ok: true, detalhe };
  }
  return falha("modo_invalido", 400);
}
