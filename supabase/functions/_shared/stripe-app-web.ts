/**
 * FUNIL APP WEB (14/11, /funil-app) — o que o stripe-criar faz pra folha de pagamento do paywall do app na web.
 * Puro (Stripe e banco injetados; testado em src/test/funil-app-web-servidor.test.ts). NADA aqui roda pra /oferta.
 *
 *   acao "pix"     vitalício R$ 97,90 no Pix. O PI da ref (criarOuReaproveitar, oferta app_web) é confirmado AQUI com
 *                  payment_method_data[type]=pix. Já tem Pix vivo nessa ref → devolve o MESMO QR (nunca 2 Pix na mesma ref).
 *   acao "cartao"  vitalício R$ 97,90 no cartão, 1x a 3x. O navegador manda só o PaymentMethod (pm_…) e as parcelas. Se a
 *                  ref tem um Pix VIVO, ele é CANCELADO antes (o QR morre) e o cartão vai num PI novo da mesma ref — é a
 *                  trava contra pagar 2× (Pix + cartão). Se o cancelamento falha porque o Pix acabou de cair → "pago".
 *                  Parcelas: o PI recebe o payment_method, a Stripe devolve available_plans (doc "Accept installments",
 *                  API direta) e a confirmação leva payment_method_options[card][installments][plan] (fixed_count/month/N).
 *                  1x limpa um plano que tenha ficado de uma tentativa anterior.
 *   acao "assinar" mensal R$ 34,90/mês, só cartão (Subscription da Stripe, preço na env STRIPE_PRECO_MENSAL_34 — conferido:
 *                  3490 BRL/mês). Também mata o Pix vivo da ref antes. Customer + Subscription (default_incomplete) + confirma
 *                  o PI da 1ª fatura com o cartão. Assinatura incompleta da mesma ref (cartão recusado) é REAPROVEITADA com
 *                  o cartão novo — nunca 2 assinaturas pra mesma ref.
 *
 * Quem libera o acesso é sempre o stripe-webhook (payment_intent.succeeded pro vitalício, invoice.paid pro mensal).
 * Daqui só sai o estado pra tela. Nada de e-mail/segredo no log.
 */
import { criarOuReaproveitar, formUrl, maisNovoPrimeiro, pixDoIntento, type ChamarStripe, type PedidoStripe } from "./stripe-criar.ts";
import { MENSAL_APP_WEB, OFERTAS_STRIPE, precoMensalConfere } from "./stripe-ofertas.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };
export type DepsAppWeb = {
  admin: ClienteMin; stripe: ChamarStripe; log: (m: string, d?: Record<string, unknown>) => void;
  /** o id do preço mensal (env STRIPE_PRECO_MENSAL_34) */
  precoMensal: string | null;
  agoraMs?: number;
};
export type Ctx = { userId: string | null; ip: string | null };
export type RespostaAppWeb = { status: number; corpo: Record<string, unknown> };

const V = MENSAL_APP_WEB.apiVersion;
const erroDe = (j: Record<string, unknown>) => (j.error ?? {}) as { code?: string; decline_code?: string; type?: string; message?: string; payment_intent?: Record<string, unknown> };
export const PARCELAS_MAX_APP_WEB = OFERTAS_STRIPE.app_web.parcelasMax;

/** o PI tem um Pix pendente (QR vivo)? */
const temPixVivo = (j: Record<string, unknown>) => !!pixDoIntento(j);

/** o PI mais novo registrado pra esta ref (stripe_order_created). "erro" = o banco não respondeu (as travas param aí). */
async function piDaRef(admin: ClienteMin, ref: string): Promise<string | null | "erro"> {
  try {
    const { data, error } = await admin.from("analytics_events").select("event_data, created_at").eq("event_name", "stripe_order_created").eq("event_data->>ref", ref).limit(50);
    if (error) return "erro";
    return maisNovoPrimeiro((data ?? []) as Array<{ event_data?: { pi?: string; pagina?: string }; created_at?: string }>).filter((l) => l.event_data?.pagina === "app_web").map((l) => l.event_data?.pi).find((x): x is string => typeof x === "string" && /^pi_/.test(x)) ?? null;
  } catch { return "erro"; }
}
/** as assinaturas desta ref (stripe_assinatura_criada), a mais nova primeiro. "erro" = o banco não respondeu. */
async function assinaturasDaRef(admin: ClienteMin, ref: string): Promise<Array<{ sub: string; cus: string | null }> | "erro"> {
  try {
    const { data, error } = await admin.from("analytics_events").select("event_data, created_at").eq("event_name", "stripe_assinatura_criada").eq("event_data->>ref", ref).limit(50);
    if (error) return "erro";
    return maisNovoPrimeiro((data ?? []) as Array<{ event_data?: { sub?: string; cus?: string }; created_at?: string }>)
      .filter((x) => typeof x.event_data?.sub === "string" && /^sub_/.test(x.event_data.sub))
      .map((x) => ({ sub: x.event_data!.sub!, cus: typeof x.event_data!.cus === "string" ? x.event_data!.cus : null }));
  } catch { return "erro"; }
}

