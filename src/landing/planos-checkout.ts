/**
 * /escolha (18/11, chave PLANOS_PAGINA no <head>) — o CHECKOUT EM TELA CHEIA da página dos 2 planos. A mesma cara do checkout da /oferta
 * (o CSS dela, ./stripe-checkout.ts), com o plano escolhido em cima e as AÇÕES do servidor (stripe-criar com pagina "planos"):
 *
 *   vitalício R$ 97,90   Pix (acao "pix": o servidor gera o QR) ou cartão até 12x (acao "cartao": o cartão vira um PaymentMethod aqui,
 *                        o servidor confere as parcelas que ESTE cartão aceita e confirma; 3DS = handleNextAction).
 *   mensal R$ 34,90/mês  cartão (acao "assinar": Subscription da Stripe) ou — só com PLANOS_PIX_MENSAL "on" — Pix Automático
 *                        (acao "assinar_pix": a Subscription com mandato; aqui o confirmPixPayment(client_secret) mostra o QR).
 *
 * O VALOR é sempre do servidor (a tabela de ofertas). Quem libera o acesso é o stripe-webhook. Esta tela só mostra o estado e, no pago,
 * dispara o Purchase do navegador com o MESMO eventID da CAPI (vitalício = PI, mensal = assinatura) e o valor real do plano.
 * Apple Pay / Google Pay: o Payment Element de cartão com wallets "auto" (a carteira vira um cartão: o mesmo caminho).
 *
 * MEDIÇÃO (nenhum evento leva e-mail; o evento() da landing põe pagina "planos", utm/ad e os braços em todos):
 *   landing_stripe_aberto {fase, plano}         landing_plano {plano, onde:"checkout", via:"toque"}
 *   landing_stripe_metodo {metodo, plano}       landing_stripe_pagar {metodo, plano, parcelas}
 *   landing_stripe_pix_gerado {pi, plano}       landing_stripe_pago {metodo, plano, pi, sub, parcelas}
 *   landing_stripe_pagar_erro {metodo, plano, etapa, code}   landing_stripe_recusado {plano, code}
 *   landing_stripe_fechado {via, fase}          landing_stripe_email_comecou / _valido
 *
 * Testes e QA: window.__planosApi (no lugar das funções) e window.__planosStripe (no lugar do Stripe.js). Fora do domínio de produção,
 * sem eles, tudo é SIMULADO (nada sai pra Stripe): o Pix "cai" com window.__planosSimPagar() ou sozinho em 8 s; cartão = pago.
 */
import { EMAIL_OK, URL_APP_STORE, sugestaoDeEmail, urlPlay } from "./regras";
import { CSS } from "./stripe-checkout";
import { eventIdDaCompra, reaisPlanos, textoParcela, valorDoPlano, type Plano } from "./planos-regras";

export type { Plano } from "./planos-regras";
export type Evento = (nome: string, dados?: Record<string, unknown>) => void;
export type Pixel = (ev: string, params?: Record<string, unknown>, eventID?: string) => void;
export type CompraPlanos = { ref: string; pi: string; plano: Plano; metodo: string; email: string | null };
export type OpcoesPlanos = {
  pk: string; producao: boolean; plano: Plano;
  vitalicioCentavos: number; mensalCentavos: number; parcelasMax: number;
  /** PLANOS_PIX_MENSAL: o botão Pix no mensal (Pix Automático) */
  pixMensal: boolean;
  evento: Evento; pixel: Pixel; atrib: Record<string, string>; sessao: string; aparelho: string; urlChegada: string; fbclid: string | null;
  voltaDoBanco?: { pi: string; status: string };
  /** a folha do indique e ganhe no pós-pago (só no vitalício — o link é de quem comprou o vitalício) */
  indique?: { abrir: (c: CompraPlanos) => void };
};

type PixQr = { data?: string; image_url_png?: string; expires_at?: number };
export type RespostaAcao = {
  ok: boolean; pago?: boolean; plano?: Plano; pi?: string; sub?: string; pix?: PixQr | null; mesmo?: boolean; acao?: boolean; client_secret?: string;
  processando?: boolean; recusado?: boolean; code?: string; erro?: string; max?: number; metodo?: string;
};
export type RespostaStatus = { ok: boolean; status?: string; pago?: boolean; metodo?: string | null };
export type ApiPlanos = {
  acao: (corpo: Record<string, unknown>) => Promise<RespostaAcao>;
  status: (corpo: { ref: string; pi: string }) => Promise<RespostaStatus>;
};
type ErroStripe = { message?: string; type?: string; code?: string };
type IntentoStripe = { id?: string; status?: string; next_action?: { type?: string; pix_display_qr_code?: PixQr } | null };
type ResultadoStripe = { error?: ErroStripe; paymentIntent?: IntentoStripe };
type ElementoPagamento = { mount: (el: HTMLElement) => void; on: (ev: string, cb: (e: { error?: ErroStripe }) => void) => void; destroy?: () => void };
type Elementos = { create: (tipo: "payment", o?: Record<string, unknown>) => ElementoPagamento; submit: () => Promise<{ error?: ErroStripe }> };
export type StripePlanos = {
  elements: (o: Record<string, unknown>) => Elementos;
  createPaymentMethod: (o: Record<string, unknown>) => Promise<{ error?: ErroStripe; paymentMethod?: { id: string } }>;
  handleNextAction: (o: { clientSecret: string }) => Promise<ResultadoStripe>;
  confirmPixPayment: (clientSecret: string, dados?: Record<string, unknown>, opcoes?: Record<string, unknown>) => Promise<ResultadoStripe>;
};
type Janela = Window & { __planosApi?: ApiPlanos; __planosStripe?: StripePlanos; __planosSimPagar?: () => void; Stripe?: (pk: string, o?: Record<string, unknown>) => StripePlanos };
const w = window as Janela;

