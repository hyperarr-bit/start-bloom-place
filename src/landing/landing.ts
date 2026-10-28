/**
 * O COMPORTAMENTO DA LANDING NOVA (/organizar, 28/10 — desligada; ver o cabeçalho do /landing.html). Vanilla, sem
 * React: a página inteira já veio pintada no HTML; isto só liga os toques, a demo, a medição e o Pix.
 *
 *   topo      "Por onde você quer começar?" → marca a área, rola até a demo e abre a demo no módulo da área
 *   demo      iframe /organizar/demo?m=… (o app de verdade, mesma origem) — começa a baixar DEPOIS da 1ª pintura
 *             (load + ocioso; ou já no 1º toque numa área). Até a demo avisar "landing:pronta", a imagem leve do
 *             módulo ocupa a MESMA caixa (sem CLS). Pílulas e a grade dos 16 trocam o módulo por postMessage.
 *   oferta    braço "ano" (+ caixinha desmarcada "pra sempre") ou "sempre" (decidido no <head>); o Pix sai NA PÁGINA:
 *             "Gerando o seu Pix…" → QR + código JÁ COPIADO → "esta tela confirma sozinha" → pago → e-mail → conta →
 *             "Abrir meu CORE" + selos das lojas. Nenhum upsell.
 *   fixo      o botão do rodapé só aparece depois que a pessoa passou pela demo (e some com a oferta/fim na tela).
 *
 * PIX_REAL = false (protótipo): as ofertas LN_* ainda não existem nas funções no ar. Fora do domínio de produção o Pix
 * é SIMULADO (mesmas telas; "Já paguei" confirma; e-mail com "+existe" simula conta existente, código 123456). No
 * domínio de produção com PIX_REAL false, o botão avisa que o pagamento desta página ainda não está ligado.
 *
 * Eventos (analytics_events, mesmo endpoint/chave anon do /missao; SÓ no domínio de produção; no dev ficam em
 * window.__eventosLanding). Todos levam landing_session_id, braco_titulo, braco_oferta, utm_*, ad ids, plataforma.
 *   landing_html {tela1_ms, ttfb_ms, forcados, divisao}   · landing_bloco {bloco}  (1x por bloco visto)
 *   landing_area {area, modulo}                           · landing_demo_aberta {modulo, via}
 *   landing_demo_pronta {modulo, ms_desde_html}           · landing_demo_modulo {modulo, via: pilula|grade|dentro|area}
 *   landing_demo_mexeu {modulo}                           · landing_demo_saida {destino}
 *   landing_oferta_vista {}                               · landing_caixinha {marcada}
 *   landing_cta {onde}                                    · landing_pix_gerado {oferta, valor, order_id, simulado}
 *   landing_pix_copiado {ok, via}                         · landing_pix_pago {oferta, valor, order_id}
 *   landing_email_pix {ok, via}                           · landing_email {via}   · landing_abrir_core {}
 *   landing_loja {loja, onde}                             · landing_erro {onde, msg}
 * Pixel: PageView (no HTML) · ViewContent 1x na oferta · InitiateCheckout no Pix gerado · Purchase pelo pagamento.ts
 * (firePixPurchaseOnce, mesmo id da CAPI do servidor).
 */
import {
  EMAIL_OK, MODULO_DA_AREA, NOME_DO_MODULO, ROTULO_OFERTA, VALOR_OFERTA, URL_APP_STORE,
  bracoOfertaDoHtml, bracoTituloDoHtml, ehArea, ehModuloLanding, estadoQueVolta, mmss, ofertaEscolhida, reais, urlPlay, venceEm,
  type Area, type EstadoLanding, type MensagemDaDemo, type ModuloLanding, type OfertaLanding, type PixLanding,
} from "./regras";

/** O Pix de verdade (asaas-pix com as ofertas LN_*). Só ligar DEPOIS do deploy das funções (RELATORIO). */
export const PIX_REAL = true; // 28/10: ligado depois do deploy de pix-reconcile, asaas-webhook, asaas-pix e pix-vincular com as ofertas LN_*

const PRODUCAO = /(^|\.)coreaplicativo\.com\.br$/.test(location.hostname);
const SIMULADO = !PIX_REAL && !PRODUCAO;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const agora = () => Math.round(performance.now());
type Janela = Window & {
  __landing?: { t?: string; oferta?: string; t_forcado?: boolean; oferta_forcada?: boolean; divisao?: string | null };
  __eventosLanding?: Record<string, unknown>[];
  __landingSimular?: { pagar: () => void };
  fbq?: (...a: unknown[]) => void;
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
};
const w = window as Janela;
w.__eventosLanding = w.__eventosLanding || [];

