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
 *   (29/10) landing_duvida_aberta {pergunta}              · landing_voltou {fase, ausente_s, com_pix}  (aba visível de novo, ≥5 s fora)
 *   (29/10) landing_ja_tem {via: marcador|servidor|email_pix} · landing_ja_tem_nao_fui_eu {}
 *   (29/10) todo evento leva landing_device_id (id aleatório estável do aparelho, cookie + localStorage — ./marcador.ts)
 *   (29/10) todo evento leva braco_checkout ("livre" | "email" — AB_CHECKOUT no <head>). No braço "email":
 *           landing_email_antes_visto {} (1x, junto da oferta) · landing_email_antes_ok {via: nova|mesma_conta|codigo}
 *           landing_email_antes_erro {motivo: vazio|invalido|sessao|outra_conta|falhou|tem_conta|codigo_errado|codigo_nao_enviado}
 *           landing_email_antes_sugestao {} (tocou no "Você quis dizer …?")
 *   (29/10) landing_lembrete_volta {toque: t12|t20h, order_id, restaurado: aba|link|nao} — chegou pelo e-mail de lembrete do Pix
 *   (30/10) todo evento leva braco_lp ("atual" | "v2" — AB_LP no <head>). landing_cta {onde:"topo"} = o botão da vitrine (v2);
 *           landing_demo_aberta {via: fundo|perto|botao|area|pilula|grade}; landing_erro {onde:"chunk_pagamento", tentativa}
 *   (30/10, crítica r1 do v3, só v2) landing_cta leva {fase}; landing_lojas_topo {} (toque em "App Store · Google Play · Computador"
 *           da 1ª tela → rola até "Sim, é um app de verdade"); landing_pix_venceu {order_id, via: relogio|recarga} (o relógio do QR
 *           chegou a zero / a pessoa voltou com o código já vencido — r3: 1× por pedido);
 *           landing_fita só com ≥ 60% por ≥ 500 ms (a rolagem suave do botão do topo não conta)
 * (30/10) NOS DOIS BRAÇOS, sem mudança visual: o pixel da Meta entra no 1º quadro + ocioso (≤ ~1,5 s; reserva 2,5 s) em vez de
 *   load + 800 ms (o PageView saía em 4–8 s num Android lento e a Meta contava "27% dos cliques não carregam"); o iframe da
 *   demo (4–5 MB) só começa DEPOIS do pixel (ou quando a demo entra ≥ 25% na tela, ou no 1º toque) — no braço v2, SÓ no toque
 *   ("Testar o app", pílula ou grade); o chunk do Pix tem 2ª chance + recarga (./carregar.ts).
 * BRAÇO v2 (30/10, html[data-lp="v2"]) = v3 "produto em uso" (SINTESE.md em novidades-guardadas/2026-10-30/lp-v3): 1ª tela com UM
 *   celular real (a Home do dia) + preço + botão "Quero organizar minha vida"; "Por dentro" com 3 painéis (os 16 no celular, Finanças
 *   com o card R$ 146, Rotina); a ordem dos blocos por CSS; o botão fixo aparece quando o botão do topo sai da tela; a tela do Pix
 *   com 3 passos + QR e código lado a lado + "Pagou? Volte aqui"; pós-compra com os selos das lojas primeiro, e-mail em caixa e o
 *   1º passo. O braço "atual" é a página de hoje, byte a byte (teste landing-v2.test.ts).
 * E-mail ANTES do Pix (29/10, braço "email"): o campo fica acima do botão (no HTML, escondido pelo CSS no braço "livre" —
 * a página do "livre" é IGUAL à de hoje). Ao tocar em pagar: e-mail → sessão anônima (updateUser) → Pix. E-mail que já
 * tem conta → código do e-mail → entra na conta → Pix nela (conta com vitalício → "Você já tem o CORE"). Na tela do QR,
 * no lugar do e-mail opcional: "Pagou e a página fechou? O acesso chega em <e-mail>".
 * "Já comprou" (29/10, ./marcador.ts): ao confirmar o pagamento grava um marcador (cookie de 400 dias no domínio + localStorage);
 * com ele a página abre com "Você já tem o CORE" + Abrir meu CORE + lojas no lugar da oferta. O servidor também recusa o
 * Pix (`ja_tem`) de quem já tem o CORE pra sempre. Quem nunca comprou vê a página IGUAL (nada muda no HTML nem no 1º render).
 * Pixel: PageView (no HTML) · ViewContent 1x na oferta · InitiateCheckout no Pix gerado · Purchase pelo pagamento.ts
 * (firePixPurchaseOnce, mesmo id da CAPI do servidor).
 */
import {

  EMAIL_OK, MODULO_DA_AREA, NOME_DO_MODULO, ROTULO_OFERTA, VALOR_OFERTA, URL_APP_STORE,
  bracoCheckoutDoHtml, bracoLpDoHtml, checarEmailAntes, sugestaoDeEmail, voltaDoLembrete,
  ESTADO_VAZIO, bracoOfertaDoHtml, bracoTituloDoHtml, ehArea, ehModuloLanding, estadoQueVolta, mmss, ofertaEscolhida, reais, urlPlay, venceEm,
  type Area, type EstadoLanding, type MensagemDaDemo, type ModuloLanding, type OfertaLanding, type PixLanding,
} from "./regras";
import { esquecerCompra, esquecerPixVivo, gravarPixVivo, idDoAparelho, lerCompra, lerPixVivo, marcarCompra, type MarcaCompra } from "./marcador";
import { carregarComRetry, limparMarcaDeRecarga } from "./carregar";

// o Pix de verdade carrega sob demanda — declarado antes do observador dos blocos, que pode pré-aquecê-lo (com PIX_REAL).
// 30/10: com 2ª chance; o pré-aquecimento (recarregar=false) nunca recarrega a página — só o toque em pagar.
type Pagamento = typeof import("./pagamento");
let pagamento: Promise<Pagamento> | null = null;
const pg = (recarregar = true): Promise<Pagamento> => {
  if (pagamento) return pagamento;
  const p = carregarComRetry(() => import("./pagamento"), {
    recarregar,
    aoFalhar: (tentativa, erro) => evento("landing_erro", { onde: "chunk_pagamento", tentativa, msg: String(erro).slice(0, 120) }),
  });
  pagamento = p;
  p.then(limparMarcaDeRecarga, () => { pagamento = null; }); // falhou: o próximo toque tenta do zero (e pode recarregar)
  return p;
};

/** O Pix de verdade (asaas-pix com as ofertas LN_*). Só ligar DEPOIS do deploy das funções (RELATORIO). */
export const PIX_REAL = true; // 28/10 16h06: funções no ar com as ofertas LN_* (pix-reconcile v45, asaas-webhook v44, asaas-pix v46, pix-vincular v10)

const PRODUCAO = /(^|\.)coreaplicativo\.com\.br$/.test(location.hostname);
// fora do domínio de produção (dev, preview, testes) o Pix é SEMPRE simulado; no domínio, de verdade se PIX_REAL
const SIMULADO = !PRODUCAO;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const agora = () => Math.round(performance.now());
type Janela = Window & {
  __landingSimularJaTem?: boolean;
  __landing?: { t?: string; oferta?: string; t_forcado?: boolean; oferta_forcada?: boolean; checkout_forcado?: boolean; lp_forcado?: boolean; divisao?: string | null };
  __eventosLanding?: Record<string, unknown>[];
  __landingSimular?: { pagar: () => void };
  /** 30/10: diagnóstico de tempo (medição de desempenho; nada vai pro banco por aqui) */
  __landingDiag?: { terceirosEm: number | null; demoEm: number | null; demoVia: string | null };
  fbq?: (...a: unknown[]) => void;
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
};
const w = window as Janela;
const listaDeEventos = (w.__eventosLanding = w.__eventosLanding || []); // a lista desta página (o teste cria outra a cada página)
const diag = { terceirosEm: null as number | null, demoEm: null as number | null, demoVia: null as string | null };
w.__landingDiag = diag;

/* ───────────────────────── a URL do anúncio fica no heap (o Instagram zera o storage, a URL não) ───────────────────────── */
const URL_DE_CHEGADA = location.href;
const BUSCA = new URLSearchParams(location.search);
const brTitulo = bracoTituloDoHtml();
const brOferta = bracoOfertaDoHtml();
const brCheckout = bracoCheckoutDoHtml(); // 29/10: "livre" (o de hoje) | "email" (e-mail antes do Pix)
const brLp = bracoLpDoHtml(); // 30/10: "atual" (a página de hoje) | "v2" (vitrine)
const V2 = brLp === "v2";

/* ───────────────────────── sessão + eventos ───────────────────────── */
const novoId = () => { try { return crypto.randomUUID(); } catch { return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; } };
const ss = (k: string, v?: string): string | null => {
  try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { /* noop */ }
  return v ?? null;
};
const sessao = ss("landing-sessao-v1") || ss("landing-sessao-v1", novoId())!;
const coreSid = ss("core_session_id") || ss("core_session_id", novoId())!;
const aparelho = idDoAparelho(); // 29/10: estável entre visitas (o landing_session_id morre com a aba)
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
  const corpo = { ...dados, landing_session_id: sessao, landing_device_id: aparelho, braco_titulo: brTitulo, braco_oferta: brOferta, braco_checkout: brCheckout, braco_lp: brLp, plataforma, in_app: inApp, t_ms: agora(), ...atrib };
  listaDeEventos.push({ nome, ...corpo });
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
  evento("landing_html", { tela1_ms: agora(), ttfb_ms: ttfb, t_forcado: !!m.t_forcado, oferta_forcada: !!m.oferta_forcada, checkout_forcado: !!m.checkout_forcado, lp_forcado: !!m.lp_forcado, divisao: m.divisao ?? null });
});

/*
 * scripts de terceiros (pixel e Google): 30/10 — no 1º QUADRO + ocioso (teto ~1,5 s), com reserva aos 2,5 s. Antes era
 * load + 800 ms (reserva 6 s) e disputava a rede com a demo: num Android lento o PageView saía em 4–8 s e a Meta via
 * "27% dos cliques sem página" (lp-web/funil §2b). A 1ª tela já pintou antes deste módulo rodar; ~100 KB de JS do pixel
 * não a atrasam. Igual nos DOIS braços.
 */
