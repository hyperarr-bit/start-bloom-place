/**
 * PRESENTE PELA STRIPE (15/11) — "Leve alguém junto" a R$ 24,90 pra quem comprou o CORE pra sempre na /oferta (R$ 67,90, Stripe).
 * Puro (Stripe e banco injetados; testado em src/test/stripe-presente.test.ts). Endpoints em ../stripe-presente/index.ts.
 *
 *   quem      a COMPRA PRINCIPAL: um PaymentIntent da /oferta pago (metadata.pagina "oferta", 6790 BRL, succeeded). Chega por 2 portas:
 *             a aba da compra ({ref, pi}: a mesma prova do stripe-status) ou o token do dia 3 / da página Você ({t} → a conta → a
 *             linha vitalícia "stripe" de 6790 dela → o PI).
 *   o PI      UM PaymentIntent de presente por compra principal (Idempotency-Key presente-oferta-<pi principal>; registro
 *             stripe_presente_criado pra achar depois das 24 h da chave), 2490 BRL, cartão + Pix, metadata.pagina "presente_oferta".
 *             Um PI só paga uma vez: nunca 2 cobranças pelo mesmo presente.
 *   cartão    1 toque: o cartão da compra principal (só se o PI dela tinha setup_future_usage — a chave UPSELL_OFERTA) é anexado a um
 *             customer (o da compra, ou um novo com metadata.pi_principal) e o PI do presente é confirmado com ele (on-session). 3DS →
 *             a página termina com handleNextAction. Recusa → o mesmo PI aceita o Pix. A confirmação tem Idempotency-Key própria
 *             (presente-cartao-<pi do presente>): 2 toques = 1 tentativa.
 *   Pix       o mesmo PI confirmado com Pix (24 h). Pix vivo → o MESMO QR.
 *   pago      o código do presente (tabela presentes, garantirPresente, pedido = id do PI do presente, 2490) assim que a conta da
 *             compra principal existe (o webhook dela). O stripe-webhook também cria (e manda o link por e-mail). Sem Purchase pra Meta.
 * Valor SEMPRE daqui. Nada de e-mail/segredo no log.
 */
import { maisNovoPrimeiro, pixDoIntento, type ChamarStripe } from "./stripe-criar.ts";
import { OFERTAS_STRIPE } from "./stripe-ofertas.ts";
import { garantirPresente, nomeNoCartao, presentePorPedido } from "./presente.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

export const PRESENTE_STRIPE = { pagina: "presente_oferta", centavos: 2490, idem: "presente-oferta", descricao: "CORE de presente", pixSegundos: 86_400 } as const;
/** a compra principal que dá direito ao presente de 24,90 (a /oferta) */
export const OFERTA_DO_PRESENTE = OFERTAS_STRIPE.oferta;
export const RETORNO_PRESENTE = "https://www.coreaplicativo.com.br/oferta";

export type DepsPresente = { admin: ClienteMin; stripe: ChamarStripe; log: (m: string, d?: Record<string, unknown>) => void };
export type RespostaPresente = { status: number; corpo: Record<string, unknown> };
type J = Record<string, unknown>;
const ok = (corpo: J): RespostaPresente => ({ status: 200, corpo: { ok: true, preco: PRESENTE_STRIPE.centavos, ...corpo } });
const nao = (motivo: string, status = 200, extra: J = {}): RespostaPresente => ({ status, corpo: { ok: false, motivo, ...extra } });
const erroDe = (j: J) => (j.error ?? {}) as { code?: string; decline_code?: string; type?: string; payment_intent?: J };

/* ───────────────────────── a compra principal ───────────────────────── */
export type Compra = { pi: J; id: string; email: string | null; ref: string | null };