/* ───────────────────────── a URL do anúncio fica no heap (o Instagram zera o storage, a URL não) ───────────────────────── */
const URL_DE_CHEGADA = location.href;
const BUSCA = new URLSearchParams(location.search);
const brTitulo = bracoTituloDoHtml();
const brOferta = bracoOfertaDoHtml();

/* ───────────────────────── sessão + eventos ───────────────────────── */
const novoId = () => { try { return crypto.randomUUID(); } catch { return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; } };
const ss = (k: string, v?: string): string | null => {
  try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { /* noop */ }
  return v ?? null;
};
const sessao = ss("landing-sessao-v1") || ss("landing-sessao-v1", novoId())!;
const coreSid = ss("core_session_id") || ss("core_session_id", novoId())!;
const URL_EV = "https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const ua = navigator.userAgent || "";
const plataforma = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "web";
const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua);
const atrib: Record<string, string> = {};
for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "c_id", "as_id", "ad_id", "pl"]) {
  const v = BUSCA.get(k); if (v) atrib[k] = v.slice(0, 200);
}
if (BUSCA.get("fbclid")) atrib.tem_fbclid = "1";

export function evento(nome: string, dados: Record<string, unknown> = {}): void {
  const corpo = { ...dados, landing_session_id: sessao, braco_titulo: brTitulo, braco_oferta: brOferta, plataforma, in_app: inApp, t_ms: agora(), ...atrib };
  w.__eventosLanding!.push({ nome, ...corpo });
  if (!PRODUCAO) return;
  try {
    fetch(URL_EV, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: null, session_id: coreSid, event_name: nome, event_data: { ...corpo, path: location.pathname } }),
    }).catch(() => {});
  } catch { /* nunca derruba a página */ }
}
const pixel = (ev: string, params: Record<string, unknown> = {}, eventID?: string) => {
  try { if (typeof w.fbq === "function") { if (eventID) w.fbq("track", ev, params, { eventID }); else w.fbq("track", ev, params); } } catch { /* noop */ }
};

/* 1ª tela: o HTML já pintou; o 1º frame depois deste script confirma */
requestAnimationFrame(() => {
  let ttfb: number | null = null;
  try { const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined; if (n) ttfb = Math.round(n.responseStart); } catch { /* noop */ }
  const m = w.__landing ?? {};
  evento("landing_html", { tela1_ms: agora(), ttfb_ms: ttfb, t_forcado: !!m.t_forcado, oferta_forcada: !!m.oferta_forcada, divisao: m.divisao ?? null });
});

/* scripts de terceiros (pixel e Google) DEPOIS do load — nunca disputam a 1ª tela */
const carregarScript = (src: string) => { const s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); };
let terceiros = false;
const carregarTerceiros = () => {
  if (terceiros || !PRODUCAO) return;
  terceiros = true;
  carregarScript("https://connect.facebook.net/en_US/fbevents.js");
  carregarScript("https://www.googletagmanager.com/gtag/js?id=AW-18254888989");
};
const depoisDoLoad = (f: () => void, ms: number) => {
  const vai = () => window.setTimeout(f, ms);
  if (document.readyState === "complete") vai(); else window.addEventListener("load", vai, { once: true });
};
depoisDoLoad(carregarTerceiros, 800);
window.setTimeout(carregarTerceiros, 6000);

/* ───────────────────────── rolar ───────────────────────── */
const rolarAte = (el: Element | null, bloco: ScrollLogicalPosition = "start") => {
  if (!el) return;
  try { el.scrollIntoView({ behavior: "smooth", block: bloco }); } catch { try { el.scrollIntoView(); } catch { /* sem rolagem (teste) */ } }
};

/* ───────────────────────── 2. a demo ───────────────────────── */
const celular = $("lp-celular");
const frame = $<HTMLIFrameElement>("lp-demo-frame");
const img = $<HTMLImageElement>("lp-demo-img");
const kicker = $("lp-demo-kicker");
const IMAGENS: Partial<Record<ModuloLanding, string>> = { financas: "/landing/demo-financas.webp", rotina: "/landing/demo-rotina.webp", treino: "/landing/demo-treino.webp" };
let moduloAtual: ModuloLanding = "financas";
let demoIniciada = false;
let demoPronta = false;
const tInicioDemo = { t: 0 };