const ocioso = (f: () => void, timeout: number) => { if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout }); else window.setTimeout(f, 200); };
const carregarScript = (src: string, aoCarregar?: () => void) => {
  const s = document.createElement("script"); s.async = true; s.src = src;
  if (aoCarregar) { s.onload = aoCarregar; s.onerror = aoCarregar; }
  document.head.appendChild(s);
};
let terceiros = false;
/** quem quer começar DEPOIS do pixel (a demo do braço atual): corre quando o fbevents chegou, ou 2,5 s depois do pedido */
let pixelPronto = false;
const esperandoPixel: Array<() => void> = [];
const avisarPixel = () => { if (pixelPronto) return; pixelPronto = true; esperandoPixel.splice(0).forEach((f) => { try { f(); } catch { /* noop */ } }); };
const depoisDoPixel = (f: () => void) => { if (pixelPronto) f(); else esperandoPixel.push(f); };
const carregarTerceiros = () => {
  if (terceiros) return;
  terceiros = true;
  diag.terceirosEm = agora();
  if (!PRODUCAO) { avisarPixel(); return; }
  carregarScript("https://connect.facebook.net/en_US/fbevents.js", avisarPixel);
  carregarScript("https://www.googletagmanager.com/gtag/js?id=AW-18254888989");
  window.setTimeout(avisarPixel, 2500);
};
requestAnimationFrame(() => ocioso(carregarTerceiros, 1500));
window.setTimeout(carregarTerceiros, 2500);

/* ───────────────────────── rolar ───────────────────────── */
/** suave = false: no arranque com Pix vivo/pago (crítica r1 pix 4: a pessoa via a 1ª tela e a página descendo por ~1 s) */
const rolarAte = (el: Element | null, bloco: ScrollLogicalPosition = "start", suave = true) => {
  if (!el) return;
  try { el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: bloco }); } catch { try { el.scrollIntoView(); } catch { /* sem rolagem (teste) */ } }
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

/** v2 (30/10 noite): a demo aberta pela landing v2 leva &lp=v2 — Finanças com o "quanto posso gastar hoje" nos R$ 146 da página em
 *  qualquer dia do mês (lib/preview-seeds-financas-landing). O atual pede a URL de sempre. */
const urlDemo = (m: ModuloLanding) => (V2 ? `/organizar/demo?m=${m}&lp=v2` : `/organizar/demo?m=${m}`);
/** v2: trocar a demo de módulo antes de ela ficar pronta SEM criar uma entrada no histórico (o "voltar" do celular é o fechar da tela cheia) */
const trocarSrc = (m: ModuloLanding) => {
  if (V2) { try { if (frame.contentWindow) { frame.contentWindow.location.replace(urlDemo(m)); return; } } catch { /* cai no src */ } }
  frame.src = urlDemo(m);
};
const cheiaModulo = document.getElementById("lp2-cheia-modulo");

function marcarModulo(m: ModuloLanding) {
  moduloAtual = m;
  celular.dataset.modulo = m;
  kicker.textContent = `Seu CORE · ${NOME_DO_MODULO[m]}`;
  if (cheiaModulo) cheiaModulo.textContent = NOME_DO_MODULO[m];
  document.querySelectorAll<HTMLButtonElement>(".lp-pilula[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
}

function iniciarDemo(via: string) {
  if (demoIniciada) return;
  demoIniciada = true;
  tInicioDemo.t = agora();
  diag.demoEm = tInicioDemo.t; diag.demoVia = via;
  celular.setAttribute("data-abrindo", ""); // v2: aparece o "Abrindo o app…" na tela cheia (no atual o CSS não muda nada)
  frame.src = urlDemo(moduloAtual);
  if (!V2) evento("landing_demo_aberta", { modulo: moduloAtual, via }); // v2: o landing_demo_aberta {via: "tela_cheia"} sai a cada abertura (abrirCheia)
}

function abrirModulo(m: ModuloLanding, via: "area" | "pilula" | "grade") {
  const mudou = m !== moduloAtual;
  marcarModulo(m);
  if (!demoPronta) {
    // a demo ainda não chegou: a imagem certa (se houver) e a demo nasce no módulo novo
    if (IMAGENS[m]) img.src = IMAGENS[m]!;
    if (demoIniciada && mudou) trocarSrc(m);
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
    // v2: a seta ← do próprio módulo fecha a tela cheia (volta pra onde a pessoa estava); o resto (algo que só existe com conta) fecha
    // e leva ao cartão. A seta manda 2 avisos ("seta" e o destino dela): o 1º manda, o 2º cai no "já fechando".
    if (V2 && cheiaAberta) { if (d.destino === "seta") pedirFechar("seta_app"); else pedirFechar("oferta_app", () => rolarAte($("oferta"), "start", false)); }
    else rolarAte($("oferta"));
  } else if (d.tipo === "landing:mexeu" && ehModuloLanding(d.modulo)) {
    evento("landing_demo_mexeu", { modulo: d.modulo });
  }
});

/*
 * 30/10: quando a demo (o app inteiro, 4–5 MB) começa a baixar.
 *   atual: o mais cedo entre (a) o pixel carregou (ou 2,5 s depois do pedido) + ocioso — antes era load + ocioso, e a
 *          demo disputava a rede com o PageView; (b) a demo entrou ≥ 25% na tela; (c) o 1º toque (área/pílula/grade).
 *          Visualmente igual: a imagem leve do módulo ocupa a MESMA caixa até o iframe chegar, como hoje.
 *   v2:    SÓ no toque ("Testar o app", pílula ou grade). 61% nunca chegavam à demo e baixavam tudo mesmo assim.
 */
// (a) depois do pixel E do load: o iframe antes do `load` segurava o evento load da página em ~5 s na medição (a barra de
// progresso do navegador do Instagram ficaria girando) — no main de hoje a demo também só entra depois do load
const depoisDoLoad = (f: () => void) => { if (document.readyState === "complete") f(); else window.addEventListener("load", f, { once: true }); };
if (!V2) {
  depoisDoPixel(() => depoisDoLoad(() => ocioso(() => iniciarDemo("fundo"), 1500)));
  if ("IntersectionObserver" in window) {
    const perto = new IntersectionObserver((ens) => { if (ens.some((e) => e.isIntersecting)) { iniciarDemo("perto"); perto.disconnect(); } }, { threshold: 0.25 });
    perto.observe($("demo"));
  }
}
document.getElementById("lp-demo-abrir")?.addEventListener("click", () => {
  evento("landing_cta", { onde: "testar_app" });
  if (V2) abrirCheia(moduloAtual, "botao"); else iniciarDemo("botao");
});

/*
 * ───────── v2 · A DEMO EM TELA CHEIA (30/10 noite, dono no iPhone: "a proporção do app ficou estranha") ─────────
 * Na página fica um cartão (celular em proporção real + "Testar o app aqui" + pílulas). O toque abre o app de verdade POR CIMA da
 * página: o próprio .lp-celular vira uma camada fixa de 100dvh (o iframe nunca muda de lugar no DOM — mover um iframe o recarrega),
 * com "← Voltar" + o módulo em cima e "R$ 27,90 · Vitalício · Pix | Quero organizar minha vida" embaixo.
 *   · abrir = history.pushState (mesma URL) + trava a página por baixo (body fixed em −y: sem pulo no WebKit, sem rolar por trás);
 *   · o voltar do celular/gesto (popstate) fecha; a seta e a barra de baixo fecham por history.back() (uma entrada só, nunca 2);
 *   · fechar devolve a página EXATAMENTE no y de antes (a barra de baixo leva ao cartão da oferta);
 *   · recarregar com a tela cheia aberta (o Instagram recarrega a aba) reabre no mesmo módulo e no mesmo y — menos com Pix vivo, pago
 *     ou "já tem": aí o cartão manda (y 0) e a marca sai do histórico;
 *   · o iframe só ganha src no 1º toque (como antes); depois de aberto continua vivo escondido — reabrir é instantâneo, no mesmo lugar.
 * Eventos: landing_demo_aberta {modulo, via: "tela_cheia", origem: botao|pilula|cartao|recarga|avancar, vez}
 *          landing_demo_fechada {ms, via: seta|voltar|comprar|seta_app|oferta_app|fase, modulo} · landing_cta {onde: "demo_tela_cheia", fase}
 */
const MARCA_CHEIA = "lpDemoCheia";
type EstadoHist = { [MARCA_CHEIA]?: 1; y?: number; m?: string } & Record<string, unknown>;
const estadoHist = (): EstadoHist | null => { try { const e = history.state; return e && typeof e === "object" ? (e as EstadoHist) : null; } catch { return null; } };
let cheiaAberta = false;
let cheiaDesde = 0;
let cheiaVezes = 0;
let yDaPagina = 0;
let fechandoVia: string | null = null;
let depoisDeFechar: (() => void) | null = null;
let reservaDoFechar: number | null = null;
let restauracaoAntes: ScrollRestoration | null = null;
let quemAbriu: HTMLElement | null = null;
const cheiaVoltar = document.getElementById("lp2-cheia-voltar");
const cheiaComprar = document.getElementById("lp2-cheia-comprar");

function travarPagina(y: number) {
  const b = document.body.style;
  b.position = "fixed"; b.top = `-${y}px`; b.left = "0"; b.right = "0"; b.width = "100%"; b.overflow = "hidden";
}
function soltarPagina(y: number) {
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = ""; b.overflow = "";
  try { window.scrollTo(0, y); } catch { /* jsdom */ }
}

function abrirCheia(m: ModuloLanding, origem: "botao" | "pilula" | "cartao" | "recarga" | "avancar", y?: number) {
  if (!V2 || cheiaAberta) return;
  const mudou = m !== moduloAtual;
  marcarModulo(m);
  if (!demoIniciada) iniciarDemo(origem);
  else if (mudou) {
    if (demoPronta) { try { frame.contentWindow?.postMessage({ tipo: "landing:modulo", m }, location.origin); } catch { /* noop */ } }
    else trocarSrc(m);
  }
  yDaPagina = y ?? Math.round(window.scrollY || window.pageYOffset || 0);
  // a rolagem é nossa enquanto a camada existe (o navegador restaurando o y da entrada de baixo brigava com o "levar ao cartão")
  try { if (restauracaoAntes === null) restauracaoAntes = history.scrollRestoration; history.scrollRestoration = "manual"; } catch { /* noop */ }
  if (origem !== "recarga") { try { history.pushState({ ...(estadoHist() ?? {}), [MARCA_CHEIA]: 1, y: yDaPagina, m }, ""); } catch { /* sem histórico: fecha só pelos botões */ } }
  travarPagina(yDaPagina);
  document.documentElement.setAttribute("data-demo-cheia", "");
  celular.setAttribute("role", "dialog"); celular.setAttribute("aria-modal", "true"); celular.setAttribute("aria-label", "Demonstração do CORE");
  cheiaAberta = true; cheiaDesde = agora(); cheiaVezes += 1;
  quemAbriu = origem === "recarga" || origem === "avancar" ? null : (document.activeElement as HTMLElement | null);
  atualizarRotulos();
  evento("landing_demo_aberta", { modulo: m, via: "tela_cheia", origem, vez: cheiaVezes });
  try { cheiaVoltar?.focus({ preventScroll: true }); } catch { /* noop */ }
}

