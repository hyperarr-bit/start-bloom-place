/**
 * FUNIL APP WEB (14/11) — o cano da folha de pagamento: as edge functions (stripe-criar com `acao`, stripe-status), o
 * Stripe.js (só o campo do cartão; o Pix é gerado no servidor) e o PEDIDO guardado no aparelho.
 *
 *   pedido   localStorage `core-appweb-pedido`: ref (uuid do aparelho), e-mail, plano, PI/assinatura, o Pix vivo e a fase.
 *            Fechar e reabrir o site no meio do Pix volta pra MESMA ref → o servidor devolve o MESMO QR (nunca um 2º Pix);
 *            pago sem senha volta pra tela da senha. Vale 2 dias (pago: 7).
 *   produção só em coreaplicativo.com.br (sem `?qa=1`). Fora disso TUDO é SIMULADO: nada sai pra Stripe nem pras functions
 *            (um campo de cartão de mentira; cartão final 0002 = recusado, 0005 = não parcela; o Pix "cai" com
 *            window.__appWebSimPagar() ou sozinho em 20 s). Testes: window.__appWebApi / window.__appWebStripe.
 */
import { supabase } from "@/integrations/supabase/client";
import { PRECO_MENSAL_CENTAVOS, PRECO_VITALICIO_CENTAVOS } from "@/lib/funil-app-web";

export type Plano = "vitalicio" | "mensal";
export type Metodo = "pix" | "card";
export type PixQr = { data?: string; image_url_png?: string; expires_at?: number };
export type RespostaAcao = {
  ok: boolean; pago?: boolean; plano?: Plano; pi?: string; sub?: string; pix?: PixQr | null; mesmo?: boolean;
  acao?: boolean; client_secret?: string; processando?: boolean; recusado?: boolean; code?: string; erro?: string; max?: number; metodo?: string;
};
export type RespostaStatus = { ok: boolean; status?: string; pago?: boolean; metodo?: string | null };
export type CorpoAcao = Record<string, unknown> & { acao: "pix" | "cartao" | "assinar"; ref: string; email: string };
export type ApiAppWeb = {
  acao: (corpo: CorpoAcao) => Promise<RespostaAcao>;
  status: (corpo: { ref: string; pi: string }) => Promise<RespostaStatus>;
};

const FUNCOES = "https://itoylenzvahbscgjgtqf.supabase.co/functions/v1";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
/** a chave publicável da conta (a mesma do /oferta e do /completo) */
export const PK_STRIPE = "pk_live_51TJnAQQdjmrIbUhHDSWqG1trOT6mFfV87AC4Vv47kFJTAFOhYsNmvryGRnf3x824Ke3mXSsWiFCovKPIR6Kqx0IX00VcuAawhC";
const TETO_MS = 15_000;

type Janela = Window & { __appWebApi?: ApiAppWeb; __appWebStripe?: StripeLike; __appWebSimPagar?: () => void; Stripe?: (pk: string, o?: Record<string, unknown>) => StripeLike };
const w = (): Janela => window as Janela;

/** produção = o domínio de verdade, sem ?qa=1 */
export function emProducao(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("qa") === "1") return false;
    return ["coreaplicativo.com.br", "www.coreaplicativo.com.br"].includes(window.location.hostname);
  } catch { return false; }
}

/* ───────────────────────── a API ───────────────────────── */
async function postar(fn: string, corpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const token = data?.session?.access_token ?? null;
  let teto = 0;
  const estourou = new Promise<Response | null>((ok) => { teto = window.setTimeout(() => ok(null), TETO_MS); });
  const r = await Promise.race([
    fetch(`${FUNCOES}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token ?? ANON}` }, body: JSON.stringify(corpo) }).catch(() => null),
    estourou,
  ]).finally(() => window.clearTimeout(teto));
  if (!r) return { ok: false, erro: "rede" };
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return r.ok ? j : { ...j, ok: j.ok === true ? true : false };
}
const apiReal: ApiAppWeb = {
  acao: async (c) => (await postar("stripe-criar", { ...c, pagina: "app_web" })) as RespostaAcao,
  status: async (c) => (await postar("stripe-status", c)) as RespostaStatus,
};