function marcarModulo(m: ModuloLanding) {
  moduloAtual = m;
  celular.dataset.modulo = m;
  kicker.textContent = `Seu CORE · ${NOME_DO_MODULO[m]}`;
  document.querySelectorAll<HTMLButtonElement>(".lp-pilula[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
}

function iniciarDemo(via: string) {
  if (demoIniciada) return;
  demoIniciada = true;
  tInicioDemo.t = agora();
  frame.src = `/organizar/demo?m=${moduloAtual}`;
  evento("landing_demo_aberta", { modulo: moduloAtual, via });
}

function abrirModulo(m: ModuloLanding, via: "area" | "pilula" | "grade") {
  const mudou = m !== moduloAtual;
  marcarModulo(m);
  if (!demoPronta) {
    // a demo ainda não chegou: a imagem certa (se houver) e a demo nasce no módulo novo
    if (IMAGENS[m]) img.src = IMAGENS[m]!;
    if (demoIniciada && mudou) frame.src = `/organizar/demo?m=${m}`;
    iniciarDemo(via);
  } else if (mudou) {
    try { frame.contentWindow?.postMessage({ tipo: "landing:modulo", m }, location.origin); } catch { /* noop */ }
  }
  if (mudou || via !== "area") evento("landing_demo_modulo", { modulo: m, via });
}

window.addEventListener("message", (e: MessageEvent) => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
  const d = e.data as MensagemDaDemo | null;
  if (!d || typeof d !== "object") return;
  if (d.tipo === "landing:pronta") {
    if (!demoPronta) {
      demoPronta = true;
      celular.setAttribute("data-pronta", "");
      frame.removeAttribute("tabindex");
      evento("landing_demo_pronta", { modulo: d.modulo, ms_desde_html: agora(), ms_desde_inicio: agora() - tInicioDemo.t });
    }
  } else if (d.tipo === "landing:modulo-trocado" && ehModuloLanding(d.modulo)) {
    marcarModulo(d.modulo);
    evento("landing_demo_modulo", { modulo: d.modulo, via: "dentro" });
  } else if (d.tipo === "landing:oferta") {
    evento("landing_demo_saida", { destino: String(d.destino).slice(0, 80), modulo: moduloAtual });
    rolarAte($("oferta"));
  } else if (d.tipo === "landing:mexeu" && ehModuloLanding(d.modulo)) {
    evento("landing_demo_mexeu", { modulo: d.modulo });
  }
});

/* a demo começa a baixar depois da 1ª pintura: load + ocioso (ou no 1º toque) */
depoisDoLoad(() => {
  const vai = () => iniciarDemo("fundo");
  if (w.requestIdleCallback) w.requestIdleCallback(vai, { timeout: 1500 }); else window.setTimeout(vai, 300);
}, 0);

/* ───────────────────────── 1. topo: a área ───────────────────────── */
document.querySelectorAll<HTMLButtonElement>(".lp-area").forEach((b) => {
  b.addEventListener("click", () => {
    const area = b.dataset.a as Area;
    if (!ehArea(area)) return;
    document.querySelectorAll<HTMLButtonElement>(".lp-area").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const m = MODULO_DA_AREA[area];
    evento("landing_area", { area, modulo: m });
    abrirModulo(m, "area");
    window.setTimeout(() => rolarAte($("demo")), 120);
  });
});
document.querySelectorAll<HTMLButtonElement>(".lp-pilula[data-m]").forEach((b) => b.addEventListener("click", () => {
  if (ehModuloLanding(b.dataset.m)) abrirModulo(b.dataset.m, "pilula");
}));
document.querySelectorAll<HTMLButtonElement>(".lp-mod[data-m]").forEach((b) => b.addEventListener("click", () => {
  if (!ehModuloLanding(b.dataset.m)) return;
  abrirModulo(b.dataset.m, "grade");
  rolarAte($("demo"));
}));
document.querySelectorAll<HTMLElement>("[data-ir]").forEach((b) => b.addEventListener("click", () => {
  const alvo = b.dataset.ir!;
  if (alvo === "oferta") evento("landing_cta", { onde: b.closest("#lp-fixo") ? "fixo" : b.closest("#fim") ? "fim" : "outro" });
  rolarAte($(alvo));
}));
document.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: a.closest("#lp-pix") ? "pos_compra" : "como" })));

