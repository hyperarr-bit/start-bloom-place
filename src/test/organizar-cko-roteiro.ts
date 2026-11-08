/**
 * O ROTEIRO FIXO DO /organizar (08/11, checkout novo do /organizar — novidades-guardadas/2026-11-07/checkout-organizar/SPEC.md §7).
 * Não é teste: é a página de verdade (landing.html + landing.ts) no jsdom, com o Pix SIMULADO (fora do domínio de produção), andando
 * sempre o mesmo caminho e tirando "fotos" do cartão. A fixture src/test/fixtures/organizar-hoje-07-11.json foi gravada com ESTE roteiro
 * ANTES de mexer em qualquer arquivo da página (HEAD 08bc1145: AB_LP ligado + checkout v2 da /oferta, nada do /organizar mexido).
 *
 * Usado por src/test/organizar-checkout-v2.test.ts: com a chave CHECKOUT_ORG_V2 off (e com ?cko=atual) o roteiro tem de dar a fixture.
 */
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
export const HTML = readFileSync(resolve(raiz, "landing.html"), "utf8");
export const CORPO = HTML.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script type="module"[^>]*><\/script>/, "");

export type Lp = "atual" | "v2";
export type Pix = "atual" | "b";
export type Ev = Record<string, unknown> & { nome: string };
type Janela = Window & {
  __eventosLanding?: Ev[];
  __landingSimular?: { pagar: () => void };
  __landingSimularJaTem?: boolean;
  __landing?: Record<string, unknown>;
  fbq?: unknown;
};
const w = () => window as unknown as Janela;

export const eventos = (): Ev[] => w().__eventosLanding ?? [];
export const nomes = () => eventos().map((e) => e.nome);
export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const apagarCookies = () => {
  // (no domínio de produção o marcador e o id do aparelho vão no Domain=.coreaplicativo.com.br — apagar os 2 jeitos)
  for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) { document.cookie = `${n}=; Max-Age=0; Path=/`; document.cookie = `${n}=; Max-Age=0; Path=/; Domain=.coreaplicativo.com.br`; } }
};

export type Abrir = { lp: Lp; pix: Pix; u2027?: boolean; limpar?: boolean; url?: string; cko?: "v2" | "atual" | null; ckoForcado?: boolean };
export let fbq = vi.fn();

/** o observador de interseção como no navegador: avisa DEPOIS (o do setup.ts avisa dentro do observe(), antes de o landing.ts terminar
 *  de rodar — com o 2027 ligado isso lia `estado` antes de existir, coisa que nunca acontece num navegador) */
class ObservadorDepois {
  private cb: IntersectionObserverCallback;
  root = null; rootMargin = ""; thresholds: number[] = [];
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
  observe(alvo: Element) {
    queueMicrotask(() => this.cb([{ isIntersecting: true, target: alvo, intersectionRatio: 1, boundingClientRect: { top: 0 } } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver));
  }
  unobserve() {} disconnect() {} takeRecords(): IntersectionObserverEntry[] { return []; }
}
(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ObservadorDepois; // writable no setup.ts (não configurable)

/** abre a página como o <head> deixaria (data-* do <html>) e importa o landing.ts de novo */
export async function abrirPagina(o: Abrir): Promise<void> {
  vi.resetModules();
  if (o.limpar !== false) { localStorage.clear(); sessionStorage.clear(); apagarCookies(); }
  window.history.replaceState(null, "", o.url ?? "/organizar");
  w().__eventosLanding = [];
  delete w().__landingSimularJaTem;
  const d = document.documentElement;
  for (const a of [...d.attributes]) if (a.name.startsWith("data-")) d.removeAttribute(a.name);
  d.setAttribute("data-t", "a");
  d.setAttribute("data-oferta", "sempre");
  d.setAttribute("data-checkout", "email");
  d.setAttribute("data-lp", o.lp);
  d.setAttribute("data-pix", o.pix);
  if (o.u2027) { d.setAttribute("data-u2027", "on"); d.setAttribute("data-upsell-pos", "presente"); }
  if (o.cko) d.setAttribute("data-cko", o.cko);
  w().__landing = o.ckoForcado ? { cko_forcado: true } : {};
  fbq = vi.fn();
  w().fbq = fbq;
  document.body.removeAttribute("style");
  document.body.innerHTML = CORPO;
  await import("@/landing/landing");
  await vi.waitFor(() => { if (!nomes().includes("landing_html")) throw new Error("sem landing_html"); }, { timeout: 2000, interval: 10 });
}

export const espera = (sel: string, ms = 6000) => vi.waitFor(() => { const el = document.querySelector(sel); if (!el) throw new Error(sel); return el; }, { timeout: ms, interval: 20 });
export const clicar = (sel: string) => (document.querySelector(sel) as HTMLElement).click();
export const digitar = (id: string, v: string) => { const c = document.getElementById(id) as HTMLInputElement; c.value = v; c.dispatchEvent(new Event("input", { bubbles: true })); };
export const botaoFixo = (lp: Lp) => (lp === "v2" ? '#lp-fixo button[data-so-lp="v2"]' : '#lp-fixo button[data-so-lp="atual"][data-so-ext="pix"]');
export const simularPago = () => w().__landingSimular!.pagar();

/** o cartão, sem o que muda a cada rodada (id do pedido simulado, relógio, o QR desenhado depois) */
export function limparHtml(h: string): string {
  return h
    .replace(/simulado-[a-z0-9-]+/g, "simulado-ID")
    .replace(/Pedido [A-Z0-9]{1,6}</g, "Pedido X<")
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, "MM:SS")
    .replace(/(<div class="lp-qr" id="lp-qr">)[\s\S]*?(<\/div>)/g, "$1$2");
}
export const fotoCartao = () => limparHtml(document.getElementById("lp-card")!.innerHTML);

/** os campos que mudam a cada rodada (tempos, ids da sessão) e, na comparação, os 2 que a chave nova acrescenta (SPEC §7) */
const FORA = new Set(["t_ms", "ms", "s_aberto", "s_na_tela", "s_total", "ausente_s", "tela1_ms", "ttfb_ms", "ms_desde_html", "ms_desde_inicio", "landing_session_id", "landing_device_id"]);
export const PERMITIDOS = ["braco_cko", "cko_forcado"];
/** só os eventos do caminho do dinheiro (os da 1ª tela, dos blocos e da demo saem em hora variável) */
const DE_FORA = /^landing_(html|bloco|fita|demo_|duvida_aberta$|lojas_topo$)/;
export function limparEventos(lista: Ev[], semPermitidos = true): Ev[] {
  const tirar = new Set([...FORA, ...(semPermitidos ? PERMITIDOS : [])]);
  return lista
    .filter((e) => !DE_FORA.test(e.nome))
    .map((e) => JSON.parse(JSON.stringify(e).replace(/simulado-[a-z0-9-]+/g, "simulado-ID")) as Ev)
    .map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !tirar.has(k))) as Ev);
}
export const limparPixel = (calls: unknown[]) => JSON.parse(JSON.stringify(calls).replace(/simulado-[a-z0-9-]+/g, "simulado-ID")) as unknown[];

