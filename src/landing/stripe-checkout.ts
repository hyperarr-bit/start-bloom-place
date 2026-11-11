/**
 * /oferta (04/11) — o CHECKOUT STRIPE EM TELA CHEIA, por cima da página (a pessoa nunca sai do site). Só baixa no toque em comprar
 * (ou ocioso, depois da 1ª pintura) e só na /oferta com a chave CHECKOUT_STRIPE "on" e a pk de verdade (o <head> decide).
 *
 *   abrir   camada fixa (role=dialog, aria-modal, foco preso, scroll de trás travado), uma entrada no histórico (o "voltar" do
 *           navegador / o X / Esc fecham sem sair do site), resumo "CORE · Acesso vitalício · R$ 67,90 · pagamento único" + 3
 *           provas, e-mail (obrigatório, com a correção de domínio da landing), NOSSOS botões Pix | Cartão (Pix marcado) e o botão
 *           de pagar, que diz o que vai acontecer: "Gerar Pix de R$ 67,90" ou "Pagar R$ 67,90". Fica travado até o método carregar.
 *   valor   SEMPRE do servidor: stripe-criar cria/atualiza o PaymentIntent (6790 BRL) e devolve só o client_secret.
 *   Pix     (06/11) NÃO passa pelo Payment Element (o texto dele era "Um código QR será exibido para você escanear").
 *           confirmPixPayment(handleActions:false) → next_action.pix_display_qr_code → QR + copia-e-cola NO NOSSO layout;
 *           espera pelo stripe-status (a cada 3 s e na volta pra aba). O webhook libera o acesso (sem depender desta aba).
 *   cartão  (06/11) Payment Element SÓ de cartão. O PI tem card + pix e, com client_secret, o Element mostraria os dois: por isso ele
 *           nasce SEM intent (mode:"payment", allowedPaymentMethodTypes:["card"], paymentMethodCreation:"manual"), vira um
 *           PaymentMethod (createPaymentMethod) e confirmPayment({clientSecret, confirmParams:{payment_method}, redirect:"if_required"})
 *           confirma no PI do servidor (3DS na mesma tela; banco que exige redirecionamento volta pra
 *           /oferta?payment_intent=…&redirect_status=…, que reabre aqui). O amount do Element é só exibição. O stripe-criar não mudou.
 *           ATENÇÃO: paymentMethodCreation "manual" não aceita parcelas (doc da Stripe). A volta dos 12x precisa trocar isto.
 *           Campo País: fields.billingDetails.address "if_required" (some o que é opcional; não precisa mandar no confirmar).
 *   trocar  (06/11, chave PIX_TROCA_CARTAO, DESLIGADA) "Prefiro pagar com cartão" na tela do Pix. O Pix continua pagável até vencer e a doc da
 *           Stripe só fala em confirmar outro método DEPOIS do vencimento; antes, o caminho documentado é cancelar o PI. Cancelar exige a
 *           chave secreta: o stripe-criar precisa aceitar `trocar_pix`. Sem isso a página fica no Pix (nunca abre o cartão com QR vivo).
 *   carregar (06/11) Stripe.js em segundo plano quando a oferta aparece (preaquecerStripe); ao abrir, stripe-criar e Stripe.js em paralelo.
 *   pago    lojas primeiro, "Já tenho conta? Entrar" (não "Começar"), guia PDF, contato. Pixel Purchase com eventID = id do PI
 *           (a CAPI do servidor manda o mesmo event_id → a Meta conta 1).
 *
 * MEDIÇÃO (06/11; nenhum evento leva e-mail; o braço do teste vem de graça, o evento() da landing põe em todos):
 *   landing_stripe_carregou {ms}          Pix pronto pra gerar (Stripe.js + PI)      landing_stripe_cartao_pronto {ms}  o Element de cartão pronto
 *   landing_stripe_metodo {metodo, via}   SÓ toque de verdade, via "toque" (antes disparava sozinho ao carregar: histórico sem `via` não é escolha)
 *   landing_stripe_email_comecou / _valido   1× por pedido                           landing_stripe_pagar_travado  tocou com o método carregando
 *   landing_stripe_pagar_erro {metodo, etapa, tipo, code}   erro ao tocar em pagar (etapa: criar | validar | cartao | pix | confirmar | excecao)
 *   landing_stripe_saiu {via, fase, metodo, email, carregou, s_aberto, vez} / landing_stripe_voltou {s_fora, fase}   saiu com o checkout aberto
 *   landing_stripe_fechado {via}          agora também o "voltar" do navegador
 *   landing_stripe_carteira {...}         só com MEDIR_CARTEIRA "on" (abaixo)
 *   landing_stripe_pix_trocou {ok, motivo}   só com PIX_TROCA_CARTAO "on"
 *
 * Testes e QA: window.__ofertaApi (no lugar das funções) e window.__stripeFalso (no lugar do Stripe.js). Fora do domínio de
 * produção, sem eles, tudo é SIMULADO (um Element de cartão de mentira) — nada sai pra Stripe.
 */
import { EMAIL_OK, URL_APP_STORE, sugestaoDeEmail, urlPlay } from "./regras";
import { reaisDeCentavos } from "./hotmart";
import { cpfValido, mascararCpf, soDigitosCpf } from "../../supabase/functions/_shared/cpf";

export type Evento = (nome: string, dados?: Record<string, unknown>) => void;
export type Pixel = (ev: string, params?: Record<string, unknown>, eventID?: string) => void;
export type OpcoesCheckout = {
  pk: string; precoCentavos: number; parcelasMax: number; producao: boolean;
  /** STRIPE_PEDE_CPF no <head> (nota fiscal): o campo de CPF abaixo do e-mail */
  pedeCpf?: boolean;
  /** só testes: liga a medição da carteira sem mexer em MEDIR_CARTEIRA */
  medirCarteira?: boolean;
  /** só testes: mostra o "Prefiro pagar com cartão" sem mexer em PIX_TROCA_CARTAO */
  trocaCartao?: boolean;
  evento: Evento; pixel: Pixel; atrib: Record<string, string>; sessao: string; aparelho: string; urlChegada: string; fbclid: string | null;
  voltaDoBanco?: { pi: string; status: string };
  /** 11/11 (AB_OFERTA_EMAIL, braço "pagina"): o e-mail já digitado no cartão da oferta. O formulário abre com ele numa linha ("Trocar" devolve o campo). */
  emailInicial?: string;
};

export type RespostaCriar = { ok: boolean; clientSecret?: string; pi?: string; erro?: string; status?: string; pix?: PixQr | null };
export type RespostaStatus = { ok: boolean; status?: string; pago?: boolean; metodo?: string | null };
export type ApiOferta = {
  criar: (corpo: Record<string, unknown>) => Promise<RespostaCriar>;
  status: (corpo: { ref: string; pi: string }) => Promise<RespostaStatus>;
};
type PixQr = { data?: string; image_url_png?: string; expires_at?: number; hosted_instructions_url?: string };
type IntentoStripe = { id?: string; status?: string; next_action?: { type?: string; pix_display_qr_code?: PixQr } | null; payment_method_types?: string[] };
type ResultadoStripe = { error?: { message?: string; type?: string; code?: string }; paymentIntent?: IntentoStripe };
type ErroStripe = { message?: string; type?: string; code?: string };
type ElementoPagamento = { mount: (el: HTMLElement | string) => void; on: (ev: string, cb: (e: { value?: { type?: string }; complete?: boolean; error?: ErroStripe }) => void) => void; destroy?: () => void };
type Elementos = { create: (tipo: "payment", o?: Record<string, unknown>) => ElementoPagamento; submit: () => Promise<{ error?: ErroStripe }> };
type PedidoCarteira = { canMakePayment: () => Promise<{ applePay?: boolean; googlePay?: boolean } | null> };
export type StripeLike = {
  elements: (o: Record<string, unknown>) => Elementos;
  createPaymentMethod: (o: Record<string, unknown>) => Promise<{ error?: ErroStripe; paymentMethod?: { id: string } }>;
  paymentRequest?: (o: Record<string, unknown>) => PedidoCarteira;
  confirmPayment: (o: Record<string, unknown>) => Promise<ResultadoStripe>;
  confirmPixPayment: (clientSecret: string, dados?: Record<string, unknown>, opcoes?: Record<string, unknown>) => Promise<ResultadoStripe>;
};
type Janela = Window & { __ofertaApi?: ApiOferta; __stripeFalso?: StripeLike; Stripe?: (pk: string, o?: Record<string, unknown>) => StripeLike };
const w = window as Janela;

