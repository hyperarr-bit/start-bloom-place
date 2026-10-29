/**
 * O QUE A LANDING (/organizar) LEMBRA DO APARELHO FORA DO ESTADO DO PIX (29/10).
 *
 *   compra     "este aparelho já comprou": cookie first-party de longa duração (core_ln_comprou, no domínio
 *              .coreaplicativo.com.br — vale no www e sem www) + localStorage (landing-comprou-v1, com o e-mail da compra
 *              pra mostrar no cartão). O cookie NÃO leva e-mail. Com o marcador, a página abre com "Você já tem o CORE"
 *              no lugar da oferta.
 *              Por quê (caso de 29/10 11h38→11h50): o `localStorage` inteiro (o estado do Pix E a sessão) sumiu depois
 *              da compra — `DeleteAccountDialog` faz `localStorage.clear()` e rodou DENTRO do iframe da demo, que é a
 *              mesma origem — e a página voltou na oferta. O cookie sobrevive a `localStorage.clear()`; a exclusão de
 *              conta apaga o marcador de propósito (esquecerCompra: a conta não existe mais).
 *   aparelho   landing_device_id: id aleatório estável (cookie + localStorage) em todo evento landing_* — mede voltas.
 *
 * Sem dependências: o DeleteAccountDialog importa daqui sem puxar a landing.
 */

export const COOKIE_COMPRA = "core_ln_comprou";
export const CHAVE_COMPRA = "landing-comprou-v1";
export const COOKIE_APARELHO = "landing_device_id";
export const CHAVE_APARELHO = "landing-device-id";
/** ~400 dias: o teto que o Chrome aceita pra cookie (o Safari pode encurtar cookie de JS, por isso o localStorage junto) */
export const VIDA_COOKIE_S = 400 * 24 * 3600;

export type MarcaCompra = { em: number; oferta: string | null; email: string | null };

const lerLs = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLs = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* só o cookie */ } };
const apagarLs = (k: string) => { try { localStorage.removeItem(k); } catch { /* noop */ } };

/** O domínio do cookie: o site inteiro (www e sem www) em produção; o host atual no resto. */
export function dominioDoCookie(hostname: string = location.hostname): string | null {
  return /(^|\.)coreaplicativo\.com\.br$/.test(hostname) ? ".coreaplicativo.com.br" : null;
}

export function lerCookie(nome: string): string | null {
  try {
    for (const par of (document.cookie || "").split(";")) {
      const i = par.indexOf("=");
      if (i < 0) continue;
      if (par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim());
    }
  } catch { /* cookie bloqueado */ }
  return null;
}

export function gravarCookie(nome: string, valor: string, vidaS: number = VIDA_COOKIE_S): void {
  try {
    const dom = dominioDoCookie();
    const seguro = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${nome}=${encodeURIComponent(valor)}; Max-Age=${vidaS}; Path=/; SameSite=Lax${dom ? `; Domain=${dom}` : ""}${seguro}`;
  } catch { /* noop */ }
}

const OFERTA_OK = /^[A-Za-z0-9_]{1,24}$/;

/** Grava (ou completa com o e-mail) o "já comprou". */
export function marcarCompra(d: { oferta?: string | null; email?: string | null }, agora: number = Date.now()): void {
  const antes = lerCompra();
  const oferta = d.oferta && OFERTA_OK.test(d.oferta) ? d.oferta : antes?.oferta ?? null;
  const email = (d.email ?? antes?.email ?? null) || null;
  const em = antes?.em ?? agora;
  gravarCookie(COOKIE_COMPRA, `1.${em}.${oferta ?? ""}`);
  gravarLs(CHAVE_COMPRA, JSON.stringify({ v: 1, em, oferta, email }));
}

/** O "já comprou" deste aparelho (localStorage primeiro — tem o e-mail; senão o cookie). */
export function lerCompra(): MarcaCompra | null {
  try {
    const bruto = JSON.parse(lerLs(CHAVE_COMPRA) || "null") as { v?: number; em?: unknown; oferta?: unknown; email?: unknown } | null;
    if (bruto && bruto.v === 1 && typeof bruto.em === "number") {
      return { em: bruto.em, oferta: typeof bruto.oferta === "string" ? bruto.oferta : null, email: typeof bruto.email === "string" && bruto.email ? bruto.email : null };
    }
  } catch { /* estragado: tenta o cookie */ }
  const c = lerCookie(COOKIE_COMPRA);
  const m = c ? /^1\.(\d{10,})\.([A-Za-z0-9_]{0,24})$/.exec(c) : null;
  if (!m) return null;
  return { em: Number(m[1]), oferta: m[2] || null, email: null };
}

/** Apaga o "já comprou" (a conta foi excluída, ou "não fui eu que comprei"). */
export function esquecerCompra(): void {
  gravarCookie(COOKIE_COMPRA, "", 0);
  apagarLs(CHAVE_COMPRA);
}

const novoId = (): string => {
  try { return crypto.randomUUID(); } catch { return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
};
const ID_OK = /^[A-Za-z0-9-]{8,64}$/;

/** O id estável do aparelho (cookie + localStorage; um socorre o outro). */
export function idDoAparelho(): string {
  const doLs = lerLs(CHAVE_APARELHO);
  const doCookie = lerCookie(COOKIE_APARELHO);
  const id = [doLs, doCookie].find((x): x is string => !!x && ID_OK.test(x)) ?? novoId();
  if (doLs !== id) gravarLs(CHAVE_APARELHO, id);
  if (doCookie !== id) gravarCookie(COOKIE_APARELHO, id);
  return id;
}