export type Roteiro = { estados: Record<string, string>; eventos: Record<string, Ev[]>; pixel: Record<string, unknown[]> };

/**
 * O roteiro de hoje (o checkout no cartão), por braço do AB_LP × braço do AB_PIX:
 *   A  botão fixo → pagar sem e-mail → e-mail com domínio errado → sugestão → pagar → gerando → QR → pago → conta (com as lojas)
 *   B  e-mail com conta → código de 8 números → QR
 *   C  e-mail com conta + vitalício → código → "Você já tem o CORE"
 *   D  Pix vivo: fecha e reabre (mesmo QR); o Instagram zera o storage (o cookie traz o MESMO QR)
 *   E  com o presente ligado: pago → "Leve alguém junto" → Agora não → conta com as lojas
 */
export async function roteiroHoje(lp: Lp, pix: Pix, extra: Partial<Abrir> = {}): Promise<Roteiro> {
  const estados: Record<string, string> = {};
  const evs: Record<string, Ev[]> = {};
  const px: Record<string, unknown[]> = {};
  const fechar = (k: string) => { evs[k] = limparEventos(eventos()); px[k] = limparPixel(fbq.mock.calls); };

  // A
  await abrirPagina({ lp, pix, ...extra });
  estados.oferta = fotoCartao();
  clicar(botaoFixo(lp));
  clicar("#lp-pagar");
  await dormir(30);
  estados.erro_vazio = fotoCartao();
  digitar("lp-email-antes", "maria@gmial.com");
  document.getElementById("lp-email-antes")!.dispatchEvent(new Event("blur"));
  estados.sugestao = fotoCartao();
  clicar("#lp-email-antes-sugestao");
  clicar("#lp-pagar");
  estados.gerando = fotoCartao();
  await espera('[data-testid="landing-codigo"]');
  estados.qr = fotoCartao();
  simularPago();
  await espera('[data-testid="landing-conta"]');
  estados.conta = fotoCartao();
  fechar("A");

  // B
  await abrirPagina({ lp, pix, ...extra });
  digitar("lp-email-antes", "maria+existe@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-email-tem-conta"]');
  estados.codigo = fotoCartao();
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('[data-testid="landing-codigo"]');
  estados.qr_codigo = fotoCartao();
  fechar("B");

  // C
  await abrirPagina({ lp, pix, ...extra });
  digitar("lp-email-antes", "maria+jatem@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-email-tem-conta"]');
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('[data-testid="landing-ja-tem"]');
  estados.ja_tem = fotoCartao();
  fechar("C");

  // D
  await abrirPagina({ lp, pix, ...extra });
  digitar("lp-email-antes", "maria@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-codigo"]');
  await abrirPagina({ lp, pix, ...extra, limpar: false });
  await espera('[data-testid="landing-codigo"]');
  estados.qr_reaberto = fotoCartao();
  localStorage.clear(); sessionStorage.clear(); // o Instagram zerou o storage; o cookie do Pix vivo ficou
  await abrirPagina({ lp, pix, ...extra, limpar: false });
  await espera('[data-testid="landing-codigo"]');
  estados.qr_cookie = fotoCartao();
  fechar("D");

  // E
  await abrirPagina({ lp, pix, u2027: true, ...extra });
  digitar("lp-email-antes", "maria@email.com");
  clicar("#lp-pagar");
  await espera('[data-testid="landing-codigo"]');
  simularPago();
  await espera('[data-testid="presente-agora-nao"]');
  await dormir(700); // o Pix do presente simulado (600 ms) fica pronto
  estados.presente = fotoCartao();
  clicar('[data-testid="presente-agora-nao"]');
  await espera('[data-testid="landing-conta"]');
  estados.conta_depois_presente = fotoCartao();
  fechar("E");

  return { estados, eventos: evs, pixel: px };
}