const FUNCOES = "https://itoylenzvahbscgjgtqf.supabase.co/functions/v1";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const GUIA = "https://www.coreaplicativo.com.br/guia/core-comece-aqui.pdf";
const CHAVE_PEDIDO = "planos-pedido";
const TETO_MS = 15_000;
const STRIPE_JS_TETO_MS = 12_000;
const VIGIA_MAX_MS = 120_000;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const novoId = () => { try { return crypto.randomUUID(); } catch { return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };

/* ───────── o pedido desta aba (sessionStorage): ref + o que já existe no servidor. Pago = apaga. Nunca o e-mail. ───────── */
type Pedido = { ref: string; plano?: Plano; pi?: string | null; sub?: string | null; metodo?: string | null };
function lerPedido(): Pedido {
  try {
    const j = JSON.parse(sessionStorage.getItem(CHAVE_PEDIDO) || "null") as Pedido | null;
    if (j && typeof j.ref === "string" && /^[A-Za-z0-9-]{8,64}$/.test(j.ref)) return j;
  } catch { /* novo */ }
  const p = { ref: novoId() };
  gravarPedido(p);
  return p;
}
function gravarPedido(p: Pedido) { try { sessionStorage.setItem(CHAVE_PEDIDO, JSON.stringify(p)); } catch { /* fica no heap */ } }
function apagarPedido() { try { sessionStorage.removeItem(CHAVE_PEDIDO); } catch { /* noop */ } }

/* ───────── a API (as edge functions) ───────── */
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
async function postar(fn: string, corpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = tokenDaSessao();
  let teto = 0;
  const estourou = new Promise<Response | null>((ok) => { teto = window.setTimeout(() => ok(null), TETO_MS); });
  const r = await Promise.race([
    fetch(`${FUNCOES}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token ?? ANON}` }, body: JSON.stringify(corpo) }).catch(() => null),
    estourou,
  ]).finally(() => window.clearTimeout(teto));
  if (!r) return { ok: false, erro: "rede" };
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return r.ok ? j : { ...j, ok: j.ok === true };
}
const apiReal: ApiPlanos = {
  acao: async (c) => (await postar("stripe-criar", { ...c, pagina: "planos" })) as RespostaAcao,
  status: async (c) => (await postar("stripe-status", c)) as RespostaStatus,
};
const QR_SIM = "00020101021226870014br.gov.bcb.pix2565qr.stripe.com/pix/SIMULADO-PLANOS5204000053039865406" + "97.905802BR5904CORE6009SAO PAULO62070503***6304ABCD";
/** fora do domínio de produção: nada sai pra Stripe. O Pix simulado "cai" com __planosSimPagar() ou 8 s depois. */
function apiSimulada(): ApiPlanos {
  let geradoEm: number | null = null;
  let pagoJa = false;
  w.__planosSimPagar = () => { pagoJa = true; };
  return {
    acao: async (c) => {
      await new Promise((ok) => window.setTimeout(ok, 500));
      const plano: Plano = c.acao === "assinar" || c.acao === "assinar_pix" ? "mensal" : "vitalicio";
      if (c.acao === "pix") { geradoEm = Date.now(); return { ok: true, plano, pi: "pi_simplanos", pix: { data: QR_SIM, expires_at: Math.floor(Date.now() / 1000) + 1800 } }; }
      if (c.acao === "assinar_pix") { geradoEm = Date.now(); return { ok: true, plano, pi: "pi_simplanosmensal", sub: "sub_simplanos", client_secret: "pi_simplanosmensal_secret_sim" }; }
      return { ok: true, pago: true, plano, pi: "pi_simplanoscartao", ...(plano === "mensal" ? { sub: "sub_simplanos" } : {}) };
    },
    status: async () => {
      const pago = pagoJa || (geradoEm !== null && Date.now() - geradoEm > 8000);
      return { ok: true, status: pago ? "succeeded" : "requires_action", pago, metodo: "pix" };
    },
  };
}
/** um Element de cartão de mentira (dev/prints) */
function stripeSimulado(): StripePlanos {
  let pronto: (() => void) | undefined;
  const el: ElementoPagamento = {
    mount: (n) => {
      n.innerHTML = `<div class="oc-sim" data-testid="planos-pe-simulado"><label>Número do cartão<input placeholder="1234 1234 1234 1234" inputmode="numeric" /></label><div class="oc-sim-2"><label>Validade<input placeholder="MM / AA" /></label><label>CVC<input placeholder="CVC" /></label></div></div>`;
      window.setTimeout(() => pronto?.(), 0);
    },
    on: (ev, cb) => { if (ev === "ready") pronto = () => cb({}); },
  };
  return {
    elements: () => ({ create: () => el, submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_simplanos" } }),
    handleNextAction: async () => ({ paymentIntent: { id: "pi_simplanoscartao", status: "succeeded" } }),
    confirmPixPayment: async () => ({ paymentIntent: { id: "pi_simplanosmensal", status: "requires_action", next_action: { type: "pix_display_qr_code", pix_display_qr_code: { data: QR_SIM, expires_at: Math.floor(Date.now() / 1000) + 1800 } } } }),
  };
}
let carregandoStripe: Promise<StripePlanos> | null = null;
function stripeDeVerdade(pk: string): Promise<StripePlanos> {
  if (carregandoStripe) return carregandoStripe;
  carregandoStripe = new Promise<StripePlanos>((ok, falha) => {
    if (w.Stripe) return ok(w.Stripe(pk, { locale: "pt-BR" }));
    const ja = document.querySelector<HTMLScriptElement>('script[src^="https://js.stripe.com/v3"]');
    const s = ja ?? document.createElement("script");
    let teto = 0;
    const desistir = () => { window.clearTimeout(teto); s.remove(); carregandoStripe = null; falha(new Error("stripe.js não carregou")); };
    s.addEventListener("load", () => { window.clearTimeout(teto); if (w.Stripe) ok(w.Stripe(pk, { locale: "pt-BR" })); else desistir(); });
    s.addEventListener("error", desistir);
    teto = window.setTimeout(desistir, STRIPE_JS_TETO_MS);
    if (ja) return;
    s.src = "https://js.stripe.com/v3"; s.async = true;
    document.head.appendChild(s);
  });
  return carregandoStripe;
}
/** chamado ocioso quando a oferta aparece (só produção; falhou = tenta de novo ao abrir) */
export function preaquecerPlanos(pk: string, producao: boolean): void {
  if (!producao || w.__planosStripe) return;
  void stripeDeVerdade(pk).catch(() => null);
}

/* ───────── a camada ───────── */
const CSS_PLANOS = `
.pc-planos{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}
.pc-plano{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:62px;padding:10px 12px;border-radius:14px;border:1.5px solid #d9d4dd;background:#fff;color:inherit;font-family:inherit;text-align:left}
.pc-plano b{font-size:15px;font-weight:800}.pc-plano span{font-size:13.5px;color:var(--suave,#6b6670);font-weight:600}
.pc-plano[aria-checked="true"]{border:2px solid var(--magenta,#d6338a);background:#fdf2f8}
.pc-plano[aria-checked="true"] span{color:var(--magenta,#d6338a)}
.pc-parcelas{margin-top:12px}
.pc-parcelas label{display:block;margin:0 0 6px;font-size:14px;font-weight:700}
.pc-parcelas select{width:100%;height:50px;border-radius:12px;border:1.5px solid #d9d4dd;padding:0 12px;font:inherit;font-size:16px;background:#fff;color:inherit}
.pc-nota{margin:10px 0 0;font-size:13px;line-height:1.4;color:var(--suave,#6b6670)}
.pc-abrir{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:16px;border-radius:14px;background:var(--grafite,#262626);color:#fff;font-size:16px;font-weight:800;text-decoration:none}
.oc-preco small{font-size:14px;font-weight:700;color:var(--suave,#6b6670);letter-spacing:0}
.pc-voltar{display:block;min-height:44px;margin:10px auto 0;padding:0 12px;border:0;background:none;font-family:inherit;font-size:14.5px;font-weight:700;color:var(--tx,#1c1a1f);text-decoration:underline}
`;
const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_CADEADO = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const ICO_PIX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/><path d="M7.4 12H9l3-3 3 3h1.6M9 12l3 3 3-3"/></svg>';
const ICO_CARTAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/></svg>';

type Fase = "form" | "pix" | "aguardando" | "pago" | "recebido";
type Metodo = "pix" | "card";
type Estado = { fase: Fase; plano: Plano; metodo: Metodo; parcelas: number; email: string; pix: PixQr | null; pi: string | null; sub: string | null; ref: string; pagoMetodo: string | null; pagoPlano: Plano | null };

let raiz: HTMLElement | null = null;
let opc: OpcoesPlanos | null = null;
let api: ApiPlanos | null = null;
let stripe: StripePlanos | null = null;
let elementos: Elementos | null = null;
let elemento: ElementoPagamento | null = null;
let est: Estado | null = null;
let aberta = false;
let pagando = false;
let montagem = 0;
let stripePronto = false;
let cartaoPronto = false;
let cargaFalhou = false;
let consulta: number | null = null;
let vigiaDesde = 0;
let comHistorico = false;
let fechandoPelaTela = false;
let yAntes = 0;
const emailMedido = { comecou: "", valido: "" };
const icFeito = new Set<string>();

export const estaAberto = () => aberta;
export const estadoAtual = () => (est ? { ...est } : null);

const precos = () => ({ vitalicio: opc!.vitalicioCentavos, mensal: opc!.mensalCentavos });
const valor = (p: Plano = est!.plano) => valorDoPlano(p, precos());
const precoTxt = (p: Plano = est!.plano) => reaisPlanos(valor(p)) + (p === "mensal" ? "/mês" : "");
/** o preço no resumo: o "/mês" pequeno (senão o título quebra em 3 linhas no celular) */
const precoHtml = (p: Plano = est!.plano) => esc(reaisPlanos(valor(p))) + (p === "mensal" ? "<small>/mês</small>" : "");
const pixLiberado = () => est!.plano === "vitalicio" || opc!.pixMensal;

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

function montarCamada(): HTMLElement {
  if (!document.getElementById("oc-estilo")) { const st = document.createElement("style"); st.id = "oc-estilo"; st.textContent = CSS; document.head.appendChild(st); }
  if (!document.getElementById("pc-estilo")) { const st = document.createElement("style"); st.id = "pc-estilo"; st.textContent = CSS_PLANOS; document.head.appendChild(st); }
  const el = document.createElement("div");
  el.className = "oc"; el.id = "pc";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "pc-tit");
  el.innerHTML = `
    <div class="oc-barra"><b>CORE</b><span>${ICO_CADEADO}Pagamento seguro</span><button type="button" class="oc-x" id="pc-x" aria-label="Fechar o pagamento">×</button></div>
    <div class="oc-corpo"><div class="oc-in" id="pc-in"></div></div>`;
  document.body.appendChild(el);
  el.querySelector("#pc-x")!.addEventListener("click", () => pedirFechar("x"));
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); pedirFechar("esc"); } });
  return el;
}
const alvo = () => raiz!.querySelector<HTMLElement>("#pc-in")!;