/** a assinatura desta ref já está paga (active/trialing/past_due)? Ou incompleta (reaproveitar)? "erro" = não deu pra saber → não cobra */
async function estadoDaAssinatura(deps: DepsAppWeb, ref: string): Promise<{ estado: "paga" | "incompleta" | "nenhuma" | "erro"; sub?: Record<string, unknown>; cus?: string | null; total?: number }> {
  const todas = await assinaturasDaRef(deps.admin, ref);
  if (todas === "erro") return { estado: "erro" };
  const a = todas[0];
  if (!a) return { estado: "nenhuma", total: 0 };
  const r = await deps.stripe(`subscriptions/${a.sub}?expand[]=latest_invoice.payment_intent`, null, undefined, V);
  if (!r.ok) return { estado: "erro" };
  const st = String(r.j.status ?? "");
  const cus = a.cus ?? (typeof r.j.customer === "string" ? r.j.customer : null);
  if (st === "active" || st === "trialing" || st === "past_due") return { estado: "paga", sub: r.j, cus, total: todas.length };
  if (st === "incomplete") return { estado: "incompleta", sub: r.j, cus, total: todas.length };
  return { estado: "nenhuma", cus, total: todas.length };
}

/**
 * A TRAVA contra pagar 2×: o Pix vivo da ref morre antes de qualquer cartão/assinatura.
 * "pago" = o vitalício desta ref já pagou (não cobra mais nada); "ok" = não há Pix vivo; "erro" = não deu pra matar o Pix
 * OU não deu pra saber (banco/Stripe sem resposta) — a tela fica no Pix, nunca abre o cartão com QR pagável.
 */
export async function matarPixDaRef(deps: DepsAppWeb, ref: string): Promise<"ok" | "pago" | "erro"> {
  const pi = await piDaRef(deps.admin, ref);
  if (pi === "erro") return "erro";
  if (!pi) return "ok";
  const atual = await deps.stripe(`payment_intents/${pi}`, null);
  if (!atual.ok) return "erro";
  if (String(atual.j.status) === "succeeded") return "pago";
  if (!temPixVivo(atual.j)) return "ok";
  const c = await deps.stripe(`payment_intents/${pi}/cancel`, [["cancellation_reason", "abandoned"]]);
  if (c.ok && String(c.j.status) === "canceled") { deps.log("Pix vivo cancelado (trocou de forma de pagar)", { pi }); return "ok"; }
  const depois = await deps.stripe(`payment_intents/${pi}`, null);
  if (depois.ok && String(depois.j.status) === "succeeded") return "pago";
  if (depois.ok && String(depois.j.status) === "canceled") return "ok";
  deps.log("Pix vivo NÃO cancelou", { pi, code: String(erroDe(c.j).code ?? "") });
  return "erro";
}

/**
 * 14/11 (revisão): UMA cobrança por vez por ref (2 abas: cartão vitalício + mensal, ou 2 mensais, ao mesmo tempo). Trava
 * atômica em webhook_events (id único `appweb-cobrando:<ref>`); a 2ª aba recebe "em_andamento" e tenta de novo — e aí as
 * travas de sempre (PI pago / assinatura paga) respondem "pago" em vez de cobrar de novo. A trava vence em 2 min (aba que
 * morreu no meio não prende a ref pra sempre).
 */