/* ───────────────────────── o estado da compra (guardado: o banco fecha/recarrega a aba) ───────────────────────── */
const CHAVE_ESTADO = "landing-estado-v1";
let estadoHeap: EstadoLanding | null = null; // o Instagram zera o storage com a página viva
const lerEstado = (): EstadoLanding => {
  let bruto: unknown = estadoHeap;
  if (!bruto) { try { bruto = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null"); } catch { bruto = null; } }
  return estadoQueVolta(bruto);
};
let estado: EstadoLanding = lerEstado();

/* ───────────────────────── blocos vistos + botão fixo ───────────────────────── */
const fixo = $("lp-fixo");
let passouDaDemo = false;
const naTela = new Set<string>();
const atualizarFixo = () => {
  const mostrar = passouDaDemo && !naTela.has("oferta") && !naTela.has("fim") && estado.fase !== "conta";
  if (mostrar) { fixo.setAttribute("data-on", ""); fixo.removeAttribute("aria-hidden"); (fixo.querySelector("button") as HTMLButtonElement).tabIndex = 0; }
  else { fixo.removeAttribute("data-on"); fixo.setAttribute("aria-hidden", "true"); (fixo.querySelector("button") as HTMLButtonElement).tabIndex = -1; }
};
const vistos = new Set<string>();
let ofertaVista = false;
if ("IntersectionObserver" in window) {
  const obs = new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      const bloco = (en.target as HTMLElement).dataset.bloco!;
      if (en.isIntersecting) {
        naTela.add(bloco);
        if (!vistos.has(bloco)) { vistos.add(bloco); evento("landing_bloco", { bloco }); }
        if (bloco === "oferta" && !ofertaVista) {
          ofertaVista = true;
          evento("landing_oferta_vista", {});
          pixel("ViewContent", { content_name: "landing_oferta", value: 27.9, currency: "BRL" });
          if (PIX_REAL) void pg().catch(() => null); // pré-aquece o Pix de verdade
        }
      } else naTela.delete(bloco);
      // passou da demo = o fim da demo já subiu acima do meio da tela
      if (bloco === "demo" && !en.isIntersecting && en.boundingClientRect.top < 0) passouDaDemo = true;
      if (bloco === "modulos" && en.isIntersecting) passouDaDemo = true;
    }
    atualizarFixo();
  }, { threshold: 0.15 });
  document.querySelectorAll("[data-bloco]").forEach((el) => obs.observe(el));
}

/* ───────────────────────── 6. oferta: caixinha ───────────────────────── */
const caixinha = $<HTMLInputElement>("lp-caixinha");
const pagarTxt = $("lp-pagar-txt");
const ofertaAtual = (): OfertaLanding => ofertaEscolhida(brOferta, !!caixinha?.checked);
const atualizarBotao = () => { pagarTxt.textContent = `Pagar ${reais(VALOR_OFERTA[ofertaAtual()])} no Pix`; };
caixinha?.addEventListener("change", () => { atualizarBotao(); evento("landing_caixinha", { marcada: caixinha.checked }); });
atualizarBotao();

/* ───────────────────────── 7–8. o Pix e o depois ───────────────────────── */
const salvar = (novo: Partial<EstadoLanding>) => {
  estado = { ...estado, ...novo, salvoEm: Date.now() };
  estadoHeap = estado;
  try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* fica no heap */ }
  render();
};

const card = $("lp-card");
const caixa = $("lp-pix");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const ICO_PIX = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="3.2" transform="rotate(45 12 12)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" transform="rotate(45 12 12)" fill="currentColor"/></svg>';
const ICO_SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

let copiado: boolean | null = null;
let erroPix: string | null = null;
let erroEmail: string | null = null;
let aviso: string | null = null;
let faseConta: "email" | "salvando" | "codigo" | "entrando" = "email";
let emailDigitado = "";

type Pagamento = typeof import("./pagamento");
let pagamento: Promise<Pagamento> | null = null;
const pg = () => (pagamento ??= import("./pagamento"));

/* ── simulação (dev) ── */
const CODIGO_SIMULADO = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/SIMULACAO-SEM-COBRANCA-CORE52040000530398654052790" + "5802BR5904CORE6009SAO PAULO62070503***6304ABCD";
const espera = (ms: number) => new Promise((ok) => window.setTimeout(ok, ms));

