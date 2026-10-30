/**
 * AÇÕES DO /admin → Suporte (30/10).
 *
 * Duas operações que o painel chama na função admin-suporte. Nenhuma das duas
 * manda e-mail ao cliente (sem Resend, sem convite, sem link de confirmação:
 * o updateUserById vai com email_confirm, que grava o e-mail já confirmado).
 *
 *   · liberarPix        o "Pix pago sem e-mail". Acha a conta anônima pelo
 *                       uid do chamado ou pelo id do pedido/pagamento e a
 *                       conta de destino pelo e-mail de login, e MOVE a linha
 *                       que já existe (transferirCompraPix). Não cria acesso,
 *                       não duplica a venda.
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
import { COLUNAS_DECISAO, linhasProprias, type LinhaAssinatura } from "./linha-pix.ts";
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

/**
 * Resolve o chamado (deUid) ou o formulário avulso (pedido + e-mail) e chama
 * transferirCompraPix. Não cria conta e não concede acesso novo.
 */
export async function liberarPix(admin: Admin, args: {
  deUid?: string; paraUid?: string; pedido?: string; email?: string; caller: string;
}): Promise<ResultadoAcao> {
  const pedido = String(args.pedido ?? "").trim();
  const email = limparEmail(String(args.email ?? ""));
  let deUid = String(args.deUid ?? "").trim();
  let paraUid = String(args.paraUid ?? "").trim();

  if (pedido) {
    if (pedido.length > 200 || /\s/.test(pedido)) return falha("pedido_invalido", 400);
    const dono = await uidDoPedido(admin, pedido);
    if (!dono) return falha("pedido_nao_encontrado", 404);
    if (deUid && deUid !== dono) return falha("pedido_nao_bate", 409, { deUid, dono });
    deUid = dono;
  }
  if (email) {
    if (!EMAIL_CONTA.test(email) || email.length > 254) return falha("email_invalido", 400);
    const login = await acharLoginPorEmail(admin, email);
    if (!login) return falha("destino_nao_encontrado", 404);
    if (paraUid && paraUid !== login) return falha("email_nao_bate", 409);
    paraUid = login;
  }
  if (!deUid || !paraUid || deUid === paraUid) return falha("deUid/paraUid inválidos", 400);

  const r = await transferirCompraPix(admin, deUid, paraUid);
  if (r.erro) return falha(r.erro, r.status ?? 409, r.detalhe);
  const detalhe = { ...r.detalhe, deUid, para: email || null, pedido: pedido || null };
  console.log(`[ADMIN-SUPORTE] transferir_pix ${deUid} -> ${paraUid} (${detalhe.plan}, ${detalhe.amount_cents}) por ${args.caller}`);
  await registrar(admin, paraUid, "admin_transferir_pix", {
    de: deUid, para: paraUid, pedido: pedido || null, email: email || null, por: args.caller,
    plan: detalhe.plan ?? null, amount_cents: detalhe.amount_cents ?? null,
  });
  return { ok: true, detalhe };
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
  if (outra) return falha("destino_ja_existe", 409, { uidDestino: outra });

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