/** o PI principal confere? (pago, da /oferta, 6790 BRL) */
export function compraValida(pi: J | null | undefined): boolean {
  if (!pi || typeof pi.id !== "string" || !/^pi_/.test(pi.id)) return false;
  const md = (pi.metadata ?? {}) as Record<string, string>;
  return pi.status === "succeeded" && md.pagina === OFERTA_DO_PRESENTE.pagina && pi.currency === "brl"
    && (Number(pi.amount_received) || Number(pi.amount)) === OFERTA_DO_PRESENTE.centavos;
}
async function lerCompra(deps: DepsPresente, pi: string): Promise<Compra | null> {
  if (!/^pi_[A-Za-z0-9]+$/.test(pi)) return null;
  const r = await deps.stripe(`payment_intents/${pi}?expand[]=latest_charge&expand[]=payment_method`, null);
  if (!r.ok || !compraValida(r.j)) return null;
  const md = (r.j.metadata ?? {}) as Record<string, string>;
  const email = (md.email || (typeof r.j.receipt_email === "string" ? r.j.receipt_email : "") || "").toLowerCase() || null;
  return { pi: r.j, id: String(r.j.id), email, ref: md.ref ?? null };
}
/** porta 1: a aba da compra (a mesma prova do stripe-status: o PI é desta ref) */
export async function compraPorRef(deps: DepsPresente, ref: unknown, pi: unknown): Promise<Compra | null> {
  if (typeof ref !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(ref) || typeof pi !== "string") return null;
  const c = await lerCompra(deps, pi);
  return c && c.ref === ref ? c : null;
}
/** porta 2: a conta (token do dia 3 / página Você) → a linha vitalícia Stripe de 6790 ativa → o PI */
export async function compraDoDono(deps: DepsPresente, dono: string): Promise<Compra | null> {
  try {
    const { data } = await deps.admin.from("subscriptions").select("abacatepay_billing_id, status, payment_method, billing_period, amount_cents, created_at").eq("user_id", dono);
    const linhas = ((data ?? []) as Array<{ abacatepay_billing_id?: string; status?: string; payment_method?: string; billing_period?: string; amount_cents?: number; created_at?: string }>)
      .filter((l) => l.payment_method === "stripe" && l.status === "active" && l.billing_period === "lifetime" && l.amount_cents === OFERTA_DO_PRESENTE.centavos && /^pi_/.test(String(l.abacatepay_billing_id ?? "")));
    const l = maisNovoPrimeiro(linhas)[0];
    return l ? await lerCompra(deps, String(l.abacatepay_billing_id)) : null;
  } catch { return null; }
}
/** a conta da compra principal (a linha que o webhook criou). null = ainda não chegou */
export async function donoDaCompra(admin: ClienteMin, piPrincipal: string): Promise<string | null> {
  try {
    const { data } = await admin.from("subscriptions").select("user_id").eq("abacatepay_billing_id", piPrincipal).eq("payment_method", "stripe");
    const l = (Array.isArray(data) ? data[0] : data) as { user_id?: string } | undefined;
    return l?.user_id ?? null;
  } catch { return null; }
}

/** o cartão salvo da compra principal (só se foi no cartão E o PI tinha setup_future_usage) */
export function cartaoSalvo(pi: J): { pm: string; customer: string | null; marca: string | null; final: string | null } | null {
  const opc = ((pi.payment_method_options as J | undefined)?.card ?? {}) as { setup_future_usage?: string };
  const sfu = opc.setup_future_usage ?? (pi.setup_future_usage as string | undefined);
  if (sfu !== "on_session" && sfu !== "off_session") return null;
  const lc = (pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : {}) as { payment_method_details?: { type?: string } };
  if (lc.payment_method_details?.type !== "card") return null;
  const pm = pi.payment_method as J | string | null | undefined;
  const id = typeof pm === "string" ? pm : typeof pm?.id === "string" ? pm.id : null;
  if (!id || !/^pm_/.test(id)) return null;
  const card = (typeof pm === "object" && pm ? (pm.card as { brand?: string; last4?: string } | undefined) : undefined) ?? {};
  const cusPm = typeof pm === "object" && pm && typeof pm.customer === "string" ? pm.customer : null;
  return { pm: id, customer: cusPm ?? (typeof pi.customer === "string" ? pi.customer : null), marca: card.brand ?? null, final: card.last4 ?? null };
}