const FUNCOES = "https://itoylenzvahbscgjgtqf.supabase.co/functions/v1";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const GUIA = "https://www.coreaplicativo.com.br/guia/core-comece-aqui.pdf";
const CHAVE_REF = "oferta-stripe-ref";
const CHAVE_PI = "oferta-stripe-pi";
/**
 * 06/11: APPLE PAY e GOOGLE PAY, SÓ MEDIÇÃO. "on" = landing_stripe_carteira diz quantos aparelhos teriam a carteira, sem mostrar nada
 * (o Element segue com wallets "never"). Antes de ligar: registrar o domínio na Stripe e abrir o Permissions-Policy `payment=()` do
 * vercel.json (senão o Google Pay pode responder "não" pra todo mundo, e o número sai falso).
 */
const MEDIR_CARTEIRA = "off" as "on" | "off";
/**
 * 06/11: "Prefiro pagar com cartão" na tela do Pix. SÓ ligar DEPOIS do deploy do stripe-criar com `trocar_pix` (cancela o PI do Pix e
 * devolve outro da mesma ref). Ligada antes disso não cobra 2×: o servidor devolve o mesmo PI, a página percebe e fica no Pix.
 */
const PIX_TROCA_CARTAO = "off" as "on" | "off";
/** Stripe.js sem responder: desiste em 12 s (metade carrega em 3,8 s; o pior caso medido foi 19 s, e aí "Tentar de novo" resolve) */
const STRIPE_JS_TETO_MS = 12_000;
/** se o Element não avisar que carregou (ele nasce invisível enquanto o Pix está marcado), o Cartão não pode ficar travado pra sempre */
const CARTAO_FOLGA_MS = 8000;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const novoId = () => { try { return crypto.randomUUID(); } catch { return `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };

/** o PaymentIntent desta ref (sessionStorage, junto da ref): a recarga reaproveita o mesmo (e o mesmo QR do Pix) */
function piDaAba(ref: string): string | null {
  try { const j = JSON.parse(sessionStorage.getItem(CHAVE_PI) || "null") as { ref?: string; pi?: string } | null; return j && j.ref === ref && typeof j.pi === "string" && /^pi_/.test(j.pi) ? j.pi : null; } catch { return null; }
}
function guardarPi(ref: string, pi: string) { try { sessionStorage.setItem(CHAVE_PI, JSON.stringify({ ref, pi })); } catch { /* heap */ } }
/** a ref do pedido nesta aba (a mesma se a pessoa fecha e reabre — o servidor não cria 2 PaymentIntents) */
function refDaAba(): string {
  try { const r = sessionStorage.getItem(CHAVE_REF); if (r && /^[A-Za-z0-9-]{8,64}$/.test(r)) return r; } catch { /* noop */ }
  const r = novoId();
  try { sessionStorage.setItem(CHAVE_REF, r); } catch { /* fica no heap */ }
  return r;
}

/* ───────────────────────── a API (as edge functions) ───────────────────────── */
function tokenDaSessao(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const t = (JSON.parse(localStorage.getItem(k) || "null") as { access_token?: unknown } | null)?.access_token;
      if (typeof t === "string" && t.length > 20) return t;
    }
  } catch { /* sem storage */ }
  return null;
}
const postar = async (fn: string, corpo: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const token = tokenDaSessao();
  const r = await fetch(`${FUNCOES}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token ?? ANON}` }, body: JSON.stringify(corpo) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return r.ok ? j : { ...j, ok: false };
};
const apiReal: ApiOferta = {
  criar: async (c) => { const j = await postar("stripe-criar", c); return { ok: j.ok === true, clientSecret: j.client_secret as string | undefined, pi: j.pi as string | undefined, erro: j.erro as string | undefined, status: j.status as string | undefined, pix: (j.pix as PixQr | null | undefined) ?? null }; },
  status: async (c) => { const j = await postar("stripe-status", c); return { ok: j.ok === true, status: j.status as string | undefined, pago: j.pago === true, metodo: (j.metodo as string | null) ?? null }; },
};
/** fora do domínio de produção: nada sai pra Stripe. O Pix simulado "cai" 6 s depois de gerado. */
function apiSimulada(): ApiOferta {
  let pagoEm: number | null = null;
  (window as unknown as { __ofertaSimPagar?: () => void }).__ofertaSimPagar = () => { pagoEm = Date.now(); };
  return {
    criar: async (c) => (c.trocar_pix || c.pi === "pi_sim2" ? { ok: true, clientSecret: "pi_sim2_secret_sim", pi: "pi_sim2" } : { ok: true, clientSecret: "pi_sim_secret_sim", pi: "pi_sim" }),
    status: async () => ({ ok: true, status: pagoEm && Date.now() >= pagoEm ? "succeeded" : "requires_action", pago: !!pagoEm && Date.now() >= pagoEm }),
  };
}
const QR_SIM = "00020101021226870014br.gov.bcb.pix2565qr.stripe.com/pix/SIMULADO5204000053039865406" + "67.905802BR5904CORE6009SAO PAULO62070503***6304ABCD";
/** um Element de cartão de mentira (dev/prints): os campos desenhados, sem País e sem parcelas */
function stripeSimulado(): StripeLike {
  let pronto: (() => void) | undefined;
  const el: ElementoPagamento = {
    mount: (alvo) => {
      const n = typeof alvo === "string" ? document.querySelector<HTMLElement>(alvo)! : alvo;
      n.innerHTML = `<div class="oc-sim" data-testid="oferta-pe-simulado"><label>Número do cartão<input placeholder="1234 1234 1234 1234" inputmode="numeric" /></label><div class="oc-sim-2"><label>Validade<input placeholder="MM / AA" /></label><label>CVC<input placeholder="CVC" /></label></div></div>`;
      window.setTimeout(() => pronto?.(), 0);
    },
    on: (ev, cb) => { if (ev === "ready") pronto = () => cb({}); },
  };
  return {
    elements: () => ({ create: () => el, submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_sim" } }),
    confirmPayment: async () => ({ paymentIntent: { id: "pi_sim", status: "succeeded" } }),
    confirmPixPayment: async () => ({ paymentIntent: { id: "pi_sim", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR_SIM, expires_at: Math.floor(Date.now() / 1000) + 1800 } } } }),
  };
}

let carregandoStripe: Promise<StripeLike> | null = null;
let tetoStripe: number | null = null;
const soltarTeto = () => { if (tetoStripe !== null) { window.clearTimeout(tetoStripe); tetoStripe = null; } };
/** Stripe.js de https://js.stripe.com/v3 (a Stripe exige carregar de lá; só na /oferta, só no checkout) */
function stripeDeVerdade(pk: string): Promise<StripeLike> {
  if (carregandoStripe) return carregandoStripe;
  carregandoStripe = new Promise<StripeLike>((ok, falha) => {
    if (w.Stripe) return ok(w.Stripe(pk, { locale: "pt-BR" }));
    // a landing também pode ter pedido o script: reaproveita em vez de baixar 2×
    const ja = document.querySelector<HTMLScriptElement>('script[src^="https://js.stripe.com/v3"]');
    const s = ja ?? document.createElement("script");
    // falhou: a tag sai e a promessa não fica guardada, senão o "Tentar de novo" repetiria a falha pra sempre
    const desistir = () => { soltarTeto(); s.remove(); carregandoStripe = null; falha(new Error("stripe.js não carregou")); };
    s.addEventListener("load", () => { soltarTeto(); if (w.Stripe) ok(w.Stripe(pk, { locale: "pt-BR" })); else desistir(); });
    s.addEventListener("error", desistir);
    tetoStripe = window.setTimeout(desistir, STRIPE_JS_TETO_MS); // sem load nem error (rede pendurada), a pessoa não pode ficar em "Carregando…"
    if (ja) return;
    s.src = "https://js.stripe.com/v3"; s.async = true;
    document.head.appendChild(s);
  });
  return carregandoStripe;
}

/** 06/11: chamado quando a oferta aparece, ocioso (depois da 1ª tela). Só produção; falhou = tenta de novo ao abrir. */
export function preaquecerStripe(pk: string, producao: boolean): void {
  if (!producao || w.__stripeFalso) return;
  for (const href of ["https://api.stripe.com", "https://m.stripe.network"]) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
    const l = document.createElement("link"); l.rel = "preconnect"; l.href = href; l.crossOrigin = "anonymous"; document.head.appendChild(l);
  }
  void stripeDeVerdade(pk).catch(() => null);
}

/* ───────────────────────── a camada ───────────────────────── */
const CSS = `
.oc{position:fixed;inset:0;z-index:300;background:#fff;display:flex;flex-direction:column;height:100vh;height:100dvh;overscroll-behavior:contain;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--tx,#1c1a1f);animation:oc-sobe .22s ease}
.oc[hidden]{display:none!important}
@keyframes oc-sobe{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.oc{animation:none}}
.oc-barra{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;height:52px;padding:0 8px 0 16px;border-bottom:1px solid var(--borda,#ebe8ee);padding-top:env(safe-area-inset-top)}
.oc-barra b{font-size:15px;font-weight:900;letter-spacing:.14em}
.oc-barra span{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--suave,#6b6670)}
.oc-x{width:44px;height:44px;border:0;background:none;border-radius:12px;font-size:26px;line-height:1;color:var(--tx,#1c1a1f)}
.oc-corpo{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 20px calc(28px + env(safe-area-inset-bottom))}
.oc-in{max-width:440px;margin:0 auto}
.oc-resumo{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:16px;background:var(--papel,#f7f5f8)}
.oc-resumo h2{margin:0;font-size:16px;font-weight:800;letter-spacing:-.01em}
.oc-resumo p{margin:3px 0 0;font-size:13px;color:var(--suave,#6b6670)}
.oc-preco{font-size:24px;font-weight:850;letter-spacing:-.02em;white-space:nowrap}
.oc-provas{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px;font-size:13.5px;color:var(--suave,#6b6670)}
.oc-provas li{display:flex;gap:8px;align-items:center}
.oc-provas li::before{content:"✓";color:var(--verde,#16a34a);font-weight:900}
.oc-rot{display:block;margin:18px 0 6px;font-size:14px;font-weight:700}
.oc-rot span{font-weight:500;color:var(--suave,#6b6670)}
.oc-campo{width:100%;height:50px;border-radius:12px;border:1.5px solid #d9d4dd;padding:0 14px;font-size:16px;font-family:inherit;background:#fff;color:inherit}
.oc-campo:focus{outline:none;border-color:var(--magenta,#d6338a);box-shadow:0 0 0 3px rgba(214,51,138,.15)}
.oc-sug{margin:6px 0 0;padding:0;border:0;background:none;font-size:13.5px;color:var(--magenta,#d6338a);font-weight:700;text-align:left}
.oc-erro{margin:8px 0 0;font-size:13.5px;color:#b42318;font-weight:600}
.oc-email-ok{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:18px 0 0;padding:11px 14px;border-radius:12px;border:1.5px solid #ebe8ee;font-size:13px;line-height:1.3;color:var(--suave,#6b6670)}
.oc-email-ok span{min-width:0;overflow-wrap:anywhere}
.oc-email-ok b{display:block;font-size:15px;font-weight:700;color:var(--tx,#1c1a1f)}
.oc-email-ok button{flex:none;min-height:44px;margin:-8px 0;padding:0 0 0 10px;border:0;background:none;font-family:inherit;font-size:14px;font-weight:700;color:var(--magenta,#d6338a)}
.oc-email-caixa[hidden]{display:none}
.oc-metodos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.oc-metodo{display:flex;align-items:center;justify-content:center;gap:9px;min-height:60px;padding:0 10px;border-radius:14px;border:1.5px solid #d9d4dd;background:#fff;color:inherit;font-family:inherit;font-size:16.5px;font-weight:800}
.oc-metodo svg{flex:none;width:21px;height:21px}
.oc-metodo[aria-checked="true"]{border:2px solid var(--magenta,#d6338a);background:#fdf2f8;color:var(--magenta,#d6338a)}
.oc-metodo:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(214,51,138,.2)}
.oc-pagamento{position:relative}
.oc-painel-pix{margin-top:12px;padding:14px 16px;border-radius:14px;background:var(--papel,#f7f5f8)}
.oc-painel-pix[hidden]{display:none}
.oc-painel-pix b{display:block;font-size:15px;font-weight:800}
.oc-painel-pix p{margin:4px 0 0;font-size:14px;line-height:1.4;color:var(--suave,#6b6670)}
.oc-pe{margin-top:14px}
.oc-pe[data-oculto]{position:absolute;left:0;right:0;top:0;height:0;margin:0;overflow:hidden;visibility:hidden}
.oc-pe-carregando{display:grid;place-items:center;height:120px;font-size:13.5px;color:var(--suave,#6b6670)}
.oc-pe-carregando[hidden]{display:none}
.oc-cta{width:100%;min-height:56px;margin-top:18px;border:0;border-radius:16px;background:var(--grafite,#262626);color:#fff;font-size:17px;font-weight:800;font-family:inherit;box-shadow:0 8px 20px -6px rgba(0,0,0,.35)}
.oc-cta[aria-busy="true"]{opacity:.7;pointer-events:none}
.oc-cta[aria-disabled="true"]{opacity:.55}
.oc-miuda{margin:12px 0 0;text-align:center;font-size:12px;color:var(--suave,#6b6670)}
.oc-sim{border:1.5px solid #e4e0e7;border-radius:14px;padding:12px}
.oc-sim label{display:block;font-size:12.5px;font-weight:600;color:var(--suave,#6b6670)}
.oc-sim-2{margin-top:8px}
.oc-sim input,.oc-sim select{display:block;width:100%;height:44px;margin-top:4px;border-radius:10px;border:1.5px solid #e4e0e7;padding:0 12px;font:inherit;font-size:15px;background:#fff}
.oc-sim-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.oc-pix{text-align:center}
.oc-pix h2{margin:6px 0 0;font-size:22px;font-weight:850;letter-spacing:-.02em}
.oc-pix>p{margin:6px 0 0;font-size:14.5px;color:var(--suave,#6b6670)}
.oc-pilula{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:7px 12px;border-radius:99px;background:#fff7e6;color:#8a5a00;font-size:13px;font-weight:700}
.oc-pilula i{width:8px;height:8px;border-radius:50%;background:#f59e0b;animation:oc-pisca 1.2s infinite}
@keyframes oc-pisca{50%{opacity:.3}}
.oc-qr{display:grid;place-items:center;margin:16px auto 0;width:212px;height:212px;border:1.5px solid #ebe8ee;border-radius:16px;background:#fff}
.oc-qr img,.oc-qr svg{width:180px;height:180px}
.oc-copia{display:flex;gap:8px;margin-top:14px}
.oc-copia input{flex:1;min-width:0;height:48px;border-radius:12px;border:1.5px solid #e4e0e7;padding:0 12px;font-size:13px;font-family:ui-monospace,Menlo,monospace;background:var(--papel,#f7f5f8);color:inherit}
.oc-copia button{flex:none;height:48px;padding:0 16px;border-radius:12px;border:0;background:var(--magenta,#d6338a);color:#fff;font:inherit;font-weight:800;font-size:14.5px}
.oc-trocar{display:block;min-height:44px;margin:10px auto 0;padding:0 12px;border:0;background:none;font-family:inherit;font-size:14.5px;font-weight:700;color:var(--tx,#1c1a1f);text-decoration:underline}
.oc-trocar[aria-busy="true"]{opacity:.6;pointer-events:none}
.oc-passos{text-align:left;margin:16px 0 0;padding:0 0 0 20px;font-size:14px;line-height:1.5;color:var(--tx,#1c1a1f)}
.oc-pago{text-align:center}
.oc-check{width:68px;height:68px;margin:6px auto 0;border-radius:50%;display:grid;place-items:center;background:var(--verde,#16a34a);color:#fff;box-shadow:0 0 0 10px var(--verde-suave,#ecfdf3)}
.oc-check svg{width:34px;height:34px}
.oc-pago h2{margin:18px 0 0;font-size:24px;font-weight:850;letter-spacing:-.025em}
.oc-pago>p{margin:8px 0 0;font-size:15px;line-height:1.45;color:var(--suave,#6b6670)}
.oc-selos{display:flex;justify-content:center;gap:10px;margin-top:18px;flex-wrap:wrap}
.oc-selos img{height:48px;width:auto;display:block}
.oc-ce{margin-top:16px;padding:13px;border-radius:14px;border:1.5px solid #f0d6e5}
.oc-ce b.t{display:block;margin:0 0 9px;font-size:14px}
.oc-ce-app{display:flex;flex-direction:column;align-items:center;gap:6px;padding:13px 12px 9px;border-radius:12px;background:#f1eeea}
.oc-ce-comecar{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:42px;border-radius:999px;background:#bdb8bf;color:#fff;font-size:15px;font-weight:800}
.oc-ce-nao{position:absolute;right:-4px;top:-9px;padding:2px 8px;border-radius:999px;background:#fff;border:1.5px solid #f0c4c8;color:#c62f3c;font-size:11px;font-weight:800}
.oc-ce-entrar{padding:7px 14px;border-radius:999px;background:#fff;border:2.5px solid var(--magenta,#d6338a);box-shadow:0 0 0 5px rgba(214,51,138,.12);font-size:14px;color:#4f5a64;white-space:nowrap}
.oc-ce-entrar span{color:#16121c;font-weight:800}
.oc-ce-sim{font-size:11.5px;font-weight:800;color:var(--magenta,#d6338a)}
.oc-ce p{margin:9px 0 0;font-size:13.5px;line-height:1.4;color:var(--suave,#6b6670)}
.oc-guia{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding:13px 14px;border-radius:14px;border:1px solid #ebe8ee;text-align:left}
.oc-guia b{display:block;font-size:15px}.oc-guia span{display:block;font-size:13px;color:var(--suave,#6b6670);margin-top:2px}
.oc-guia a{flex:none;background:var(--grafite,#262626);color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:11px 14px;border-radius:10px}
.oc-contato{margin:14px 0 0;font-size:13px;color:var(--suave,#6b6670)}
.oc-contato a{color:inherit;font-weight:700}
`;

const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_CADEADO = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

const ICO_PIX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/><path d="M7.4 12H9l3-3 3 3h1.6M9 12l3 3 3-3"/></svg>';
const ICO_CARTAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/></svg>';

type Fase = "form" | "pix" | "aguardando" | "pago" | "recebido";
type Metodo = "pix" | "card";
/** o CPF fica SÓ na memória desta página (nada de storage, evento ou log) e vai só pro stripe-criar */
type Estado = { fase: Fase; ref: string; pi: string | null; clientSecret: string | null; metodo: string; pix: PixQr | null; email: string; cpf: string };

let raiz: HTMLElement | null = null;
let opc: OpcoesCheckout | null = null;
let api: ApiOferta | null = null;
let stripe: StripeLike | null = null;
let elementos: Elementos | null = null;
let elementoCartao: ElementoPagamento | null = null;
let est: Estado | null = null;
/** braço "pagina": o último e-mail que veio do cartão da oferta */
let ultimoEmailInicial: string | null = null;
/** cada abertura do formulário é uma montagem: o que chegar atrasado de uma montagem velha não mexe na tela nova */
let montagem = 0;
/** Stripe.js + PI prontos = o Pix pode ser gerado */
let pixPronto = false;
/** o Element de cartão avisou que carregou */
let cartaoPronto = false;
/** a carga falhou: o botão vira "Tentar de novo" (cartaoFalhou: só no Cartão; o Pix segue valendo) */
let cargaFalhou = false;
let cartaoFalhou = false;
let abertoEm = 0;
let saidas = 0;
let saiuEm: number | null = null;
let fechandoPelaTela = false;
let carteiraMedida = false;
let trocandoPix = false;
const emailMedido = { comecou: "", valido: "" };
let aberta = false;
let yAntes = 0;
let focoAntes: HTMLElement | null = null;
let consulta: number | null = null;
let pagando = false;
let comHistorico = false;
let ultimaCriacao: RespostaCriar | null = null;
const icNoHeap = new Set<string>();
let vigiaDesde = 0;
/** revisão 2 (4): respostas ok:false SEGUIDAS na espera do cartão (1 erro isolado não basta) */
let semConfirmar = 0;
/** 3 (revisão): sem resposta em ~2 min na espera do cartão/banco → para e mostra "Pagamento recebido?" */
const VIGIA_MAX_MS = 120_000;

/** a camada está aberta? (testes) */
export const estaAberto = () => aberta;
export const faseAtual = () => est?.fase ?? null;

function travar() {
  yAntes = window.scrollY || 0;
  const b = document.body.style;
  b.position = "fixed"; b.top = `-${yAntes}px`; b.left = "0"; b.right = "0"; b.width = "100%"; b.overflow = "hidden";
  document.documentElement.setAttribute("data-checkout-aberto", "");
}
function soltar() {
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = ""; b.overflow = "";
  document.documentElement.removeAttribute("data-checkout-aberto");
  try { window.scrollTo(0, yAntes); } catch { /* jsdom */ }
}

function montarCamada(o: OpcoesCheckout): HTMLElement {
  if (!document.getElementById("oc-estilo")) { const st = document.createElement("style"); st.id = "oc-estilo"; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement("div");
  el.className = "oc"; el.id = "oc";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "oc-tit");
  el.innerHTML = `
    <div class="oc-barra"><b>CORE</b><span>${ICO_CADEADO}Pagamento seguro</span><button type="button" class="oc-x" id="oc-x" aria-label="Fechar o pagamento">×</button></div>
    <div class="oc-corpo"><div class="oc-in" id="oc-in"></div></div>`;
  document.body.appendChild(el);
  el.querySelector("#oc-x")!.addEventListener("click", () => pedirFechar("x"));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); pedirFechar("esc"); return; }
    if (e.key !== "Tab") return;
    const foc = [...el.querySelectorAll<HTMLElement>("button, input, select, a[href], iframe, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled") && x.offsetParent !== null || x === document.activeElement);
    if (!foc.length) return;
    const pri = foc[0], ult = foc[foc.length - 1];
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  });
  void o;
  return el;
}

const preco = () => reaisDeCentavos(opc!.precoCentavos);

function telaForm() {
  const o = opc!;
  const alvo = raiz!.querySelector<HTMLElement>("#oc-in")!;
  // 11/11 (braço "pagina"): o e-mail veio do cartão da oferta — aqui vira uma linha, e o campo fica guardado atrás do "Trocar"
  const emailPronto = !!o.emailInicial && EMAIL_OK.test(est!.email.trim().toLowerCase());
  alvo.innerHTML = `
    <div class="oc-resumo" data-testid="oferta-resumo"><div><h2 id="oc-tit">CORE · Acesso vitalício</h2><p>Pagamento único · nada é cobrado depois</p></div><div class="oc-preco">${esc(preco())}</div></div>
    <ul class="oc-provas"><li>As 16 áreas da vida num app só</li><li>iPhone, Android e computador, com a mesma conta</li><li>7 dias de garantia: não gostou, devolvemos 100%</li></ul>
    ${emailPronto ? `<div class="oc-email-ok" id="oc-email-ok" data-testid="oferta-email-ok"><span>Seu acesso chega em<b>${esc(est!.email.trim().toLowerCase())}</b></span><button type="button" id="oc-email-trocar">Trocar</button></div>` : ""}
    <div class="oc-email-caixa" id="oc-email-caixa"${emailPronto ? " hidden" : ""}>
    <label class="oc-rot" for="oc-email">Seu e-mail <span>· é por onde você entra no CORE</span></label>
    <input class="oc-campo" id="oc-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" placeholder="voce@email.com" value="${esc(est!.email)}" />
    <button type="button" class="oc-sug" id="oc-sug" hidden></button>
    <p class="oc-erro" id="oc-email-erro" role="alert" hidden></p>
    </div>
    ${o.pedeCpf ? `<label class="oc-rot" for="oc-cpf">CPF <span>· pra nota fiscal</span></label>
    <input class="oc-campo" id="oc-cpf" type="text" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" value="${esc(mascararCpf(est!.cpf))}" />
    <p class="oc-erro" id="oc-cpf-erro" role="alert" hidden></p>` : ""}
    <div class="oc-metodos" role="radiogroup" aria-label="Forma de pagamento">
      <button type="button" class="oc-metodo" role="radio" data-metodo="pix" aria-checked="false">${ICO_PIX}Pix</button>
      <button type="button" class="oc-metodo" role="radio" data-metodo="card" aria-checked="false">${ICO_CARTAO}Cartão</button>
    </div>
    <div class="oc-pagamento">
      <div class="oc-painel-pix" id="oc-painel-pix" data-testid="oferta-painel-pix"><b>Pix copia e cola</b><p>Aprovado na hora. Você copia o código e paga no app do seu banco.</p></div>
      <div class="oc-pe-carregando" id="oc-pe-carregando" hidden>Carregando o pagamento…</div>
      <div class="oc-pe" id="oc-pe" data-oculto></div>
    </div>
    <p class="oc-erro" id="oc-erro" role="alert" hidden></p>
    <button type="button" class="oc-cta" id="oc-pagar"></button>
    <p class="oc-miuda">Pix ou cartão${o.parcelasMax > 1 ? ` em até ${o.parcelasMax}x` : ""} · processado pela Stripe · CORE · CNPJ 55.041.112/0001-82</p>`;
  const campo = alvo.querySelector<HTMLInputElement>("#oc-email")!;
  const sug = alvo.querySelector<HTMLButtonElement>("#oc-sug")!;
  const atualizarSug = () => {
    const s = sugestaoDeEmail(campo.value);
    if (s) { sug.hidden = false; sug.textContent = `Você quis dizer ${s}?`; sug.dataset.s = s; } else { sug.hidden = true; delete sug.dataset.s; }
  };
  campo.addEventListener("input", () => { est!.email = campo.value; erroEmail(null); atualizarSug(); medirEmail(); });
  campo.addEventListener("blur", atualizarSug);
  sug.addEventListener("click", () => { campo.value = sug.dataset.s ?? campo.value; est!.email = campo.value; sug.hidden = true; o.evento("landing_email_antes_sugestao", { onde: "stripe" }); medirEmail(); });
  alvo.querySelector("#oc-email-trocar")?.addEventListener("click", () => { o.evento("landing_stripe_email_trocar", {}); mostrarCampoEmail(); campo.focus(); });
  if (emailPronto) medirEmail();
  const cpf = alvo.querySelector<HTMLInputElement>("#oc-cpf");
  cpf?.addEventListener("input", () => { const m = mascararCpf(cpf.value); if (cpf.value !== m) cpf.value = m; est!.cpf = soDigitosCpf(m); erroCpf(null); });
  alvo.querySelector("#oc-pagar")!.addEventListener("click", () => { void tocouPagar(); });
  const botoes = [...alvo.querySelectorAll<HTMLButtonElement>("[data-metodo]")];
  botoes.forEach((b, i) => {
    b.addEventListener("click", () => tocouMetodo(b.dataset.metodo as Metodo));
    // radiogroup: as setas trocam (e o foco vai junto)
    b.addEventListener("keydown", (e) => {
      if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault();
      const outro = botoes[(i + 1) % botoes.length];
      outro.focus(); tocouMetodo(outro.dataset.metodo as Metodo);
    });
  });
  mostrarMetodo();
  void montarElemento();
}

const metodoAtual = (): Metodo => (est?.metodo === "card" ? "card" : "pix");
const rotuloPagar = () => (metodoAtual() === "pix" ? `Gerar Pix de ${preco()}` : `Pagar ${preco()}`);
const metodoPronto = () => pixPronto && (metodoAtual() === "pix" || cartaoPronto);
const metodoFalhou = () => cargaFalhou || (metodoAtual() === "card" && cartaoFalhou);
const MSG_CARTAO_FALHOU = "O cartão não carregou. Tente de novo ou use o Pix.";

/** o botão de pagar conta a verdade: carregando (travado), falhou (tenta de novo) ou o que vai acontecer */
function atualizarPagar() {
  const b = raiz?.querySelector<HTMLButtonElement>("#oc-pagar");
  if (!b || pagando) return;
  const pronto = metodoPronto(), falhou = metodoFalhou();
  if (pronto || falhou) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true");
  b.textContent = falhou ? "Tentar de novo" : pronto ? rotuloPagar() : "Carregando…";
  const espera = raiz?.querySelector<HTMLElement>("#oc-pe-carregando");
  if (espera) espera.hidden = !(metodoAtual() === "card" && !cartaoPronto && !falhou);
}

/** pinta o método marcado. O Element fica montado e só some da vista (display:none atrapalha o iframe da Stripe) */
function mostrarMetodo() {
  const m = metodoAtual();
  raiz?.querySelectorAll<HTMLButtonElement>("[data-metodo]").forEach((b) => { const sim = b.dataset.metodo === m; b.setAttribute("aria-checked", String(sim)); b.tabIndex = sim ? 0 : -1; });
  const painel = raiz?.querySelector<HTMLElement>("#oc-painel-pix");
  if (painel) painel.hidden = m !== "pix";
  raiz?.querySelector<HTMLElement>("#oc-pe")?.toggleAttribute("data-oculto", m !== "card" || !cartaoPronto);
  atualizarPagar();
}

function tocouMetodo(m: Metodo) {
  if (!est || pagando || metodoAtual() === m) return;
  est.metodo = m;
  erroGeral(m === "card" && cartaoFalhou ? MSG_CARTAO_FALHOU : null);
  opc?.evento("landing_stripe_metodo", { metodo: m, via: "toque" });
  mostrarMetodo();
  if (m !== "card" || cartaoPronto || cartaoFalhou) return;
  const minha = montagem;
  window.setTimeout(() => {
    if (minha !== montagem || cartaoPronto || cartaoFalhou || !pixPronto || !elementos) return;
    opc?.evento("landing_erro", { onde: "stripe_cartao_sem_ready" });
    cartaoPronto = true; mostrarMetodo();
  }, CARTAO_FOLGA_MS);
}

function tocouPagar() {
  if (pagando || !opc) return;
  if (metodoFalhou()) { erroGeral(null); void montarElemento(); return; }
  if (!metodoPronto()) { opc.evento("landing_stripe_pagar_travado", { metodo: metodoAtual() }); return; }
  return pagar();
}

/** começou a digitar / ficou válido: 1× por pedido (nunca o e-mail no evento) */
function medirEmail() {
  if (!est || !opc) return;
  const v = est.email.trim().toLowerCase();
  if (v && emailMedido.comecou !== est.ref) { emailMedido.comecou = est.ref; opc.evento("landing_stripe_email_comecou", {}); }
  if (EMAIL_OK.test(v) && emailMedido.valido !== est.ref) { emailMedido.valido = est.ref; opc.evento("landing_stripe_email_valido", {}); }
}

/** erro da Stripe (ou do nosso servidor) depois do toque em pagar */
function erroAoPagar(etapa: string, e?: ErroStripe) {
  opc?.evento("landing_stripe_pagar_erro", { metodo: metodoAtual(), etapa, tipo: String(e?.type ?? "").slice(0, 40), code: String(e?.code ?? "").slice(0, 40) });
}

/** braço "pagina": tira a linha do e-mail pronto e devolve o campo (no "Trocar", e sempre que houver um erro pra mostrar nele) */
function mostrarCampoEmail() {
  raiz?.querySelector("#oc-email-ok")?.remove();
  const c = raiz?.querySelector<HTMLElement>("#oc-email-caixa");
  if (c) c.hidden = false;
}
function erroEmail(m: string | null) { if (m) mostrarCampoEmail(); const e = raiz?.querySelector<HTMLElement>("#oc-email-erro"); if (e) { e.hidden = !m; e.textContent = m ?? ""; } }
function erroCpf(m: string | null) { const e = raiz?.querySelector<HTMLElement>("#oc-cpf-erro"); if (e) { e.hidden = !m; e.textContent = m ?? ""; } }
function erroGeral(m: string | null) { const e = raiz?.querySelector<HTMLElement>("#oc-erro"); if (e) { e.hidden = !m; e.textContent = m ?? ""; } }

function corpoDoPedido(email: string | null, cpf: string | null = null): Record<string, unknown> {
  const o = opc!;
  return {
    ref: est!.ref, pi: est!.pi, email, pagina: "oferta", ...(cpf ? { cpf } : {}),
    fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc"), fbclid: o.fbclid, url: o.urlChegada.slice(0, 500),
    landing_session_id: o.sessao, landing_device_id: o.aparelho, atrib: o.atrib,
  };
}

/** stripe-criar sem responder: desiste no mesmo teto do Stripe.js. A resposta atrasada é ignorada, e a nova tentativa cai no mesmo PI (mesma ref) */
function criarComTeto(corpo: Record<string, unknown>): Promise<RespostaCriar> {
  let teto = 0;
  const estourou = new Promise<RespostaCriar>((ok) => { teto = window.setTimeout(() => ok({ ok: false, erro: "teto" }), STRIPE_JS_TETO_MS); });
  return Promise.race([api!.criar(corpo).catch(() => ({ ok: false } as RespostaCriar)), estourou]).finally(() => window.clearTimeout(teto));
}

async function garantirIntento(email: string | null, cpf: string | null = null): Promise<boolean> {
  const o = opc!;
  const r = await criarComTeto(corpoDoPedido(email, cpf));
  if (!r.ok || !r.clientSecret) { o.evento("landing_erro", { onde: "stripe_criar", msg: String(r.erro ?? "falhou").slice(0, 80) }); return false; }
  est!.clientSecret = r.clientSecret; est!.pi = r.pi ?? est!.pi;
  if (est!.pi) guardarPi(est!.ref, est!.pi);
  ultimaCriacao = r;
  return true;
}

function falhouCarga(msg: string) {
  cargaFalhou = true;
  erroGeral(msg);
  mostrarMetodo();
}

/** o Element de cartão: nasce sem intent e invisível, enquanto o Pix está marcado (quem toca em Cartão já encontra pronto) */
function montarCartao(s: StripeLike, minha: number, t0: number) {
  const o = opc!;
  const caixa = raiz?.querySelector<HTMLElement>("#oc-pe");
  if (!caixa) return;
  elementos = s.elements({
    mode: "payment", amount: o.precoCentavos, currency: "brl", allowedPaymentMethodTypes: ["card"], paymentMethodCreation: "manual", locale: "pt-BR",
    appearance: { theme: "stripe", variables: { colorPrimary: "#d6338a", colorText: "#1c1a1f", borderRadius: "12px", fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif" } },
    fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" }],
  });
  const pe = elementos.create("payment", { layout: { type: "tabs" }, fields: { billingDetails: { email: "never", address: "if_required" } }, wallets: { applePay: "never", googlePay: "never", link: "never" } });
  elementoCartao = pe;
  pe.on("ready", () => {
    if (minha !== montagem) return;
    cartaoPronto = true;
    o.evento("landing_stripe_cartao_pronto", { ms: Math.round(performance.now() - t0) });
    mostrarMetodo();
  });
  pe.on("loaderror", (e) => {
    if (minha !== montagem) return;
    cartaoFalhou = true;
    o.evento("landing_erro", { onde: "stripe_cartao", msg: String(e.error?.code ?? e.error?.type ?? "").slice(0, 40) });
    if (metodoAtual() === "card") erroGeral(MSG_CARTAO_FALHOU);
    mostrarMetodo();
  });
  pe.mount(caixa);
}

async function montarElemento() {
  const o = opc!;
  const minha = ++montagem;
  const t0 = performance.now();
  pixPronto = false; cartaoPronto = false; cargaFalhou = false; cartaoFalhou = false;
  try { elementoCartao?.destroy?.(); } catch { /* já saiu da tela */ }
  elementoCartao = null; elementos = null;
  mostrarMetodo();
  // 06/11: o PI e o Stripe.js ao mesmo tempo (antes, em fila); o Element de cartão não precisa do PI
  const intento = garantirIntento(null);
  const comStripe = (async () => {
    try {
      const s = w.__stripeFalso ?? (o.producao ? await stripeDeVerdade(o.pk) : stripeSimulado());
      if (minha !== montagem) return false;
      stripe = s;
    } catch { return false; }
    // erro síncrono no cartão não derruba o Pix: o Stripe.js está aqui, e o Pix só precisa dele
    try { montarCartao(stripe, minha, t0); }
    catch (e) {
      cartaoFalhou = true;
      o.evento("landing_erro", { onde: "stripe_cartao", msg: String((e as Error)?.name ?? "").slice(0, 40) });
      if (metodoAtual() === "card") erroGeral(MSG_CARTAO_FALHOU);
    }
    return true;
  })();
  const temIntento = await intento;
  if (minha !== montagem) return;
  if (!temIntento) { falhouCarga("Não consegui abrir o pagamento agora. Tente de novo em instantes."); return; }
  // 2 (revisão): a recarga reaproveitou o PI — Pix já gerado volta com o MESMO QR; já pago vai pro pago
  if (ultimaCriacao?.status === "succeeded") { mostrarPago(est!.metodo); return; }
  if (ultimaCriacao?.pix && (ultimaCriacao.pix.data || ultimaCriacao.pix.image_url_png)) { est!.pix = ultimaCriacao.pix; est!.metodo = "pix"; est!.fase = "pix"; telaPix(); return; }
  const temStripe = await comStripe;
  if (minha !== montagem) return;
  if (!temStripe) { o.evento("landing_erro", { onde: "stripe_js" }); falhouCarga("O pagamento não carregou. Confira a internet e tente de novo."); return; }
  pixPronto = true;
  o.evento("landing_stripe_carregou", { ms: Math.round(performance.now() - t0) });
  mostrarMetodo();
  void medirCarteira(stripe!);
}

/** só medição (MEDIR_CARTEIRA): paymentRequest não desenha nada; nada aqui pode atrapalhar o pagamento */
async function medirCarteira(s: StripeLike) {
  const o = opc!;
  if (carteiraMedida || !(o.medirCarteira ?? MEDIR_CARTEIRA === "on") || !s.paymentRequest) return;
  carteiraMedida = true;
  let aparelho = "sem_api";
  try { const A = (window as unknown as { ApplePaySession?: { canMakePayments: () => boolean } }).ApplePaySession; if (A) aparelho = A.canMakePayments() ? "sim" : "nao"; } catch { aparelho = "erro"; }
  try {
    const pedido = s.paymentRequest({ country: "BR", currency: "brl", total: { label: "CORE", amount: o.precoCentavos } });
    const r = await Promise.race([pedido.canMakePayment(), new Promise<"demorou">((ok) => window.setTimeout(() => ok("demorou"), 4000))]);
    o.evento("landing_stripe_carteira", { apple_pay: r !== "demorou" && !!r?.applePay, google_pay: r !== "demorou" && !!r?.googlePay, apple_aparelho: aparelho, demorou: r === "demorou" });
  } catch { o.evento("landing_stripe_carteira", { apple_pay: false, google_pay: false, apple_aparelho: aparelho, erro: true }); }
}

async function pagar() {
  if (pagando || !opc || !est) return;
  const o = opc;
  const campo = raiz!.querySelector<HTMLInputElement>("#oc-email")!;
  const email = campo.value.trim().toLowerCase();
  if (!email) { erroEmail("Digite seu e-mail: é por ele que você entra no CORE."); campo.focus(); o.evento("landing_email_antes_erro", { motivo: "vazio", onde: "stripe" }); return; }
  if (!EMAIL_OK.test(email)) { erroEmail("Confira o e-mail: parece que falta alguma coisa."); campo.focus(); o.evento("landing_email_antes_erro", { motivo: "invalido", onde: "stripe" }); return; }
  // CPF (nota fiscal): só os dígitos, conferidos aqui e de novo no servidor; nunca vai pra evento/log (só o motivo do erro)
  let cpf: string | null = null;
  if (o.pedeCpf) {
    const campoCpf = raiz!.querySelector<HTMLInputElement>("#oc-cpf");
    cpf = soDigitosCpf(campoCpf?.value);
    if (!cpf) { erroCpf("Digite seu CPF (pra nota fiscal)."); campoCpf?.focus(); o.evento("landing_cpf_erro", { motivo: "vazio" }); return; }
    if (!cpfValido(cpf)) { erroCpf("Confira o CPF: os números não batem."); campoCpf?.focus(); o.evento("landing_cpf_erro", { motivo: "invalido" }); return; }
    est.cpf = cpf;
  }
  const metodo = metodoAtual();
  if (!stripe || !est.clientSecret || (metodo === "card" && !elementos)) { erroGeral("O pagamento ainda está carregando. Tente de novo em instantes."); return; }
  pagando = true;
  const botao = raiz!.querySelector<HTMLButtonElement>("#oc-pagar")!;
  botao.setAttribute("aria-busy", "true"); botao.textContent = "Processando…";
  erroGeral(null);
  est.email = email;
  try {
    o.evento("landing_stripe_pagar", { metodo });
    if (metodo === "pix") {
      if (!(await garantirIntento(email, cpf))) { erroGeral("Não consegui registrar o pagamento. Tente de novo em instantes."); erroAoPagar("criar"); return; }
      const r = await stripe.confirmPixPayment(est.clientSecret!, { payment_method: { billing_details: { email } } }, { handleActions: false });
      if (r.error) { erroGeral(r.error.message ?? "Não deu pra gerar o Pix. Tente de novo."); o.evento("landing_erro", { onde: "stripe_pix", msg: String(r.error.code ?? "").slice(0, 40) }); erroAoPagar("pix", r.error); return; }
      const qr = r.paymentIntent?.next_action?.pix_display_qr_code;
      if (r.paymentIntent?.status === "succeeded") return mostrarPago("pix");
      if (!qr?.data && !qr?.image_url_png) { erroGeral("Não deu pra mostrar o Pix. Tente de novo."); erroAoPagar("pix", { code: "sem_qr" }); return; }
      est.pix = qr; est.fase = "pix";
      o.evento("landing_stripe_pix_gerado", { pi: est.pi });
      telaPix();
      return;
    }
    // cartão: confere os campos antes de ir ao servidor; o PaymentMethod e o e-mail no PI vão juntos
    const sub = await elementos!.submit();
    if (sub?.error) { erroGeral(sub.error.message ?? "Confira os dados do pagamento."); erroAoPagar("validar", sub.error); return; }
    const [temIntento, criado] = await Promise.all([garantirIntento(email, cpf), stripe.createPaymentMethod({ elements: elementos, params: { billing_details: { email } } })]);
    if (criado.error || !criado.paymentMethod) { erroGeral(criado.error?.message ?? "Confira os dados do cartão."); erroAoPagar("cartao", criado.error); return; }
    if (!temIntento) { erroGeral("Não consegui registrar o pagamento. Tente de novo em instantes."); erroAoPagar("criar"); return; }
    const retorno = new URL(location.href); retorno.search = ""; retorno.hash = "";
    for (const [k, v] of new URLSearchParams(location.search)) if (!/^(payment_intent|payment_intent_client_secret|redirect_status)$/.test(k)) retorno.searchParams.set(k, v);
    const r = await stripe.confirmPayment({ clientSecret: est.clientSecret, redirect: "if_required", confirmParams: { return_url: retorno.toString(), payment_method: criado.paymentMethod.id } });
    if (r.error) { erroGeral(r.error.message ?? "O pagamento não passou. Confira os dados ou tente outro cartão."); o.evento("landing_stripe_recusado", { tipo: String(r.error.type ?? ""), code: String(r.error.code ?? "") }); erroAoPagar("confirmar", r.error); return; }
    const st = r.paymentIntent?.status;
    if (st === "succeeded") return mostrarPago("card");
    est.fase = "aguardando"; telaAguardando(); vigiar();
  } catch (e) {
    // Stripe.js pode lançar (não só devolver error): antes o botão voltava sem explicar nada
    erroGeral("Não deu pra concluir agora. Tente de novo em instantes.");
    erroAoPagar("excecao", { code: String((e as Error)?.name ?? "") });
  } finally {
    pagando = false;
    const b = raiz?.querySelector<HTMLButtonElement>("#oc-pagar");
    if (b) b.removeAttribute("aria-busy");
    atualizarPagar();
  }
}

function telaPix() {
  const o = opc!, p = est!.pix!;
  const alvo = raiz!.querySelector<HTMLElement>("#oc-in")!;
  const vence = p.expires_at ? new Date(p.expires_at * 1000) : null;
  const hora = vence ? vence.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  alvo.innerHTML = `
    <div class="oc-pix" data-testid="oferta-pix">
      <div class="oc-resumo" style="text-align:left"><div><h2 id="oc-tit">CORE · Acesso vitalício</h2><p>Pix · pagamento único</p></div><div class="oc-preco">${esc(preco())}</div></div>
      <span class="oc-pilula"><i></i>Esperando o Pix · confirma sozinho</span>
      <div class="oc-qr" id="oc-qr" aria-label="QR code do Pix">${p.image_url_png ? `<img alt="QR code do Pix" src="${esc(p.image_url_png)}" width="180" height="180" />` : ""}</div>
      <div class="oc-copia"><input id="oc-codigo" readonly value="${esc(p.data ?? "")}" aria-label="Pix copia e cola" /><button type="button" id="oc-copiar">Copiar</button></div>
      <ol class="oc-passos"><li>Abra o app do seu banco e escolha <b>Pix copia e cola</b> (ou leia o QR).</li><li>Cole o código e confirme ${esc(preco())}.</li><li>Volte aqui: esta tela confirma sozinha.</li></ol>
      ${hora ? `<p>Vale até ${esc(hora)}. O acesso também chega no seu e-mail.</p>` : "<p>O acesso também chega no seu e-mail.</p>"}
      ${o.trocaCartao ?? PIX_TROCA_CARTAO === "on" ? `<p class="oc-erro" id="oc-erro" role="alert" hidden></p><button type="button" class="oc-trocar" id="oc-trocar">Prefiro pagar com cartão</button>` : ""}
    </div>`;
  alvo.querySelector("#oc-trocar")?.addEventListener("click", () => { void trocarPixPorCartao(); });
  if (!p.image_url_png && p.data) void desenharQr(alvo.querySelector<HTMLElement>("#oc-qr")!, p.data);
  alvo.querySelector("#oc-copiar")!.addEventListener("click", async () => {
    const b = alvo.querySelector<HTMLButtonElement>("#oc-copiar")!;
    let ok = false;
    try { await navigator.clipboard.writeText(p.data ?? ""); ok = true; } catch { const i = alvo.querySelector<HTMLInputElement>("#oc-codigo")!; i.select(); try { ok = document.execCommand("copy"); } catch { ok = false; } }
    b.textContent = ok ? "Copiado ✓" : "Copie acima";
    o.evento("landing_pix_copiado", { ok, via: "stripe" });
  });
  vigiar();
}

/**
 * Sair do Pix pro cartão. O formulário só abre com a PROVA de que o Pix antigo morreu: outro PI, sem Pix. Qualquer outra resposta (servidor
 * antigo, falha, cancelamento recusado) deixa a pessoa no Pix que vale, senão daria pra pagar o QR e o cartão.
 */
async function trocarPixPorCartao() {
  if (!opc || !est?.pi || est.fase !== "pix" || trocandoPix) return;
  const o = opc, velho = est.pi;
  const b = raiz?.querySelector<HTMLButtonElement>("#oc-trocar");
  trocandoPix = true;
  b?.setAttribute("aria-busy", "true");
  erroGeral(null);
  const r = await api!.criar({ ...corpoDoPedido(null), trocar_pix: true }).catch(() => ({ ok: false } as RespostaCriar));
  trocandoPix = false;
  b?.removeAttribute("aria-busy");
  if (!est || est.fase !== "pix") return; // o Pix caiu enquanto esperava: a tela de pago já está lá
  if (r.ok && r.status === "succeeded") { o.evento("landing_stripe_pix_trocou", { ok: false, motivo: "ja_pago" }); mostrarPago("pix"); return; }
  const trocou = r.ok && !!r.clientSecret && !!r.pi && r.pi !== velho && !r.pix;
  o.evento("landing_stripe_pix_trocou", { ok: trocou, motivo: trocou ? null : r.ok ? "mesmo_pi" : "falhou" });
  if (!trocou) { erroGeral("Não deu pra trocar agora. Este Pix continua valendo."); return; }
  pararVigia();
  est.pi = r.pi!; est.clientSecret = r.clientSecret!; est.pix = null; est.fase = "form"; est.metodo = "card";
  guardarPi(est.ref, est.pi);
  telaForm();
  raiz?.querySelector<HTMLElement>(".oc-corpo")?.scrollTo?.(0, 0);
}

async function desenharQr(alvo: HTMLElement, valor: string) {
  try {
    const [{ createElement }, { createRoot }, { QRCodeSVG }] = await Promise.all([import("react"), import("react-dom/client"), import("qrcode.react")]);
    createRoot(alvo).render(createElement(QRCodeSVG, { value: valor, size: 180, level: "M" }));
  } catch { /* o copia-e-cola continua */ }
}

/** 3 (revisão): a volta do banco sem confirmação daqui (outro navegador, ref perdida, ou 2 min sem resposta) — nunca "Confirmando…" pra sempre */
function telaRecebido() {
  if (!est || !raiz) return;
  est.fase = "recebido";
  pararVigia();
  opc?.evento("landing_stripe_recebido_sem_confirmar", { pi: est.pi });
  raiz.querySelector<HTMLElement>("#oc-in")!.innerHTML = `
    <div class="oc-pago" data-testid="oferta-recebido">
      <h2 id="oc-tit">Pagamento recebido?</h2>
      <p>O acesso chega no seu e-mail em até 1 minuto. Enquanto isso, baixe o app:</p>
      <div class="oc-selos"><a href="${URL_APP_STORE}" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="144" height="48" /></a><a href="${esc(urlPlay("oferta"))}" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="124" height="48" /></a></div>
      <p class="oc-contato">No app, toque em <b>“Já tenho conta? Entrar”</b> com o e-mail da compra. Não chegou? <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a></p>
    </div>`;
}

function telaAguardando() {
  const alvo = raiz!.querySelector<HTMLElement>("#oc-in")!;
  alvo.innerHTML = `<div class="oc-pix" data-testid="oferta-aguardando"><h2 id="oc-tit">Confirmando o pagamento…</h2><span class="oc-pilula"><i></i>Só um instante</span><p>Não feche esta tela. O acesso também chega no seu e-mail.</p></div>`;
}

/** pergunta ao servidor se o PaymentIntent pagou (a cada 3 s, e na volta pra aba) */
function vigiar() {
  if (consulta !== null) return;
  vigiaDesde = Date.now();
  semConfirmar = 0;
  const uma = async () => {
    if (!est?.pi || est.fase === "pago" || est.fase === "recebido") return;
    const r = await api!.status({ ref: est.ref, pi: est.pi }).catch(() => null);
    if (r?.pago) return mostrarPago((r.metodo as string) || est.metodo);
    semConfirmar = r?.ok === false ? semConfirmar + 1 : 0;
    if (est.fase === "aguardando" && (semConfirmar >= 3 || Date.now() - vigiaDesde > VIGIA_MAX_MS)) telaRecebido();
  };
  consulta = window.setInterval(() => { void uma(); }, 3000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void uma(); });
  void uma();
}
function pararVigia() { if (consulta !== null) { window.clearInterval(consulta); consulta = null; } }

function mostrarPago(metodo: string) {
  if (!opc || !est || est.fase === "pago") return;
  const o = opc;
  est.fase = "pago";
  pararVigia();
  // o Pix caiu com a camada fechada: ela volta, já no "pago"
  if (!aberta && raiz) {
    raiz.hidden = false; aberta = true; travar();
    try { history.pushState({ ofertaCheckout: 1 }, ""); comHistorico = true; } catch { comHistorico = false; }
    window.addEventListener("popstate", aoVoltarNavegador);
    vigiarSaida(true);
  }
  try { sessionStorage.removeItem(CHAVE_REF); sessionStorage.removeItem(CHAVE_PI); } catch { /* noop */ }
  o.evento("landing_stripe_pago", { metodo, pi: est.pi });
  if (est.pi) o.pixel("Purchase", { value: o.precoCentavos / 100, currency: "BRL", content_name: "oferta_stripe" }, est.pi);
  telaPago();
}

/** só desenha: reabrir depois de pago volta aqui, sem evento nem Purchase de novo */
function telaPago() {
  const o = opc!;
  const e = est!.email;
  const alvo = raiz!.querySelector<HTMLElement>("#oc-in")!;
  alvo.innerHTML = `
    <div class="oc-pago" data-testid="oferta-pago">
      <div class="oc-check">${ICO_CHECK}</div>
      <h2 id="oc-tit">Compra confirmada!</h2>
      <p>Seu acesso chega no ${e ? `e-mail <b>${esc(e)}</b>` : "e-mail da compra"} em até 1 minuto. Agora é só baixar o app:</p>
      <div class="oc-selos"><a href="${URL_APP_STORE}" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="144" height="48" /></a><a href="${esc(urlPlay("oferta"))}" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="124" height="48" /></a></div>
      <div class="oc-ce"><b class="t">No app, toque aqui 👇</b>
        <div class="oc-ce-app" role="img" aria-label="No app, toque em Já tenho conta? Entrar, e não em Começar"><div class="oc-ce-comecar">Começar<span class="oc-ce-nao">✕ não é aqui</span></div><div class="oc-ce-entrar">Já tenho conta? <span>Entrar</span></div><div class="oc-ce-sim">✓ é aqui</div></div>
        <p>Toque em <b>“Já tenho conta? Entrar”</b> (não em “Começar”), digite ${e ? `<b>${esc(e)}</b>` : "o e-mail da compra"} e o código de 8 números que chega nele.</p></div>
      <div class="oc-guia"><div><b>📖 Guia com fotos</b><span>Como entrar, primeiros passos e dicas.</span></div><a href="${GUIA}" data-guia>Abrir o guia</a></div>
      <p class="oc-contato">Dúvida? <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a></p>
    </div>`;
  alvo.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => o.evento("landing_loja", { loja: a.dataset.loja, onde: "stripe_pago" })));
  raiz!.querySelector<HTMLElement>(".oc-corpo")!.scrollTop = 0;
}

function lerCookie(nome: string): string | null {
  try { for (const par of (document.cookie || "").split(";")) { const i = par.indexOf("="); if (i > 0 && par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim()); } } catch { /* noop */ }
  return null;
}

/* ───────────────────────── abrir / fechar ───────────────────────── */
const aoVoltarNavegador = () => {
  if (!aberta) return;
  if (!fechandoPelaTela) opc?.evento("landing_stripe_fechado", { via: "voltar", fase: est?.fase ?? null });
  comHistorico = false; fecharJa("voltar");
};

/** saiu com o checkout aberto, sem usar o X. No Instagram o pagehide nem sempre vem: a aba escondida é o sinal que sobra. */
function saiuDaTela(via: string) {
  if (!aberta || saiuEm !== null || !est || est.fase === "pago") return;
  saiuEm = Date.now(); saidas += 1;
  const v = est.email.trim().toLowerCase();
  opc?.evento("landing_stripe_saiu", { via, fase: est.fase, metodo: metodoAtual(), email: !v ? "vazio" : EMAIL_OK.test(v) ? "valido" : "digitou", carregou: pixPronto, s_aberto: Math.round((Date.now() - abertoEm) / 1000), vez: saidas });
}
const aoMudarVisibilidade = () => {
  if (document.visibilityState === "hidden") { saiuDaTela("oculta"); return; }
  if (saiuEm === null) return;
  if (aberta) opc?.evento("landing_stripe_voltou", { s_fora: Math.round((Date.now() - saiuEm) / 1000), fase: est?.fase ?? null });
  saiuEm = null;
};
const aoSairDaPagina = () => saiuDaTela("pagehide");
function vigiarSaida(ligar: boolean) {
  if (ligar) { document.addEventListener("visibilitychange", aoMudarVisibilidade); window.addEventListener("pagehide", aoSairDaPagina); }
  else { document.removeEventListener("visibilitychange", aoMudarVisibilidade); window.removeEventListener("pagehide", aoSairDaPagina); }
}

export async function abrirCheckout(o: OpcoesCheckout): Promise<void> {
  if (aberta) return;
  opc = o;
  api = w.__ofertaApi ?? (o.producao ? apiReal : (api ?? apiSimulada()));
  focoAntes = document.activeElement as HTMLElement | null;
  if (!raiz || !document.body.contains(raiz)) raiz = montarCamada(o);
  raiz.hidden = false;
  aberta = true;
  travar();
  try { history.pushState({ ofertaCheckout: 1 }, ""); comHistorico = true; } catch { comHistorico = false; }
  window.addEventListener("popstate", aoVoltarNavegador);
  abertoEm = Date.now(); saiuEm = null; saidas = 0;
  vigiarSaida(true);
  if (!est) { const ref = refDaAba(); est = { fase: "form", ref, pi: piDaAba(ref), clientSecret: null, metodo: "pix", pix: null, email: "", cpf: "" }; }
  // só quando o e-mail do cartão da oferta mudou: quem trocou o e-mail aqui dentro, fechou e reabriu continua com o que escolheu
  if (o.emailInicial && est.fase === "form" && o.emailInicial !== ultimoEmailInicial) { est.email = o.emailInicial; ultimoEmailInicial = o.emailInicial; }
  if (o.voltaDoBanco) {
    est.pi = o.voltaDoBanco.pi;
    est.fase = "aguardando"; telaAguardando();
    const r = await api.status({ ref: est.ref, pi: est.pi }).catch(() => null);
    if (r?.pago) mostrarPago(r.metodo ?? "card");
    else if (o.voltaDoBanco.status === "failed") { est.fase = "form"; est.metodo = "card"; telaForm(); erroGeral("O banco não aprovou. Tente de novo ou use o Pix."); }
    else if (!r || r.ok === false) telaRecebido(); // ref perdida / outro navegador: não dá pra conferir daqui
    else vigiar();
  } else if (est.fase === "pix" && est.pix) telaPix();
  else if (est.fase === "pago") telaPago();
  else if (est.fase === "aguardando") { telaAguardando(); vigiar(); }
  else telaForm();
  o.evento("landing_stripe_aberto", { fase: est.fase });
  // 5 (revisão): InitiateCheckout 1× por ref (abrir e fechar várias vezes não infla)
  const chaveIc = `oferta-ic-${est.ref}`;
  let jaFoi = false; try { jaFoi = sessionStorage.getItem(chaveIc) === "1"; sessionStorage.setItem(chaveIc, "1"); } catch { /* heap */ }
  if (est.fase === "form" && !jaFoi && !icNoHeap.has(est.ref)) o.pixel("InitiateCheckout", { value: o.precoCentavos / 100, currency: "BRL", content_name: "oferta_stripe" }, `ic-${est.ref}`);
  icNoHeap.add(est.ref);
  window.setTimeout(() => { raiz?.querySelector<HTMLElement>("#oc-email, #oc-copiar, #oc-x")?.focus(); }, 30);
}

/** X / Esc: fecha pelo histórico (o "voltar" do navegador também fecha, sem sair do site) */
function pedirFechar(via: string) {
  opc?.evento("landing_stripe_fechado", { via, fase: est?.fase ?? null });
  fechandoPelaTela = true;
  if (comHistorico) { try { history.back(); return; } catch { /* cai no fechar direto */ } }
  fecharJa(via);
}
function fecharJa(_via: string) {
  if (!aberta) return;
  aberta = false;
  fechandoPelaTela = false;
  window.removeEventListener("popstate", aoVoltarNavegador);
  vigiarSaida(false);
  if (est?.fase !== "pix" && est?.fase !== "aguardando") pararVigia(); // Pix na rua: continua vigiando (pagou com a camada fechada = abre o pago)
  if (raiz) raiz.hidden = true;
  soltar();
  focoAntes?.focus?.();
}

/** testes: zera o módulo entre páginas */
export function _zerar() { pararVigia(); raiz?.remove(); raiz = null; est = null; ultimoEmailInicial = null; ultimaCriacao = null; icNoHeap.clear(); aberta = false; opc = null; api = null; stripe = null; elementos = null; elementoCartao = null; montagem += 1; pixPronto = false; cartaoPronto = false; cargaFalhou = false; cartaoFalhou = false; carteiraMedida = false; emailMedido.comecou = ""; emailMedido.valido = ""; fechandoPelaTela = false; saiuEm = null; carregandoStripe = null; soltarTeto(); trocandoPix = false; window.removeEventListener("popstate", aoVoltarNavegador); vigiarSaida(false); soltar(); }