/* simulado: o "servidor" guarda no aparelho (fechar/reabrir mostra o MESMO Pix, como o de verdade) */
const CHAVE_SIM = "qa-appweb-sim"; // fora do prefixo "core-": a vassoura do cache não apaga o "servidor" simulado
type EstadoSim = { refs: Record<string, { pi: string; pix?: PixQr; pago?: boolean; pagoEm?: number; plano?: Plano; metodo?: Metodo; sub?: string; n: number; geradoEm?: number }> };
const lerSim = (): EstadoSim => { try { return JSON.parse(localStorage.getItem(CHAVE_SIM) || "null") ?? { refs: {} }; } catch { return { refs: {} }; } };
const gravarSim = (e: EstadoSim) => { try { localStorage.setItem(CHAVE_SIM, JSON.stringify(e)); } catch { /* noop */ } };
const QR_SIM = "00020101021226870014br.gov.bcb.pix2565qr.stripe.com/pix/SIMULADO-APPWEB5204000053039865406" + "97.905802BR5904CORE6009SAO PAULO62070503***6304ABCD";
export const PIX_SIM_CAI_MS = 20_000;
function apiSimulada(): ApiAppWeb {
  w().__appWebSimPagar = () => {
    const e = lerSim();
    for (const r of Object.values(e.refs)) if (r.pix && !r.pago) { r.pago = true; r.pagoEm = Date.now(); r.metodo = "pix"; r.plano = "vitalicio"; }
    gravarSim(e);
  };
  const esperar = (ms: number) => new Promise((ok) => window.setTimeout(ok, ms));
  return {
    acao: async (c) => {
      await esperar(500);
      const e = lerSim();
      const r = e.refs[c.ref] ?? (e.refs[c.ref] = { pi: `pi_sim_${c.ref.slice(0, 8)}_1`, n: 1 });
      if (r.pago) { gravarSim(e); return { ok: true, pago: true, plano: r.plano ?? "vitalicio", pi: r.pi, sub: r.sub }; }
      if (c.acao === "pix") {
        if (!r.pix) { r.pix = { data: QR_SIM, expires_at: Math.floor(Date.now() / 1000) + 1800 }; r.geradoEm = Date.now(); }
        gravarSim(e);
        return { ok: true, pi: r.pi, pix: r.pix, plano: "vitalicio" };
      }
      // cartão / assinatura: o Pix vivo morre antes (a trava do servidor)
      if (r.pix) { r.pix = undefined; r.n += 1; r.pi = `pi_sim_${c.ref.slice(0, 8)}_${r.n}`; }
      const pm = String(c.pm ?? "");
      if (/0002$/.test(pm)) { gravarSim(e); return { ok: false, recusado: true, code: "generic_decline", pi: r.pi }; }
      if (c.acao === "cartao" && Number(c.parcelas) > 1 && /0005$/.test(pm)) { gravarSim(e); return { ok: false, erro: "parcelas_indisponiveis", max: 1, pi: r.pi }; }
      r.pago = true; r.pagoEm = Date.now(); r.metodo = "card"; r.plano = c.acao === "assinar" ? "mensal" : "vitalicio";
      if (c.acao === "assinar") r.sub = `sub_sim_${c.ref.slice(0, 8)}`;
      gravarSim(e);
      return { ok: true, pago: true, plano: r.plano, pi: r.pi, sub: r.sub };
    },
    status: async (c) => {
      const e = lerSim();
      const r = e.refs[c.ref];
      if (!r || r.pi !== c.pi) return { ok: false };
      if (r.pix && !r.pago && r.geradoEm && Date.now() - r.geradoEm > PIX_SIM_CAI_MS) { r.pago = true; r.pagoEm = Date.now(); r.metodo = "pix"; r.plano = "vitalicio"; gravarSim(e); }
      return { ok: true, status: r.pago ? "succeeded" : "requires_action", pago: !!r.pago, metodo: r.metodo ?? null };
    },
  };
}
let apiSim: ApiAppWeb | null = null;
export const api = (): ApiAppWeb => w().__appWebApi ?? (emProducao() ? apiReal : (apiSim ??= apiSimulada()));

/* ───────────────────────── Stripe.js (só o campo do cartão) ───────────────────────── */
export type ErroStripe = { message?: string; type?: string; code?: string; decline_code?: string };
export type ElementoCartao = { mount: (el: HTMLElement) => void; on: (ev: string, cb: (e: { complete?: boolean; error?: ErroStripe }) => void) => void; destroy?: () => void };
export type Elementos = { create: (tipo: "payment", o?: Record<string, unknown>) => ElementoCartao; submit: () => Promise<{ error?: ErroStripe }> };
export type StripeLike = {
  elements: (o: Record<string, unknown>) => Elementos;
  createPaymentMethod: (o: Record<string, unknown>) => Promise<{ error?: ErroStripe; paymentMethod?: { id: string } }>;
  handleNextAction: (o: { clientSecret: string }) => Promise<{ error?: ErroStripe; paymentIntent?: { id?: string; status?: string } }>;
};

let carregando: Promise<StripeLike> | null = null;
function stripeDeVerdade(): Promise<StripeLike> {
  if (carregando) return carregando;
  carregando = new Promise<StripeLike>((ok, falha) => {
    const j = w();
    if (j.Stripe) return ok(j.Stripe(PK_STRIPE, { locale: "pt-BR" }));
    const ja = document.querySelector<HTMLScriptElement>('script[src^="https://js.stripe.com/v3"]');
    const s = ja ?? document.createElement("script");
    const teto = window.setTimeout(() => desistir(), 12_000);
    const desistir = () => { window.clearTimeout(teto); s.remove(); carregando = null; falha(new Error("stripe.js não carregou")); };
    s.addEventListener("load", () => { window.clearTimeout(teto); if (j.Stripe) ok(j.Stripe(PK_STRIPE, { locale: "pt-BR" })); else desistir(); });
    s.addEventListener("error", desistir);
    if (ja) return;
    s.src = "https://js.stripe.com/v3"; s.async = true;
    document.head.appendChild(s);
  });
  return carregando;
}