/** Copiar NO TOQUE (o navegador só deixa copiar dentro do gesto): ClipboardItem com promessa (Safari/Chrome); senão, writeText depois. */
function copiarNoToque(codigo: Promise<string>): Promise<{ ok: boolean; via: string }> {
  try {
    const CI = (window as unknown as { ClipboardItem?: new (i: Record<string, Promise<Blob>>) => unknown }).ClipboardItem;
    if (CI && navigator.clipboard?.write) {
      const item = new CI({ "text/plain": codigo.then((t) => new Blob([t], { type: "text/plain" })) });
      return navigator.clipboard.write([item as ClipboardItem]).then(() => ({ ok: true, via: "item" }), () => copiarTexto(codigo).then((ok) => ({ ok, via: "texto" })));
    }
  } catch { /* plano B */ }
  return copiarTexto(codigo).then((ok) => ({ ok, via: "texto" }));
}
async function copiarTexto(c: Promise<string> | string): Promise<boolean> {
  let t = "";
  try { t = await c; } catch { return false; }
  try { await navigator.clipboard.writeText(t); return true; } catch { /* plano C */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}

async function gerar(): Promise<void> {
  if (estado.fase === "gerando") return;
  const oferta = ofertaAtual();
  if (!SIMULADO && !PIX_REAL) {
    erroPix = "O pagamento por esta página ainda não está ligado.";
    evento("landing_erro", { onde: "pix_desligado" });
    render();
    return;
  }
  erroPix = null; copiado = null;
  const anteriores = estado.pix && venceEm(estado.pix) > Date.now() ? [...estado.anteriores, estado.pix] : estado.anteriores;
  salvar({ fase: "gerando", anteriores });
  rolarAte(card, "start");
  evento("landing_cta", { onde: "pagar", oferta });
  const t0 = Date.now();
  const pedido: Promise<PixLanding | { erro: string; onde: string }> = SIMULADO
    ? espera(700).then(() => ({ orderId: `simulado-${Date.now().toString(36)}`, qrCode: CODIGO_SIMULADO, qrCodeBase64: null, expiresAt: null, criadoEm: Date.now(), oferta }))
    : pg().then((m) => m.gerarPix(oferta, URL_DE_CHEGADA)).catch((e) => ({ erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(e).slice(0, 120) }));
  // o código vai pra área de transferência AINDA no toque (a promessa resolve quando o QR chegar)
  const copia = copiarNoToque(pedido.then((p) => ("erro" in p ? Promise.reject(new Error("sem pix")) : p.qrCode)));
  const r = await pedido;
  // a animação "Gerando o seu Pix…" dura pelo menos 1,2 s (dá tempo de ler; o Pix rápido não pisca)
  const falta = 1200 - (Date.now() - t0);
  if (falta > 0) await espera(falta);
  if ("erro" in r) {
    erroPix = r.erro;
    evento("landing_erro", { onde: "pix_create", msg: r.onde });
    salvar({ fase: "oferta" });
    return;
  }
  const c = await copia;
  copiado = c.ok;
  salvar({ fase: "qr", pix: r });
  evento("landing_pix_gerado", { oferta, valor: VALOR_OFERTA[oferta], order_id: r.orderId, simulado: SIMULADO });
  evento("landing_pix_copiado", { ok: c.ok, via: c.via, auto: true, order_id: r.orderId });
  pixel("InitiateCheckout", { value: VALOR_OFERTA[oferta], currency: "BRL", content_name: oferta }, `ic-${r.orderId}`);
  conferirEmLoop();
}

/* confirmação: a cada 3 s + na volta da aba (o banco) — reveza com os QRs anteriores ainda vivos */
let loop: number | null = null;
let vez = 0;
let conferindo = false;
async function conferirUmaVez(): Promise<boolean> {
  if (!estado.pix || estado.fase !== "qr" || conferindo) return false;
  if (SIMULADO) return false; // simulado: só o "Já paguei" (ou __landingSimular.pagar) confirma
  conferindo = true;
  try {
    const vivos = estado.anteriores.filter((a) => venceEm(a) > Date.now());
    const fila: PixLanding[] = vivos.length ? vivos.flatMap((v) => [estado.pix!, v]) : [estado.pix];
    const alvo = fila[vez++ % fila.length];
    const m = await pg();
    if (await m.conferirPix(alvo, URL_DE_CHEGADA)) { pago(alvo); return true; }
  } catch { /* tenta de novo */ } finally { conferindo = false; }
  return false;
}
function conferirEmLoop() {
  if (loop) window.clearTimeout(loop);
  const passo = async () => {
    if (estado.fase !== "qr") return;
    await conferirUmaVez();
    if (estado.fase === "qr") loop = window.setTimeout(passo, 3000);
  };
  loop = window.setTimeout(passo, 3000);
}
const aoVoltar = () => { if (document.visibilityState === "visible" && estado.fase === "qr") void conferirUmaVez(); };
document.addEventListener("visibilitychange", aoVoltar);
window.addEventListener("pageshow", aoVoltar);

function pago(p: PixLanding) {
  if (estado.fase === "pago" || estado.fase === "conta") return;
  if (loop) window.clearTimeout(loop);
  evento("landing_pix_pago", { oferta: p.oferta, valor: VALOR_OFERTA[p.oferta], order_id: p.orderId, simulado: SIMULADO });
  salvar({ fase: "pago", pago: p, anteriores: [] });
  rolarAte(card, "start");
  // deu o e-mail na tela do QR (ou pagou logada): segue sozinho pra conta
  if (estado.emailPix) void prontoComEmail(estado.emailPix, "pix");
  else if (!SIMULADO) void pg().then((m) => m.emailDaSessaoAtual()).then((e) => { if (e) void prontoComEmail(e, "ja_logada"); }).catch(() => null);
}
w.__landingSimular = { pagar: () => { if (SIMULADO && estado.pix && estado.fase === "qr") pago(estado.pix); } };

async function jaPaguei() {
  evento("landing_cta", { onde: "ja_paguei" });
  if (SIMULADO) { await espera(600); if (estado.pix) pago(estado.pix); return; }
  const ok = await conferirUmaVez();
  if (!ok) { aviso = "Ainda não chegou. Confere no app do banco — quando cair, esta tela muda sozinha."; render(); }
}

async function salvarEmailPix(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo) || !estado.pix) return;
  let via: string | null = null;
  erroEmail = null;
  if (SIMULADO) { await espera(400); via = limpo.includes("+existe") ? "destino" : "conta"; }
  else {
    const r = await pg().then((m) => m.salvarEmailDoPix(estado.pix!, limpo)).catch(() => ({ erro: "Não consegui salvar agora." }));
    if ("via" in r) via = r.via; else erroEmail = r.erro;
  }
  evento("landing_email_pix", { ok: !!via, via });
  if (via) salvar({ emailPix: limpo }); else render();
}