const TRAVA_MS = 120_000;
async function travarRef(admin: ClienteMin, ref: string, agoraMs = Date.now()): Promise<boolean> {
  const id = `appweb-cobrando:${ref}`;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const { error } = await admin.from("webhook_events").insert({ id, source: "stripe", event: `trava:${agoraMs}` });
      if (!error) return true;
      if ((error as { code?: string }).code !== "23505") return false;
      const { data } = await admin.from("webhook_events").select("id, event").eq("id", id).maybeSingle();
      const m = /^trava:(\d+)$/.exec(String((data as { event?: string } | null)?.event ?? ""));
      const desde = m ? Number(m[1]) : NaN;
      // sem conseguir ler a hora da trava, ela vale (nunca solta a trava de outra aba no escuro)
      if (!Number.isFinite(desde) || agoraMs - desde < TRAVA_MS) return false;
      await admin.from("webhook_events").delete().eq("id", id); // trava velha (aba morreu): solta e tenta 1×
    } catch { return false; }
  }
  return false;
}
async function soltarRef(admin: ClienteMin, ref: string) { try { await admin.from("webhook_events").delete().eq("id", `appweb-cobrando:${ref}`); } catch { /* vence sozinha */ } }
const EM_ANDAMENTO: RespostaAppWeb = { status: 409, corpo: { ok: false, erro: "em_andamento" } };
const INDISPONIVEL: RespostaAppWeb = { status: 503, corpo: { ok: false, erro: "indisponivel" } };
async function comTrava(deps: DepsAppWeb, ref: string, fazer: () => Promise<RespostaAppWeb>): Promise<RespostaAppWeb> {
  if (!(await travarRef(deps.admin, ref, deps.agoraMs))) return EM_ANDAMENTO;
  try { return await fazer(); } finally { await soltarRef(deps.admin, ref); }
}

/** o que a tela recebe de um PI depois de confirmar (pago / 3DS / recusado / esperando) */
function resultadoDoPi(j: Record<string, unknown>, extra: Record<string, unknown> = {}): RespostaAppWeb {
  const st = String(j.status ?? "");
  if (st === "succeeded") return { status: 200, corpo: { ok: true, pago: true, pi: j.id, ...extra } };
  if (st === "requires_action") return { status: 200, corpo: { ok: true, acao: true, client_secret: j.client_secret, pi: j.id, ...extra } };
  if (st === "processing") return { status: 200, corpo: { ok: true, processando: true, pi: j.id, ...extra } };
  const e = (j.last_payment_error ?? {}) as { code?: string; decline_code?: string; message?: string };
  return { status: 200, corpo: { ok: false, recusado: true, pi: j.id, code: String(e.decline_code ?? e.code ?? "recusado").slice(0, 40), ...extra } };
}
/** erro HTTP da Stripe no confirmar (cartão recusado vem como 402 com o PI dentro) */
function resultadoDoErro(j: Record<string, unknown>, extra: Record<string, unknown> = {}): RespostaAppWeb {
  const e = erroDe(j);
  if (e.type === "card_error") return { status: 200, corpo: { ok: false, recusado: true, code: String(e.decline_code ?? e.code ?? "recusado").slice(0, 40), ...(e.payment_intent?.id ? { pi: e.payment_intent.id } : {}), ...extra } };
  return { status: 502, corpo: { ok: false, code: String(e.code ?? "").slice(0, 40), ...extra } };
}

/* ───────────────────────── Pix (vitalício) ───────────────────────── */
export async function pixAppWeb(deps: DepsAppWeb, p: PedidoStripe, md: Record<string, string>, ctx: Ctx): Promise<RespostaAppWeb> {
  if (!p.email) return { status: 400, corpo: { ok: false, erro: "email" } };
  return comTrava(deps, p.ref, () => pixSemTrava(deps, p, md, ctx));
}
async function pixSemTrava(deps: DepsAppWeb, p: PedidoStripe, md: Record<string, string>, ctx: Ctx): Promise<RespostaAppWeb> {
  const sub = await estadoDaAssinatura(deps, p.ref);
  if (sub.estado === "erro") return INDISPONIVEL;
  if (sub.estado === "paga") return { status: 200, corpo: { ok: true, pago: true, plano: "mensal" } };
  const r = await criarOuReaproveitar(deps, { ...p, pagina: "app_web" }, md, ctx);
  if (r.status !== 200) return r;
  const c = r.corpo as { pi: string; status: string; pix: unknown };
  if (c.status === "succeeded") return { status: 200, corpo: { ok: true, pago: true, pi: c.pi, plano: "vitalicio" } };
  if (c.pix) return { status: 200, corpo: { ok: true, pi: c.pi, pix: c.pix, plano: "vitalicio", mesmo: true } };
  const conf = await deps.stripe(`payment_intents/${c.pi}/confirm`, [
    ["payment_method_data[type]", "pix"], ["payment_method_data[billing_details][email]", p.email],
  ]);
  if (!conf.ok) { deps.log("Pix não gerou", { pi: c.pi, code: String(erroDe(conf.j).code ?? "") }); return { status: 502, corpo: { ok: false } }; }
  if (String(conf.j.status) === "succeeded") return { status: 200, corpo: { ok: true, pago: true, pi: c.pi, plano: "vitalicio" } };
  const pix = pixDoIntento(conf.j);
  if (!pix) return { status: 502, corpo: { ok: false, erro: "sem_qr" } };
  return { status: 200, corpo: { ok: true, pi: c.pi, pix, plano: "vitalicio" } };
}

