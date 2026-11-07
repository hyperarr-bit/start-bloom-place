/**
 * /oferta (04/11) — o corpo do stripe-criar → os parâmetros do PaymentIntent (puro; testado em src/test/stripe-webhook.test.ts).
 * O VALOR é SEMPRE o do servidor (STRIPE_PRECO_CENTAVOS): o corpo da página nunca leva preço que vale.
 * Metadata (≤ 500 caracteres cada, só texto): ref, pagina "oferta", e-mail, user_id da sessão, fbp, fbc, fbclid, url, IP, UA,
 * utm/ad e o momento — o webhook usa pra achar a conta e pra CAPI (o webhook é chamado pela Stripe: IP/UA só existem aqui).
 */
import { PAGINA_STRIPE, STRIPE_PRECO_CENTAVOS } from "./stripe.ts";
import { cpfValido, soDigitosCpf } from "./cpf.ts";

export type PedidoStripe = {
  ref: string; pi: string | null; email: string | null; fbp: string | null; fbc: string | null; fbclid: string | null; url: string | null;
  landing_session_id: string | null; landing_device_id: string | null; atrib: Record<string, string>;
  /** CPF (nota fiscal), só dígitos e válido — vai SÓ pra metadata[cpf] do PI pelo atualizar; nunca pra banco/log */
  cpf: string | null;
};
const t = (v: unknown, n: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const ATRIB = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl", "braco_lp_oferta"]; // 06/11: o braço da página (AB_OFERTA_LP) vira metadata do PI
const SITES = ["https://www.coreaplicativo.com.br/", "https://coreaplicativo.com.br/"];
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarPedidoStripe(body: unknown): PedidoStripe | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const ref = t(b.ref, 64);
  if (!ref || !/^[A-Za-z0-9-]{8,64}$/.test(ref)) return null;
  const pi = t(b.pi, 80);
  // CPF que veio e não confere = pedido recusado (a página já confere; aqui é a 2ª trava)
  const cpfBruto = b.cpf === undefined || b.cpf === null || b.cpf === "" ? null : soDigitosCpf(String(b.cpf));
  if (cpfBruto !== null && !cpfValido(cpfBruto)) return null;
  const email = t(b.email, 254)?.toLowerCase() ?? null;
  const url = t(b.url, 500);
  const a = (b.atrib && typeof b.atrib === "object" ? b.atrib : {}) as Record<string, unknown>;
  const atrib: Record<string, string> = {};
  for (const k of ATRIB) { const v = t(a[k], 200); if (v) atrib[k] = v; }
  return {
    ref, pi: pi && /^pi_[A-Za-z0-9]+$/.test(pi) ? pi : null, email: email && EMAIL_OK.test(email) ? email : null,
    fbp: t(b.fbp, 120), fbc: t(b.fbc, 400), fbclid: t(b.fbclid, 300), url: url && SITES.some((s) => url.startsWith(s)) ? url : null,
    landing_session_id: t(b.landing_session_id, 64), landing_device_id: t(b.landing_device_id, 64), atrib, cpf: cpfBruto,
  };
}

/** metadata do PI (só texto, sem chave vazia) */
export function metadataDoPedido(p: PedidoStripe, args: { userId: string | null; ip: string | null; ua: string | null; agoraIso: string }): Record<string, string> {
  const md: Record<string, string | null> = {
    ref: p.ref, pagina: PAGINA_STRIPE, email: p.email, user_id: args.userId, fbp: p.fbp, fbc: p.fbc, fbclid: p.fbclid, url: p.url,
    ip: args.ip && args.ua ? args.ip : null, ua: args.ip && args.ua ? args.ua.slice(0, 450) : null, sessao: p.landing_session_id, aparelho: p.landing_device_id,
    criado_em: args.agoraIso, ...p.atrib,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(md)) if (v) out[k] = String(v).slice(0, 500);
  return out;
}

/**
 * O POST /v1/payment_intents (criar) — SÓ campos FIXOS da ref (revisão 05/11): com Idempotency-Key oferta-<ref>, a Stripe devolve
 * o MESMO PaymentIntent numa recarga; um campo que muda (hora, IP, UA, fbp) dava idempotency_error por 24 h. Pix + cartão;
 * parcelas no cartão (installments BR); Pix vale 30 min. Os sinais variáveis vão depois, pelo atualizar.
 */
