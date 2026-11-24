/**
 * /2027 (23/11) — pixel, eventos e atribuição IGUAIS aos da /tudo (src/tudo/payment.ts), com funil "p2027" e path "/2027".
 * Diferenças pedidas: SEM pixel do TikTok; o pagamento é o checkout Stripe compartilhado (src/landing/stripe-checkout.ts) DENTRO do
 * cartão do preço (montarEm) com o layout "cartao" (só e-mail, Pix | Cartão de crédito, sem folha por cima).
 * Servidor: a linha própria "p2027" (stripe-lp27-criar, PRECO_2027_CENTAVOS). Em produção o checkout só deixa pagar se o servidor
 * devolver o MESMO valor, a mesma moeda e a mesma página (senão: landing_erro {onde: "stripe_preco_divergente"} e não cobra).
 * Prévia (?qa=1 ou fora do domínio de produção): pagamento SIMULADO (nada sai pra Stripe) e nada é rastreado (nem pixel).
 */
import { captureLandingMeta, trackEventBeacon } from "@/lib/analytics";
import { captureLeadSource } from "@/lib/lead-source";
import { idDoAparelho } from "@/landing/marcador";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { readStripeReturn } from "@/completo/stripe-return";
import { compactCheckoutSource } from "@/conhecer/attribution";
import { PRECO_2027_CENTAVOS } from "./preco";

export const PRECO_CENTAVOS = PRECO_2027_CENTAVOS;
export const DOMINIOS = ["coreaplicativo.com.br", "www.coreaplicativo.com.br"];
export const QA = new URLSearchParams(location.search).get("qa") === "1" || !DOMINIOS.includes(location.hostname);
/** o pedido desta aba (sessionStorage `<prefixo>-stripe-ref` / `-stripe-pi`): a prévia nunca reaproveita um pedido de verdade */
export const STORAGE_PREFIX = QA ? "p2027-qa" : "p2027";
export const bankReturn = readStripeReturn(location.href);
// Remove Stripe return secrets before initializing any page analytics.
if (new URLSearchParams(location.search).has("payment_intent_client_secret")) { const clean = new URL(location.href); clean.searchParams.delete("payment_intent_client_secret"); history.replaceState(history.state, "", clean.href); }
const source = compactCheckoutSource(location.href);
const params = new URLSearchParams(location.search);
const atrib: Record<string, string> = {};
for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl"]) { const value = params.get(key); if (value) atrib[key] = value.slice(0, 200); }
const session = (() => { try { const key = "p2027-session-v1"; let id = sessionStorage.getItem(key); if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); } return id; } catch { return `c${Date.now()}${Math.random().toString(36).slice(2)}`; } })();
const device = idDoAparelho();

/** todo evento leva funil/página/jornada "p2027", o path, a sessão, o aparelho, o preço e a atribuição. Na prévia: só window.__p2027Events. */
export function event(name: string, data: Record<string, unknown> = {}) {
  const payload = { ...data, ...atrib, funil: "p2027", pagina: "p2027", jornada: "p2027_v1", path: "/2027", landing_session_id: session, landing_device_id: device, preco_centavos: PRECO_CENTAVOS };
  const w = window as unknown as { __p2027Events?: Array<Record<string, unknown>> };
  (w.__p2027Events ??= []).push({ name, ...payload });
  if (!QA) trackEventBeacon(name, payload);
}

/** Meta igual à /tudo (os 2 pixels + PageView + ViewContent com eventID da sessão). Sem TikTok. Na prévia: nada. */
export function initPixel() {
  if (QA) return;
  captureLandingMeta(); captureLeadSource();
  const w = window as unknown as { fbq?: unknown; _fbq?: unknown };
  if (!w.fbq) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f: any = function (...args: unknown[]) { if (f.callMethod) f.callMethod(...args); else f.queue.push(args); };
    f.push = f; f.loaded = true; f.version = "2.0"; f.queue = []; w.fbq = f; w._fbq = f;
    f("init", "998037194527241"); f("init", "1104688251942954"); f("track", "PageView");
    const script = document.createElement("script"); script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js"; document.head.appendChild(script);
  }
  fireMetaEvent("ViewContent", { content_name: "CORE vitalício /2027", value: PRECO_CENTAVOS / 100, currency: "BRL" }, `p2027-vc-${session}`);
}

/** o checkout DENTRO de `alvo` (inline), layout "cartao". Purchase = o do checkout compartilhado (eventID = id do PI, o mesmo da CAPI). */
export async function mountPayment(alvo: HTMLElement, o: { voltaDoBanco?: { pi: string; status: string }; emailInicial?: string; evento?: (nome: string, dados?: Record<string, unknown>) => void } = {}) {
  const { abrirCheckout } = await import("@/landing/stripe-checkout");
  await abrirCheckout({
    pk: "pk_live_51TJnAQQdjmrIbUhHDSWqG1trOT6mFfV87AC4Vv47kFJTAFOhYsNmvryGRnf3x824Ke3mXSsWiFCovKPIR6Kqx0IX00VcuAawhC",
    precoCentavos: PRECO_CENTAVOS, parcelasMax: 1, producao: !QA, pedeCpf: false, somentePix: false, layout: "cartao", montarEm: alvo,
    storagePrefix: STORAGE_PREFIX, pagina: "p2027", trocaCartao: false, medirCarteira: false, posApp: true, pixCopiaPrimeiro: "sempre",
    voltaDoBanco: o.voltaDoBanco, ...(o.emailInicial ? { emailInicial: o.emailInicial } : {}), evento: o.evento ?? event,
    pixel: (name, data, id) => { if (!QA && (name === "Purchase" || name === "InitiateCheckout" || name === "ViewContent" || name === "CompleteRegistration")) fireMetaEvent(name, data, id); },
    atrib, sessao: session, aparelho: device, urlChegada: source.url, fbclid: params.get("fbclid"),
  });
}