/** Fecha JÁ (o histórico já voltou, ou não dá pra usar o histórico). */
function fecharCheia(via: string) {
  if (!cheiaAberta) return;
  cheiaAberta = false;
  fechandoVia = null;
  if (reservaDoFechar !== null) { window.clearTimeout(reservaDoFechar); reservaDoFechar = null; }
  document.documentElement.removeAttribute("data-demo-cheia");
  celular.removeAttribute("aria-modal");
  soltarPagina(yDaPagina);
  evento("landing_demo_fechada", { ms: agora() - cheiaDesde, via, modulo: moduloAtual });
  const depois = depoisDeFechar; depoisDeFechar = null;
  if (depois) depois();
  else if (quemAbriu && document.contains(quemAbriu)) { try { quemAbriu.focus({ preventScroll: true }); } catch { /* noop */ } }
  quemAbriu = null;
  // devolve a restauração de rolagem do navegador depois que a volta do histórico terminou
  window.setTimeout(() => { if (!cheiaAberta && restauracaoAntes !== null) { try { history.scrollRestoration = restauracaoAntes; } catch { /* noop */ } restauracaoAntes = null; } }, 400);
}

/** Fechar pela seta / barra de baixo / app: volta 1 entrada no histórico (a que o abrir criou) e o popstate fecha. */
function pedirFechar(via: string, depois?: () => void) {
  if (!cheiaAberta || fechandoVia) return;
  fechandoVia = via;
  depoisDeFechar = depois ?? null;
  if (estadoHist()?.[MARCA_CHEIA]) {
    try { history.back(); } catch { fecharCheia(via); return; }
    // reserva: um navegador que não devolve o popstate (ou demora) não prende ninguém na tela cheia
    reservaDoFechar = window.setTimeout(() => { reservaDoFechar = null; if (cheiaAberta) fecharCheia(via); }, 700);
  } else fecharCheia(via);
}

/** O Pix mudou de tela com a tela cheia aberta (pagou no banco e voltou com a demo aberta): fecha na hora, sem esperar o histórico. */
let pularProximoPop = false;
function fecharCheiaJa(via: string) {
  if (!cheiaAberta) return;
  if (estadoHist()?.[MARCA_CHEIA]) { pularProximoPop = true; try { history.back(); } catch { pularProximoPop = false; } }
  fecharCheia(via);
}

window.addEventListener("popstate", (e: PopStateEvent) => {
  if (!V2 || !document.contains(celular)) return; // !contains: uma página anterior deste mesmo documento (testes) não mexe na atual
  const marca = !!(e.state && typeof e.state === "object" && (e.state as EstadoHist)[MARCA_CHEIA]);
  if (pularProximoPop) { pularProximoPop = false; if (!marca) return; }
  if (cheiaAberta && !marca) fecharCheia(fechandoVia ?? "voltar");
  else if (!cheiaAberta && marca && ehModuloLanding((e.state as EstadoHist).m)) abrirCheia((e.state as EstadoHist).m as ModuloLanding, "avancar", Math.round(window.scrollY || 0));
});
document.addEventListener("keydown", (e) => { if (cheiaAberta && e.key === "Escape" && document.contains(celular)) pedirFechar("seta"); });
cheiaVoltar?.addEventListener("click", () => pedirFechar("seta"));
cheiaComprar?.addEventListener("click", () => {
  evento("landing_cta", { onde: "demo_tela_cheia", fase: estado.fase });
  pedirFechar("comprar", () => rolarAte($("oferta"), "start", false));
});
document.getElementById("lp2-demo-cartao")?.addEventListener("click", () => { evento("landing_cta", { onde: "testar_app_cartao" }); abrirCheia(moduloAtual, "cartao"); });

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
  if (!ehModuloLanding(b.dataset.m)) return;
  if (V2) { evento("landing_demo_modulo", { modulo: b.dataset.m, via: "pilula" }); abrirCheia(b.dataset.m, "pilula"); return; } // v2: a pílula abre a tela cheia já no módulo
  abrirModulo(b.dataset.m, "pilula");
}));
document.querySelectorAll<HTMLButtonElement>(".lp-mod[data-m]").forEach((b) => b.addEventListener("click", () => {
  if (!ehModuloLanding(b.dataset.m)) return;
  abrirModulo(b.dataset.m, "grade");
  rolarAte($("demo"));
}));
document.querySelectorAll<HTMLElement>("[data-ir]").forEach((b) => b.addEventListener("click", () => {
  const alvo = b.dataset.ir!;
  if (alvo === "oferta") evento("landing_cta", { onde: b.closest("#lp-fixo") ? "fixo" : b.closest("#fim") ? "fim" : b.closest("#topo-v2") ? "topo" : "outro", fase: estado.fase });
  if (alvo === "dentro-v2") evento("landing_lojas_topo", {}); // r1: "App Store · Google Play · Computador" da 1ª tela → rola até "Sim, é um app de verdade"
  rolarAte($(alvo));
}));
document.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: a.closest("#lp-pix") ? "pos_compra" : "como" })));

/* ───────────────────────── o estado da compra (guardado: o banco fecha/recarrega a aba) ───────────────────────── */
const CHAVE_ESTADO = "landing-estado-v1";
const ehOferta = (o: string): o is OfertaLanding => Object.prototype.hasOwnProperty.call(VALOR_OFERTA, o);
let estadoHeap: EstadoLanding | null = null; // o Instagram zera o storage com a página viva
/* crítica r1 (pix 3, v2): o código vencido não some em silêncio — o cartão avisa e o pedido vencido segue sendo conferido por uns
 * minutos (quem pagou no minuto 29 e voltou no 31 não pode ver a oferta de novo e pagar 2×). Também na recarga: um Pix que
 * venceu há < 10 min deixa o aviso. */
let vencido: PixLanding | null = null;
let avisoOferta: string | null = null;
/* r3 (oferta M2 / pix 3): no braço livre o e-mail do QR é opcional — sem e-mail conhecido, o acesso NÃO chega em e-mail nenhum:
 * é esta tela que vira "pago" e pede o e-mail. A frase só promete o e-mail quando ele existe. */
const avisoVenceu = (emailConhecido: boolean) => emailConhecido
  ? "Esse código venceu. Se você já pagou, o acesso chega no seu e-mail em instantes. Se não, é só gerar outro."
  : "Esse código venceu. Se você já pagou, esta tela confirma sozinha em instantes. Se não, é só gerar outro.";
