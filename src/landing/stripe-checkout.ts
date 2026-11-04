/**
 * /oferta (04/11) — o CHECKOUT STRIPE EM TELA CHEIA, por cima da página (a pessoa nunca sai do site). Só baixa no toque em comprar
 * (ou ocioso, depois da 1ª pintura) e só na /oferta com a chave CHECKOUT_STRIPE "on" e a pk de verdade (o <head> decide).
 *
 *   abrir   camada fixa (role=dialog, aria-modal, foco preso, scroll de trás travado), uma entrada no histórico (o "voltar" do
 *           navegador / o X / Esc fecham sem sair do site), resumo "CORE · Acesso vitalício · R$ 67,90 · pagamento único" + 3
 *           provas, e-mail (obrigatório, com a correção de domínio da landing), Stripe Payment Element (Pix + cartão; parcelas
 *           no cartão pelo installments BR) e "Pagar R$ 67,90".
 *   valor   SEMPRE do servidor: stripe-criar cria/atualiza o PaymentIntent (6790 BRL) e devolve só o client_secret.
 *   Pix     confirmPixPayment(handleActions:false) → next_action.pix_display_qr_code → QR + copia-e-cola NO NOSSO layout;
 *           espera pelo stripe-status (a cada 3 s e na volta pra aba). O webhook libera o acesso (sem depender desta aba).
 *   cartão  confirmPayment({redirect:"if_required"}) (3DS na mesma tela; banco que exige redirecionamento volta pra
 *           /oferta?payment_intent=…&redirect_status=…, que reabre aqui).
 *   pago    lojas primeiro, "Já tenho conta? Entrar" (não "Começar"), guia PDF, contato. Pixel Purchase com eventID = id do PI
 *           (a CAPI do servidor manda o mesmo event_id → a Meta conta 1).
 *
 * Testes e QA: window.__ofertaApi (no lugar das funções) e window.__stripeFalso (no lugar do Stripe.js). Fora do domínio de
 * produção, sem eles, tudo é SIMULADO (um Payment Element de mentira com Pix e cartão) — nada sai pra Stripe.
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
  evento: Evento; pixel: Pixel; atrib: Record<string, string>; sessao: string; aparelho: string; urlChegada: string; fbclid: string | null;
  voltaDoBanco?: { pi: string; status: string };
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
type ElementoPagamento = { mount: (el: HTMLElement | string) => void; on: (ev: string, cb: (e: { value?: { type?: string }; complete?: boolean }) => void) => void; destroy?: () => void };
type Elementos = { create: (tipo: "payment", o?: Record<string, unknown>) => ElementoPagamento; submit: () => Promise<{ error?: { message?: string } }> };
export type StripeLike = {
  elements: (o: Record<string, unknown>) => Elementos;
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
    criar: async () => ({ ok: true, clientSecret: "pi_sim_secret_sim", pi: "pi_sim" }),
    status: async () => ({ ok: true, status: pagoEm && Date.now() >= pagoEm ? "succeeded" : "requires_action", pago: !!pagoEm && Date.now() >= pagoEm }),
  };
}
const QR_SIM = "00020101021226870014br.gov.bcb.pix2565qr.stripe.com/pix/SIMULADO5204000053039865406" + "67.905802BR5904CORE6009SAO PAULO62070503***6304ABCD";
/** um Payment Element de mentira (dev/prints): abas Cartão | Pix, com os campos desenhados */
function stripeSimulado(api: ApiOferta): StripeLike {
  let tipo = "card";
  const el: ElementoPagamento & { cb?: (e: { value?: { type?: string } }) => void } = {
    mount: (alvo) => {
      const n = typeof alvo === "string" ? document.querySelector<HTMLElement>(alvo)! : alvo;
      n.innerHTML = `<div class="oc-sim" data-testid="oferta-pe-simulado">
        <div class="oc-sim-abas" role="tablist"><button type="button" role="tab" data-t="card" aria-selected="true">💳 Cartão</button><button type="button" role="tab" data-t="pix" aria-selected="false">◆ Pix</button></div>
        <div class="oc-sim-card"><label>Número do cartão<input placeholder="1234 1234 1234 1234" inputmode="numeric" /></label><div class="oc-sim-2"><label>Validade<input placeholder="MM / AA" /></label><label>CVC<input placeholder="CVC" /></label></div><label>Parcelas<select><option>1x de R$ 67,90 sem juros</option><option>2x</option><option>3x</option><option>12x</option></select></label></div>
        <div class="oc-sim-pix" hidden><p>Ao pagar, o QR do Pix aparece aqui. Vale por 30 minutos.</p></div>
      </div>`;
      n.querySelectorAll<HTMLButtonElement>("[data-t]").forEach((b) => b.addEventListener("click", () => {
        tipo = b.dataset.t!;
        n.querySelectorAll<HTMLButtonElement>("[data-t]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
        (n.querySelector(".oc-sim-card") as HTMLElement).hidden = tipo !== "card";
        (n.querySelector(".oc-sim-pix") as HTMLElement).hidden = tipo !== "pix";
        el.cb?.({ value: { type: tipo } });
      }));
    },
    on: (ev, cb) => { if (ev === "change") el.cb = cb; },
  };
  return {
    elements: () => ({ create: () => el, submit: async () => ({}) }),
    confirmPayment: async () => ({ paymentIntent: { id: "pi_sim", status: "succeeded" } }),
    confirmPixPayment: async () => {
      void api;
      return { paymentIntent: { id: "pi_sim", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR_SIM, expires_at: Math.floor(Date.now() / 1000) + 1800 } } } };
    },
  };
}