/* ───────────────────────── cartão (vitalício, 1x–3x) ───────────────────────── */
export type PedidoCartao = { pm: string; parcelas: number; returnUrl: string };
export async function cartaoAppWeb(deps: DepsAppWeb, p: PedidoStripe, md: Record<string, string>, ctx: Ctx, c: PedidoCartao): Promise<RespostaAppWeb> {
  if (!p.email) return { status: 400, corpo: { ok: false, erro: "email" } };
  if (!Number.isInteger(c.parcelas) || c.parcelas < 1 || c.parcelas > PARCELAS_MAX_APP_WEB) return { status: 400, corpo: { ok: false, erro: "parcelas" } };
  return comTrava(deps, p.ref, () => cartaoSemTrava(deps, p, md, ctx, c));
}
async function cartaoSemTrava(deps: DepsAppWeb, p: PedidoStripe, md: Record<string, string>, ctx: Ctx, c: PedidoCartao): Promise<RespostaAppWeb> {
  const sub = await estadoDaAssinatura(deps, p.ref);
  if (sub.estado === "erro") return INDISPONIVEL;
  if (sub.estado === "paga") return { status: 200, corpo: { ok: true, pago: true, plano: "mensal" } };
  const morto = await matarPixDaRef(deps, p.ref);
  if (morto === "pago") return { status: 200, corpo: { ok: true, pago: true, plano: "vitalicio", metodo: "pix" } };
  if (morto === "erro") return { status: 409, corpo: { ok: false, erro: "pix_vivo" } };
  const r = await criarOuReaproveitar(deps, { ...p, pagina: "app_web", pi: null }, md, ctx);
  if (r.status !== 200) return r;
  const k = r.corpo as { pi: string; status: string; pix: unknown };
  if (k.status === "succeeded") return { status: 200, corpo: { ok: true, pago: true, pi: k.pi, plano: "vitalicio" } };
  if (k.pix) return { status: 409, corpo: { ok: false, erro: "pix_vivo" } }; // nunca: o Pix acabou de morrer
  // o cartão no PI → a Stripe devolve os planos de parcelamento que ESTE cartão aceita
  const up = await deps.stripe(`payment_intents/${k.pi}`, [["payment_method", c.pm]]);
  if (!up.ok) return resultadoDoErro(up.j, { plano: "vitalicio" });
  const planos = (((up.j.payment_method_options as Record<string, unknown> | undefined)?.card as Record<string, unknown> | undefined)?.installments as { available_plans?: Array<{ count?: number; interval?: string; type?: string }> } | undefined)?.available_plans ?? [];
  const pares: Array<[string, string]> = [["return_url", c.returnUrl]];
  if (c.parcelas > 1) {
    const ok = planos.some((x) => x.count === c.parcelas && x.interval === "month" && x.type === "fixed_count");
    if (!ok) {
      const max = Math.max(1, ...planos.filter((x) => x.interval === "month" && x.type === "fixed_count" && (x.count ?? 0) <= PARCELAS_MAX_APP_WEB).map((x) => x.count ?? 1));
      deps.log("parcelas indisponíveis neste cartão", { pi: k.pi, pediu: c.parcelas, max });
      return { status: 200, corpo: { ok: false, erro: "parcelas_indisponiveis", max, pi: k.pi } };
    }
    pares.push(["payment_method_options[card][installments][plan][type]", "fixed_count"], ["payment_method_options[card][installments][plan][interval]", "month"], ["payment_method_options[card][installments][plan][count]", String(c.parcelas)]);
  } else {
    pares.push(["payment_method_options[card][installments][plan]", ""]); // à vista: tira o plano de uma tentativa anterior
  }
  const conf = await deps.stripe(`payment_intents/${k.pi}/confirm`, pares);
  if (!conf.ok) return resultadoDoErro(conf.j, { plano: "vitalicio", pi: k.pi });
  return resultadoDoPi(conf.j, { plano: "vitalicio", parcelas: c.parcelas });
}