const JANELA_VENCIDO_MS = 10 * 60_000;
const lerEstado = (): EstadoLanding => {
  let bruto: unknown = estadoHeap;
  if (!bruto) { try { bruto = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null"); } catch { bruto = null; } }
  if (V2) {
    // r3 (pix 2): o localStorage sumiu (Instagram) mas o cookie do Pix vivo ficou → o mesmo QR reabre, sem um 2º Pix
    if (!bruto) {
      const c = lerPixVivo();
      if (c && ehOferta(c.oferta)) {
        const pix: PixLanding = { orderId: c.orderId, qrCode: c.qrCode, qrCodeBase64: null, expiresAt: c.expiresAt, criadoEm: Date.now(), oferta: c.oferta };
        bruto = { ...ESTADO_VAZIO, fase: "qr", pix, salvoEm: Date.now() } as EstadoLanding;
      }
    }
    const e = bruto as Partial<EstadoLanding> | null;
    if (e && e.v === 1 && e.pix && !e.pago && typeof e.salvoEm === "number") {
      const fora = Date.now() - venceEm(e.pix);
      if (fora > 0 && fora < JANELA_VENCIDO_MS) {
        vencido = e.pix; avisoOferta = avisoVenceu(!!(e.emailPix || lerCompra()?.email));
        // r3 (oferta B3): quem volta com o código já morto também conta (1× por pedido nesta aba) — a régua vê quantos voltaram a um Pix vencido
        const chave = `landing-venceu-${e.pix.orderId}`;
        if (!ss(chave)) { ss(chave, "1"); evento("landing_pix_venceu", { order_id: e.pix.orderId, via: "recarga" }); }
      }
    }
  }
  return estadoQueVolta(bruto);
};
let estado: EstadoLanding = lerEstado();
/* 29/10: "Você já tem o CORE" no lugar da oferta (marcador do aparelho, ou o servidor disse `ja_tem`) */
let jaTem: MarcaCompra | null = null;
// comprou antes do marcador existir (o estado do Pix ainda guarda a compra): marca agora
if (estado.pago) { try { if (!lerCompra()) marcarCompra({ oferta: estado.pago.oferta, email: estado.email ?? estado.emailPix }); } catch { /* noop */ } }

/* ───────────────────────── blocos vistos + botão fixo ───────────────────────── */
const fixo = $("lp-fixo");
let passouDaDemo = false;
/** v2: o botão do topo saiu da tela POR CIMA? (crítica r1: a trava "passou uma vez" deixava a barra ligada em cima da 1ª tela ao voltar) */
let topoSaiuPorCima = false;
const naTela = new Set<string>();
/* ── v2 (crítica r1, oferta M2 / pix M1): depois do Pix gerado ou pago a página não pode continuar "vendendo" — o botão do topo, o
 * fixo e o fim mudam de rótulo conforme a fase; com conta pronta (ou "já tem") o fixo some. ── */
const rotuloCta = (): string => (jaTem || estado.fase === "conta") ? "Ver minha conta" : estado.fase === "pago" ? "Liberar meu acesso" : estado.fase === "qr" ? "Voltar pro meu Pix" : "Quero organizar minha vida";
const porRotulo = (b: Element | null, t: string) => {
  if (!b) return;
  const n = b.firstChild;
  if (n && n.nodeType === Node.TEXT_NODE) n.textContent = b.querySelector("svg") ? `${t} ` : t; else b.prepend(`${t} `);
};
/** v2: a barra de baixo da tela cheia repete a barra fixa (preço/"Pix gerado · vale por" + o mesmo rótulo do botão) */
const barrasDePreco = (): HTMLElement[] => (V2 ? [fixo, document.querySelector<HTMLElement>(".lp2-cheia-baixo")].filter((x): x is HTMLElement => !!x) : []);
let rotulosDe = "";
function atualizarRotulos() {
  if (!V2) return;
  const t = rotuloCta();
  const chave = `${t}|${estado.fase === "qr" ? estado.pix?.orderId : ""}`;
  if (chave === rotulosDe) return; // o observador chama a cada bloco que entra/sai: só mexe no DOM quando a fase mudou
  rotulosDe = chave;
  porRotulo($("lp-cta-topo"), t);
  porRotulo(fixo.querySelector('button[data-so-lp="v2"]'), t);
  porRotulo(document.getElementById("lp2-cheia-comprar"), t);
  porRotulo(document.querySelector('#fim button[data-so-lp="v2"]'), t);
  const fim = $("fim");
  fim.dataset.fase = jaTem ? "conta" : estado.fase;
  const fimP = fim.querySelector<HTMLElement>('p[data-so-lp="v2"]');
  if (fimP) fimP.textContent = jaTem || estado.fase === "conta" ? "Sua conta está pronta." : estado.fase === "pago" ? "Pagamento confirmado. Falta só o seu e-mail." : estado.fase === "qr" ? "Seu Pix está logo acima." : "Vitalício por R$ 27,90 · Pix na hora";
  for (const barra of barrasDePreco()) {
    const fixoB = barra.querySelector<HTMLElement>(".lp2-fixo-p b"); const fixoS = barra.querySelector<HTMLElement>(".lp2-fixo-p span");
    if (!fixoB || !fixoS) continue;
    if (estado.fase === "qr" && estado.pix) { fixoB.textContent = "Pix gerado"; fixoS.textContent = `vale por ${mmss(Math.max(0, venceEm(estado.pix) - Date.now()))}`; }
    else { fixoB.textContent = "R$ 27,90"; fixoS.innerHTML = "Vitalício<i> · Pix</i>"; }
  }
}
const atualizarFixo = () => {
  const vendendo = estado.fase !== "conta" && !jaTem;
  const mostrar = (V2 ? topoSaiuPorCima && vendendo && estado.fase !== "pago" : passouDaDemo && vendendo) && !naTela.has("oferta") && !naTela.has("fim");
  // 30/10: 2 botões (um por braço; o CSS esconde o do outro) — o tabIndex vai nos dois
  if (mostrar) { fixo.setAttribute("data-on", ""); fixo.removeAttribute("aria-hidden"); fixo.querySelectorAll("button").forEach((b) => { b.tabIndex = 0; }); }
  else { fixo.removeAttribute("data-on"); fixo.setAttribute("aria-hidden", "true"); fixo.querySelectorAll("button").forEach((b) => { b.tabIndex = -1; }); }
  atualizarRotulos();
};
const vistos = new Set<string>();
let ofertaVista = false;
/** "viu a oferta" (1x): o evento da régua + ViewContent + pré-aquecimento do Pix. Atual: 15% do bloco #oferta na tela (como hoje).
 *  v2 (crítica r1 8.1): o BOTÃO DE PAGAR ≥ 50% visível — no v2 a oferta começa em y 684 e, em telas de 844+, 15% do bloco
 *  aparecia sem rolar (a régua inflava e a Meta recebia ViewContent de quem só abriu). */
const viuAOferta = () => {
  if (ofertaVista) return;
  ofertaVista = true;
  evento("landing_oferta_vista", { via: V2 ? "botao_50" : "bloco_15" });
  if (brCheckout === "email") evento("landing_email_antes_visto", {});
  pixel("ViewContent", { content_name: "landing_oferta", value: 27.9, currency: "BRL" });
  if (PIX_REAL && !SIMULADO) void pg(false).catch(() => null); // pré-aquece o Pix de verdade (sem recarregar a página se falhar)
};
if ("IntersectionObserver" in window) {
  if (V2) {
    const botaoPagar = $("lp-pagar");
    new IntersectionObserver((ens) => { if (ens.some((e) => e.isIntersecting)) viuAOferta(); }, { threshold: 0.5 }).observe(botaoPagar);
    // crítica r2 2.5: o landing_bloco "oferta" do v2 também só com metade do bloco na tela (em 844+ os 15% apareciam sem rolar)
    new IntersectionObserver((ens, o) => { if (ens.some((e) => e.isIntersecting) && !vistos.has("oferta")) { vistos.add("oferta"); evento("landing_bloco", { bloco: "oferta", via: "50" }); o.disconnect(); } }, { threshold: 0.5 }).observe($("oferta"));
    // crítica r1 8.2 / v3: os painéis do "Por dentro" — qual foi visto (1x por painel, ≥ 60% na tela). O nome do evento continua
    // landing_fita (os painéis eram uma fita na v2; o painel do dashboard lê esse nome); a legenda é o título do painel.
    // crítica r1 (técnico 7.2): ≥ 60% por ≥ 500 ms — a rolagem suave do botão do topo cruzava os 3 painéis e contava "viu" sem olhar
    const telas = [...document.querySelectorAll<HTMLElement>("#dentro-v2 .lp2-foto")];
    const vistas = new Set<number>();
    const esperando = new Map<number, number>();
    const fita = new IntersectionObserver((ens) => {
      for (const en of ens) {
        const i = telas.indexOf(en.target as HTMLElement);
        if (i < 0 || vistas.has(i)) continue;
        if (en.isIntersecting) {
          if (!esperando.has(i)) esperando.set(i, window.setTimeout(() => {
            esperando.delete(i); vistas.add(i);
            // r3 (prova-e-meio 1.3): o painel 1 tem 2 títulos (um por braço do AB_TITULO; o CSS esconde o outro) — a legenda é o visível
            const h3 = en.target.querySelector(brTitulo === "b" ? "h3.lp2-h3-b, h3:not(.lp2-h3-a)" : "h3:not(.lp2-h3-b)");
            evento("landing_fita", { indice: i, legenda: [...(h3?.childNodes ?? [])].map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim().slice(0, 40) });
            if (vistas.size === telas.length) fita.disconnect();
          }, 500));
        } else { const t = esperando.get(i); if (t !== undefined) { window.clearTimeout(t); esperando.delete(i); } }
      }
    }, { threshold: 0.6 });
    telas.forEach((t) => fita.observe(t));
  }
  const obs = new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      const bloco = (en.target as HTMLElement).dataset.bloco!;
      if (en.isIntersecting) {
        naTela.add(bloco);
        if (!vistos.has(bloco) && !(V2 && bloco === "oferta")) { vistos.add(bloco); evento("landing_bloco", { bloco }); } // v2: a oferta conta com ≥ 50% (abaixo)
        if (bloco === "oferta" && !V2) viuAOferta(); // no v2 é o botão de pagar ≥ 50% visível (abaixo)
      } else naTela.delete(bloco);
      // passou da demo = o fim da demo já subiu acima do meio da tela
      if (bloco === "demo" && !en.isIntersecting && en.boundingClientRect.top < 0) passouDaDemo = true;
      if (bloco === "modulos" && en.isIntersecting) passouDaDemo = true;
    }
    atualizarFixo();
  }, { threshold: 0.15 });
  document.querySelectorAll("[data-bloco]").forEach((el) => obs.observe(el));
  // v2: o botão fixo entra ENQUANTO o botão do topo está fora da tela por cima — e sai quando ele volta (crítica r1: liga e desliga)
  const ctaTopo = V2 ? document.getElementById("lp-cta-topo") : null;
  if (ctaTopo) {
    // r3 (primeira-tela B3): a barra também liga enquanto o botão ainda está ABAIXO da dobra (fonte do sistema +30%: o botão nasce
    // em 720–774 numa tela de 690 — a 1ª tela ficava com preço e sem botão até rolar); desliga assim que ele entra na tela
    const foraDaTela = (r: { top: number; bottom?: number }, alturaRaiz: number) => r.top < 0 || r.top >= alturaRaiz;
    new IntersectionObserver((ens) => {
      for (const en of ens) topoSaiuPorCima = !en.isIntersecting && foraDaTela(en.boundingClientRect, en.rootBounds?.height || window.innerHeight);
      atualizarFixo();
    }, { threshold: 0 }).observe(ctaTopo);
    // r2 (medição a +30%): com a fonte grande o botão do topo nasce ABAIXO da dobra; um salto de rolagem que pula o botão inteiro
    // (fora → fora) não gera entrada no observador e a barra nunca ligava. A rolagem confere a geometria (1x por quadro).
    let conferindo = false;
    window.addEventListener("scroll", () => {
      if (conferindo) return;
      conferindo = true;
      window.requestAnimationFrame(() => {
        conferindo = false;
        const b = ctaTopo.getBoundingClientRect();
        if (!b.height) return; // sem layout (jsdom): manda o observador
        const saiu = b.bottom < 0 || b.top >= window.innerHeight;
        if (saiu !== topoSaiuPorCima) { topoSaiuPorCima = saiu; atualizarFixo(); }
      });
    }, { passive: true });
  }
}

/* ───────────────────────── 6. oferta: caixinha ───────────────────────── */
const caixinha = $<HTMLInputElement>("lp-caixinha");
const pagarTxt = $("lp-pagar-txt");
const ofertaAtual = (): OfertaLanding => ofertaEscolhida(brOferta, !!caixinha?.checked);
// r2 (oferta 5 / pix 1, v2): com o aviso "Esse código venceu…" ligado, o botão diz o que o aviso manda fazer
const atualizarBotao = () => { pagarTxt.textContent = V2 && avisoOferta ? `Gerar outro Pix · ${reais(VALOR_OFERTA[ofertaAtual()])}` : `Pagar ${reais(VALOR_OFERTA[ofertaAtual()])} no Pix`; };
caixinha?.addEventListener("change", () => { atualizarBotao(); evento("landing_caixinha", { marcada: caixinha.checked }); });
atualizarBotao();

/* ───────────────────────── 7–8. o Pix e o depois ───────────────────────── */
const salvar = (novo: Partial<EstadoLanding>) => {
  estado = { ...estado, ...novo, salvoEm: Date.now() };
  estadoHeap = estado;
  try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* fica no heap */ }
  if (V2) {
    // r3 (pix 2): o Pix vivo também no cookie (até vencer); pago/vencido/oferta tiram o cookie
    if (estado.fase === "qr" && estado.pix) gravarPixVivo({ orderId: estado.pix.orderId, qrCode: estado.pix.qrCode, expiresAt: new Date(venceEm(estado.pix)).toISOString(), oferta: estado.pix.oferta });
    else if (estado.fase !== "gerando") esquecerPixVivo();
  }
  render();
};
/* r3 (pix 2): o navegador do Instagram zera o localStorage com a página viva (~5 s depois da chegada). O heap segura a
 * página, mas uma recarga depois disso voltava pra oferta. A cada volta pra aba (e a cada render do v2) a chave é re-semeada. */
const reSemear = () => {
  if (!V2 || (estado.fase !== "qr" && estado.fase !== "pago")) return; // só onde há dinheiro em jogo (a conta pronta já vive no marcador)
  try { if (localStorage.getItem(CHAVE_ESTADO) === null) localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* sem storage */ }
};
document.addEventListener("visibilitychange", reSemear);
window.addEventListener("pageshow", reSemear);
window.addEventListener("pagehide", reSemear);

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
let codigoPago = ""; // r2 (pix 3): o código digitado depois de pagar (sobrevive ao re-render do erro)


