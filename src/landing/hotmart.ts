/**
 * /vida (04/11) — a LP v3 num LINK PRÓPRIO, separado do /organizar, pagando pela HOTMART (R$ 97,90, Pix ou cartão).
 * O /organizar não muda nada (nem o AB_LP): a rota decide, no <head> do landing.html, sem sorteio.
 *
 *   CHECKOUT_HOTMART "off" → /vida mostra a v3 com o Pix próprio de R$ 27,90 (o mesmo do /organizar no braço v2): fallback seguro.
 *   CHECKOUT_HOTMART "on"  → /vida paga pela Hotmart. Com HOTMART_CHECKOUT_URL ainda no placeholder ("…/PREENCHER"), cai no
 *                            Pix próprio (nunca um botão quebrado).
 *   QA: ?hotmart=on|off força neste navegador (localStorage), ?hotmart=auto desfaz. O placeholder vale também pro forçado.
 *
 * O <head> escreve html[data-pagina="vida"] e html[data-checkout-ext="hotmart"|"pix"]. Todo evento da /vida leva
 * pagina:"vida" e braco_checkout_ext. Este arquivo é PURO (testado em src/test/landing-hotmart.test.ts).
 */

export type BracoCheckoutExt = "hotmart" | "pix" | "stripe";

/** A URL do checkout é de verdade? (https://pay.hotmart.com/<código>, sem o placeholder) — a MESMA conta do <head>. */
export function urlHotmartValida(url: string | null | undefined): boolean {
  const u = String(url ?? "");
  return /^https:\/\/pay\.hotmart\.com\/[A-Za-z0-9]+/.test(u) && !/PREENCHER/i.test(u);
}

/** 04/11: "vida" (Hotmart) ou "oferta" (Stripe, ./stripe-checkout.ts); no /organizar, null. */
export function paginaDoHtml(el: { getAttribute(n: string): string | null } = document.documentElement): "vida" | "oferta" | null {
  const p = el.getAttribute("data-pagina");
  return p === "vida" ? "vida" : p === "oferta" ? "oferta" : null;
}

export function checkoutExtDoHtml(el: { getAttribute(n: string): string | null } = document.documentElement): BracoCheckoutExt | null {
  const v = el.getAttribute("data-checkout-ext");
  return v === "hotmart" ? "hotmart" : v === "pix" ? "pix" : v === "stripe" ? "stripe" : null;
}

/** 04/11: a chave publicável da Stripe é de verdade? (pk_live_/pk_test_, sem o placeholder) — a MESMA conta do <head>. */
export function pkStripeValida(pk: string | null | undefined): boolean {
  const s = String(pk ?? "");
  return /^pk_(live|test)_[A-Za-z0-9]+$/.test(s) && !/PREENCHER/i.test(s);
}

/** sck/src da Hotmart: só letras, números, _ - . | (o resto vira "_"), até 100. */
export const limparCodigo = (s: string | null | undefined): string => String(s ?? "").replace(/[^A-Za-z0-9_.|-]/g, "_").slice(0, 100);

/** A ref do pedido (vai no sck e volta no webhook): só o formato que o servidor aceita. */
export const REF_OK = /^[A-Za-z0-9-]{8,64}$/;

/**
 * A URL do checkout: base + sck=<ref> + src=<utm_content ou ad_id> (+ email, se a página já sabe). Mantém a query da base.
 */
export function urlCheckoutHotmart(base: string, args: { ref: string; src?: string | null; email?: string | null }): string {
  const u = new URL(base);
  u.searchParams.set("sck", limparCodigo(args.ref));
  const src = limparCodigo(args.src);
  if (src) u.searchParams.set("src", src);
  const e = String(args.email ?? "").trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) u.searchParams.set("email", e);
  return u.toString();
}

/** "R$ 97,90" — o preço do braço Hotmart sai SEMPRE desta conta (constante HOTMART_PRECO_CENTAVOS no <head>). */
/** com espaço NÃO separável entre "R$" e o número (o "R$" nunca fica sozinho no fim da linha) */
export const reaisDeCentavos = (c: number): string => `R$\u00a0${(c / 100).toFixed(2).replace(".", ",")}`;