export function paramsCriar(ref: string): Array<[string, string]> {
  return [
    ["amount", String(STRIPE_PRECO_CENTAVOS)], ["currency", "brl"],
    ["payment_method_types[]", "card"], ["payment_method_types[]", "pix"],
    ["payment_method_options[card][installments][enabled]", "true"],
    ["payment_method_options[pix][expires_after_seconds]", "1800"],
    ["description", "CORE vitalicio"], ["statement_descriptor_suffix", "CORE"],
    ["metadata[ref]", ref], ["metadata[pagina]", PAGINA_STRIPE],
  ];
}

/** O POST /v1/payment_intents/<id> (atualizar): o e-mail e os sinais do navegador (variáveis). O valor NUNCA é reenviado.
 *  `jaTem` = a metadata atual do PI: o criado_em só vai na 1ª vez (o fbc do fbclid usa esse horário). */
export function paramsAtualizar(md: Record<string, string>, email: string | null, jaTem: Record<string, string> = {}, cpf: string | null = null): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (email) out.push(["receipt_email", email]);
  if (cpf) out.push(["metadata[cpf]", cpf]); // nota fiscal: SÓ aqui (nunca no criar idempotente, nunca no banco)
  for (const [k, v] of Object.entries(md)) {
    if (k === "ref" || k === "pagina") continue;
    if (k === "criado_em" && jaTem.criado_em) continue;
    out.push([`metadata[${k}]`, v]);
  }
  return out;
}

/** status em que ainda dá pra atualizar o PI (depois de confirmado, só lê) */
export const PODE_ATUALIZAR = new Set(["requires_payment_method", "requires_confirmation"]);

/** o Pix pendente do PI (pra recarga mostrar o MESMO QR) */
export function pixDoIntento(j: Record<string, unknown>): { data?: string; image_url_png?: string; expires_at?: number } | null {
  const na = j.next_action as { type?: string; pix_display_qr_code?: { data?: string; image_url_png?: string; expires_at?: number } } | null | undefined;
  if (j.status !== "requires_action" || na?.type !== "pix_display_qr_code" || !na.pix_display_qr_code) return null;
  const q = na.pix_display_qr_code;
  return { data: q.data, image_url_png: q.image_url_png, expires_at: q.expires_at };
}

export const formUrl = (pares: Array<[string, string]>) => pares.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

/* ───────── limite por IP (como o hotmart-iniciar) ───────── */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };
export const LIMITE_POR_IP = 20;
export const JANELA_IP_MS = 10 * 60_000;
export async function ipPodeCriar(admin: ClienteMin, ip: string | null, agoraMs: number = Date.now()): Promise<boolean> {
  if (!ip) return true;
  try {
    const { count, error } = await admin.from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event_name", "stripe_order_created").eq("event_data->>client_ip", ip)
      .gte("created_at", new Date(agoraMs - JANELA_IP_MS).toISOString());
    if (error || typeof count !== "number") return true;
    return count < LIMITE_POR_IP;
  } catch { return true; }
}

/** stripe-status: o PI é desta ref? Devolve só o que a página precisa. */
export function respostaStatus(pi: { metadata?: Record<string, string> | null; status?: string; latest_charge?: { payment_method_details?: { type?: string } } | string | null } | null, ref: string): { ok: boolean; status?: string; pago?: boolean; metodo?: string | null } {
  if (!pi || pi.metadata?.ref !== ref || pi.metadata?.pagina !== PAGINA_STRIPE) return { ok: false };
  const lc = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  return { ok: true, status: pi.status, pago: pi.status === "succeeded", metodo: lc?.payment_method_details?.type ?? null };
}

/* ───────── o fluxo do stripe-criar (revisão 05/11), com a Stripe e o banco injetados (testado no vitest) ───────── */
export type ChamarStripe = (caminho: string, pares: Array<[string, string]> | null, idem?: string) => Promise<{ ok: boolean; j: Record<string, unknown> }>;
/**
 * 1º o PI que a página já tem (sessionStorage); 2º o desta ref (stripe_order_created); só então cria — com Idempotency-Key
 * oferta-<ref> e SÓ campos fixos (a recarga recebe o mesmo PI, nunca idempotency_error). Os sinais variáveis vão no atualizar,
 * enquanto o PI aceita. Devolve o client_secret, o status e o Pix pendente (a recarga mostra o MESMO QR).
 */