/* ── simulação (dev) ── */
const CODIGO_SIMULADO = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/SIMULACAO-SEM-COBRANCA-CORE52040000530398654052790" + "5802BR5904CORE6009SAO PAULO62070503***6304ABCD";
const espera = (ms: number) => new Promise((ok) => window.setTimeout(ok, ms));

/** Copiar NO TOQUE (o navegador só deixa copiar dentro do gesto): ClipboardItem com promessa (Safari/Chrome); senão, writeText depois. */
function copiarNoToque(codigo: Promise<string>): Promise<{ ok: boolean; via: string }> {
  try {
    const CI = (window as unknown as { ClipboardItem?: new (i: Record<string, Promise<Blob>>) => unknown }).ClipboardItem;
    if (CI && navigator.clipboard?.write) {
      const blob = codigo.then((t) => new Blob([t], { type: "text/plain" }));
      void blob.catch(() => null); // r2 (visitante-frio 3): quando não há Pix ("já tem conta"), a promessa rejeita — o ClipboardItem não conta como handler e o console acusava "Error: sem pix"
      const item = new CI({ "text/plain": blob });
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

/* ── 29/10: o e-mail ANTES do Pix (braço "email") ── */
const campoAntes = document.getElementById("lp-email-antes") as HTMLInputElement | null;
const erroAntesEl = document.getElementById("lp-email-antes-erro");
const sugestaoEl = document.getElementById("lp-email-antes-sugestao") as HTMLButtonElement | null;
/** e-mail que já tem conta: a pessoa entra com o código ANTES do Pix (nada pago ainda) */
let antes: { fase: "codigo" | "entrando"; email: string; erro: string | null } | null = null;
let codigoAntes = "";

function mostrarErroAntes(msg: string | null) {
  if (!erroAntesEl || !campoAntes) return;
  erroAntesEl.textContent = msg ?? "";
  erroAntesEl.hidden = !msg;
  if (msg) campoAntes.setAttribute("aria-invalid", "true"); else campoAntes.removeAttribute("aria-invalid");
}
function atualizarSugestao() {
  if (!sugestaoEl || !campoAntes) return;
  const s = sugestaoDeEmail(campoAntes.value);
  sugestaoEl.hidden = !s;
  sugestaoEl.dataset.v = s ?? "";
  sugestaoEl.innerHTML = s ? `Você quis dizer <b>${esc(s)}</b>?` : "";
}

type FalhaEmail = { existe: true } | { erro: string; motivo: string };
type PassoEmail = { ok: true; via: string } | FalhaEmail;
type Gerado = PixLanding | { jaTem: true; via: string } | { erro: string; onde: string };

/** o e-mail do campo → a sessão que vai pagar (simulado: "+existe"/"+jatem" = e-mail com conta; "+falha" = erro) */
function passoDoEmail(email: string): Promise<PassoEmail> {
  if (SIMULADO) {
    return espera(450).then(() => (/\+(existe|jatem)@/.test(email) ? { existe: true as const }
      : /\+falha@/.test(email) ? { erro: "Não consegui salvar seu e-mail agora. Tenta de novo em alguns segundos.", motivo: "falhou" }
        : { ok: true as const, via: "nova" }));
  }
  return pg().then((m) => m.emailAntesDoPix(email)).catch(() => ({ erro: "Não consegui salvar seu e-mail agora. Tenta de novo em alguns segundos.", motivo: "falhou" }));
}
function passoDoCodigo(email: string, codigo: string): Promise<PassoEmail> {
  if (SIMULADO) return espera(500).then(() => (codigo.trim() === "123456" ? { ok: true as const, via: "codigo" } : { erro: "Código errado ou vencido. Confere no seu e-mail.", motivo: "codigo_errado" }));
  return pg().then((m) => m.entrarAntesDoPix(email, codigo)).catch(() => ({ erro: "Não consegui entrar agora. Tenta de novo em alguns segundos.", motivo: "falhou" }));
}
function criarPix(oferta: OfertaLanding, emailConhecido: string | null): Promise<Gerado> {
  if (SIMULADO) {
    return espera(700).then(() => (w.__landingSimularJaTem || /\+jatem@/.test(emailConhecido ?? "")
      ? { jaTem: true as const, via: "servidor" }
      : { orderId: `simulado-${Date.now().toString(36)}`, qrCode: CODIGO_SIMULADO, qrCodeBase64: null, expiresAt: null, criadoEm: Date.now(), oferta }));
  }
  return pg().then((m) => m.gerarPix(oferta, URL_DE_CHEGADA, emailConhecido)).catch((e) => ({ erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(e).slice(0, 120) }));
}
async function mandarCodigo(email: string): Promise<boolean> {
  if (SIMULADO) { await espera(300); return true; }
  return pg().then((m) => m.pedirCodigo(email)).catch(() => false);
}

/**
 * O toque em pagar. Braço "livre": igual a sempre (Pix na hora). Braço "email": o e-mail do campo (ou o código, quando o
 * e-mail já tinha conta) vem antes, NA MESMA promessa — o código do Pix ainda vai pra área de transferência no toque.
 */
async function gerar(comCodigo: string | null = null): Promise<void> {
  if (estado.fase === "gerando" || antes?.fase === "entrando") return;
  const oferta = ofertaAtual();
  if (!SIMULADO && !PIX_REAL) {
    erroPix = "O pagamento por esta página ainda não está ligado.";
    evento("landing_erro", { onde: "pix_desligado" });
    render();
    return;
  }
  let emailAntes: string | null = null;
  if (brCheckout === "email") {
    if (antes && comCodigo !== null) emailAntes = antes.email;
    else {
      const ch = checarEmailAntes(campoAntes?.value ?? "");
      if ("motivo" in ch) {
        // r2 (oferta 4, v2): o rótulo do campo já diz "é por onde você entra no CORE" — o erro do vazio não repete a frase (1 linha)
        mostrarErroAntes(V2 && ch.motivo === "vazio" ? "Falta o seu e-mail pra gerar o Pix." : ch.msg);
        evento("landing_email_antes_erro", { motivo: ch.motivo });
        try { campoAntes?.focus(); } catch { /* noop */ }
        return;
      }
      emailAntes = ch.email;
      mostrarErroAntes(null);
    }
  }
  erroPix = null; copiado = null; avisoOferta = null;
  const anteriores = estado.pix && venceEm(estado.pix) > Date.now() ? [...estado.anteriores, estado.pix] : estado.anteriores;
  let t0 = Date.now();
  if (antes && comCodigo !== null) { antes = { ...antes, fase: "entrando", erro: null }; render(); }
  else { salvar({ fase: "gerando", anteriores }); rolarAte(card, "start"); }
  evento("landing_cta", { onde: comCodigo !== null ? "pagar_codigo" : "pagar", oferta });
  const emailConhecido = emailAntes ?? estado.email ?? estado.emailPix ?? lerCompra()?.email ?? null;
  const passo: Promise<PassoEmail> = emailAntes === null ? Promise.resolve({ ok: true as const, via: "livre" })
    : comCodigo !== null ? passoDoCodigo(emailAntes, comCodigo) : passoDoEmail(emailAntes);
  const pedido: Promise<Gerado | FalhaEmail> = passo.then<Gerado | FalhaEmail>((p) => {
    if (!("ok" in p)) return p;
    if (emailAntes !== null) evento("landing_email_antes_ok", { via: p.via });
    if (antes) { antes = null; salvar({ fase: "gerando", anteriores }); rolarAte(card, "start"); t0 = Date.now(); }
    return criarPix(oferta, emailConhecido);
  });
  // o código vai pra área de transferência AINDA no toque (a promessa resolve quando o QR chegar)
  const copia = copiarNoToque(pedido.then((p) => ("qrCode" in p ? p.qrCode : Promise.reject(new Error("sem pix")))));
  const r = await pedido;
  if ("existe" in r) {
    // 29/10: o e-mail já tem conta → código do e-mail ANTES do Pix (nada pago: entrar na conta dela é seguro)
    void copia.catch(() => null);
    if (!emailAntes) { salvar({ fase: "oferta" }); return; }
    const foi = await mandarCodigo(emailAntes);
    evento("landing_email_antes_erro", { motivo: foi ? "tem_conta" : "codigo_nao_enviado" });
    antes = { fase: "codigo", email: emailAntes, erro: foi ? null : "Não consegui mandar o código agora. Toque em “Mandar de novo”." };
    codigoAntes = "";
    salvar({ fase: "oferta" });
    rolarAte(card, "start");
    return;
  }
  if ("motivo" in r) {
    void copia.catch(() => null);
    evento("landing_email_antes_erro", { motivo: r.motivo });
    if (antes) { antes = { ...antes, fase: "codigo", erro: r.erro }; render(); return; }
    salvar({ fase: "oferta" });
    mostrarErroAntes(r.erro);
    return;
  }
  // a animação "Gerando o seu Pix…" dura pelo menos 1,2 s (dá tempo de ler; o Pix rápido não pisca)
  const falta = 1200 - (Date.now() - t0);
  if (falta > 0) await espera(falta);
  if ("jaTem" in r) {
    // 29/10: o servidor diz que esta pessoa JÁ tem o CORE pra sempre — nada de Pix novo
    void copia.catch(() => null);
    mostrarJaTem("servidor", emailAntes);
    return;
  }
  if ("erro" in r) {
    erroPix = r.erro;
    evento("landing_erro", { onde: "pix_create", msg: r.onde });
    salvar({ fase: "oferta" });
    return;
  }
  const c = await copia;
  copiado = c.ok;
  salvar({ fase: "qr", pix: r, ...(emailAntes ? { emailPix: emailAntes } : {}) });
  evento("landing_pix_gerado", { oferta, valor: VALOR_OFERTA[oferta], order_id: r.orderId, simulado: SIMULADO, email_antes: !!emailAntes });
  evento("landing_pix_copiado", { ok: c.ok, via: c.via, auto: true, order_id: r.orderId });
  pixel("InitiateCheckout", { value: VALOR_OFERTA[oferta], currency: "BRL", content_name: oferta }, `ic-${r.orderId}`);
  conferirEmLoop();
}

if (brCheckout === "email" && campoAntes) {
  if (estado.emailPix && !campoAntes.value) campoAntes.value = estado.emailPix;
  campoAntes.addEventListener("input", () => { mostrarErroAntes(null); if (sugestaoEl && !sugestaoEl.hidden) atualizarSugestao(); });
  campoAntes.addEventListener("blur", atualizarSugestao);
  campoAntes.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); void gerar(); } });
  sugestaoEl?.addEventListener("click", () => {
    const v = sugestaoEl.dataset.v;
    if (!v) return;
    campoAntes.value = v;
    atualizarSugestao();
    evento("landing_email_antes_sugestao", {});
  });
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

