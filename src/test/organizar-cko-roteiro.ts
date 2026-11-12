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

export type Abrir = { lp: Lp; pix: Pix; u2027?: boolean; limpar?: boolean; url?: string; cko?: "v2" | "atual" | null; ckoForcado?: boolean; oferta?: "ano" | "sempre"; manterHist?: boolean; /** 11/11: /simples (a LP de uma tela): html[data-uma] + a 1ª tela saindo do <template>, como o <head> e o script inline fazem */ uma?: boolean };
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
(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ObservadorDepois;
window.scrollTo = (() => {}) as typeof window.scrollTo; // o jsdom não rola (e avisa "Not implemented" a cada destravada de página) // writable no setup.ts (não configurable)

/*
 * 08/11 (revisão): A PÁGINA ANTERIOR MORRE, COMO NUMA NAVEGAÇÃO DE VERDADE. Cada abrirPagina importa o landing.ts de novo, mas o que a página
 * velha pendurou no window/document (popstate, scroll, visibilitychange, pageshow…) e os timers dela (o relógio do QR a cada 1 s, o "deNovo"
 * de 1,5 s do aoFecharCko, o timerAutoCko de 400 ms, o foco de 30 ms e o timerRestauracao da camada…) continuavam vivos por baixo das
 * páginas seguintes. Num arquivo com dezenas de páginas isso deixava tudo lento (a rodada dos 2 arquivos levou 32 min) e deixava uma página
 * velha mexer na atual (o erro solto depois do teste "?cko=atual"). Aqui, tudo o que o código da página (src/landing/*) registra no
 * window/document e todo timer que ele cria fica anotado; encerrarPagina() desfaz — no começo de cada abrirPagina e no afterEach.
 */
type Registro = { alvo: EventTarget; tipo: string; f: EventListenerOrEventListenerObject; o?: boolean | AddEventListenerOptions };
/** quem chamou é o código da página — e não o jsdom por dentro: o requestAnimationFrame do jsdom agenda UM timer só, compartilhado por todas as
 *  páginas; cancelá-lo (o 1º rascunho deste conserto fez isso) parava todo rAF dali em diante e nenhuma página nova soltava o landing_html */
const daPagina = (): boolean => { const s = new Error().stack ?? ""; return /[\\/]src[\\/]landing[\\/]/.test(s) && !/[\\/]node_modules[\\/]jsdom[\\/]/.test(s); };
const registros: Registro[] = [];
const timeouts = new Set<unknown>();
const intervalos = new Set<unknown>();
type Global = { setTimeout: typeof setTimeout; setInterval: typeof setInterval; clearTimeout: typeof clearTimeout; clearInterval: typeof clearInterval; __ckoAnotando?: boolean };
const g = globalThis as unknown as Global;
if (!g.__ckoAnotando) {
  g.__ckoAnotando = true;
  for (const alvo of [window, document] as EventTarget[]) {
    const add = alvo.addEventListener.bind(alvo);
    alvo.addEventListener = (tipo: string, f: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) => {
      if (f && daPagina()) registros.push({ alvo, tipo, f, o });
      add(tipo, f, o);
    };
  }
  const alvosDeTimer = new Set<Global>([g, window as unknown as Global]);
  for (const t of alvosDeTimer) {
    const st = t.setTimeout.bind(t), si = t.setInterval.bind(t);
    t.setTimeout = ((f: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => { const id = st(f, ms, ...a); if (daPagina()) timeouts.add(id); return id; }) as typeof setTimeout;
    t.setInterval = ((f: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => { const id = si(f, ms, ...a); if (daPagina()) intervalos.add(id); return id; }) as typeof setInterval;
  }
}
/** a página atual "fecha": tira os ouvintes que ela pôs no window/document e cancela os timers dela (a próxima página começa limpa) */
export function encerrarPagina(): void {
  for (const r of registros.splice(0)) { try { r.alvo.removeEventListener(r.tipo, r.f, r.o); } catch { /* noop */ } }
  for (const id of timeouts) { try { g.clearTimeout(id as ReturnType<typeof setTimeout>); } catch { /* noop */ } }
  for (const id of intervalos) { try { g.clearInterval(id as ReturnType<typeof setInterval>); } catch { /* noop */ } }
  timeouts.clear(); intervalos.clear();
}

/** abre a página como o <head> deixaria (data-* do <html>) e importa o landing.ts de novo */
export async function abrirPagina(o: Abrir): Promise<void> {
  encerrarPagina();
  vi.resetModules();
  if (o.limpar !== false) { localStorage.clear(); sessionStorage.clear(); apagarCookies(); }
  if (!o.manterHist) window.history.replaceState(null, "", o.url ?? "/organizar"); // manterHist: a recarga (a entrada do histórico continua a mesma)
  w().__eventosLanding = [];
  delete w().__landingSimularJaTem;
  const d = document.documentElement;
  for (const a of [...d.attributes]) if (a.name.startsWith("data-")) d.removeAttribute(a.name);
  d.setAttribute("data-t", "a");
  d.setAttribute("data-oferta", o.oferta ?? "sempre");
  d.setAttribute("data-checkout", "email");
  d.setAttribute("data-lp", o.lp);
  d.setAttribute("data-pix", o.pix);
  if (o.u2027) { d.setAttribute("data-u2027", "on"); d.setAttribute("data-upsell-pos", "presente"); }
  if (o.cko) d.setAttribute("data-cko", o.cko);
  if (o.uma) d.setAttribute("data-uma", "");
  w().__landing = { ...(o.ckoForcado ? { cko_forcado: true } : {}), ...(o.uma ? { uma: true } : {}) };
  fbq = vi.fn();
  w().fbq = fbq;
  document.body.removeAttribute("style");
  document.body.innerHTML = CORPO;
  if (o.uma) { const tpl = document.getElementById("lp-uma") as HTMLTemplateElement; tpl.parentNode!.replaceChild(tpl.content.cloneNode(true), tpl); }
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

/* ───────────────────────── 08/11: o MESMO roteiro pela camada do checkout novo (data-cko="v2") ───────────────────────── */
export const camadaAberta = () => { const c = document.getElementById("cko"); return !!c && !c.hidden; };
export const esperaCamada = () => vi.waitFor(() => { if (!camadaAberta()) throw new Error("camada fechada"); }, { timeout: 4000, interval: 10 });
export const esperaCamadaFechar = () => vi.waitFor(() => { if (camadaAberta()) throw new Error("camada aberta"); }, { timeout: 4000, interval: 10 });
/** os eventos novos da camada saem da comparação com a fixture (o resto tem de ser IGUAL) */
export const semCko = (l: Ev[]) => l.filter((e) => !/^landing_cko_/.test(e.nome));

export type RoteiroV2 = Roteiro & { camada: Record<string, string>; eventosCko: Record<string, Ev[]> };
/** A–E do roteiroHoje, mas pagando pela camada: o botão fixo abre a camada; erro, sugestão, gerando e código aparecem NELA; do QR em diante, o cartão */
export async function roteiroV2(lp: Lp, pix: Pix): Promise<RoteiroV2> {
  const estados: Record<string, string> = {};
  const camada: Record<string, string> = {};
  const evs: Record<string, Ev[]> = {};
  const evsCko: Record<string, Ev[]> = {};
  const px: Record<string, unknown[]> = {};
  const fotoCamada = () => limparHtml(document.getElementById("cko-in")!.innerHTML);
  const fechar = (k: string) => { evs[k] = semCko(limparEventos(eventos())); evsCko[k] = limparEventos(eventos(), false).filter((e) => /^landing_cko_/.test(e.nome)); px[k] = limparPixel(fbq.mock.calls); };
  const abrir = (o: Partial<Abrir> = {}) => abrirPagina({ lp, pix, cko: "v2", ...o });

  // A
  await abrir();
  estados.oferta = fotoCartao();
  clicar(botaoFixo(lp));
  await esperaCamada();
  camada.aberta = fotoCamada();
  clicar("#cko-gerar");
  await dormir(30);
  camada.erro_vazio = fotoCamada();
  digitar("cko-email", "maria@gmial.com");
  document.getElementById("cko-email")!.dispatchEvent(new Event("blur"));
  camada.sugestao = fotoCamada();
  clicar("#cko-sug");
  clicar("#cko-gerar");
  camada.gerando = fotoCamada();
  await espera('#lp-card [data-testid="landing-codigo"]');
  await esperaCamadaFechar();
  estados.qr = fotoCartao();
  simularPago();
  await espera('[data-testid="landing-conta"]');
  estados.conta = fotoCartao();
  fechar("A");

  // B
  await abrir();
  clicar("#lp-pagar"); // B–E: como no roteiro de hoje (sem o botão fixo), pelo botão do cartão — que agora abre a camada
  await esperaCamada();
  digitar("cko-email", "maria+existe@email.com");
  clicar("#cko-gerar");
  await espera('#cko [data-testid="landing-email-tem-conta"]');
  camada.codigo = fotoCamada();
  estados.cartao_no_codigo = fotoCartao();
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('#lp-card [data-testid="landing-codigo"]');
  await esperaCamadaFechar();
  estados.qr_codigo = fotoCartao();
  fechar("B");

  // C
  await abrir();
  clicar("#lp-pagar"); // B–E: como no roteiro de hoje (sem o botão fixo), pelo botão do cartão — que agora abre a camada
  await esperaCamada();
  digitar("cko-email", "maria+jatem@email.com");
  clicar("#cko-gerar");
  await espera('#cko [data-testid="landing-email-tem-conta"]');
  digitar("lp-codigo-antes", "12345678");
  clicar("#lp-entrar-pagar");
  await espera('#lp-card [data-testid="landing-ja-tem"]');
  await esperaCamadaFechar();
  estados.ja_tem = fotoCartao();
  fechar("C");

  // D
  await abrir();
  clicar("#lp-pagar"); // B–E: como no roteiro de hoje (sem o botão fixo), pelo botão do cartão — que agora abre a camada
  await esperaCamada();
  digitar("cko-email", "maria@email.com");
  clicar("#cko-gerar");
  await espera('#lp-card [data-testid="landing-codigo"]');
  await abrir({ limpar: false });
  await espera('[data-testid="landing-codigo"]');
  estados.qr_reaberto = fotoCartao();
  localStorage.clear(); sessionStorage.clear();
  await abrir({ limpar: false });
  await espera('[data-testid="landing-codigo"]');
  estados.qr_cookie = fotoCartao();
  fechar("D");

  // E
  await abrir({ u2027: true });
  clicar("#lp-pagar"); // B–E: como no roteiro de hoje (sem o botão fixo), pelo botão do cartão — que agora abre a camada
  await esperaCamada();
  digitar("cko-email", "maria@email.com");
  clicar("#cko-gerar");
  await espera('#lp-card [data-testid="landing-codigo"]');
  await esperaCamadaFechar();
  simularPago();
  await espera('[data-testid="presente-agora-nao"]');
  await dormir(700);
  estados.presente = fotoCartao();
  clicar('[data-testid="presente-agora-nao"]');
  await espera('[data-testid="landing-conta"]');
  estados.conta_depois_presente = fotoCartao();
  fechar("E");

  return { estados, eventos: evs, pixel: px, camada, eventosCko: evsCko };
}
/** o campo de e-mail do cartão (escondido no checkout novo — o e-mail é pedido na camada): fora da comparação do cartão */
export const semCampoDoCartao = (h: string) => h.replace(/<div class="lp-email-antes"[\s\S]*?<\/div>/, "<!--campo-->");