/* ───────────────────────── o PI do presente ───────────────────────── */
export function paramsPresente(c: Compra, n = 1): { pares: Array<[string, string]>; idem: string } {
  const md = (c.pi.metadata ?? {}) as Record<string, string>;
  const pares: Array<[string, string]> = [
    ["amount", String(PRESENTE_STRIPE.centavos)], ["currency", "brl"],
    ["payment_method_types[]", "card"], ["payment_method_types[]", "pix"],
    ["payment_method_options[pix][expires_after_seconds]", String(PRESENTE_STRIPE.pixSegundos)],
    ["description", PRESENTE_STRIPE.descricao], ["statement_descriptor_suffix", "CORE"],
    ["metadata[pagina]", PRESENTE_STRIPE.pagina], ["metadata[pi_principal]", c.id],
  ];
  if (md.ref) pares.push(["metadata[ref]", md.ref]);
  if (md.user_id) pares.push(["metadata[user_id]", md.user_id]);
  if (c.email) pares.push(["metadata[email]", c.email], ["receipt_email", c.email]);
  return { pares, idem: `${PRESENTE_STRIPE.idem}-${c.id}${n > 1 ? `-${n}` : ""}` };
}
const doPresente = (j: J, c: Compra) => ((j.metadata ?? {}) as Record<string, string>).pi_principal === c.id && ((j.metadata ?? {}) as Record<string, string>).pagina === PRESENTE_STRIPE.pagina;

/** o PI do presente desta compra que já existe (sem criar). "erro" = não deu pra saber */
export async function presenteExistente(deps: DepsPresente, c: Compra): Promise<J | null | "erro"> {
  try {
    const { data, error } = await deps.admin.from("analytics_events").select("event_data, created_at").eq("event_name", "stripe_presente_criado").eq("event_data->>pi_principal", c.id).order("created_at", { ascending: false }).limit(20);
    if (error) return "erro";
    const pi = maisNovoPrimeiro((data ?? []) as Array<{ event_data?: { pi?: string }; created_at?: string }>).map((l) => l.event_data?.pi).find((x): x is string => typeof x === "string" && /^pi_/.test(x));
    if (!pi) return null;
    const r = await deps.stripe(`payment_intents/${pi}`, null);
    if (!r.ok) return "erro";
    return doPresente(r.j, c) ? r.j : null;
  } catch { return "erro"; }
}
/** o PI do presente (o que existe, ou cria). Cancelado → outro com a chave -2, -3… */
export async function garantirPiPresente(deps: DepsPresente, c: Compra): Promise<J | null> {
  const ja = await presenteExistente(deps, c);
  if (ja === "erro") return null;
  if (ja && ja.status !== "canceled") return ja;
  for (let n = 1; n <= 6; n++) {
    const { pares, idem } = paramsPresente(c, n);
    const r = await deps.stripe("payment_intents", pares, idem);
    if (!r.ok || !doPresente(r.j, c)) { deps.log("presente: criar falhou", { code: String(erroDe(r.j).code ?? "") }); return null; }
    const atual = await deps.stripe(`payment_intents/${String(r.j.id)}`, null);
    const j = atual.ok ? atual.j : r.j;
    if (j.status === "canceled") continue;
    try { await deps.admin.from("analytics_events").insert({ event_name: "stripe_presente_criado", user_id: null, event_data: { pi: j.id, pi_principal: c.id, valor_cents: PRESENTE_STRIPE.centavos } }); } catch { /* a chave ainda segura por 24 h */ }
    return j;
  }
  return null;
}