let carregandoStripe: Promise<StripeLike> | null = null;
/** Stripe.js de https://js.stripe.com/v3 (a Stripe exige carregar de lá; só na /oferta, só no checkout) */
function stripeDeVerdade(pk: string): Promise<StripeLike> {
  if (carregandoStripe) return carregandoStripe;
  carregandoStripe = new Promise<StripeLike>((ok, falha) => {
    const pronto = () => (w.Stripe ? ok(w.Stripe(pk, { locale: "pt-BR" })) : falha(new Error("sem Stripe")));
    if (w.Stripe) return pronto();
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3"; s.async = true;
    s.onload = pronto; s.onerror = () => { carregandoStripe = null; falha(new Error("stripe.js não carregou")); };
    document.head.appendChild(s);
  });
  return carregandoStripe;
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
.oc-pe{margin-top:16px;min-height:120px}
.oc-pe-carregando{display:grid;place-items:center;height:120px;font-size:13.5px;color:var(--suave,#6b6670)}
.oc-cta{width:100%;min-height:56px;margin-top:18px;border:0;border-radius:16px;background:var(--grafite,#262626);color:#fff;font-size:17px;font-weight:800;font-family:inherit;box-shadow:0 8px 20px -6px rgba(0,0,0,.35)}
.oc-cta[aria-busy="true"]{opacity:.7;pointer-events:none}
.oc-miuda{margin:12px 0 0;text-align:center;font-size:12px;color:var(--suave,#6b6670)}
.oc-sim{border:1.5px solid #e4e0e7;border-radius:14px;padding:12px}
.oc-sim-abas{display:flex;gap:8px;margin-bottom:12px}
.oc-sim-abas button{flex:1;height:44px;border-radius:10px;border:1.5px solid #e4e0e7;background:#fff;font:inherit;font-weight:700;font-size:14px}
.oc-sim-abas button[aria-selected="true"]{border-color:var(--magenta,#d6338a);color:var(--magenta,#d6338a)}
.oc-sim label{display:block;font-size:12.5px;font-weight:600;color:var(--suave,#6b6670);margin-top:8px}
.oc-sim input,.oc-sim select{display:block;width:100%;height:44px;margin-top:4px;border-radius:10px;border:1.5px solid #e4e0e7;padding:0 12px;font:inherit;font-size:15px;background:#fff}
.oc-sim-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.oc-sim-pix p{margin:0;font-size:14px;color:var(--suave,#6b6670)}
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

type Fase = "form" | "pix" | "aguardando" | "pago" | "recebido";
/** o CPF fica SÓ na memória desta página (nada de storage, evento ou log) e vai só pro stripe-criar */
type Estado = { fase: Fase; ref: string; pi: string | null; clientSecret: string | null; metodo: string; pix: PixQr | null; email: string; cpf: string };

let raiz: HTMLElement | null = null;
let opc: OpcoesCheckout | null = null;
let api: ApiOferta | null = null;
let stripe: StripeLike | null = null;
let elementos: Elementos | null = null;
let est: Estado | null = null;
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
  alvo.innerHTML = `
    <div class="oc-resumo" data-testid="oferta-resumo"><div><h2 id="oc-tit">CORE · Acesso vitalício</h2><p>Pagamento único · nada é cobrado depois</p></div><div class="oc-preco">${esc(preco())}</div></div>
    <ul class="oc-provas"><li>As 16 áreas da vida num app só</li><li>iPhone, Android e computador, com a mesma conta</li><li>7 dias de garantia: não gostou, devolvemos 100%</li></ul>
    <label class="oc-rot" for="oc-email">Seu e-mail <span>· é por onde você entra no CORE</span></label>
    <input class="oc-campo" id="oc-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" placeholder="voce@email.com" value="${esc(est!.email)}" />
    <button type="button" class="oc-sug" id="oc-sug" hidden></button>
    <p class="oc-erro" id="oc-email-erro" role="alert" hidden></p>
    ${o.pedeCpf ? `<label class="oc-rot" for="oc-cpf">CPF <span>· pra nota fiscal</span></label>
    <input class="oc-campo" id="oc-cpf" type="text" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" value="${esc(mascararCpf(est!.cpf))}" />
    <p class="oc-erro" id="oc-cpf-erro" role="alert" hidden></p>` : ""}
    <div class="oc-pe" id="oc-pe"><div class="oc-pe-carregando">Carregando o pagamento…</div></div>
    <p class="oc-erro" id="oc-erro" role="alert" hidden></p>
    <button type="button" class="oc-cta" id="oc-pagar">Pagar ${esc(preco())}</button>
    <p class="oc-miuda">Pix ou cartão${o.parcelasMax > 1 ? ` em até ${o.parcelasMax}x` : ""} · processado pela Stripe · CORE · CNPJ 55.041.112/0001-82</p>`;
  const campo = alvo.querySelector<HTMLInputElement>("#oc-email")!;
  const sug = alvo.querySelector<HTMLButtonElement>("#oc-sug")!;
  const atualizarSug = () => {
    const s = sugestaoDeEmail(campo.value);
    if (s) { sug.hidden = false; sug.textContent = `Você quis dizer ${s}?`; sug.dataset.s = s; } else { sug.hidden = true; delete sug.dataset.s; }
  };
  campo.addEventListener("input", () => { est!.email = campo.value; erroEmail(null); atualizarSug(); });
  campo.addEventListener("blur", atualizarSug);
  sug.addEventListener("click", () => { campo.value = sug.dataset.s ?? campo.value; est!.email = campo.value; sug.hidden = true; o.evento("landing_email_antes_sugestao", { onde: "stripe" }); });
  const cpf = alvo.querySelector<HTMLInputElement>("#oc-cpf");
  cpf?.addEventListener("input", () => { const m = mascararCpf(cpf.value); if (cpf.value !== m) cpf.value = m; est!.cpf = soDigitosCpf(m); erroCpf(null); });
  alvo.querySelector("#oc-pagar")!.addEventListener("click", () => { void pagar(); });
  void montarElemento();
}

function erroEmail(m: string | null) { const e = raiz?.querySelector<HTMLElement>("#oc-email-erro"); if (e) { e.hidden = !m; e.textContent = m ?? ""; } }
function erroCpf(m: string | null) { const e = raiz?.querySelector<HTMLElement>("#oc-cpf-erro"); if (e) { e.hidden = !m; e.textContent = m ?? ""; } }
function erroGeral(m: string | null) { const e = raiz?.querySelector<HTMLElement>("#oc-erro"); if (e) { e.hidden = !m; e.textContent = m ?? ""; } }

async function garantirIntento(email: string | null, cpf: string | null = null): Promise<boolean> {
  const o = opc!;
  const r = await api!.criar({
    ref: est!.ref, pi: est!.pi, email, pagina: "oferta", ...(cpf ? { cpf } : {}),
    fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc"), fbclid: o.fbclid, url: o.urlChegada.slice(0, 500),
    landing_session_id: o.sessao, landing_device_id: o.aparelho, atrib: o.atrib,
  }).catch(() => ({ ok: false } as RespostaCriar));
  if (!r.ok || !r.clientSecret) { o.evento("landing_erro", { onde: "stripe_criar", msg: String(r.erro ?? "falhou").slice(0, 80) }); return false; }
  est!.clientSecret = r.clientSecret; est!.pi = r.pi ?? est!.pi;
  if (est!.pi) guardarPi(est!.ref, est!.pi);
  ultimaCriacao = r;
  return true;
}

async function montarElemento() {
  const o = opc!;
  const caixa = raiz!.querySelector<HTMLElement>("#oc-pe")!;
  if (!(await garantirIntento(null))) { caixa.innerHTML = ""; erroGeral("Não consegui abrir o pagamento agora. Tente de novo em instantes."); return; }
  // 2 (revisão): a recarga reaproveitou o PI — Pix já gerado volta com o MESMO QR; já pago vai pro pago
  if (ultimaCriacao?.status === "succeeded") { mostrarPago(est!.metodo); return; }
  if (ultimaCriacao?.pix && (ultimaCriacao.pix.data || ultimaCriacao.pix.image_url_png)) { est!.pix = ultimaCriacao.pix; est!.metodo = "pix"; est!.fase = "pix"; telaPix(); return; }
  try {
    stripe = w.__stripeFalso ?? (o.producao ? await stripeDeVerdade(o.pk) : stripeSimulado(api!));
  } catch {
    caixa.innerHTML = ""; erroGeral("O pagamento não carregou. Confira a internet e tente de novo."); o.evento("landing_erro", { onde: "stripe_js" }); return;
  }
  elementos = stripe.elements({
    clientSecret: est!.clientSecret, locale: "pt-BR",
    appearance: { theme: "stripe", variables: { colorPrimary: "#d6338a", colorText: "#1c1a1f", borderRadius: "12px", fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif" } },
    fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" }],
  });
  const pe = elementos.create("payment", { layout: { type: "tabs", defaultCollapsed: false }, paymentMethodOrder: ["pix", "card"], fields: { billingDetails: { email: "never" } }, wallets: { applePay: "never", googlePay: "never" } });
  caixa.innerHTML = "";
  pe.mount(caixa);
  pe.on("change", (e) => { if (e.value?.type) { est!.metodo = e.value.type; o.evento("landing_stripe_metodo", { metodo: e.value.type }); } });
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
  if (!stripe || !elementos || !est.clientSecret) { erroGeral("O pagamento ainda está carregando. Tente de novo em instantes."); return; }
  pagando = true;
  const botao = raiz!.querySelector<HTMLButtonElement>("#oc-pagar")!;
  botao.setAttribute("aria-busy", "true"); botao.textContent = "Processando…";
  erroGeral(null);
  est.email = email;
  try {
    o.evento("landing_stripe_pagar", { metodo: est.metodo });
    if (!(await garantirIntento(email, cpf))) { erroGeral("Não consegui registrar o pagamento. Tente de novo em instantes."); return; }
    const sub = await elementos.submit();
    if (sub?.error) { erroGeral(sub.error.message ?? "Confira os dados do pagamento."); return; }
    if (est.metodo === "pix") {
      const r = await stripe.confirmPixPayment(est.clientSecret!, { payment_method: { billing_details: { email } } }, { handleActions: false });
      if (r.error) { erroGeral(r.error.message ?? "Não deu pra gerar o Pix. Tente de novo."); o.evento("landing_erro", { onde: "stripe_pix", msg: String(r.error.code ?? "").slice(0, 40) }); return; }
      const qr = r.paymentIntent?.next_action?.pix_display_qr_code;
      if (r.paymentIntent?.status === "succeeded") return mostrarPago("pix");
      if (!qr?.data && !qr?.image_url_png) { erroGeral("Não deu pra mostrar o Pix. Tente de novo."); return; }
      est.pix = qr; est.fase = "pix";
      o.evento("landing_stripe_pix_gerado", { pi: est.pi });
      telaPix();
      return;
    }
    const retorno = new URL(location.href); retorno.search = ""; retorno.hash = "";
    for (const [k, v] of new URLSearchParams(location.search)) if (!/^(payment_intent|payment_intent_client_secret|redirect_status)$/.test(k)) retorno.searchParams.set(k, v);
    const r = await stripe.confirmPayment({ elements: elementos, clientSecret: est.clientSecret, redirect: "if_required", confirmParams: { return_url: retorno.toString(), payment_method_data: { billing_details: { email } } } });
    if (r.error) { erroGeral(r.error.message ?? "O pagamento não passou. Confira os dados ou tente outro cartão."); o.evento("landing_stripe_recusado", { tipo: String(r.error.type ?? ""), code: String(r.error.code ?? "") }); return; }
    const st = r.paymentIntent?.status;
    if (st === "succeeded") return mostrarPago("card");
    est.fase = "aguardando"; telaAguardando(); vigiar();
  } finally {
    pagando = false;
    const b = raiz?.querySelector<HTMLButtonElement>("#oc-pagar");
    if (b) { b.removeAttribute("aria-busy"); b.textContent = `Pagar ${preco()}`; }
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
    </div>`;
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
  }
  try { sessionStorage.removeItem(CHAVE_REF); sessionStorage.removeItem(CHAVE_PI); } catch { /* noop */ }
  o.evento("landing_stripe_pago", { metodo, pi: est.pi });
  if (est.pi) o.pixel("Purchase", { value: o.precoCentavos / 100, currency: "BRL", content_name: "oferta_stripe" }, est.pi);
  const e = est.email;
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
const aoVoltarNavegador = () => { if (aberta) { comHistorico = false; fecharJa("voltar"); } };

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
  if (!est) { const ref = refDaAba(); est = { fase: "form", ref, pi: piDaAba(ref), clientSecret: null, metodo: "card", pix: null, email: "", cpf: "" }; }
  if (o.voltaDoBanco) {
    est.pi = o.voltaDoBanco.pi;
    est.fase = "aguardando"; telaAguardando();
    const r = await api.status({ ref: est.ref, pi: est.pi }).catch(() => null);
    if (r?.pago) mostrarPago(r.metodo ?? "card");
    else if (o.voltaDoBanco.status === "failed") { est.fase = "form"; telaForm(); erroGeral("O banco não aprovou. Tente de novo ou use o Pix."); }
    else if (!r || r.ok === false) telaRecebido(); // ref perdida / outro navegador: não dá pra conferir daqui
    else vigiar();
  } else if (est.fase === "pix" && est.pix) telaPix();
  else if (est.fase === "pago") { est.fase = "form"; telaForm(); }
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
  if (comHistorico) { try { history.back(); return; } catch { /* cai no fechar direto */ } }
  fecharJa(via);
}
function fecharJa(_via: string) {
  if (!aberta) return;
  aberta = false;
  window.removeEventListener("popstate", aoVoltarNavegador);
  if (est?.fase !== "pix" && est?.fase !== "aguardando") pararVigia(); // Pix na rua: continua vigiando (pagou com a camada fechada = abre o pago)
  if (raiz) raiz.hidden = true;
  soltar();
  focoAntes?.focus?.();
}

/** testes: zera o módulo entre páginas */
export function _zerar() { pararVigia(); raiz?.remove(); raiz = null; est = null; ultimaCriacao = null; icNoHeap.clear(); aberta = false; opc = null; api = null; stripe = null; elementos = null; window.removeEventListener("popstate", aoVoltarNavegador); soltar(); }