/* ───────────────────────── mensal (assinatura no cartão) ───────────────────────── */
export async function assinarAppWeb(deps: DepsAppWeb, p: PedidoStripe, md: Record<string, string>, ctx: Ctx, c: { pm: string; returnUrl: string }): Promise<RespostaAppWeb> {
  const { stripe, log } = deps;
  if (!p.email) return { status: 400, corpo: { ok: false, erro: "email" } };
  if (!deps.precoMensal || !/^price_[A-Za-z0-9]+$/.test(deps.precoMensal)) { log("sem STRIPE_PRECO_MENSAL_34"); return { status: 503, corpo: { ok: false, erro: "mensal_indisponivel" } }; }
  const preco = await stripe(`prices/${deps.precoMensal}`, null, undefined, V);
  if (!preco.ok || !precoMensalConfere(preco.j)) { log("preço mensal não confere (3490 BRL/mês)", { ok: preco.ok }); return { status: 503, corpo: { ok: false, erro: "mensal_indisponivel" } }; }
  return comTrava(deps, p.ref, () => assinarSemTrava(deps, p, md, ctx, c));
}
async function assinarSemTrava(deps: DepsAppWeb, p: PedidoStripe, md: Record<string, string>, ctx: Ctx, c: { pm: string; returnUrl: string }): Promise<RespostaAppWeb> {
  const { stripe, log } = deps;
  const precoMensal = deps.precoMensal!;
  // 14/11 (revisão): o vitalício desta ref já pagou (cartão numa aba, mensal na outra) → não assina por cima
  const morto = await matarPixDaRef(deps, p.ref);
  if (morto === "pago") return { status: 200, corpo: { ok: true, pago: true, plano: "vitalicio", metodo: "pix" } };
  if (morto === "erro") return { status: 409, corpo: { ok: false, erro: "pix_vivo" } };

  const mdSub: Array<[string, string]> = Object.entries({ ...md, pagina: MENSAL_APP_WEB.pagina }).map(([k, v]) => [`metadata[${k}]`, v]);
  const atual = await estadoDaAssinatura(deps, p.ref);
  if (atual.estado === "erro") return INDISPONIVEL;
  if (atual.estado === "paga") return { status: 200, corpo: { ok: true, pago: true, plano: "mensal", sub: atual.sub?.id } };

  let sub: Record<string, unknown>;
  let cus: string | null = null;
  if (atual.estado === "incompleta" && atual.sub) {
    // cartão recusado antes: a MESMA assinatura com o cartão novo
    sub = atual.sub; cus = atual.cus ?? null;
    if (cus) {
      const at = await stripe(`payment_methods/${c.pm}/attach`, [["customer", cus]], undefined, V);
      if (!at.ok) return resultadoDoErro(at.j, { plano: "mensal", sub: sub.id });
      await stripe(`customers/${cus}`, [["invoice_settings[default_payment_method]", c.pm]], undefined, V);
      await stripe(`subscriptions/${String(sub.id)}`, [["default_payment_method", c.pm]], undefined, V);
    }
  } else {
    if (!(await ipPodeAssinar(deps.admin, ctx.ip, deps.agoraMs))) { log("limite por IP (assinar)"); return { status: 429, corpo: { ok: false, limite: true } }; }
    // 14/11 (revisão): o cliente da ref é reaproveitado (assinatura anterior vencida); a chave da assinatura é por ref +
    // tentativa (nº de assinaturas já registradas), nunca pelo cartão — 2 cliques com cartões diferentes não viram 2 assinaturas
    // (a trava da ref já serializa; a chave cobre o reenvio do mesmo pedido)
    cus = atual.cus ?? null;
    if (!cus) {
      const cr = await stripe("customers", [
        ["email", p.email!], ["metadata[ref]", p.ref], ...(md.user_id ? [["metadata[user_id]", md.user_id] as [string, string]] : []),
      ], `appweb-cus-${p.ref}`, V);
      if (!cr.ok) return resultadoDoErro(cr.j, { plano: "mensal" });
      cus = String(cr.j.id);
    }
    const at = await stripe(`payment_methods/${c.pm}/attach`, [["customer", cus]], undefined, V);
    if (!at.ok) return resultadoDoErro(at.j, { plano: "mensal" });
    const sr = await stripe("subscriptions", [
      ["customer", cus], ["items[0][price]", precoMensal], ["default_payment_method", c.pm],
      ["payment_behavior", "default_incomplete"], ["payment_settings[payment_method_types][0]", "card"],
      ["payment_settings[save_default_payment_method]", "on_subscription"], ["expand[0]", "latest_invoice.payment_intent"],
      ["description", "CORE mensal"], ...mdSub,
    ], `appweb-sub-${p.ref}-${(atual.total ?? 0) + 1}`, V);
    if (!sr.ok) return resultadoDoErro(sr.j, { plano: "mensal" });
    sub = sr.j;
    try { await deps.admin.from("analytics_events").insert({ event_name: "stripe_assinatura_criada", user_id: ctx.userId, session_id: p.landing_session_id, event_data: { ref: p.ref, sub: sub.id, cus, pagina: MENSAL_APP_WEB.pagina, ...(ctx.ip ? { client_ip: ctx.ip } : {}), ...p.atrib } }); } catch { /* a assinatura existe; a recarga acha pela chave de idempotência */ }
  }
  const fatura = (sub.latest_invoice ?? {}) as Record<string, unknown>;
  const piFat = (fatura.payment_intent && typeof fatura.payment_intent === "object" ? fatura.payment_intent : null) as Record<string, unknown> | null;
  if (String(sub.status) === "active" || fatura.status === "paid") return { status: 200, corpo: { ok: true, pago: true, plano: "mensal", sub: sub.id } };
  if (!piFat?.id) { log("assinatura sem PI na 1ª fatura", { sub: String(sub.id) }); return { status: 502, corpo: { ok: false, plano: "mensal" } }; }
  // o PI da 1ª fatura ganha a ref/página: o stripe-status responde por ele e o webhook não confunde com venda avulsa
  await stripe(`payment_intents/${String(piFat.id)}`, [["metadata[ref]", p.ref], ["metadata[pagina]", MENSAL_APP_WEB.pagina], ["metadata[sub]", String(sub.id)]], undefined, V);
  const conf = await stripe(`payment_intents/${String(piFat.id)}/confirm`, [["payment_method", c.pm], ["return_url", c.returnUrl]], undefined, V);
  if (!conf.ok) return resultadoDoErro(conf.j, { plano: "mensal", sub: sub.id, pi: piFat.id });
  return resultadoDoPi(conf.j, { plano: "mensal", sub: sub.id });
}