/* ───────── o formulário ───────── */
function telaForm() {
  const o = opc!, e = est!;
  if (!pixLiberado()) e.metodo = "card";
  const max = Math.max(1, Math.min(12, Math.floor(o.parcelasMax)));
  if (e.parcelas > max) e.parcelas = max;
  const opcoesParcelas = Array.from({ length: max }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === e.parcelas ? " selected" : ""}>${n === 1 ? `1x de ${esc(reaisPlanos(valor("vitalicio")))} (à vista)` : `${esc(textoParcela(valor("vitalicio"), n))} · total ${esc(reaisPlanos(valor("vitalicio")))}`}</option>`).join("");
  const mensal = e.plano === "mensal";
  alvo().innerHTML = `
    <div class="pc-planos" role="radiogroup" aria-label="Plano">
      <button type="button" class="pc-plano" role="radio" data-pc-plano="vitalicio" aria-checked="${!mensal}"><b>Vitalício</b><span>${esc(reaisPlanos(valor("vitalicio")))}</span></button>
      <button type="button" class="pc-plano" role="radio" data-pc-plano="mensal" aria-checked="${mensal}"><b>Mensal</b><span>${esc(reaisPlanos(valor("mensal")))}/mês</span></button>
    </div>
    <div class="oc-resumo" data-testid="planos-resumo"><div><h2 id="pc-tit">${mensal ? "CORE · Mensal" : "CORE · Acesso vitalício"}</h2><p>${mensal ? "Renova todo mês · cancele quando quiser" : "Pagamento único · nada é cobrado depois"}</p></div><div class="oc-preco">${precoHtml()}</div></div>
    <ul class="oc-provas"><li>As 16 áreas da vida num app só</li><li>iPhone, Android e computador, com a mesma conta</li><li>7 dias de garantia: não gostou, devolvemos 100%</li></ul>
    <label class="oc-rot" for="pc-email">Seu e-mail <span>· é por onde você entra no CORE</span></label>
    <input class="oc-campo" id="pc-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" placeholder="voce@email.com" value="${esc(e.email)}" />
    <button type="button" class="oc-sug" id="pc-sug" hidden></button>
    <p class="oc-erro" id="pc-email-erro" role="alert" hidden></p>
    ${pixLiberado() ? `<div class="oc-metodos" role="radiogroup" aria-label="Forma de pagamento">
      <button type="button" class="oc-metodo" role="radio" data-metodo="pix" aria-checked="false">${ICO_PIX}Pix</button>
      <button type="button" class="oc-metodo" role="radio" data-metodo="card" aria-checked="false">${ICO_CARTAO}Cartão</button>
    </div>` : `<p class="oc-rot" id="pc-so-cartao">Cartão de crédito</p>`}
    <div class="oc-pagamento">
      <div class="oc-painel-pix" id="pc-painel-pix">${mensal
        ? "<b>Pix Automático</b><p>Você paga a 1ª mensalidade agora e autoriza o débito mensal no app do seu banco. Cancela quando quiser.</p>"
        : "<b>Pix copia e cola</b><p>Aprovado na hora. Você copia o código e paga no app do seu banco.</p>"}</div>
      <div class="oc-pe-carregando" id="pc-pe-carregando" hidden>Carregando o pagamento…</div>
      <div class="oc-pe" id="pc-pe" data-oculto></div>
      ${mensal ? "" : `<div class="pc-parcelas" id="pc-parcelas" hidden><label for="pc-parcelas-sel">Parcelas</label><select id="pc-parcelas-sel">${opcoesParcelas}</select></div>`}
      ${mensal ? `<p class="pc-nota" id="pc-nota-mensal">${esc(reaisPlanos(valor("mensal")))} por mês${pixLiberado() ? "" : " no cartão"}. Renova sozinho até você cancelar; cancelou, o acesso vai até o fim do mês pago.</p>` : ""}
    </div>
    <p class="oc-erro" id="pc-erro" role="alert" hidden></p>
    <button type="button" class="oc-cta" id="pc-pagar"></button>
    <p class="oc-miuda">${mensal ? "Assinatura mensal" : `Pix ou cartão em até ${max}x`} · processado pela Stripe · CORE · CNPJ 55.041.112/0001-82</p>`;
  const a = alvo();
  const campo = a.querySelector<HTMLInputElement>("#pc-email")!;
  const sug = a.querySelector<HTMLButtonElement>("#pc-sug")!;
  const atualizarSug = () => { const s = sugestaoDeEmail(campo.value); if (s) { sug.hidden = false; sug.textContent = `Você quis dizer ${s}?`; sug.dataset.s = s; } else { sug.hidden = true; delete sug.dataset.s; } };
  campo.addEventListener("input", () => { e.email = campo.value; erroEmail(null); atualizarSug(); medirEmail(); });
  campo.addEventListener("blur", atualizarSug);
  sug.addEventListener("click", () => { campo.value = sug.dataset.s ?? campo.value; e.email = campo.value; sug.hidden = true; o.evento("landing_email_antes_sugestao", { onde: "planos" }); medirEmail(); });
  a.querySelectorAll<HTMLButtonElement>("[data-pc-plano]").forEach((b) => b.addEventListener("click", () => trocarPlano(b.dataset.pcPlano as Plano)));
  a.querySelectorAll<HTMLButtonElement>("[data-metodo]").forEach((b) => b.addEventListener("click", () => tocouMetodo(b.dataset.metodo as Metodo)));
  a.querySelector<HTMLSelectElement>("#pc-parcelas-sel")?.addEventListener("change", (ev) => { e.parcelas = Number((ev.target as HTMLSelectElement).value) || 1; o.evento("landing_stripe_parcelas", { plano: e.plano, parcelas: e.parcelas }); atualizarPagar(); });
  a.querySelector("#pc-pagar")!.addEventListener("click", () => { void tocouPagar(); });
  mostrarMetodo();
  void montarElemento();
}

function trocarPlano(p: Plano) {
  if (!est || pagando || est.plano === p) return;
  est.plano = p;
  opc!.evento("landing_plano", { plano: p, onde: "checkout", via: "toque" });
  guardarPedido();
  telaForm();
}
const metodoAtual = (): Metodo => (est?.metodo === "card" || !pixLiberado() ? "card" : "pix");
function rotuloPagar(): string {
  const e = est!;
  if (metodoAtual() === "pix") return e.plano === "mensal" ? `Gerar Pix de ${reaisPlanos(valor())}` : `Gerar Pix de ${reaisPlanos(valor())}`;
  if (e.plano === "mensal") return `Assinar por ${reaisPlanos(valor())}/mês`;
  return e.parcelas > 1 ? `Pagar ${textoParcela(valor(), e.parcelas)}` : `Pagar ${reaisPlanos(valor())}`;
}
const pronto = () => stripePronto && (metodoAtual() === "pix" || cartaoPronto);
function atualizarPagar() {
  const b = raiz?.querySelector<HTMLButtonElement>("#pc-pagar");
  if (!b || pagando) return;
  const ok = pronto();
  if (ok || cargaFalhou) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true");
  b.textContent = cargaFalhou ? "Tentar de novo" : ok ? rotuloPagar() : "Carregando…";
  const espera = raiz?.querySelector<HTMLElement>("#pc-pe-carregando");
  if (espera) espera.hidden = !(metodoAtual() === "card" && !cartaoPronto && !cargaFalhou);
}
function mostrarMetodo() {
  const m = metodoAtual();
  raiz?.querySelectorAll<HTMLButtonElement>("[data-metodo]").forEach((b) => { const sim = b.dataset.metodo === m; b.setAttribute("aria-checked", String(sim)); b.tabIndex = sim ? 0 : -1; });
  const painel = raiz?.querySelector<HTMLElement>("#pc-painel-pix");
  if (painel) painel.hidden = m !== "pix";
  raiz?.querySelector<HTMLElement>("#pc-pe")?.toggleAttribute("data-oculto", m !== "card" || !cartaoPronto);
  const parc = raiz?.querySelector<HTMLElement>("#pc-parcelas");
  if (parc) parc.hidden = m !== "card" || !cartaoPronto;
  atualizarPagar();
}
function tocouMetodo(m: Metodo) {
  if (!est || pagando || metodoAtual() === m) return;
  est.metodo = m;
  erroGeral(null);
  opc!.evento("landing_stripe_metodo", { metodo: m, via: "toque", plano: est.plano });
  mostrarMetodo();
}
function medirEmail() {
  if (!est || !opc) return;
  const v = est.email.trim().toLowerCase();
  if (v && emailMedido.comecou !== est.ref) { emailMedido.comecou = est.ref; opc.evento("landing_stripe_email_comecou", { plano: est.plano }); }
  if (EMAIL_OK.test(v) && emailMedido.valido !== est.ref) { emailMedido.valido = est.ref; opc.evento("landing_stripe_email_valido", { plano: est.plano }); }
}
function erroEmail(m: string | null) { const el = raiz?.querySelector<HTMLElement>("#pc-email-erro"); if (el) { el.hidden = !m; el.textContent = m ?? ""; } }
function erroGeral(m: string | null) { const el = raiz?.querySelector<HTMLElement>("#pc-erro"); if (el) { el.hidden = !m; el.textContent = m ?? ""; } }
function erroAoPagar(etapa: string, code?: string) { opc?.evento("landing_stripe_pagar_erro", { metodo: metodoAtual(), plano: est?.plano, etapa, code: String(code ?? "").slice(0, 40) }); }
function guardarPedido() { if (est) gravarPedido({ ref: est.ref, plano: est.plano, pi: est.pi, sub: est.sub, metodo: est.metodo }); }

/** o Stripe.js e o Element de cartão (com Apple Pay / Google Pay quando o aparelho tem) — o Element nasce de novo a cada plano */
async function montarElemento() {
  const o = opc!, e = est!;
  const minha = ++montagem;
  const t0 = performance.now();
  stripePronto = false; cartaoPronto = false; cargaFalhou = false;
  try { elemento?.destroy?.(); } catch { /* já saiu */ }
  elemento = null; elementos = null;
  mostrarMetodo();
  try {
    const s = w.__planosStripe ?? (o.producao ? await stripeDeVerdade(o.pk) : stripeSimulado());
    if (minha !== montagem) return;
    stripe = s;
  } catch {
    if (minha !== montagem) return;
    cargaFalhou = true; o.evento("landing_erro", { onde: "planos_stripe_js" });
    erroGeral("O pagamento não carregou. Confira a internet e tente de novo."); mostrarMetodo(); return;
  }
  stripePronto = true;
  o.evento("landing_stripe_carregou", { ms: Math.round(performance.now() - t0), plano: e.plano });
  try {
    const caixa = raiz!.querySelector<HTMLElement>("#pc-pe")!;
    const mensal = e.plano === "mensal";
    elementos = stripe!.elements({
      mode: mensal ? "subscription" : "payment", amount: valor(), currency: "brl", paymentMethodTypes: ["card"], paymentMethodCreation: "manual", locale: "pt-BR",
      appearance: { theme: "stripe", variables: { colorPrimary: "#d6338a", colorText: "#1c1a1f", borderRadius: "12px", fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif" } },
      fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" }],
    });
    // Apple Pay / Google Pay: "auto" = aparecem quando o aparelho/navegador tem (domínio registrado na Stripe + Permissions-Policy payment da /escolha)
    const pe = elementos.create("payment", {
      layout: { type: "tabs" }, fields: { billingDetails: { email: "never", address: "if_required" } }, wallets: { applePay: "auto", googlePay: "auto", link: "never" },
      ...(mensal ? { applePay: { recurringPaymentRequest: { paymentDescription: "CORE mensal", managementURL: "https://www.coreaplicativo.com.br/entrar", regularBilling: { amount: valor(), label: "CORE mensal", recurringPaymentIntervalUnit: "month", recurringPaymentIntervalCount: 1 } } } } : {}),
    });
    elemento = pe;
    pe.on("ready", () => { if (minha !== montagem) return; cartaoPronto = true; o.evento("landing_stripe_cartao_pronto", { ms: Math.round(performance.now() - t0), plano: e.plano }); mostrarMetodo(); });
    pe.on("loaderror", (x) => { if (minha !== montagem) return; o.evento("landing_erro", { onde: "planos_cartao", msg: String(x.error?.code ?? "").slice(0, 40) }); if (metodoAtual() === "card") erroGeral("O cartão não carregou. Tente de novo ou use o Pix."); });
    pe.mount(caixa);
  } catch (x) {
    o.evento("landing_erro", { onde: "planos_cartao", msg: String((x as Error)?.name ?? "").slice(0, 40) });
  }
  mostrarMetodo();
}

function corpo(acao: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const o = opc!, e = est!;
  return {
    acao, ref: e.ref, email: e.email.trim().toLowerCase(), pagina: "planos",
    fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc"), fbclid: o.fbclid, url: o.urlChegada.slice(0, 500),
    landing_session_id: o.sessao, landing_device_id: o.aparelho, atrib: o.atrib, ...extra,
  };
}
function lerCookie(nome: string): string | null {
  try { for (const par of (document.cookie || "").split(";")) { const i = par.indexOf("="); if (i > 0 && par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim()); } } catch { /* noop */ }
  return null;
}
const MSG_ERRO: Record<string, string> = {
  em_andamento: "Já estamos processando um pagamento seu. Tente de novo em instantes.",
  pix_vivo: "Você tem um Pix em aberto. Pague ele ou tente de novo em 1 minuto.",
  mensal_indisponivel: "O plano mensal está indisponível agora. Tente o vitalício ou volte em instantes.",
  pix_mensal_indisponivel: "O Pix do mensal está indisponível agora. Use o cartão.",
  rede: "Sem resposta do pagamento. Confira a internet e tente de novo.",
};

async function tocouPagar() {
  if (pagando || !opc || !est) return;
  if (cargaFalhou) { erroGeral(null); void montarElemento(); return; }
  if (!pronto()) { opc.evento("landing_stripe_pagar_travado", { metodo: metodoAtual(), plano: est.plano }); return; }
  const o = opc, e = est;
  const campo = raiz!.querySelector<HTMLInputElement>("#pc-email")!;
  const email = campo.value.trim().toLowerCase();
  if (!email) { erroEmail("Digite seu e-mail: é por ele que você entra no CORE."); campo.focus(); o.evento("landing_email_antes_erro", { motivo: "vazio", onde: "planos" }); return; }
  if (!EMAIL_OK.test(email)) { erroEmail("Confira o e-mail: parece que falta alguma coisa."); campo.focus(); o.evento("landing_email_antes_erro", { motivo: "invalido", onde: "planos" }); return; }
  e.email = email;
  const metodo = metodoAtual();
  pagando = true;
  const botao = raiz!.querySelector<HTMLButtonElement>("#pc-pagar")!;
  botao.setAttribute("aria-busy", "true"); botao.textContent = "Processando…";
  erroGeral(null);
  try {
    o.evento("landing_stripe_pagar", { metodo, plano: e.plano, parcelas: metodo === "card" && e.plano === "vitalicio" ? e.parcelas : 1 });
    if (metodo === "pix") await pagarPix();
    else await pagarCartao();
  } catch (x) {
    erroGeral("Não deu pra concluir agora. Tente de novo em instantes.");
    erroAoPagar("excecao", String((x as Error)?.name ?? ""));
  } finally {
    pagando = false;
    raiz?.querySelector<HTMLButtonElement>("#pc-pagar")?.removeAttribute("aria-busy");
    atualizarPagar();
  }
}

async function pagarPix() {
  const o = opc!, e = est!;
  const mensal = e.plano === "mensal";
  const r = await api!.acao(corpo(mensal ? "assinar_pix" : "pix"));
  if (r.pago) return mostrarPago(r.metodo ?? "pix", r);
  if (!r.ok) { erroGeral(MSG_ERRO[r.erro ?? ""] ?? "Não deu pra gerar o Pix. Tente de novo."); erroAoPagar("criar", r.erro ?? r.code); return; }
  e.pi = r.pi ?? e.pi; e.sub = r.sub ?? e.sub; guardarPedido();
  let pix = r.pix ?? null;
  if (!pix && mensal) {
    // Pix Automático: o navegador confirma o PI da 1ª fatura (o banco mostra o mandato junto do pagamento)
    if (!r.client_secret || !stripe) { erroGeral("Não deu pra gerar o Pix. Tente de novo."); erroAoPagar("pix", "sem_segredo"); return; }
    const c = await stripe.confirmPixPayment(r.client_secret, { payment_method: { billing_details: { email: e.email } } }, { handleActions: false });
    if (c.error) { erroGeral(c.error.message ?? "Não deu pra gerar o Pix. Tente de novo."); erroAoPagar("pix", c.error.code); return; }
    if (c.paymentIntent?.status === "succeeded") return mostrarPago("pix", r);
    pix = c.paymentIntent?.next_action?.pix_display_qr_code ?? null;
  }
  if (!pix || (!pix.data && !pix.image_url_png)) { erroGeral("Não deu pra mostrar o Pix. Tente de novo."); erroAoPagar("pix", "sem_qr"); return; }
  e.pix = pix; e.fase = "pix";
  o.evento("landing_stripe_pix_gerado", { pi: e.pi, plano: e.plano, mesmo: !!r.mesmo });
  telaPix();
}

async function pagarCartao() {
  const o = opc!, e = est!;
  if (!stripe || !elementos) { erroGeral("O pagamento ainda está carregando. Tente de novo em instantes."); return; }
  const sub = await elementos.submit();
  if (sub?.error) { erroGeral(sub.error.message ?? "Confira os dados do cartão."); erroAoPagar("validar", sub.error.code); return; }
  const criado = await stripe.createPaymentMethod({ elements: elementos, params: { billing_details: { email: e.email } } });
  if (criado.error || !criado.paymentMethod) { erroGeral(criado.error?.message ?? "Confira os dados do cartão."); erroAoPagar("cartao", criado.error?.code); return; }
  const mensal = e.plano === "mensal";
  const r = await api!.acao(corpo(mensal ? "assinar" : "cartao", { pm: criado.paymentMethod.id, ...(mensal ? {} : { parcelas: e.parcelas }) }));
  e.pi = r.pi ?? e.pi; e.sub = r.sub ?? e.sub; guardarPedido();
  if (r.pago) return mostrarPago("card", r);
  if (r.erro === "parcelas_indisponiveis") {
    const max = Math.max(1, Number(r.max) || 1);
    erroGeral(max > 1 ? `Este cartão parcela em até ${max}x. Escolha de novo.` : "Este cartão não parcela. Pague à vista ou use outro cartão.");
    o.evento("landing_stripe_parcelas_indisponiveis", { plano: e.plano, pediu: e.parcelas, max });
    return;
  }
  if (r.recusado) { erroGeral("O banco recusou este cartão. Tente outro cartão ou o Pix."); o.evento("landing_stripe_recusado", { plano: e.plano, code: String(r.code ?? "").slice(0, 40) }); erroAoPagar("confirmar", r.code); return; }
  if (r.acao && r.client_secret) {
    const a = await stripe.handleNextAction({ clientSecret: r.client_secret });
    if (a.error) { erroGeral(a.error.message ?? "O banco não confirmou. Tente de novo ou use outro cartão."); erroAoPagar("3ds", a.error.code); return; }
    if (a.paymentIntent?.status === "succeeded") return mostrarPago("card", r);
    e.fase = "aguardando"; telaAguardando(); vigiar(); return;
  }
  if (r.processando) { e.fase = "aguardando"; telaAguardando(); vigiar(); return; }
  erroGeral(MSG_ERRO[r.erro ?? ""] ?? "O pagamento não passou. Confira os dados ou tente outro cartão.");
  erroAoPagar("confirmar", r.erro ?? r.code);
}

/* ───────── Pix na tela ───────── */
function telaPix() {
  const o = opc!, e = est!, p = e.pix!;
  const vence = p.expires_at ? new Date(p.expires_at * 1000) : null;
  const hora = vence ? vence.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  const mensal = e.plano === "mensal";
  alvo().innerHTML = `
    <div class="oc-pix" data-testid="planos-pix">
      <div class="oc-resumo" style="text-align:left"><div><h2 id="pc-tit">${mensal ? "CORE · Mensal" : "CORE · Acesso vitalício"}</h2><p>${mensal ? "Pix Automático · renova todo mês" : "Pix · pagamento único"}</p></div><div class="oc-preco">${precoHtml()}</div></div>
      <span class="oc-pilula"><i></i>Esperando o Pix · confirma sozinho</span>
      <div class="oc-qr" id="pc-qr" aria-label="QR code do Pix">${p.image_url_png ? `<img alt="QR code do Pix" src="${esc(p.image_url_png)}" width="180" height="180" />` : ""}</div>
      <div class="oc-copia"><input id="pc-codigo" readonly value="${esc(p.data ?? "")}" aria-label="Pix copia e cola" /><button type="button" id="pc-copiar">Copiar</button></div>
      <ol class="oc-passos"><li>Abra o app do seu banco e escolha <b>Pix copia e cola</b> (ou leia o QR).</li><li>${mensal ? `Confirme ${esc(reaisPlanos(valor()))} e autorize o Pix Automático (o débito mensal).` : `Cole o código e confirme ${esc(reaisPlanos(valor()))}.`}</li><li>Volte aqui: esta tela confirma sozinha.</li></ol>
      ${hora ? `<p>Vale até ${esc(hora)}. O acesso também chega no seu e-mail.</p>` : "<p>O acesso também chega no seu e-mail.</p>"}
      <button type="button" class="pc-voltar" id="pc-outra">Escolher outra forma de pagar</button>
    </div>`;
  if (!p.image_url_png && p.data) void desenharQr(alvo().querySelector<HTMLElement>("#pc-qr")!, p.data);
  alvo().querySelector("#pc-copiar")!.addEventListener("click", async () => {
    const b = alvo().querySelector<HTMLButtonElement>("#pc-copiar")!;
    let ok = false;
    try { await navigator.clipboard.writeText(p.data ?? ""); ok = true; } catch { const i = alvo().querySelector<HTMLInputElement>("#pc-codigo")!; i.select(); try { ok = document.execCommand("copy"); } catch { ok = false; } }
    b.textContent = ok ? "Copiado ✓" : "Copie acima";
    o.evento("landing_pix_copiado", { ok, via: "planos", plano: e.plano });
  });
  // voltar pro formulário: o servidor anula este Pix antes de qualquer outra cobrança na mesma ref (nunca 2 cobranças)
  alvo().querySelector("#pc-outra")!.addEventListener("click", () => { o.evento("landing_stripe_pix_outra", { plano: e.plano }); pararVigia(); e.fase = "form"; e.pix = null; telaForm(); });
  vigiar();
}
async function desenharQr(el: HTMLElement, v: string) {
  try {
    const [{ createElement }, { createRoot }, { QRCodeSVG }] = await Promise.all([import("react"), import("react-dom/client"), import("qrcode.react")]);
    createRoot(el).render(createElement(QRCodeSVG, { value: v, size: 180, level: "M" }));
  } catch { /* o copia-e-cola continua */ }
}
function telaAguardando() {
  alvo().innerHTML = `<div class="oc-pix" data-testid="planos-aguardando"><h2 id="pc-tit">Confirmando o pagamento…</h2><span class="oc-pilula"><i></i>Só um instante</span><p>Não feche esta tela. O acesso também chega no seu e-mail.</p></div>`;
}
function telaRecebido() {
  if (!est) return;
  est.fase = "recebido"; pararVigia();
  opc?.evento("landing_stripe_recebido_sem_confirmar", { pi: est.pi, plano: est.plano });
  alvo().innerHTML = `
    <div class="oc-pago" data-testid="planos-recebido">
      <h2 id="pc-tit">Pagamento recebido?</h2>
      <p>O acesso chega no seu e-mail em até 1 minuto. Enquanto isso, baixe o app:</p>
      ${selos()}
      <p class="oc-contato">No app, toque em <b>“Já tenho conta? Entrar”</b> com o e-mail da compra. Não chegou? <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a></p>
    </div>`;
}
const selos = () => `<div class="oc-selos"><a href="${URL_APP_STORE}" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="144" height="48" /></a><a href="${esc(urlPlay("planos"))}" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="124" height="48" /></a></div>`;

/** pergunta ao servidor se o PI pagou (a cada 3 s e na volta pra aba) */
function vigiar() {
  if (consulta !== null) return;
  vigiaDesde = Date.now();
  const uma = async () => {
    if (!est?.pi || est.fase === "pago" || est.fase === "recebido") return;
    const r = await api!.status({ ref: est.ref, pi: est.pi }).catch(() => null);
    if (r?.pago) return mostrarPago(r.metodo || (est.fase === "pix" ? "pix" : "card"), null);
    if (est.fase === "aguardando" && Date.now() - vigiaDesde > VIGIA_MAX_MS) telaRecebido();
  };
  consulta = window.setInterval(() => { void uma(); }, 3000);
  document.addEventListener("visibilitychange", aoVoltarAba);
  void uma();
}
const aoVoltarAba = () => { if (document.visibilityState === "visible" && consulta !== null && est?.pi) void api!.status({ ref: est.ref, pi: est.pi }).then((r) => { if (r?.pago) mostrarPago(r.metodo || "pix", null); }).catch(() => null); };
function pararVigia() { if (consulta !== null) { window.clearInterval(consulta); consulta = null; } document.removeEventListener("visibilitychange", aoVoltarAba); }

/* ───────── pago ───────── */
function mostrarPago(metodo: string, r: RespostaAcao | null) {
  if (!opc || !est || est.fase === "pago") return;
  const o = opc, e = est;
  // o servidor manda: se esta ref já tinha pago o OUTRO plano (2 abas), vale o que ele disse
  const plano: Plano = r?.plano === "mensal" || r?.plano === "vitalicio" ? r.plano : e.plano;
  e.pi = r?.pi ?? e.pi; e.sub = r?.sub ?? e.sub;
  e.fase = "pago"; e.pagoMetodo = metodo; e.pagoPlano = plano;
  pararVigia();
  if (!aberta && raiz) { raiz.hidden = false; aberta = true; travar(); } // o Pix caiu com a camada fechada: ela volta, já no pago
  apagarPedido();
  o.evento("landing_stripe_pago", { metodo, plano, pi: e.pi, sub: e.sub, parcelas: metodo === "card" && plano === "vitalicio" ? e.parcelas : 1 });
  // Purchase do navegador: o MESMO eventID da CAPI (vitalício = PI · mensal = assinatura) e o valor REAL do plano; 1× por compra
  const id = eventIdDaCompra(plano, { pi: e.pi, sub: e.sub });
  if (id) {
    const chave = `planos-purchase-${id}`;
    let ja = false; try { ja = sessionStorage.getItem(chave) === "1"; sessionStorage.setItem(chave, "1"); } catch { /* heap */ }
    if (!ja) o.pixel("Purchase", { value: valor(plano) / 100, currency: "BRL", content_name: plano === "mensal" ? "planos_mensal" : "planos_vitalicio" }, id);
  } else o.evento("landing_erro", { onde: "planos_purchase_sem_id", plano });
  telaPago();
  if (plano === "vitalicio" && o.indique && e.pi) { try { o.indique.abrir({ ref: e.ref, pi: e.pi, plano, metodo, email: e.email || null }); } catch { /* fica o pago */ } }
}
function telaPago() {
  const o = opc!, e = est!;
  const em = e.email;
  const mensal = e.pagoPlano === "mensal";
  const entrar = `/entrar${em ? `?email=${encodeURIComponent(em)}` : ""}`;
  alvo().innerHTML = `
    <div class="oc-pago" data-testid="planos-pago">
      <div class="oc-check">${ICO_CHECK}</div>
      <h2 id="pc-tit">${mensal ? "Assinatura confirmada!" : "Compra confirmada!"}</h2>
      <p>Seu acesso chega no ${em ? `e-mail <b>${esc(em)}</b>` : "e-mail da compra"} em até 1 minuto. O CORE está na App Store e no Google Play:</p>
      ${selos()}
      <a class="pc-abrir" href="${esc(entrar)}" id="pc-abrir" data-testid="planos-abrir">Abrir meu CORE</a>
      <div class="oc-ce"><b class="t">No app, toque aqui 👇</b>
        <div class="oc-ce-app" role="img" aria-label="No app, toque em Já tenho conta? Entrar, e não em Começar"><div class="oc-ce-comecar">Começar<span class="oc-ce-nao">✕ não é aqui</span></div><div class="oc-ce-entrar">Já tenho conta? <span>Entrar</span></div><div class="oc-ce-sim">✓ é aqui</div></div>
        <p>Toque em <b>“Já tenho conta? Entrar”</b> (não em “Começar”), digite ${em ? `<b>${esc(em)}</b>` : "o e-mail da compra"} e o código de 8 números que chega nele.</p></div>
      ${mensal ? `<p class="pc-nota">${esc(reaisPlanos(valor("mensal")))} por mês. Cancele quando quiser; o acesso vai até o fim do mês pago.</p>` : ""}
      <div class="oc-guia"><div><b>📖 Guia com fotos</b><span>Como entrar, primeiros passos e dicas.</span></div><a href="${GUIA}" data-guia>Abrir o guia</a></div>
      <p class="oc-contato">Dúvida? <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a></p>
    </div>`;
  alvo().querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => o.evento("landing_loja", { loja: a.dataset.loja, onde: "planos_pago" })));
  alvo().querySelector("#pc-abrir")?.addEventListener("click", () => o.evento("landing_abrir_core", { onde: "planos_pago" }));
  const c = raiz!.querySelector<HTMLElement>(".oc-corpo"); if (c) c.scrollTop = 0;
}

/* ───────── abrir / fechar ───────── */
const aoVoltarNavegador = () => {
  if (!aberta) return;
  if (!fechandoPelaTela) opc?.evento("landing_stripe_fechado", { via: "voltar", fase: est?.fase ?? null, plano: est?.plano });
  comHistorico = false; fecharJa();
};
export async function abrirPlanos(o: OpcoesPlanos): Promise<void> {
  if (aberta) return;
  opc = o;
  api = w.__planosApi ?? (o.producao ? apiReal : (api ?? apiSimulada()));
  if (!raiz || !document.body.contains(raiz)) raiz = montarCamada();
  raiz.hidden = false; aberta = true; travar();
  try { history.pushState({ planosCheckout: 1 }, ""); comHistorico = true; } catch { comHistorico = false; }
  window.addEventListener("popstate", aoVoltarNavegador);
  if (!est) {
    const p = lerPedido();
    est = { fase: "form", plano: o.plano, metodo: "pix", parcelas: 1, email: "", pix: null, pi: p.pi ?? null, sub: p.sub ?? null, ref: p.ref, pagoMetodo: null, pagoPlano: null };
  } else if (est.fase === "form" && est.plano !== o.plano) est.plano = o.plano;
  guardarPedido();
  if (o.voltaDoBanco) {
    const p = lerPedido();
    est.pi = o.voltaDoBanco.pi; est.plano = p.plano ?? est.plano; est.sub = p.sub ?? est.sub;
    est.fase = "aguardando"; telaAguardando();
    const r = await api.status({ ref: est.ref, pi: est.pi }).catch(() => null);
    if (r?.pago) mostrarPago(r.metodo ?? "card", null);
    else if (o.voltaDoBanco.status === "failed") { est.fase = "form"; est.metodo = "card"; telaForm(); erroGeral("O banco não aprovou. Tente de novo ou use o Pix."); }
    else if (!r || r.ok === false) telaRecebido();
    else vigiar();
  } else if (est.fase === "pix" && est.pix) telaPix();
  else if (est.fase === "pago") telaPago();
  else if (est.fase === "aguardando") { telaAguardando(); vigiar(); }
  else telaForm();
  o.evento("landing_stripe_aberto", { fase: est.fase, plano: est.plano });
  const chaveIc = `planos-ic-${est.ref}-${est.plano}`;
  let ja = false; try { ja = sessionStorage.getItem(chaveIc) === "1"; sessionStorage.setItem(chaveIc, "1"); } catch { /* heap */ }
  if (est.fase === "form" && !ja && !icFeito.has(chaveIc)) o.pixel("InitiateCheckout", { value: valor() / 100, currency: "BRL", content_name: est.plano === "mensal" ? "planos_mensal" : "planos_vitalicio" }, `ic-${est.ref}-${est.plano}`);
  icFeito.add(chaveIc);
  window.setTimeout(() => { raiz?.querySelector<HTMLElement>("#pc-email, #pc-copiar, #pc-x")?.focus(); }, 30);
}
function pedirFechar(via: string) {
  opc?.evento("landing_stripe_fechado", { via, fase: est?.fase ?? null, plano: est?.plano });
  fechandoPelaTela = true;
  if (comHistorico) { try { history.back(); return; } catch { /* fecha direto */ } }
  fecharJa();
}
function fecharJa() {
  if (!aberta) return;
  aberta = false; fechandoPelaTela = false;
  window.removeEventListener("popstate", aoVoltarNavegador);
  if (est?.fase !== "pix" && est?.fase !== "aguardando") pararVigia(); // Pix na rua: continua vigiando (pagou com a camada fechada = abre o pago)
  if (raiz) raiz.hidden = true;
  soltar();
}

/** testes: zera o módulo entre páginas */
export function _zerar() {
  pararVigia(); raiz?.remove(); raiz = null; est = null; aberta = false; opc = null; api = null; stripe = null; elementos = null; elemento = null;
  montagem += 1; stripePronto = false; cartaoPronto = false; cargaFalhou = false; pagando = false; comHistorico = false; fechandoPelaTela = false;
  emailMedido.comecou = ""; emailMedido.valido = ""; icFeito.clear(); carregandoStripe = null;
  window.removeEventListener("popstate", aoVoltarNavegador); soltar();
}