/** o campo de cartão simulado (dev/QA/prints): número, validade, CVC. O PM leva os 4 últimos dígitos (0002 = recusado). */
function stripeSimulado(): StripeLike {
  let numero = "";
  const el: ElementoCartao = {
    mount: (alvo) => {
      alvo.innerHTML = `<div class="grid gap-2" data-testid="appweb-cartao-simulado">
        <label class="block text-[12.5px] font-semibold text-black/55">Número do cartão<input data-sim="numero" class="block w-full h-12 mt-1 rounded-xl border-[1.5px] border-black/15 px-3 text-[16px] bg-white" inputmode="numeric" placeholder="1234 1234 1234 1234" /></label>
        <div class="grid grid-cols-2 gap-2"><label class="block text-[12.5px] font-semibold text-black/55">Validade<input class="block w-full h-12 mt-1 rounded-xl border-[1.5px] border-black/15 px-3 text-[16px] bg-white" placeholder="MM / AA" /></label>
        <label class="block text-[12.5px] font-semibold text-black/55">CVC<input class="block w-full h-12 mt-1 rounded-xl border-[1.5px] border-black/15 px-3 text-[16px] bg-white" placeholder="CVC" /></label></div></div>`;
      alvo.querySelector<HTMLInputElement>('[data-sim="numero"]')?.addEventListener("input", (e) => { numero = (e.target as HTMLInputElement).value.replace(/\D/g, ""); });
      window.setTimeout(() => pronto?.(), 0);
    },
    on: (ev, cb) => { if (ev === "ready") pronto = () => cb({}); },
  };
  let pronto: (() => void) | undefined;
  return {
    elements: () => ({ create: () => el, submit: async () => (numero.length < 12 ? { error: { message: "O número do cartão está incompleto.", type: "validation_error" } } : {}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: `pm_sim${Date.now().toString(36)}_${numero.slice(-4) || "0000"}` } }),
    handleNextAction: async () => ({ paymentIntent: { status: "succeeded" } }),
  };
}
let simulado: StripeLike | null = null;
export async function carregarStripe(): Promise<StripeLike> {
  const j = w();
  if (j.__appWebStripe) return j.__appWebStripe;
  if (!emProducao()) return (simulado ??= stripeSimulado());
  return stripeDeVerdade();
}
export const aparenciaStripe = {
  theme: "stripe",
  variables: { colorPrimary: "#d6338a", colorText: "#16121c", borderRadius: "12px", fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif" },
};

/* ───────────────────────── o pedido no aparelho ───────────────────────── */
export type Fase = "form" | "pix" | "pago";
export type Pedido = {
  v: 1; ref: string; email: string; plano: Plano; metodo: Metodo; fase: Fase;
  pi: string | null; sub: string | null; pix: PixQr | null; parcelas: number;
  /** pago: o valor (centavos) e se o Purchase do navegador já saiu */
  valor: number | null; purchaseFeito: boolean; senhaCriada: boolean; salvoEm: number;
};
export const CHAVE_PEDIDO = "core-appweb-pedido";
const VALE_MS = 2 * 86400_000;
const VALE_PAGO_MS = 7 * 86400_000;
const novoId = () => { try { return crypto.randomUUID(); } catch { return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };

export function lerPedido(agora = Date.now()): Pedido | null {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PEDIDO) || "null") as Pedido | null;
    if (!p || p.v !== 1 || typeof p.ref !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(p.ref)) return null;
    if (agora - (p.salvoEm || 0) > (p.fase === "pago" ? VALE_PAGO_MS : VALE_MS)) { localStorage.removeItem(CHAVE_PEDIDO); return null; }
    return p;
  } catch { return null; }
}
export function gravarPedido(p: Pedido): Pedido {
  const n = { ...p, salvoEm: Date.now() };
  try { localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(n)); } catch { /* fica no estado da tela */ }
  return n;
}
export function apagarPedido() { try { localStorage.removeItem(CHAVE_PEDIDO); } catch { /* noop */ } }
export function pedidoNovo(plano: Plano): Pedido {
  return { v: 1, ref: novoId(), email: "", plano, metodo: plano === "mensal" ? "card" : "pix", fase: "form", pi: null, sub: null, pix: null, parcelas: 1, valor: null, purchaseFeito: false, senhaCriada: false, salvoEm: Date.now() };
}
/** o pedido pede pra cair direto no paywall/folha ao reabrir? (Pix vivo ou pago sem senha) */
export const pedidoPendente = (p: Pedido | null): boolean => !!p && (p.fase === "pix" || (p.fase === "pago" && !p.senhaCriada));
export const valorDoPlano = (plano: Plano): number => (plano === "mensal" ? PRECO_MENSAL_CENTAVOS : PRECO_VITALICIO_CENTAVOS);

/** cookies da Meta (o servidor manda na CAPI) */
export function lerCookie(nome: string): string | null {
  try { for (const par of (document.cookie || "").split(";")) { const i = par.indexOf("="); if (i > 0 && par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim()); } } catch { /* noop */ }
  return null;
}