/** limite de assinaturas novas por IP (mesmos 20 em 10 min do criar) */
async function ipPodeAssinar(admin: ClienteMin, ip: string | null, agoraMs: number = Date.now()): Promise<boolean> {
  if (!ip) return true;
  try {
    const { count, error } = await admin.from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event_name", "stripe_assinatura_criada").eq("event_data->>client_ip", ip)
      .gte("created_at", new Date(agoraMs - 10 * 60_000).toISOString());
    if (error || typeof count !== "number") return true;
    return count < 20;
  } catch { return true; }
}

/** o corpo de uma ação do funil app web (pm e parcelas validados aqui; o resto é o PedidoStripe de sempre) */
export function validarAcaoAppWeb(b: unknown): { acao: "pix" | "cartao" | "assinar"; pm: string | null; parcelas: number } | null {
  const x = (b ?? {}) as Record<string, unknown>;
  const acao = x.acao === "pix" || x.acao === "cartao" || x.acao === "assinar" ? x.acao : null;
  if (!acao) return null;
  const pm = typeof x.pm === "string" && /^pm_[A-Za-z0-9_]{6,80}$/.test(x.pm) ? x.pm : null;
  if ((acao === "cartao" || acao === "assinar") && !pm) return null;
  const parcelas = acao === "cartao" ? Number(x.parcelas ?? 1) : 1;
  return { acao, pm, parcelas };
}

/** a volta do banco (3DS com redirecionamento) cai de novo no funil, no paywall, que reabre a folha */
export const RETORNO_APP_WEB = "https://www.coreaplicativo.com.br/funil-app?step=offer";
export { formUrl };