/* r1 (pix 3, v2): o Pix que acabou de vencer segue sendo conferido a cada 5 s por até 10 min (o banco pode confirmar depois do relógio) */
let loopVencido: number | null = null;
function conferirVencidoEmLoop() {
  if (!V2 || SIMULADO) return;
  if (loopVencido) window.clearTimeout(loopVencido);
  const passo = async () => {
    const p = vencido;
    if (!p || estado.fase === "pago" || estado.fase === "conta" || jaTem) return;
    if (Date.now() - venceEm(p) > JANELA_VENCIDO_MS) { vencido = null; return; }
    try {
      const m = await pg(false);
      if (await m.conferirPix(p, URL_DE_CHEGADA)) { vencido = null; avisoOferta = null; pago(p); return; }
    } catch { /* tenta de novo */ }
    if (vencido === p) loopVencido = window.setTimeout(passo, 5000);
  };
  loopVencido = window.setTimeout(passo, 2000);
}

function pago(p: PixLanding) {
  if (estado.fase === "pago" || estado.fase === "conta") return;
  if (loop) window.clearTimeout(loop);
  if (loopVencido) window.clearTimeout(loopVencido);
  vencido = null; avisoOferta = null;
  evento("landing_pix_pago", { oferta: p.oferta, valor: VALOR_OFERTA[p.oferta], order_id: p.orderId, simulado: SIMULADO });
  marcarCompra({ oferta: p.oferta, email: estado.emailPix }); // 29/10: sobrevive ao localStorage zerado (cookie)
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
  if (!ok) {
    aviso = estado.pix?.doEmail
      ? "Se você já pagou, o acesso chega no seu e-mail em instantes."
      : "Ainda não chegou. Confere no app do banco — quando cair, esta tela muda sozinha.";
    render();
  }
}

async function salvarEmailPix(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo) || !estado.pix) return;
  let via: string | null = null;
  erroEmail = null;
  if (SIMULADO) {
    await espera(400);
    if (limpo.includes("+jatem")) { evento("landing_email_pix", { ok: false, via: "ja_tem" }); mostrarJaTem("email_pix", limpo); return; }
    via = limpo.includes("+existe") ? "destino" : "conta";
  } else {
    const r = await pg().then((m) => m.salvarEmailDoPix(estado.pix!, limpo)).catch(() => ({ erro: "Não consegui salvar agora." }));
    if ("jaTem" in r) { evento("landing_email_pix", { ok: false, via: "ja_tem" }); mostrarJaTem("email_pix", limpo); return; }
    if ("via" in r) via = r.via; else erroEmail = r.erro;
  }
  evento("landing_email_pix", { ok: !!via, via });
  if (via) salvar({ emailPix: limpo }); else render();
}

async function prontoComEmail(email: string, via: string) {
  const p = estado.pago;
  if (!p) return;
  if (!SIMULADO) {
    try { await (await pg()).finalizarConta(p.orderId, { attr: atrib, braco_titulo: brTitulo, braco_oferta: brOferta, braco_checkout: brCheckout, braco_lp: brLp, oferta: p.oferta, landing_session_id: sessao }); } catch { /* o e-mail é extra */ }
  }
  evento("landing_email", { via });
  marcarCompra({ oferta: p.oferta, email });
  salvar({ fase: "conta", email });
}

async function criarConta(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo)) { erroEmail = "Esse e-mail parece errado. Confere e tenta de novo."; render(); return; }
  emailDigitado = limpo; erroEmail = null; faseConta = "salvando"; codigoPago = ""; render();
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
/* ── v3 (v2): o miolo da "conta pronta" — e-mail em caixa, selos das lojas primeiro (48 px), site secundário (no computador, principal),
 * como entrar (sem senha: código por e-mail — a pessoa nunca criou senha), 1º passo, contato. Usado na conta pronta E no "Você já tem o CORE"
 * (crítica r1 pix 9: quem voltava depois de comprar via o desenho antigo). ── */
function miolContaV2(email: string): string {
  // r2 (pix 6): sem target=_blank — dentro do navegador do Instagram (WKWebView) um _blank pode não abrir nada; a página já está em "conta" (nada a perder ao navegar na mesma aba)
  const selos = `<div class="lp2-selos lp-selos"><a href="${URL_APP_STORE}" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="144" height="48" /></a><a href="${esc(urlPlay("landing"))}" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="124" height="48" /></a></div>`;
  const site = `<div class="lp-form"><button type="button" class="${plataforma === "web" ? "lp-cta" : "lp2-btn2"}" id="lp-abrir">${plataforma === "web" ? `Abrir meu CORE ${ICO_SETA}` : "Ou abrir no site agora"}</button></div>`;
  return `
        ${email ? `<div class="lp2-email-caixa">${esc(email)}</div>` : ""}
        ${plataforma === "web" ? site + selos : selos + site}
        <p class="lp2-como-entrar">Pra entrar, toque em <b>Entrar sem senha</b>: o código chega ${email ? "neste e-mail" : "no seu e-mail"}. Os passos também vão por e-mail.</p>
        <div class="lp2-passo1"><b>1º passo:</b> anote o que entra e o que sai. O CORE mostra quanto você pode gastar hoje.</div>
        <p class="lp2-duvida-contato">Dúvida? contato@coreaplicativo.com.br</p>`;
}
/** 29/10: o cartão "Você já tem o CORE" (a mesma cara da "Sua conta está pronta") no lugar da oferta. */
function renderJaTem(m: MarcaCompra) {
  card.dataset.fase = "conta";
  const email = m.email ?? "";
  if (V2) {
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-ja-tem">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Você já tem o CORE</h3>
        <p>${email ? `Seu CORE já está liberado. ${plataforma === "web" ? "Entre com este e-mail, aqui ou no app:" : "Baixe o app e entre com este e-mail:"}` : "Seu CORE já está liberado. Entre com o e-mail que você usou na compra."}</p>
        ${miolContaV2(email)}
        <div class="lp-links"><button type="button" class="lp-link" id="lp-nao-fui-eu">Não fui eu que comprei</button></div>
      </div>`;
  } else caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-ja-tem">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Você já tem o CORE</h3>
        <p>${email ? `Seu CORE já está liberado. Entre com <b>${esc(email)}</b>.` : "Seu CORE já está liberado. Entre com o e-mail que você usou na compra."}</p>
        <div class="lp-form"><button type="button" class="lp-cta" id="lp-abrir">Abrir meu CORE ${ICO_SETA}</button></div>
        <div class="lp-loja-bloco">
          <b>Seu CORE também no celular</b>
          <p>Baixe na App Store ou Google Play e entre com ${email ? `este e-mail: <strong>${esc(email)}</strong>` : "o mesmo e-mail"}</p>
          <div class="lp-selos"><a href="${URL_APP_STORE}" target="_blank" rel="noopener" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="120" height="40" /></a><a href="${esc(urlPlay("landing"))}" target="_blank" rel="noopener" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="103" height="40" /></a></div>
        </div>
        <div class="lp-links"><button type="button" class="lp-link" id="lp-nao-fui-eu">Não fui eu que comprei</button></div>
      </div>`;
  $("lp-abrir").addEventListener("click", () => { evento("landing_abrir_core", { via: "ja_tem" }); location.href = "/home"; });
  caixa.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: "ja_tem" })));
  $("lp-nao-fui-eu").addEventListener("click", () => { evento("landing_ja_tem_nao_fui_eu", {}); esquecerCompra(); jaTem = null; render(); });
  atualizarFixo();
}
/** r1 (pix 7, v2): o erro de gerar o Pix fica colado no botão de pagar (#lp-pagar-erro), não solto abaixo do CNPJ */
const erroNoBotao = (msg: string | null) => {
  const el = document.getElementById("lp-pagar-erro");
  if (!el) return false;
  el.textContent = msg ?? ""; el.hidden = !msg;
  return true;
};
/** r2 (oferta 5 / pix 1, v2): o aviso "Esse código venceu…" é a 1ª linha do cartão (antes de "Vitalício por"), não o rodapé depois do CNPJ —
 * quem volta do banco lê primeiro o que aconteceu. */
const avisoNoTopo = (msg: string | null) => {
  const corpo = card.querySelector(".lp-card-corpo");
  if (!corpo) return;
  let el = document.getElementById("lp2-aviso-topo");
  if (!msg) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("p");
    el.id = "lp2-aviso-topo"; el.className = "lp-aviso lp2-aviso-topo"; el.setAttribute("role", "status"); el.dataset.testid = "landing-venceu";
    corpo.prepend(el);
  }
  el.textContent = msg;
};

function mostrarJaTem(via: "marcador" | "servidor" | "email_pix", email: string | null = null) {
  if (loop) window.clearTimeout(loop);
  if (via !== "marcador") marcarCompra({ email });
  jaTem = lerCompra() ?? { em: Date.now(), oferta: null, email };
  if (email && !jaTem.email) jaTem = { ...jaTem, email };
  evento("landing_ja_tem", { via });
  if (estado.fase !== "oferta") salvar({ fase: "oferta", pix: null, anteriores: [] }); else render();
}