async function prontoComEmail(email: string, via: string) {
  const p = estado.pago;
  if (!p) return;
  if (!SIMULADO) {
    try { await (await pg()).finalizarConta(p.orderId, { attr: atrib, braco_titulo: brTitulo, braco_oferta: brOferta, oferta: p.oferta, landing_session_id: sessao }); } catch { /* o e-mail é extra */ }
  }
  evento("landing_email", { via });
  salvar({ fase: "conta", email });
}

async function criarConta(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo)) { erroEmail = "Esse e-mail parece errado. Confere e tenta de novo."; render(); return; }
  emailDigitado = limpo; erroEmail = null; faseConta = "salvando"; render();
  if (SIMULADO) {
    await espera(700);
    if (limpo.includes("+existe")) { faseConta = "codigo"; render(); return; }
    faseConta = "email"; await prontoComEmail(limpo, "nova"); return;
  }
  const m = await pg();
  // pagou com o e-mail de destino (conta que já existia) → o servidor já levou a compra; aqui entra com o código
  const r = await m.criarConta(limpo);
  if (r.ok === true) { faseConta = "email"; await prontoComEmail(limpo, "nova"); return; }
  if ("existe" in r) {
    evento("landing_email", { via: "existe" });
    const foi = await m.pedirCodigo(limpo);
    faseConta = "codigo";
    if (!foi) erroEmail = "Não consegui mandar o código agora. Tenta de novo em alguns segundos.";
    render(); return;
  }
  faseConta = "email"; erroEmail = r.erro; render();
}

async function entrarComCodigo(codigo: string) {
  faseConta = "entrando"; erroEmail = null; render();
  if (SIMULADO) {
    await espera(600);
    if (codigo.trim() !== "123456") { faseConta = "codigo"; erroEmail = "Código errado. Confere no seu e-mail."; render(); return; }
    faseConta = "email"; await prontoComEmail(emailDigitado, "codigo"); return;
  }
  const r = await (await pg()).entrarComCodigo(emailDigitado, codigo);
  if (!r.ok) { faseConta = "codigo"; erroEmail = "Código errado ou vencido. Confere no seu e-mail."; render(); return; }
  aviso = r.aviso ?? null;
  faseConta = "email"; await prontoComEmail(emailDigitado, "codigo");
}