/** pago → o código (se a conta da compra já existe). Nunca lança. */
export async function codigoDoPago(deps: DepsPresente, piPresente: string, piPrincipal: string): Promise<{ codigo: string | null; de: string | null }> {
  try {
    const ja = await presentePorPedido(deps.admin, piPresente);
    if (ja) return { codigo: ja.codigo, de: ja.de_nome ?? null };
    const dono = await donoDaCompra(deps.admin, piPrincipal);
    if (!dono) return { codigo: null, de: null };
    const g = await garantirPresente(deps.admin, { orderId: piPresente, compradorId: dono, valorCentavos: PRESENTE_STRIPE.centavos });
    return { codigo: g?.codigo ?? null, de: null };
  } catch { return { codigo: null, de: null }; }
}
async function pagoCom(deps: DepsPresente, j: J, c: Compra, via: string): Promise<RespostaPresente> {
  const k = await codigoDoPago(deps, String(j.id), c.id);
  return ok({ pago: true, pedido: j.id, codigo: k.codigo, de: k.de, via });
}
const pixDe = (j: J) => { const p = pixDoIntento(j); return p ? { orderId: String(j.id), qrCode: p.data ?? "", expiresAt: new Date((p.expires_at ?? Math.floor(Date.now() / 1000) + PRESENTE_STRIPE.pixSegundos) * 1000).toISOString(), imagem: p.image_url_png ?? null } : null; };

/* ───────────────────────── as ações ───────────────────────── */
/** o que a tela precisa (sem criar nada): o preço, o cartão salvo (marca/final), o Pix vivo, ou já pago + o código */
export async function estadoPresente(deps: DepsPresente, c: Compra): Promise<RespostaPresente> {
  const cs = cartaoSalvo(c.pi);
  const cartao = cs ? { marca: cs.marca, final: cs.final } : null;
  const ja = await presenteExistente(deps, c);
  if (ja && ja !== "erro") {
    if (ja.status === "succeeded") return pagoCom(deps, ja, c, "estado");
    const pix = pixDe(ja);
    if (pix) return ok({ pago: false, cartao, pix });
  }
  return ok({ pago: false, cartao, pix: null });
}