/** 29/10 (braço "email"): o e-mail já tem conta → o código, ANTES do Pix. */
function renderCodigoAntes(a: NonNullable<typeof antes>) {
  card.dataset.fase = "codigo"; // o CSS esconde a oferta (qualquer fase ≠ "oferta")
  const entrando = a.fase === "entrando";
  caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-email-tem-conta">
        <h3>Esse e-mail já tem conta</h3>
        <p>Mandamos um código pra <b>${esc(a.email)}</b>. Digite aqui e o Pix sai na sua conta.</p>
        <div class="lp-form">
          <label for="lp-codigo-antes">Código de 6 números</label>
          <input class="lp-campo grande" id="lp-codigo-antes" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" value="${esc(codigoAntes)}" />
          <button type="button" class="lp-cta" id="lp-entrar-pagar" ${codigoAntes.trim().length >= 6 && !entrando ? "" : "disabled"}>${entrando ? '<i class="lp-gira"></i>Entrando…' : `Entrar e pagar ${reais(VALOR_OFERTA[ofertaAtual()])}`}</button>
          ${a.erro ? `<p class="lp-erro" role="alert">${esc(a.erro)}</p>` : ""}
        </div>
        <div class="lp-links"><button type="button" class="lp-link" id="lp-outro-email">Usar outro e-mail</button><button type="button" class="lp-link" id="lp-reenviar">Mandar de novo</button></div>
      </div>`;
  const c = $<HTMLInputElement>("lp-codigo-antes"); const b = $<HTMLButtonElement>("lp-entrar-pagar");
  c.addEventListener("input", () => { codigoAntes = c.value.replace(/\D/g, "").slice(0, 6); b.disabled = codigoAntes.length < 6 || antes?.fase === "entrando"; });
  c.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void gerar(codigoAntes); });
  b.addEventListener("click", () => { void gerar(codigoAntes); });
  $("lp-outro-email").addEventListener("click", () => {
    evento("landing_cta", { onde: "outro_email" });
    antes = null; codigoAntes = "";
    render();
    if (campoAntes) { campoAntes.value = ""; try { campoAntes.focus(); } catch { /* noop */ } }
  });
  $("lp-reenviar").addEventListener("click", async () => {
    if (!antes) return;
    evento("landing_cta", { onde: "reenviar_codigo" });
    const foi = await mandarCodigo(antes.email);
    if (antes) { antes = { ...antes, erro: foi ? null : "Não consegui mandar o código agora. Tenta de novo em alguns segundos." }; render(); }
  });
  atualizarFixo();
}

/*
 * CRÍTICA r1 4.1 (30/10, v2): a cada troca de "tela" do cartão (gerando → QR, erro, código do e-mail, pago, conta) a página
 * ROLA até o cartão. No v2 a ordem dos blocos é por CSS `order`, e o scroll anchoring do navegador (desligado no CSS,
 * overflow-anchor: none) empurrava a página ~580 px quando o QR aparecia — a pessoa via "Já paguei" sem QR. Com a âncora
 * desligada, a rolagem explícita garante o QR/passos/Copiar no topo da tela. No atual nada muda (o DOM já está na ordem visual).
 */
let telaRenderizada: string | null = null;
function render() {
  renderDoCartao();
  if (!V2) return;
  reSemear();
  const tela = `${estado.fase}|${antes ? "codigo" : ""}|${erroPix ? "erro" : ""}|${jaTem ? "jatem" : ""}|${avisoOferta ? "venceu" : ""}`;
  if (tela === telaRenderizada) return;
  const primeira = telaRenderizada === null;
  telaRenderizada = tela;
  if (primeira && tela === "oferta||||") return; // a página abrindo na oferta: nada a rolar
  if (cheiaAberta) fecharCheiaJa("fase"); // a tela do cartão mudou (ex.: pagou no banco com a demo aberta) — a página precisa estar solta pra rolar
  rolarAte(card, "start", !primeira); // no arranque (Pix vivo / pago / conta): direto, sem a página "descendo" (r1 pix 4)
}
function renderDoCartao() {
  if (relogio) { window.clearInterval(relogio); relogio = null; }
  if (jaTem && (estado.fase === "oferta" || estado.fase === "erro")) { renderJaTem(jaTem); return; }
  if (antes && estado.fase === "oferta") { renderCodigoAntes(antes); return; }
  card.dataset.fase = estado.fase === "erro" ? "oferta" : estado.fase;
  const f = estado.fase;
  if (V2) { erroNoBotao(f === "oferta" ? erroPix : null); avisoNoTopo(f === "oferta" ? avisoOferta : null); atualizarBotao(); }
  if (f === "oferta") {
    caixa.innerHTML = erroPix && !(V2 && document.getElementById("lp-pagar-erro")) ? `<p class="lp-erro" role="alert">${esc(erroPix)}</p>` : "";
  } else if (f === "gerando") {
    caixa.innerHTML = `<div class="lp-pix-gerando" data-testid="landing-gerando"><span class="lp-pix-logo">${ICO_PIX}</span><b>Gerando o seu Pix…</b><div class="lp-progresso"><i></i></div><span>${V2 ? "Sem CPF. Leva 2 segundos." : "Sem CPF, sem cadastro. Leva 2 segundos."}</span></div>`;
  } else if (f === "qr" && estado.pix) {
    const p = estado.pix;
    // 30/10 (v2): 3 passos curtos no lugar da caixa verde + "Pagou? Volte aqui" (quem volta do banco paga 81%; quem não
    // paga sai ~4 s depois do QR — lp-web/funil §3c) + a garantia perto do código. O braço atual segue IGUAL.
    const passosV2 = V2 ? `
      <ol class="lp2-passos" data-testid="landing-passos">
        <li${copiado ? ' class="feito"' : ""}><span>${copiado ? "<b>Código Pix copiado.</b> Se precisar, toque em Copiar de novo." : "<b>Copie o código Pix</b> (botão abaixo)."}</span></li>
        <li><span>Abra o app do seu <b>banco</b> e vá em Pix.</span></li>
        <li><span>Escolha <b>Pix Copia e Cola</b>, cole o código e confirme.</span></li>
      </ol>` : "";
    const esperando = V2
      ? `<div class="lp2-volte" data-testid="landing-volte"><i class="lp-ponto"></i><span><b>Pagou? Volte aqui.</b>${p.doEmail ? " Quando o pagamento cair, o acesso chega no seu e-mail." : " O acesso abre na hora: esta tela confirma sozinha."}<span class="lp2-vale" id="lp-validade">Este código vale por ${mmss(venceEm(p) - Date.now())}</span></span></div>
         <p class="lp2-garantia-mini">${ICO_CHECK}<span>7 dias de garantia · devolvemos 100%</span></p>`
      : `<div class="lp-esperando"><i class="lp-ponto"></i><span><b>Esperando o pagamento</b>${p.doEmail ? "Quando o pagamento cair, o acesso chega no seu e-mail." : "Esta tela confirma sozinha quando o pagamento entrar."}</span></div>`;
    // v3 (v2): QR e código lado a lado (a tela inteira — passos, QR, Copiar e "Volte aqui" — cabe em 390×690 com o cartão no topo)
    const qrECodigo = V2
      ? `<div class="lp2-qr-linha"><div class="lp-qr" id="lp-qr"></div><div class="lp2-qr-lado"><p class="lp2-qr-dica">Ou leia o QR code com a câmera do banco, em outro aparelho.</p><div class="lp-codigo lp2-codigo" data-testid="landing-codigo">${esc(p.qrCode)}</div><button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="lp-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código Pix"}</span></button></div></div>`
      : `<div class="lp-qr-linha"><div class="lp-qr" id="lp-qr"></div><div class="lp-qr-dica">${copiado ? "Ou leia o <b>QR code</b> com a câmera do banco, em outro aparelho." : "<b>Copie o código</b> e cole no app do banco em Pix → Copia e Cola. Ou leia o QR code."}</div></div>
      <div class="lp-codigo" data-testid="landing-codigo">${esc(p.qrCode)}</div>
      <button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="lp-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código Pix"}</span></button>`;
    caixa.innerHTML = `
      <div class="lp-pix-valor"><b>${reais(VALOR_OFERTA[p.oferta])}</b><span>${esc(V2 && p.oferta === "LN_sempre279" ? "Vitalício · pagamento único" : ROTULO_OFERTA[p.oferta])}</span></div>
      ${copiado && !V2 ? `<div class="lp-copiado" data-testid="landing-copiado">${ICO_CHECK}<span><b>Código Pix copiado</b>Agora abra o app do seu banco: Pix → Copia e Cola.</span></div>` : ""}
      ${passosV2}
      ${qrECodigo}
      ${esperando}
      ${V2 ? "" : `<div class="lp-validade" id="lp-validade">Este código vale por ${mmss(venceEm(p) - Date.now())}</div>`}
      ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
      <div class="lp-email-opc">${brCheckout === "email" || p.doEmail
        ? (estado.emailPix
          ? `<div class="lp-ok-linha" data-testid="landing-email-garantido">${ICO_CHECK}<span>Pagou e a página fechou? O acesso chega em <b>${esc(estado.emailPix)}</b>.</span></div>`
          : `<div class="lp-ok-linha" data-testid="landing-email-garantido">${ICO_CHECK}<span>Pagou e a página fechou? O acesso chega no seu e-mail.</span></div>`)
        : estado.emailPix
        ? `<div class="lp-ok-linha">${ICO_CHECK}<span>O acesso também vai pra <b>${esc(estado.emailPix)}</b>.</span></div>`
        : `<label for="lp-email-pix">${V2 ? "Seu e-mail (se quiser) · pra entrar no app depois" : 'Seu e-mail pra garantir o acesso <span style="font-weight:500">(opcional)</span>'}</label>
           <div class="lp-linha"><input class="lp-campo" id="lp-email-pix" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" /><button type="button" class="lp-mini" id="lp-email-pix-ok" disabled>Salvar</button></div>
           ${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}`}</div>
      <div class="lp-links"><button type="button" class="lp-link" id="lp-ja-paguei">${V2 ? "Já paguei e não mudou?" : "Já paguei"}</button>${brOferta === "ano" ? `<button type="button" class="lp-link" id="lp-mudar">Mudar o plano</button>` : ""}</div>`;
    void desenharQr($("lp-qr"), p);
    $("lp-copiar").addEventListener("click", async () => {
      const ok = await copiarTexto(p.qrCode);
      const antesJa = copiado;
      copiado = ok || copiado;
      evento("landing_pix_copiado", { ok, via: "botao", auto: false, order_id: p.orderId });
      if (copiado !== antesJa || !V2) render();
      // r2 (visitante-frio 1, v2): quem toca em "Copiar de novo" é quem duvida que copiou — o botão responde "Copiado ✓" por 1,5 s (sem re-render)
      if (V2 && ok) {
        const rot = document.querySelector<HTMLElement>("#lp-copiar span");
        if (rot) { const antes = rot.textContent; rot.textContent = "Copiado ✓"; window.setTimeout(() => { if (rot.isConnected && rot.textContent === "Copiado ✓") rot.textContent = antes; }, 1500); }
      }
    });
    $("lp-ja-paguei").addEventListener("click", () => { void jaPaguei(); });
    // 29/10 (dono): no vitalício só existe 1 plano — o "Mudar o plano" só tirava a pessoa do Pix gerado; fica só no braço "ano" (caixinha)
    document.getElementById("lp-mudar")?.addEventListener("click", () => { evento("landing_cta", { onde: "mudar_plano" }); aviso = null; salvar({ fase: "oferta" }); });
    const campo = document.getElementById("lp-email-pix") as HTMLInputElement | null;
    if (campo) {
      const btn = $<HTMLButtonElement>("lp-email-pix-ok");
      campo.addEventListener("input", () => { btn.disabled = !EMAIL_OK.test(campo.value.trim()); });
      const salvarDoCampo = () => { btn.disabled = true; btn.textContent = "…"; void salvarEmailPix(campo.value); };
      btn.addEventListener("click", salvarDoCampo);
      // r2 (pix 2): o "ir" do teclado também salva (a pessoa toca Enter e acha que salvou)
      campo.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && EMAIL_OK.test(campo.value.trim())) { ev.preventDefault(); salvarDoCampo(); } });
    }
    relogio = window.setInterval(() => {
      const el = document.getElementById("lp-validade");
      const resta = venceEm(p) - Date.now();
      if (el) el.textContent = resta > 0 ? `Este código vale por ${mmss(resta)}` : "Este código venceu.";
      if (resta > 0) for (const barra of barrasDePreco()) { const fv = barra.querySelector<HTMLElement>(".lp2-fixo-p span"); if (fv) fv.textContent = `vale por ${mmss(resta)}`; }
      if (resta <= 0) {
        window.clearInterval(relogio!);
        if (V2) { vencido = p; avisoOferta = avisoVenceu(!!(estado.emailPix || lerCompra()?.email)); try { ss(`landing-venceu-${p.orderId}`, "1"); } catch { /* noop */ } evento("landing_pix_venceu", { order_id: p.orderId, via: "relogio" }); }
        salvar({ fase: "oferta" });
        conferirVencidoEmLoop();
      }
    }, 1000);
  } else if (f === "pago") {
    const codigo = faseConta === "codigo" || faseConta === "entrando";
    // v3 (v2, braço livre): "Pronto! Falta o seu e-mail." — o e-mail é por onde a pessoa entra no app da loja (2 em 94 pagaram sem e-mail e não entraram)
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-pago">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>${V2 && !codigo ? "Pronto! Falta o seu e&#8209;mail." : "Pagamento confirmado!"}</h3>
        <p>${codigo ? `Esse e-mail já tem conta. Mandamos um código pra <b>${esc(emailDigitado)}</b>.` : V2 ? "Pagamento confirmado. O e-mail é por onde você entra no CORE, no celular e no computador." : "Agora só falta o seu e-mail pra criar sua conta."}</p>
        <div class="lp-form">
          ${codigo
            ? `<label for="lp-codigo">Código de 6 números</label><input class="lp-campo grande" id="lp-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" value="${esc(codigoPago)}" />
               <button type="button" class="lp-cta" id="lp-entrar" ${codigoPago.trim().length >= 6 && faseConta !== "entrando" ? "" : "disabled"}>${faseConta === "entrando" ? '<i class="lp-gira"></i>' : ""}Entrar e liberar meu CORE</button>`
            : `<label for="lp-email">Seu e-mail</label><input class="lp-campo grande" id="lp-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" value="${esc(emailDigitado)}" />
               <button type="button" class="lp-cta" id="lp-criar" ${EMAIL_OK.test(emailDigitado) && faseConta !== "salvando" ? "" : "disabled"}>${faseConta === "salvando" ? '<i class="lp-gira"></i>Criando sua conta…' : `${V2 ? "Liberar meu acesso" : "Criar minha conta"} ${ICO_SETA}`}</button>`}
          ${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}
        </div>
      </div>`;
    if (codigo) {
      const c = $<HTMLInputElement>("lp-codigo"); const b = $<HTMLButtonElement>("lp-entrar");
      // r2 (pix 3): o digitado sobrevive ao re-render do erro ("Código errado…"), como no código ANTES do Pix
      c.addEventListener("input", () => { codigoPago = c.value.replace(/\D/g, "").slice(0, 6); b.disabled = codigoPago.length < 6; });
      c.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void entrarComCodigo(c.value); });
      b.addEventListener("click", () => { void entrarComCodigo(c.value); });
    } else {
      const e = $<HTMLInputElement>("lp-email"); const b = $<HTMLButtonElement>("lp-criar");
      e.addEventListener("input", () => { emailDigitado = e.value; b.disabled = !EMAIL_OK.test(e.value.trim()); });
      e.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void criarConta(e.value); });
      b.addEventListener("click", () => { void criarConta(e.value); });
    }
  } else if (f === "conta" && V2) {
    // v3: levar pro app da loja AGORA com o e-mail certo. Selos primeiro e grandes (quem abre o app da loja no dia 0 volta 43% no D1;
    // só no site, 15%), o site como secundário, o 1º passo em destaque (ação real no dia 0 → D1 49%). No computador, o site vem primeiro.
    const email = estado.email ?? "";
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-conta">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Sua conta está pronta.</h3>
        <p>${ehPraSempreTxt()} ${plataforma === "web" ? "Entre com este e-mail, aqui ou no app:" : "Baixe o app e entre com este e-mail:"}</p>
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        ${miolContaV2(email)}
      </div>`;
    $("lp-abrir").addEventListener("click", () => { evento("landing_abrir_core", {}); location.href = "/home"; });
    caixa.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: "pos_compra" })));
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
const ehPraSempreTxt = () => (estado.pago && estado.pago.oferta !== "LN_ano279" ? (V2 ? "O CORE é seu pra sempre." : "Seu CORE é seu pra sempre.") : "Seu CORE está liberado por 1 ano.");

$("lp-pagar").addEventListener("click", () => { void gerar(); });

/* r3 (oferta M1 / pix M1 / visitante-frio M1 — WebKit, 70% do tráfego): toda abertura que leva ao cartão (Pix vivo, pago, conta,
 * "já tem", código vencido com aviso) rolava até ele ANTES de os prints do "Por dentro" ganharem src; no WebKit um <img> sem src
 * não reserva altura e, quando o src chegava, +786 px entravam ACIMA do cartão (cartão em 204/786 px). O CSS agora reserva a
 * altura do celular (height, não max-height) e, por garantia, nos primeiros 6 s qualquer crescimento da página re-encosta o
 * cartão no topo — até a pessoa tocar/rolar por conta própria. */
const cartaoNoArranque = V2 && (estado.fase !== "oferta" || !!avisoOferta || !!lerCompra());
if (cartaoNoArranque) {
  // r1 (pix M2, v2): no Chromium a restauração de rolagem da recarga vencia o rolarAte e deixava o QR fora da tela. r3: também com
  // o aviso do vencido e com o "já tem" (antes só com fase ≠ oferta)
  try { history.scrollRestoration = "manual"; } catch { /* noop */ }
  if (typeof ResizeObserver !== "undefined") {
    let interagiu = false;
    const marcar = () => { interagiu = true; };
    for (const ev of ["touchstart", "wheel", "keydown", "pointerdown"]) window.addEventListener(ev, marcar, { passive: true, once: true });
    const fim = Date.now() + 6000;
    const ro = new ResizeObserver(() => {
      if (interagiu || Date.now() > fim || (estado.fase === "oferta" && !avisoOferta && !jaTem)) { ro.disconnect(); return; }
      if (Math.abs(card.getBoundingClientRect().top) > 1) rolarAte(card, "start", false);
    });
    ro.observe(document.body);
    window.setTimeout(() => ro.disconnect(), 6500);
  }
}

/* 29/10: o aparelho já comprou (cookie/localStorage) e a página voltou na oferta → "Você já tem o CORE" */
if (estado.fase === "oferta") { const m = lerCompra(); if (m) { jaTem = m; mostrarJaTem("marcador"); } }

/* 29/10: chegou pelo e-mail de lembrete do Pix (?r=t12|t20h): o Pix ainda vivo reabre (mesmo nesta aba nova) */
{
  const volta = voltaDoLembrete(BUSCA);
  if (volta) {
    let restaurado = "nao";
    if (estado.pix && volta.pedido && estado.pix.orderId === volta.pedido && estado.fase === "qr") restaurado = "aba";
    else if (volta.pix && estado.fase === "oferta" && !jaTem) {
      restaurado = "link";
      estado = { ...estado, fase: "qr", pix: volta.pix, salvoEm: Date.now() };
      estadoHeap = estado;
      try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* fica no heap */ }
    }
    evento("landing_lembrete_volta", { toque: volta.toque, order_id: volta.pedido, restaurado });
    if (restaurado === "nao" && estado.fase === "oferta") window.setTimeout(() => rolarAte($("oferta")), 300);
  }
}

/* voltou com Pix aberto (o banco recarregou a aba) / já pago: a tela certa */
if (estado.fase === "qr") { copiado = null; conferirEmLoop(); }
if (estado.fase !== "oferta") {
  // r1 (pix M2, v2): no Chromium a restauração de rolagem da recarga vencia o rolarAte e deixava o QR fora da tela
  if (V2) { try { history.scrollRestoration = "manual"; } catch { /* noop */ } }
  render();
  if (estado.fase === "pago" || estado.fase === "conta") window.setTimeout(() => rolarAte(card, "start", !V2), 50);
  if (V2) window.addEventListener("load", () => rolarAte(card, "start", false), { once: true });
}
if (V2 && avisoOferta && estado.fase === "oferta" && !jaTem) { render(); conferirVencidoEmLoop(); } // o Pix venceu há pouco: o aviso fica, e a conferência segue

/* v2 (30/10 noite): a aba recarregou com a demo em tela cheia aberta (o Instagram recarrega) → reabre no mesmo módulo, com a página
 * parada no mesmo y por baixo. Com Pix vivo, pago, aviso de vencido ou "já tem" o cartão manda (y 0): a marca sai do histórico. */
{
  const h = V2 ? estadoHist() : null;
  if (h?.[MARCA_CHEIA]) {
    if (estado.fase === "oferta" && !jaTem && !avisoOferta && ehModuloLanding(h.m)) abrirCheia(h.m, "recarga", typeof h.y === "number" ? h.y : 0);
    else { try { const resto: EstadoHist = { ...h }; delete resto[MARCA_CHEIA]; history.replaceState(resto, ""); } catch { /* noop */ } }
  }
}

/* ───────────────────────── medição invisível (29/10) ───────────────────────── */
/* qual dúvida abre: 1x por pergunta por visita */
const duvidasAbertas = new Set<string>();
document.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => d.addEventListener("toggle", () => {
  if (!d.open) return;
  const pergunta = (d.querySelector("summary")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!pergunta || duvidasAbertas.has(pergunta)) return;
  duvidasAbertas.add(pergunta);
  evento("landing_duvida_aberta", { pergunta });
}));

/* a volta pra aba (foi ao banco, ao Instagram…): ≥5 s fora */
let saiuEm: number | null = document.visibilityState === "hidden" ? Date.now() : null;
const faseAgora = () => (jaTem && estado.fase === "oferta" ? "ja_tem" : estado.fase);
const voltou = () => {
  if (saiuEm === null) return;
  const fora = Date.now() - saiuEm;
  saiuEm = null;
  if (fora >= 5000) evento("landing_voltou", { fase: faseAgora(), ausente_s: Math.round(fora / 1000), com_pix: estado.fase === "qr", order_id: estado.fase === "qr" ? estado.pix?.orderId ?? null : null });
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saiuEm = Date.now(); else voltou();
});
window.addEventListener("pagehide", () => { saiuEm = Date.now(); });
window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) voltou(); });