/* ── o QR (a imagem da Asaas; no simulado/sem imagem, desenhado aqui — só baixa nesse caso) ── */
async function desenharQr(alvo: HTMLElement, p: PixLanding) {
  if (p.qrCodeBase64) { alvo.innerHTML = `<img alt="QR code do Pix" width="116" height="116" src="${esc(p.qrCodeBase64)}" />`; return; }
  try {
    const [{ createElement }, { createRoot }, { QRCodeSVG }] = await Promise.all([import("react"), import("react-dom/client"), import("qrcode.react")]);
    createRoot(alvo).render(createElement(QRCodeSVG, { value: p.qrCode, size: 116, level: "M" }));
  } catch { /* sem QR desenhado: o código copia-e-cola continua */ }
}

let relogio: number | null = null;
function render() {
  card.dataset.fase = estado.fase === "erro" ? "oferta" : estado.fase;
  const f = estado.fase;
  if (relogio) { window.clearInterval(relogio); relogio = null; }
  if (f === "oferta") {
    caixa.innerHTML = erroPix ? `<p class="lp-erro" role="alert">${esc(erroPix)}</p>` : "";
  } else if (f === "gerando") {
    caixa.innerHTML = `<div class="lp-pix-gerando" data-testid="landing-gerando"><span class="lp-pix-logo">${ICO_PIX}</span><b>Gerando o seu Pix…</b><div class="lp-progresso"><i></i></div><span>Sem CPF, sem cadastro. Leva 2 segundos.</span></div>`;
  } else if (f === "qr" && estado.pix) {
    const p = estado.pix;
    caixa.innerHTML = `
      <div class="lp-pix-valor"><b>${reais(VALOR_OFERTA[p.oferta])}</b><span>${esc(ROTULO_OFERTA[p.oferta])}</span></div>
      ${copiado ? `<div class="lp-copiado" data-testid="landing-copiado">${ICO_CHECK}<span><b>Código Pix copiado</b>Agora abra o app do seu banco: Pix → Copia e Cola.</span></div>` : ""}
      <div class="lp-qr-linha"><div class="lp-qr" id="lp-qr"></div><div class="lp-qr-dica">${copiado ? "Ou leia o <b>QR code</b> com a câmera do banco, em outro aparelho." : "<b>Copie o código</b> e cole no app do banco em Pix → Copia e Cola. Ou leia o QR code."}</div></div>
      <div class="lp-codigo" data-testid="landing-codigo">${esc(p.qrCode)}</div>
      <button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="lp-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código Pix"}</span></button>
      <div class="lp-esperando"><i class="lp-ponto"></i><span><b>Esperando o pagamento</b>Esta tela confirma sozinha quando o pagamento entrar.</span></div>
      <div class="lp-validade" id="lp-validade">Este código vale por ${mmss(venceEm(p) - Date.now())}</div>
      ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
      <div class="lp-email-opc">${estado.emailPix
        ? `<div class="lp-ok-linha">${ICO_CHECK}<span>O acesso também vai pra <b>${esc(estado.emailPix)}</b>.</span></div>`
        : `<label for="lp-email-pix">Seu e-mail pra garantir o acesso <span style="font-weight:500">(opcional)</span></label>
           <div class="lp-linha"><input class="lp-campo" id="lp-email-pix" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" /><button type="button" class="lp-mini" id="lp-email-pix-ok" disabled>Salvar</button></div>
           ${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}`}</div>
      <div class="lp-links"><button type="button" class="lp-link" id="lp-ja-paguei">Já paguei</button><button type="button" class="lp-link" id="lp-mudar">Mudar o plano</button></div>`;
    void desenharQr($("lp-qr"), p);
    $("lp-copiar").addEventListener("click", async () => {
      const ok = await copiarTexto(p.qrCode);
      copiado = ok || copiado;
      evento("landing_pix_copiado", { ok, via: "botao", auto: false, order_id: p.orderId });
      render();
    });
    $("lp-ja-paguei").addEventListener("click", () => { void jaPaguei(); });
    $("lp-mudar").addEventListener("click", () => { evento("landing_cta", { onde: "mudar_plano" }); aviso = null; salvar({ fase: "oferta" }); });
    const campo = document.getElementById("lp-email-pix") as HTMLInputElement | null;
    if (campo) {
      const btn = $<HTMLButtonElement>("lp-email-pix-ok");
      campo.addEventListener("input", () => { btn.disabled = !EMAIL_OK.test(campo.value.trim()); });
      btn.addEventListener("click", () => { btn.disabled = true; btn.textContent = "…"; void salvarEmailPix(campo.value); });
    }
    relogio = window.setInterval(() => {
      const el = document.getElementById("lp-validade");
      const resta = venceEm(p) - Date.now();
      if (el) el.textContent = resta > 0 ? `Este código vale por ${mmss(resta)}` : "Este código venceu.";
      if (resta <= 0) { window.clearInterval(relogio!); salvar({ fase: "oferta" }); }
    }, 1000);
  } else if (f === "pago") {
    const codigo = faseConta === "codigo" || faseConta === "entrando";
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-pago">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Pagamento confirmado!</h3>
        <p>${codigo ? `Esse e-mail já tem conta. Mandamos um código pra <b>${esc(emailDigitado)}</b>.` : "Agora só falta o seu e-mail pra criar sua conta."}</p>
        <div class="lp-form">
          ${codigo
            ? `<label for="lp-codigo">Código de 6 números</label><input class="lp-campo grande" id="lp-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" />
               <button type="button" class="lp-cta" id="lp-entrar" disabled>${faseConta === "entrando" ? '<i class="lp-gira"></i>' : ""}Entrar e liberar meu CORE</button>`
            : `<label for="lp-email">Seu e-mail</label><input class="lp-campo grande" id="lp-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" value="${esc(emailDigitado)}" />
               <button type="button" class="lp-cta" id="lp-criar" ${EMAIL_OK.test(emailDigitado) && faseConta !== "salvando" ? "" : "disabled"}>${faseConta === "salvando" ? '<i class="lp-gira"></i>Criando sua conta…' : `Criar minha conta ${ICO_SETA}`}</button>`}
          ${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}
        </div>
      </div>`;
    if (codigo) {
      const c = $<HTMLInputElement>("lp-codigo"); const b = $<HTMLButtonElement>("lp-entrar");
      c.addEventListener("input", () => { b.disabled = c.value.trim().length < 6; });
      b.addEventListener("click", () => { void entrarComCodigo(c.value); });
    } else {
      const e = $<HTMLInputElement>("lp-email"); const b = $<HTMLButtonElement>("lp-criar");
      e.addEventListener("input", () => { emailDigitado = e.value; b.disabled = !EMAIL_OK.test(e.value.trim()); });
      e.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void criarConta(e.value); });
      b.addEventListener("click", () => { void criarConta(e.value); });
    }
  } else if (f === "conta") {
    const email = estado.email ?? "";
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-conta">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Sua conta está pronta</h3>
        <p>${ehPraSempreTxt()} Entre com <b>${esc(email)}</b>.</p>
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        <div class="lp-form"><button type="button" class="lp-cta" id="lp-abrir">Abrir meu CORE ${ICO_SETA}</button></div>
        <div class="lp-loja-bloco">
          <b>Seu CORE também no celular</b>
          <p>Baixe na App Store ou Google Play e entre com este e-mail: <strong>${esc(email)}</strong></p>
          <div class="lp-selos"><a href="${URL_APP_STORE}" target="_blank" rel="noopener" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="120" height="40" /></a><a href="${esc(urlPlay("landing"))}" target="_blank" rel="noopener" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="103" height="40" /></a></div>
        </div>
      </div>`;
    $("lp-abrir").addEventListener("click", () => { evento("landing_abrir_core", {}); location.href = "/home"; });
    caixa.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: "pos_compra" })));
  }
  atualizarFixo();
}
const ehPraSempreTxt = () => (estado.pago && estado.pago.oferta !== "LN_ano279" ? "Seu CORE é seu pra sempre." : "Seu CORE está liberado por 1 ano.");

$("lp-pagar").addEventListener("click", () => { void gerar(); });

/* voltou com Pix aberto (o banco recarregou a aba) / já pago: a tela certa */
if (estado.fase === "qr") { copiado = null; conferirEmLoop(); }
if (estado.fase !== "oferta") {
  render();
  if (estado.fase === "pago" || estado.fase === "conta") window.setTimeout(() => rolarAte(card, "start"), 50);
}