/** 1 toque no cartão salvo */
export async function cartaoPresente(deps: DepsPresente, c: Compra, retorno: string = RETORNO_PRESENTE): Promise<RespostaPresente> {
  const cs = cartaoSalvo(c.pi);
  if (!cs) return nao("sem_cartao");
  const j = await garantirPiPresente(deps, c);
  if (!j) return nao("indisponivel", 503);
  if (j.status === "succeeded") return pagoCom(deps, j, c, "cartao");
  const vivo = pixDe(j);
  if (vivo) return nao("pix_vivo", 200, { pix: vivo });
  if (j.status === "processing") return ok({ processando: true, pedido: j.id });
  // o customer: o do cartão (tem que ser DESTA compra) ou um novo, só desta compra
  let cus = cs.customer;
  if (cus) {
    const k = await deps.stripe(`customers/${cus}`, null);
    const mdc = ((k.j.metadata ?? {}) as Record<string, string>);
    if (!k.ok || (mdc.pi_principal && mdc.pi_principal !== c.id) || (typeof c.pi.customer === "string" && c.pi.customer !== cus)) return nao("outro_cliente");
  } else {
    const pares: Array<[string, string]> = [["metadata[pi_principal]", c.id], ["metadata[origem]", "presente_oferta"]];
    if (c.email) pares.push(["email", c.email]);
    const k = await deps.stripe("customers", pares, `presente-cus-${c.id}`);
    if (!k.ok || typeof k.j.id !== "string") return nao("indisponivel", 503);
    cus = k.j.id;
    const a = await deps.stripe(`payment_methods/${cs.pm}/attach`, [["customer", cus]], `presente-attach-${c.id}`);
    const ja = typeof a.j.customer === "string" ? a.j.customer : null;
    if (!a.ok || ja !== cus) { deps.log("presente: anexar o cartão falhou", { code: String(erroDe(a.j).code ?? "") }); return nao("cartao_nao_salvo"); }
  }
  if (j.customer !== cus) {
    const u = await deps.stripe(`payment_intents/${String(j.id)}`, [["customer", cus!]]);
    if (!u.ok) return nao("indisponivel", 503);
  }
  const conf = await deps.stripe(`payment_intents/${String(j.id)}/confirm`, [["payment_method", cs.pm], ["return_url", retorno]], `presente-cartao-${String(j.id)}`);
  if (!conf.ok) {
    const e = erroDe(conf.j);
    if (e.type === "card_error") return { status: 200, corpo: { ok: false, motivo: "recusado", recusado: true, code: String(e.decline_code ?? e.code ?? "recusado").slice(0, 40), pedido: j.id } };
    // a chave repetida devolve o erro da 1ª vez; o PI agora pode estar pago (2 toques): relê
    const agora = await deps.stripe(`payment_intents/${String(j.id)}`, null);
    if (agora.ok && agora.j.status === "succeeded") return pagoCom(deps, agora.j, c, "cartao");
    return nao("indisponivel", 502, { code: String(e.code ?? "").slice(0, 40) });
  }
  const st = String(conf.j.status ?? "");
  if (st === "succeeded") return pagoCom(deps, conf.j, c, "cartao");
  if (st === "requires_action") return ok({ acao: true, client_secret: conf.j.client_secret, pedido: j.id });
  if (st === "processing") return ok({ processando: true, pedido: j.id });
  const le = (conf.j.last_payment_error ?? {}) as { code?: string; decline_code?: string };
  return { status: 200, corpo: { ok: false, motivo: "recusado", recusado: true, code: String(le.decline_code ?? le.code ?? "recusado").slice(0, 40), pedido: j.id } };
}

/** o Pix do presente (o MESMO, se vivo) */
export async function pixPresente(deps: DepsPresente, c: Compra): Promise<RespostaPresente> {
  const j = await garantirPiPresente(deps, c);
  if (!j) return nao("indisponivel", 503);
  if (j.status === "succeeded") return pagoCom(deps, j, c, "pix");
  const vivo = pixDe(j);
  if (vivo) return ok({ pago: false, pix: vivo, mesmo: true });
  if (j.status === "processing") return ok({ processando: true, pedido: j.id });
  const pares: Array<[string, string]> = [["payment_method_data[type]", "pix"]];
  if (c.email) pares.push(["payment_method_data[billing_details][email]", c.email]);
  const conf = await deps.stripe(`payment_intents/${String(j.id)}/confirm`, pares);
  if (!conf.ok) { deps.log("presente: Pix não gerou", { code: String(erroDe(conf.j).code ?? "") }); return nao("pix", 502); }
  if (conf.j.status === "succeeded") return pagoCom(deps, conf.j, c, "pix");
  const pix = pixDe(conf.j);
  return pix ? ok({ pago: false, pix }) : nao("pix", 502);
}

/** o nome no cartão (só o presente DESTA compra, só antes do resgate) */
export async function nomePresente(deps: DepsPresente, c: Compra, pedido: unknown, nome: unknown): Promise<RespostaPresente> {
  if (typeof pedido !== "string" || !/^pi_[A-Za-z0-9]+$/.test(pedido)) return nao("pedido", 400);
  const r = await deps.stripe(`payment_intents/${pedido}`, null);
  if (!r.ok || !doPresente(r.j, c)) return nao("pedido");
  const p = await presentePorPedido(deps.admin, pedido);
  if (!p) return nao("ainda_nao");
  if (p.resgatado_por) return ok({ de: p.de_nome ?? null });
  const de = nomeNoCartao(nome);
  await deps.admin.from("presentes").update({ de_nome: de }).eq("codigo", p.codigo);
  return ok({ de });
}