export async function criarOuReaproveitar(
  deps: { admin: ClienteMin; stripe: ChamarStripe; log: (m: string, d?: Record<string, unknown>) => void; agoraMs?: number },
  p: PedidoStripe, md: Record<string, string>, ctx: { userId: string | null; ip: string | null },
): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const { admin, stripe, log } = deps;
  let pi = p.pi;
  if (!pi) {
    try {
      // o MAIS NOVO desta ref (um PI cancelado dá lugar a outro: -2, -3…)
      const { data: ja } = await admin.from("analytics_events").select("event_data").eq("event_name", "stripe_order_created").eq("event_data->>ref", p.ref).limit(10);
      const achado = ((ja ?? []) as Array<{ event_data?: { pi?: string } }>).map((l) => l.event_data?.pi).filter((x): x is string => typeof x === "string" && /^pi_/.test(x)).at(-1);
      if (achado) pi = achado;
    } catch { /* cria (a chave de idempotência ainda segura o 2º) */ }
  }
  const registrar = async (id: unknown) => {
    try { await admin.from("analytics_events").insert({ event_name: "stripe_order_created", user_id: ctx.userId, session_id: p.landing_session_id, event_data: { ref: p.ref, pi: id, pagina: PAGINA_STRIPE, ...(ctx.ip ? { client_ip: ctx.ip } : {}), ...p.atrib } }); } catch { /* o PI existe; a próxima recarga acha pela chave */ }
  };
  let j: Record<string, unknown> | null = null;
  if (pi) {
    const atual = await stripe(`payment_intents/${pi}`, null);
    if (!atual.ok || (atual.j.metadata as Record<string, string> | undefined)?.ref !== p.ref) return { status: 404, corpo: { ok: false } };
    j = atual.j;
  } else {
    if (!(await ipPodeCriar(admin, ctx.ip, deps.agoraMs))) { log("limite por IP"); return { status: 429, corpo: { ok: false, limite: true } }; }
    const r = await stripe("payment_intents", paramsCriar(p.ref), `oferta-${p.ref}`);
    if (!r.ok || typeof r.j.client_secret !== "string") { log("criar falhou", { code: String((r.j.error as Record<string, unknown> | undefined)?.code ?? "") }); return { status: 502, corpo: { ok: false } }; }
    j = r.j;
    await registrar(j.id);
  }
  // 05/11 (revisão 2): PI cancelado não serve pra pagar → um novo pra mesma ref, com outra chave (oferta-<ref>-2, -3…)
  for (let n = 2; String(j.status) === "canceled" && n <= 6; n++) {
    const r = await stripe("payment_intents", paramsCriar(p.ref), `oferta-${p.ref}-${n}`);
    if (!r.ok || typeof r.j.client_secret !== "string") { log("recriar falhou", { n }); return { status: 502, corpo: { ok: false } }; }
    j = r.j;
    if (String(j.status) !== "canceled") await registrar(j.id);
  }
  if (String(j.status) === "canceled") return { status: 502, corpo: { ok: false } };
  // requires_action (3DS abandonado / Pix gerado) também aceita mudar metadata e receipt_email na Stripe — só quando é uma NOVA
  // tentativa de pagar (veio e-mail ou CPF); a recarga só lê (o Pix pendente fica intacto)
  if (PODE_ATUALIZAR.has(String(j.status)) || (String(j.status) === "requires_action" && (p.email || p.cpf))) {
    const up = await stripe(`payment_intents/${j.id}`, paramsAtualizar(md, p.email, (j.metadata ?? {}) as Record<string, string>, p.cpf));
    if (up.ok) j = up.j;
    else {
      log("atualizar falhou", { code: String((up.j.error as Record<string, unknown> | undefined)?.code ?? "") });
      // revisão 2 (1): na hora de pagar (veio o e-mail), sem o e-mail no PI não paga — a página mostra o erro e tenta de novo
      if (p.email) return { status: 502, corpo: { ok: false } };
    }
  }
  return { status: 200, corpo: { ok: true, client_secret: j.client_secret, pi: j.id, status: j.status, pix: pixDoIntento(j) } };
}
