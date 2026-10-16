import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { AREAS, AREA_TRACKS, QUIZ, isInAppBrowser, type AreaKey } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { ABERTURA_TUDO, numeroDaRotaDe, portaTudo } from "@/lib/funil-numeros";
import { QuizScreen, ProgressScreen, RadarResultScreen, ProvaSocialScreen } from "@/pages/funis/dia14/ComecarDia14";
import { capturarAtribuicao, idsDoAnuncio, lerAtribuicao, type AtribuicaoPorta } from "@/pages/porta/atribuicao";
import { LOGO_PORTA } from "@/pages/porta/telas";
import type { Plataforma } from "@/pages/porta/SucessoPorta";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
/* a venda do /assinar (as MESMAS telas e chamadas ao servidor) */
import { entrarComSenha, entrouPorCodigo, prepararConta, type VendaNaConta } from "@/pages/venda/conta";
import { cookiesDaMeta, eventoMeta, novoEventId, sessaoDaVenda } from "@/pages/venda/rastreio";
import { firePixPurchaseOnce } from "@/lib/purchase-tracking";
import { DadosVenda, type ResultadoDados } from "@/pages/venda/telas-venda";
import { PixVenda, venceEm, type PixGerado, type PixPago } from "@/pages/venda/PixVenda";
import { SucessoVenda } from "@/pages/venda/SucessoVenda";
import { WelcomeVideo } from "./WelcomeVideo";
import { GraficoComSemWeb } from "./GraficoComSemWeb";
import { LembretesApp, PlanoDe3DiasApp, PortaApp } from "./telas-app";
import { PaywallWeb, PresenteWeb } from "./PaywallApp";
import {
  FUNIL_APP_WEB, MENSAL_SEM_RENOVACAO, OFERTAS, OFERTA_DO_DEGRAU, URL_QR_APP_WEB, VARIANTE_APP, passosDaPreparacao, proximoDegrau,
  textoDoPlanoNoSucesso, type Degrau, type OfertaApp,
} from "./conteudo";

/**
 * O FUNIL DO APP NA WEB — coreaplicativo.com.br/assinatura (16/10). Só na WEB (SoNaWeb no App.tsx + cinto aqui),
 * noindex. A /comece, a /experimente, a /assinar e a /liberar não mudam; o app não muda.
 *
 * As telas são as do iPhone 1.0.15 (ComecarW com o funil enxuto do Cal AI e o "Seu plano de 3 dias" com cadeado),
 * na mesma ordem e com os mesmos componentes:
 *   welcome (vídeo do app) → porta → quiz (2 perguntas: a dor + o número) → sem × com → lembretes → prova → preparando
 *   → resultado → plano de 3 dias → PAYWALL DA WEB.
 * O paywall é o que muda: Pix, com a escada (./conteudo.ts):
 *   anual 97,90 (a97) → recusou (Voltar/X · "Agora não" · voltou do QR sem pagar) → presente anual 69,90 (a69)
 *   → recusou → mensal 24,90 por 30 dias, sem renovação (w25) → recusou → volta pro 97,90, sem mais oferta.
 * Cada presente aparece 1x por sessão. Aceitou um degrau → nome + e-mail (a conta nasce AQUI, pelo MESMO caminho do
 * /assinar: ../../venda/conta.ts; "já é assinante" não paga) → o MESMO PixVenda com a oferta do degrau → o MESMO
 * SucessoVenda. Se a conta já existe nesta sessão (voltou do QR), o próximo degrau vai DIRETO pro Pix.
 *
 * Eventos (venda_* com venda_session_id + ids do anúncio + variante "app"):
 *   funnel_view {step, funil: "app_web", variante: "app", web: true}   cada passo do funil, como o app (porta = "start")
 *   + os das telas do app (quiz_N, prova_social, funnel_quiz_answer, funnel_click…), iguais aos do app
 *   venda_view (1x por sessão) · venda_passo {passo, resposta: "view"} · venda_paywall_view
 *   venda_paywall_recusou {via} · venda_downsell_view {degrau} · venda_downsell_aceitou {degrau} · venda_downsell_recusou {degrau, via}
 *   venda_plano_click {plano, oferta, metodo, valor} · venda_conta · venda_conta_existe · venda_dados_erro · venda_ja_assinante
 *   venda_pix_qr_view · venda_pix_copiado · venda_erro · venda_pago {plano, oferta, metodo, valor, order_id} · venda_loja_click ·
 *   venda_codigo · venda_abrir_app_click
 * Meta: ViewContent 1x por sessão e InitiateCheckout no aceite de cada degrau (pixel + CAPI pela venda-capi, mesmo
 * event_id; valor 97,90 / 69,90 / 24,90); Purchase pela CAPI do pagamento (event_id = id do pedido, valor = o que foi
 * pago) + pixel com o mesmo id (firePixPurchaseOnce). Conta: user_metadata.venda com `variante: "app"`.
 */

export type PassoApp =
  | "welcome" | "porta" | "quiz" | "grafico_com_sem" | "notif" | "prova" | "progress" | "result" | "plano_3_dias"
  | "paywall" | "oferta_69" | "oferta_24" | "dados" | "pix" | "sucesso";
const PASSOS: PassoApp[] = ["welcome", "porta", "quiz", "grafico_com_sem", "notif", "prova", "progress", "result", "plano_3_dias", "paywall", "oferta_69", "oferta_24", "dados", "pix", "sucesso"];
const FUNIL_PASSOS = new Set<PassoApp>(["welcome", "porta", "quiz", "grafico_com_sem", "notif", "prova", "progress", "result", "plano_3_dias"]);
/** a volta de passo do funil (a mesma fila do app, PASSO_ANTERIOR_CALAI) */
const ANTERIOR: Partial<Record<PassoApp, PassoApp>> = {
  porta: "welcome", quiz: "porta", grafico_com_sem: "quiz", notif: "grafico_com_sem", prova: "notif", progress: "prova", result: "quiz", plano_3_dias: "result",
};
const TELA_DO_DEGRAU: Record<Degrau, PassoApp> = { 97: "paywall", 69: "oferta_69", 24: "oferta_24" };

export type EstadoApp = {
  passo: PassoApp;
  area: AreaKey | null;
  answers: Record<string, string>;
  marcados: number | null;
  oferta: OfertaApp | null;
  nome: string | null;
  email: string | null;
  pix: PixGerado | null;
  /** a oferta do QR guardado (QR de outra oferta nunca é reaproveitado) */
  pixOferta: OfertaApp | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  fim?: string | null;
  jaAssinante?: boolean;
  pago?: boolean;
  /** 17/10 (revisão): os QRs que ela abriu ANTES nesta escada e ainda não venceram (copiou o de 97,90, voltou e aceitou
   *  o de 69,90) — o Pix confere esses também; o que cair é o que vale (oferta e valor DELE). */
  pixAnteriores?: QrAnterior[];
  /** quando o estado foi gravado (ms) — estado velho não volta (ver lerEstado) */
  salvoEm?: number;
};

/** Um QR anterior desta escada: o QR inteiro (pra voltar a ser o atual se ela escolher a mesma oferta) + a oferta dele. */
export type QrAnterior = PixGerado & { oferta: OfertaApp };
const vivo = (q: PixGerado, agora = Date.now()) => venceEm(q) > agora;

export const CHAVE_ESTADO_APP = "assinatura-estado-v1";
/** Estado guardado mais velho que isso recomeça do zero (o funil e o sucesso não ficam pra sempre no aparelho). */
export const VALIDADE_ESTADO_MS = 7 * 86_400_000;
const CHAVE_DEGRAUS = "assinatura-degraus-v1";
const CHAVE_VC = "assinatura-vc-v1";

let memoriaEstado: EstadoApp | null = null;
let memoriaDegraus: { sessao: string; vistos: Degrau[] } | null = null;
let memoriaVc: string | null = null;
/** só pros testes */
export function _zerarEstadoApp(): void { memoriaEstado = null; memoriaDegraus = null; memoriaVc = null; }

const novoEstado = (): EstadoApp => ({ passo: "welcome", area: null, answers: {}, marcados: null, oferta: null, nome: null, email: null, pix: null, pixOferta: null });
const ehOferta = (o: unknown): o is OfertaApp => o === "a97" || o === "a69" || o === "w25";

/** O passo guardado, conferido com o que existe (recarregar no meio nunca cai numa tela sem dado). */
export function passoValido(e: EstadoApp): PassoApp {
  const p = PASSOS.includes(e.passo) ? e.passo : "welcome";
  if (p === "sucesso") return e.pago || e.jaAssinante ? "sucesso" : e.oferta ? "paywall" : "welcome";
  if (p === "pix") return e.email && e.oferta ? "pix" : e.oferta ? "dados" : "paywall";
  if (p === "dados") return e.oferta ? "dados" : "paywall";
  if (p === "progress") return "result";
  if (FUNIL_PASSOS.has(p) && p !== "welcome" && p !== "porta" && !e.area) return "porta";
  return p;
}
function lerEstado(): EstadoApp {
  if (memoriaEstado) return memoriaEstado;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_APP);
    if (raw) {
      const e = JSON.parse(raw) as Partial<EstadoApp>;
      if (e && typeof e === "object" && estadoValendo(e)) {
        const base: EstadoApp = {
          ...novoEstado(), ...e,
          area: e.area && e.area in AREAS ? e.area : null,
          answers: e.answers && typeof e.answers === "object" ? e.answers : {},
          oferta: ehOferta(e.oferta) ? e.oferta : null,
          pixOferta: ehOferta(e.pixOferta) ? e.pixOferta : null,
          pixAnteriores: Array.isArray(e.pixAnteriores) ? e.pixAnteriores.filter((a) => a && typeof a.orderId === "string" && typeof a.qrCode === "string" && ehOferta(a.oferta)) : [],
        } as EstadoApp;
        memoriaEstado = { ...base, passo: passoValido(base) };
        return memoriaEstado;
      }
    }
  } catch { /* noop */ }
  return novoEstado();
}
function gravarEstado(e: EstadoApp): void {
  memoriaEstado = e;
  try { localStorage.setItem(CHAVE_ESTADO_APP, JSON.stringify({ ...e, salvoEm: Date.now() })); } catch { /* storage bloqueado: fica a memória */ }
}
/** O estado guardado ainda vale? Não, se tem mais de 7 dias, ou se é o sucesso de um acesso que já acabou (o mensal de
 *  30 dias não fica mostrando "Seu CORE está liberado" depois de vencer). Sem `salvoEm` (estado antigo): vale. */
export function estadoValendo(e: Partial<EstadoApp>, agora = Date.now()): boolean {
  if (typeof e.salvoEm === "number" && agora - e.salvoEm > VALIDADE_ESTADO_MS) return false;
  if (e.passo === "sucesso" && e.fim) {
    const fim = Date.parse(e.fim);
    if (Number.isFinite(fim) && fim < agora) return false;
  }
  return true;
}

/* os presentes já vistos NESTA sessão da venda (1x cada por sessão) */
function degrausVistos(sessao: string): Degrau[] {
  if (memoriaDegraus?.sessao === sessao) return memoriaDegraus.vistos;
  try {
    const raw = sessionStorage.getItem(CHAVE_DEGRAUS);
    const v = raw ? JSON.parse(raw) : null;
    if (v && v.sessao === sessao && Array.isArray(v.vistos)) {
      memoriaDegraus = { sessao, vistos: v.vistos.filter((d: unknown) => d === 69 || d === 24) };
      return memoriaDegraus.vistos;
    }
  } catch { /* noop */ }
  return [];
}
function marcarDegrau(sessao: string, d: Degrau): void {
  const vistos = [...new Set([...degrausVistos(sessao), d])];
  memoriaDegraus = { sessao, vistos };
  try { sessionStorage.setItem(CHAVE_DEGRAUS, JSON.stringify(memoriaDegraus)); } catch { /* fica a memória */ }
}
const vcJaSaiu = (sessao: string): boolean => {
  if (memoriaVc === sessao) return true;
  try { return sessionStorage.getItem(CHAVE_VC) === sessao; } catch { return false; }
};
const marcarVc = (sessao: string): void => {
  memoriaVc = sessao;
  try { sessionStorage.setItem(CHAVE_VC, sessao); } catch { /* fica a memória */ }
};

const plataformaDaWeb = (): Plataforma => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};
const dataBr = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getFullYear() > 2100) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
};

// Tema claro fixo (o funil do app roda claro, doa o que doer o tema do sistema) — o LIGHT_VARS do ComecarW.
const LIGHT_VARS = {
  "--background": "0 0% 100%", "--foreground": "0 0% 15%", "--card": "0 0% 100%", "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%", "--primary-foreground": "0 0% 100%", "--secondary": "40 20% 96%", "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%", "--muted-foreground": "0 0% 45%", "--accent": "330 65% 50%", "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%", "--input": "0 0% 90%", "--ring": "0 0% 20%",
} as CSSProperties;
const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

/** A rota: o app da loja NUNCA monta (cinto além do SoNaWeb do App.tsx). */
export default function AssinaturaAppRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <AssinaturaApp />;
}

export function AssinaturaApp() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSubscribed } = useAuth();

  // atribuição + sessão da venda: na 1ª renderização
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string } | null>(null);
  if (!inicio.current) inicio.current = { attr: capturarAtribuicao(), sessao: sessaoDaVenda().id };
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = useCallback((): Record<string, string> => {
    const { porta_session_id: _p, ...resto } = idsDoAnuncio(lerAtribuicao() ?? inicio.current!.attr, sessao);
    return { venda_session_id: sessao, ...resto, variante: VARIANTE_APP };
  }, [sessao]);
  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);

  const [estado, setEstadoCru] = useState<EstadoApp>(lerEstado);
  const setEstado = useCallback((f: (e: EstadoApp) => EstadoApp) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const passo = estado.passo;
  const area: AreaKey = estado.area ?? "dinheiro";

  /* noindex + título, só enquanto a página está montada */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-assinatura", "");
    document.head.appendChild(meta);
    const antes = document.title;
    document.title = "CORE · Seu plano";
    return () => { meta.remove(); document.title = antes; };
  }, []);

  /* ---------------------------------------------------------- a máquina de passos (+ o Voltar do navegador) */
  const voltandoRef = useRef(false);
  const tagPasso = (s: PassoApp, extra: Record<string, unknown> = {}) =>
    trackEvent("funnel_view", { step: s === "porta" ? "start" : s, funil: FUNIL_APP_WEB, variante: VARIANTE_APP, web: true, ...(estadoRef.current.area ? { area: estadoRef.current.area } : {}), ...extra });
  /** Avança (ou troca de tela) — o passo do funil emite o funnel_view como o setStep do app; uma entrada no history. */
  const ir = (s: PassoApp, extra: Partial<EstadoApp> = {}, evento: Record<string, unknown> | null = {}) => {
    setEstado((e) => ({ ...e, ...extra, passo: s }));
    if (evento && FUNIL_PASSOS.has(s)) tagPasso(s, evento);
    if (!voltandoRef.current) { try { window.history.pushState({ aw: s }, ""); } catch { /* noop */ } }
  };
  /** Volta de passo, sem contar como view nova (como o app). */
  const recuar = (s: PassoApp) => setEstado((e) => ({ ...e, passo: s }));

  /* 1ª carga: venda_view (1x por sessão), ViewContent (1x por sessão, decidido no efeito) e o passo de entrada */
  useEffect(() => {
    try { window.history.replaceState({ ...(window.history.state || {}), aw: estadoRef.current.passo }, ""); } catch { /* noop */ }
    if (!vcJaSaiu(sessao)) {
      marcarVc(sessao);
      const { origem, ...a } = inicio.current!.attr;
      trackEvent("venda_view", { ...a, atribuicao: origem, venda_session_id: sessao, plataforma, in_app: emInApp, retomou: passo !== "welcome" ? passo : null, variante: VARIANTE_APP });
      eventoMeta("ViewContent", novoEventId("vc"), { content_name: "venda_web", content_category: "venda_app" }, inicio.current!.attr.fbc || null);
    }
    if (FUNIL_PASSOS.has(passo)) tagPasso(passo, passo === "welcome" ? { video: true } : { retomada: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [passo]);

  /* as telas da venda: 1 venda_passo "view" por chegada; paywall e presentes com os eventos deles */
  const sessaoDegraus = sessao;
  useEffect(() => {
    if (FUNIL_PASSOS.has(passo)) return;
    trackEvent("venda_passo", { passo, area: estadoRef.current.area, resposta: "view", ...ids() });
    if (passo === "paywall") {
      trackEvent("funnel_view", { step: "offer", funil: FUNIL_APP_WEB, variante: VARIANTE_APP, web: true, area: estadoRef.current.area });
      trackEvent("venda_paywall_view", { area: estadoRef.current.area, degrau: 97, ...ids() });
    }
    if (passo === "oferta_69" || passo === "oferta_24") {
      const degrau: Degrau = passo === "oferta_69" ? 69 : 24;
      marcarDegrau(sessaoDegraus, degrau);
      trackEvent("venda_downsell_view", { degrau, valor: OFERTAS[OFERTA_DO_DEGRAU[degrau]].valor, area: estadoRef.current.area, ...ids() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  /* ---------------------------------------------------------- a escada */
  /** Recusou o degrau: o próximo presente (1x por sessão) ou, acabou a escada, o 97,90 (ou o plano, se recusou o 97,90 de novo). */
  const recusar = (degrau: Degrau, via: "voltar" | "agora_nao" | "pix_voltar" | "navegador") => {
    if (degrau === 97) trackEvent("venda_paywall_recusou", { via, ...ids() });
    else trackEvent("venda_downsell_recusou", { degrau, via, ...ids() });
    const prox = proximoDegrau(degrau, degrausVistos(sessaoDegraus));
    if (prox) { ir(TELA_DO_DEGRAU[prox]); return; }
    if (degrau === 97) { recuar("plano_3_dias"); return; } // como o recuo do paywall do app
    ir("paywall");
  };

  /** A conta desta sessão já existe (deu nome + e-mail e continua logada nela)? */
  const contaPronta = (): boolean => {
    const e = estadoRef.current;
    return !!(e.email && user?.email && user.email.toLowerCase() === e.email.toLowerCase());
  };
  const conferirJaAssinante = async (): Promise<{ sim: boolean; fim: string | null }> => {
    try {
      const { data } = await supabase.functions.invoke("check-subscription");
      const d = data as { subscribed?: boolean; subscription_end?: string | null } | null;
      return { sim: !!d?.subscribed, fim: d?.subscription_end ?? null };
    } catch {
      return { sim: false, fim: null }; // sem resposta: segue pro pagamento (o Pix de um vitalício é preservado no servidor)
    }
  };
  const irJaAssinante = (nome: string, email: string, fim: string | null, via: string) => {
    trackEvent("venda_ja_assinante", { via, ...ids() });
    ir("sucesso", { nome, email: email.toLowerCase(), jaAssinante: true, fim, pix: null, pixOferta: null });
  };
  /** Vai pro Pix da oferta. QR de outra oferta nunca é reaproveitado — mas também não é esquecido: se ainda não venceu,
   *  vira um "anterior" que o Pix continua conferindo (quem copiou o de 97,90 e voltou pode pagá-lo no banco). Se já
   *  existe um anterior vivo DESTA oferta, ele volta a ser o atual (nada de QR novo pro mesmo preço). */
  const irProPix = (extra: Partial<EstadoApp> = {}) => {
    const e = estadoRef.current;
    const oferta = extra.oferta ?? e.oferta;
    if (e.pixOferta === oferta) { ir("pix", { ...extra, jaAssinante: false }); return; }
    const agora = Date.now();
    let anteriores = (e.pixAnteriores ?? []).filter((a) => vivo(a, agora));
    if (e.pix && e.pixOferta && vivo(e.pix, agora) && !anteriores.some((a) => a.orderId === e.pix!.orderId)) {
      anteriores = [...anteriores, { ...e.pix, oferta: e.pixOferta }];
    }
    const deVolta = anteriores.find((a) => a.oferta === oferta) ?? null;
    if (deVolta) anteriores = anteriores.filter((a) => a.orderId !== deVolta.orderId);
    const { oferta: _o, ...qr } = deVolta ?? { oferta: null };
    ir("pix", { ...extra, jaAssinante: false, pix: deVolta ? (qr as PixGerado) : null, pixOferta: oferta, pixAnteriores: anteriores });
  };

  const [ocupado, setOcupado] = useState(false);
  /** Aceitou um degrau: InitiateCheckout + nome/e-mail (ou direto pro Pix, se a conta já é desta sessão). */
  const aceitar = async (oferta: OfertaApp) => {
    if (ocupado) return;
    const o = OFERTAS[oferta];
    if (o.degrau !== 97) trackEvent("venda_downsell_aceitou", { degrau: o.degrau, valor: o.valor, ...ids() });
    trackEvent("venda_plano_click", { plano: o.plano, oferta, metodo: "pix", valor: o.valor, degrau: o.degrau, ...ids() });
    eventoMeta("InitiateCheckout", novoEventId("ic"), { content_name: o.conteudo, value: o.valor, currency: "BRL", content_category: "pix" }, attrAgora().fbc || null);
    if (!contaPronta()) { ir("dados", { oferta }); return; }
    // voltou do QR (a conta é desta sessão): confere se o Pix anterior não caiu antes de cobrar de novo
    setOcupado(true);
    try {
      const j = await conferirJaAssinante();
      const e = estadoRef.current;
      if (j.sim) { irJaAssinante(e.nome ?? "", e.email ?? "", j.fim, "sessao"); return; }
      irProPix({ oferta });
    } finally {
      setOcupado(false);
    }
  };

  /* ---------------------------------------------------------- o Voltar (da tela e do navegador) */
  /** Voltou do QR: antes de abrir o próximo degrau, UMA conferência do pedido atual (até ~1,5 s, "Conferindo
   *  pagamento…") — quem pagou no banco e voltou vai pro sucesso, não pra um presente que cobraria de novo. */
  const [conferindo, setConferindo] = useState(false);
  const conferindoRef = useRef(false);
  const voltarDoPix = async (via: "pix_voltar" | "navegador") => {
    if (conferindoRef.current) return;
    const e = estadoRef.current;
    const atual = e.pix && e.pixOferta ? { orderId: e.pix.orderId, oferta: e.pixOferta } : null;
    if (atual) {
      conferindoRef.current = true;
      setConferindo(true);
      try {
        const c = cookiesDaMeta();
        const r = await Promise.race([
          supabase.functions.invoke("asaas-pix", { body: { action: "check", id: atual.orderId, offer: atual.oferta, fbp: c.fbp, fbc: c.fbc, sourceUrl: window.location.href.slice(0, 300) } })
            .then(({ data }) => !!(data as { paid?: boolean } | null)?.paid).catch(() => false),
          new Promise<boolean>((ok) => window.setTimeout(() => ok(false), 1500)),
        ]);
        if (r) {
          trackEvent("venda_pix_pago_no_voltar", { order_id: atual.orderId, oferta: atual.oferta, ...ids() });
          void firePixPurchaseOnce("checkout");
          onPixPago(atual);
          return;
        }
      } finally {
        conferindoRef.current = false;
        setConferindo(false);
      }
    }
    if (pagoRef.current || passoRef.current !== "pix") return;
    // pelo Voltar do navegador a entrada do history já foi consumida: o próximo degrau não empilha outra
    if (via === "navegador") voltandoRef.current = true;
    try { recusar(degrauDaOferta(), via); } finally { voltandoRef.current = false; }
  };
  const degrauDaOferta = (): Degrau => OFERTAS[estadoRef.current.oferta ?? "a97"].degrau;
  const voltarDe = (p: PassoApp, via: "tela" | "navegador"): boolean => {
    const v = via === "navegador" ? "navegador" : null;
    if (p === "paywall") { recusar(97, v ?? "voltar"); return true; }
    if (p === "oferta_69") { recusar(69, v ?? "voltar"); return true; }
    if (p === "oferta_24") { recusar(24, v ?? "voltar"); return true; }
    if (p === "pix") { void voltarDoPix(v ?? "pix_voltar"); return true; }
    if (p === "dados") { recuar(TELA_DO_DEGRAU[degrauDaOferta()]); return true; }
    const ant = ANTERIOR[p];
    if (ant) { trackEvent("funnel_click", { cta: "w_back", funil: FUNIL_APP_WEB, variante: VARIANTE_APP, step: p, para: ant, ...(v ? { via: v } : {}) }); recuar(ant); return true; }
    return false;
  };
  /* Voltar do navegador (o do Instagram saía do site): volta UM passo, como o Voltar da tela — no paywall, nos presentes
   * e no Pix é a recusa (o próximo degrau). Nunca prende: cada Voltar consome uma entrada e, sem passo anterior, sai. */
  const passoRef = useRef(passo);
  passoRef.current = passo;
  useEffect(() => {
    const aoPopstate = (e: PopStateEvent) => {
      if (!(e.state && typeof e.state === "object" && "aw" in e.state)) return;
      const atual = passoRef.current;
      if (atual === "quiz") {
        // a seta da tela manda (pergunta anterior ou a porta)
        const daTela = document.querySelector<HTMLButtonElement>('[data-testid="app-web-quiz"] button[aria-label="Voltar"]');
        if (daTela) { voltandoRef.current = true; daTela.click(); voltandoRef.current = false; return; }
      }
      voltandoRef.current = true;
      let voltou = false;
      try { voltou = voltarDe(atual, "navegador"); } finally { voltandoRef.current = false; }
      // sem passo anterior (welcome, sucesso): segue saindo — o Voltar nunca fica preso aqui
      if (!voltou) { try { window.history.back(); } catch { /* noop */ } }
    };
    window.addEventListener("popstate", aoPopstate);
    return () => window.removeEventListener("popstate", aoPopstate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------- dados → Pix (a conta, como no /assinar) */
  const montarVenda = (e: EstadoApp = estadoRef.current): VendaNaConta & { variante: string; oferta: string } => ({
    v: 1,
    attr: capturarAtribuicao({ search: "" }),
    respostas: {
      area: e.area ?? "dinheiro",
      area_label: e.answers.area_label ?? null,
      ...Object.fromEntries(Object.entries(e.answers).filter(([k]) => k !== "area" && k !== "area_label").map(([k, v]) => [k, String(v)])),
      plano_marcados: e.marcados == null ? null : String(e.marcados),
    },
    plano: e.oferta ? OFERTAS[e.oferta].plano : "anual",
    metodo: "pix",
    venda_session_id: sessao,
    criado_em: new Date().toISOString(),
    variante: VARIANTE_APP,
    oferta: e.oferta ?? "a97",
  });
  const seguirPagamento = (nome: string, email: string) => irProPix({ nome, email: email.toLowerCase() });
  const seguirOuJaAssinante = async (nome: string, email: string, via: string) => {
    const j = await conferirJaAssinante();
    if (j.sim) { irJaAssinante(nome, email, j.fim, via); return; }
    seguirPagamento(nome, email);
  };
  const onEnviarDados = async (nome: string, email: string): Promise<ResultadoDados> => {
    if (isSubscribed && user?.email && user.email.toLowerCase() === email.toLowerCase()) {
      irJaAssinante(nome, email, null, "sessao");
      return { ok: true };
    }
    const r = await prepararConta({ email, nome, venda: montarVenda() });
    if (r.ok === false) {
      if ("existe" in r) { trackEvent("venda_conta_existe", { ...ids() }); return { ok: false, existe: true }; }
      const erro = (r as { erro: string }).erro;
      trackEvent("venda_erro", { onde: "conta", msg: erro.slice(0, 120), ...ids() });
      return { ok: false, erro };
    }
    const nova = (r as { nova: boolean }).nova;
    trackEvent("venda_conta", { nova, via: "email", plano: OFERTAS[estadoRef.current.oferta ?? "a97"].plano, oferta: estadoRef.current.oferta, metodo: "pix", ...ids() });
    if (nova) seguirPagamento(nome, email);
    else await seguirOuJaAssinante(nome, email, "sessao");
    return { ok: true };
  };
  const onEntrarSenha = async (email: string, senha: string, nome: string): Promise<boolean> => {
    const ok = await entrarComSenha(email, senha, nome, montarVenda());
    if (!ok) return false;
    trackEvent("venda_conta", { nova: false, via: "senha", ...ids() });
    await seguirOuJaAssinante(nome, email, "senha");
    return true;
  };
  const onEntrouCodigo = async (nome: string, email: string) => {
    await entrouPorCodigo(nome, montarVenda());
    trackEvent("venda_conta", { nova: false, via: "codigo", ...ids() });
    await seguirOuJaAssinante(nome, email, "codigo");
  };

  /* ---------------------------------------------------------- pago */
  const pedirCodigo = async (): Promise<void> => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: "codigo" } });
      const codigo = (data as { codigo?: unknown } | null)?.codigo;
      if (error || !codigoDaPortaOk(codigo)) {
        trackEvent("venda_codigo", { ok: false, erro: (error?.message || "sem_codigo").slice(0, 120), ...ids() });
        return;
      }
      const emailEnviado = !!(data as { email_enviado?: boolean } | null)?.email_enviado;
      setEstado((x) => ({ ...x, codigo, emailEnviado }));
      trackEvent("venda_codigo", { ok: true, email: emailEnviado, ...ids() });
    } catch (e) {
      trackEvent("venda_codigo", { ok: false, erro: String(e).slice(0, 120), ...ids() });
    }
  };
  const pediuCodigo = useRef(false);
  /** Caiu um Pix: o atual OU um anterior da escada — a venda é a do pedido que caiu (oferta, valor e plano DELE). */
  const pagoRef = useRef(false);
  const onPixPago = useCallback((p?: PixPago) => {
    if (pagoRef.current) return; // o Voltar (conferência na hora) e a conferência do Pix podem achar o mesmo pagamento
    pagoRef.current = true;
    const e = estadoRef.current;
    const oferta: OfertaApp = p && ehOferta(p.oferta) ? p.oferta : e.oferta ?? "a97";
    const o = OFERTAS[oferta];
    const anterior = !!p && p.orderId !== e.pix?.orderId;
    trackEvent("venda_pago", { plano: o.plano, oferta: o.oferta, metodo: "pix", valor: o.valor, degrau: o.degrau, order_id: p?.orderId ?? e.pix?.orderId ?? null, ...(anterior ? { qr_anterior: true } : {}), ...ids() });
    ir("sucesso", { pago: true, jaAssinante: false, oferta, pixAnteriores: [] });
    if (!pediuCodigo.current) { pediuCodigo.current = true; void pedirCodigo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onPix = useCallback((p: PixGerado | null) => setEstado((e) => ({ ...e, pix: p, pixOferta: p ? e.oferta : e.pixOferta })), [setEstado]);

  /* sucesso: o fim do acesso + o código se a página recarregou sem ele */
  useEffect(() => {
    if (passo !== "sucesso" || authLoading || !user) return;
    if (!estado.fim) {
      void supabase.functions.invoke("check-subscription").then(({ data }) => {
        const fim = (data as { subscription_end?: string | null } | null)?.subscription_end;
        if (fim) setEstado((e) => ({ ...e, fim }));
      }).catch(() => {});
    }
    if (!pediuCodigo.current && !codigoDaPortaOk(estado.codigo)) { pediuCodigo.current = true; void pedirCodigo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, authLoading, user?.id]);

  /* sucesso: loja + volta da aba */
  const clicouLoja = useRef(false);
  const [voltou, setVoltou] = useState(false);
  useEffect(() => {
    const aoMudar = () => { if (document.visibilityState === "visible" && clicouLoja.current) setVoltou(true); };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);
  const hrefLoja = (loja: "ios" | "android" | null): string => {
    const a = attrAgora();
    const q = new URLSearchParams({ origem: "venda_app" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("venda_loja_click", { plataforma, loja, ...ids() });
  };

  /* ---------------------------------------------------------- render */
  // o quiz do app enxuto: só a DOR e o NÚMERO da rota (dinheiro: perguntas 1 e 3; as outras rotas: 1 e 2)
  const perguntas = area === "dinheiro" ? QUIZ : AREA_TRACKS[area as Exclude<AreaKey, "dinheiro">];
  const itensQuiz = area === "dinheiro"
    ? [{ kind: "q" as const, qIdx: 0 }, { kind: "q" as const, qIdx: 2 }]
    : [{ kind: "q" as const, qIdx: 0 }, { kind: "q" as const, qIdx: 1 }];
  const venda = !FUNIL_PASSOS.has(passo);
  const telaCheia = venda;
  const telaComprida = passo === "result" || passo === "plano_3_dias" || passo === "grafico_com_sem";
  const ofertaAtual = OFERTAS[estado.oferta ?? "a97"];

  let telaVenda: React.ReactNode = null;
  if (passo === "paywall") {
    telaVenda = <PaywallWeb onPagar={() => void aceitar("a97")} onRecusar={(via) => recusar(97, via)} ocupado={ocupado} />;
  } else if (passo === "oferta_69" || passo === "oferta_24") {
    const degrau = passo === "oferta_69" ? 69 : 24;
    telaVenda = <PresenteWeb key={degrau} degrau={degrau} onAceitar={() => void aceitar(OFERTA_DO_DEGRAU[degrau])} onRecusar={(via) => recusar(degrau, via)} ocupado={ocupado} />;
  } else if (passo === "dados") {
    telaVenda = (
      <DadosVenda
        plano={ofertaAtual.plano} metodo="pix"
        resumo={<><b>{ofertaAtual.rotulo}</b> · R$ {ofertaAtual.preco}{ofertaAtual.plano === "mensal" ? " · 30 dias" : ""} · Pix</>}
        nomeInicial={estado.nome ?? ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "")}
        emailInicial={estado.email ?? ""}
        emailLogado={!authLoading && user?.email ? user.email : null}
        onEnviar={onEnviarDados} onEntrarSenha={onEntrarSenha} onEntrouCodigo={onEntrouCodigo}
        onTrocarPlano={() => recuar(TELA_DO_DEGRAU[ofertaAtual.degrau])}
        onErroCampo={(campo, motivo) => trackEvent("venda_dados_erro", { campo, motivo, ...ids() })}
      />
    );
  } else if (passo === "pix") {
    telaVenda = (
      <PixVenda
        key={estado.oferta ?? "a97"}
        pix={estado.pixOferta === estado.oferta ? estado.pix : null} onPix={onPix} onPago={onPixPago} ids={ids} celular={plataforma !== "web"}
        anteriores={estado.pixAnteriores ?? []}
        oferta={ofertaAtual.oferta} plano={ofertaAtual.plano} rotulo={ofertaAtual.rotulo} preco={ofertaAtual.preco} valor={ofertaAtual.valor}
        acesso={ofertaAtual.oferta === "w25" ? "pagamento único" : ofertaAtual.acesso}
        aviso={ofertaAtual.oferta === "w25" ? MENSAL_SEM_RENOVACAO : null}
      />
    );
  } else if (passo === "sucesso") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    telaVenda = (
      <SucessoVenda
        plataforma={plataforma} email={estado.email ?? user?.email ?? null} plano={ofertaAtual.plano} confirmado jaAssinante={!!estado.jaAssinante} voltou={voltou}
        abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
        emailEnviado={comCodigo && !!estado.emailEnviado}
        fimDoAcesso={dataBr(estado.fim)} hrefLoja={hrefLoja} qrUrl={URL_QR_APP_WEB} onLoja={onLoja}
        planoTexto={textoDoPlanoNoSucesso(ofertaAtual.oferta, dataBr(estado.fim))}
        onAbrirApp={() => trackEventBeacon("venda_abrir_app_click", { voltou, ...ids() })}
      />
    );
  }
  /* dados, Pix e sucesso: as telas do /assinar numa página branca com o topo do app (voltar + CORE) */
  const comTopo = passo === "dados" || passo === "pix" || passo === "sucesso";

  return (
    <div style={{ ...LIGHT_VARS, background: "#ffffff" }} className="tema-claro min-h-[100dvh] text-foreground flex flex-col" data-testid="assinatura-app" data-passo={passo}>
      <AnimatePresence>
        {passo === "welcome" && (
          <motion.div key="welcome" exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <WelcomeVideo area={estado.area} onComecar={() => ir("porta")} onEntrar={() => navigate("/entrar")} />
          </motion.div>
        )}
      </AnimatePresence>

      {passo !== "welcome" && (
        <div
          style={{ ["--util" as string]: "100dvh" }}
          className={`flex flex-col px-5 ${telaCheia ? "min-h-[var(--util)] pt-4 pb-7" : telaComprida ? "min-h-[var(--util)] pt-6 pb-8" : "h-[var(--util)] overflow-hidden pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div key={passo} {...fade} className="w-full flex-1 flex flex-col" data-tela={passo}>
              {passo === "porta" && (
                <PortaApp
                  onBack={() => recuar("welcome")}
                  totalPassos={itensQuiz.length + 1}
                  onPickArea={(a, label) => {
                    const r = { ...estadoRef.current.answers, area: a, area_label: label };
                    trackEvent("funnel_quiz_answer", { step: "porta", answer: label, funil: FUNIL_APP_WEB, variante: VARIANTE_APP });
                    // trocou de área: as respostas da área antiga não valem mais
                    const mudou = estadoRef.current.area !== a;
                    estadoRef.current = { ...estadoRef.current, area: a };
                    ir("quiz", { area: a, answers: mudou ? { area: a, area_label: label } : r });
                  }}
                />
              )}
              {passo === "quiz" && portaTudo(estado.answers) && (
                <p className="text-[13px] text-muted-foreground leading-snug mb-4 -mt-1 rounded-xl px-3 py-2" style={{ background: "#FFF8D6" }} data-testid="abertura-tudo">{ABERTURA_TUDO}</p>
              )}
              {passo === "quiz" && (
                <div data-testid="app-web-quiz" className="contents">
                  <QuizScreen
                    questions={perguntas}
                    items={itensQuiz}
                    initialAnswers={estado.answers}
                    counterBase={1}
                    semContador
                    onBack={() => recuar("porta")}
                    onDone={(r: Record<string, string>) => {
                      const todas = { ...estadoRef.current.answers, ...r };
                      const n = numeroDaRotaDe(estadoRef.current.area, todas);
                      ir("grafico_com_sem", { answers: todas }, { rota: n.rota, formato: n.formato, numero: n.valor, estimado: n.estimado, ...(portaTudo(todas) ? { area: "tudo" } : {}) });
                    }}
                  />
                </div>
              )}
              {passo === "grafico_com_sem" && <GraficoComSemWeb numero={numeroDaRotaDe(estado.area, estado.answers)} onNext={() => ir("notif")} />}
              {passo === "notif" && <LembretesApp area={area} onDone={() => ir("prova")} />}
              {passo === "prova" && <ProvaSocialScreen onNext={() => ir("progress")} botaoFixo />}
              {passo === "progress" && <div className="flex-1 grid place-items-center"><ProgressScreen steps={passosDaPreparacao(AREAS[area].nome)} onDone={() => ir("result")} /></div>}
              {passo === "result" && (
                <RadarResultScreen answers={estado.answers} area={area} cta="Montar meu plano" rodape={null} botaoFixo onDone={() => ir("plano_3_dias")} />
              )}
              {passo === "plano_3_dias" && <PlanoDe3DiasApp area={area} onDone={(n) => ir("paywall", { marcados: n })} />}

              {(passo === "paywall" || passo === "oferta_69" || passo === "oferta_24") && telaVenda}
              {comTopo && (
                <div className="w-full max-w-md mx-auto" data-testid="app-web-venda">
                  <div className="relative flex items-center justify-center h-9">
                    {passo !== "sucesso" && (
                      <button type="button" onClick={() => voltarDe(passo, "tela")} aria-label="Voltar" data-testid="app-web-voltar" disabled={conferindo}
                        className="absolute left-0 -ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}
                    <span className="flex items-center gap-2">
                      <img src={LOGO_PORTA} alt="" width={24} height={24} className="w-6 h-6 rounded-[7px] border border-[#e6e3e9] bg-white" />
                      <span className="text-[18px] font-black tracking-[-0.03em] leading-none text-[#16121c]">CORE</span>
                    </span>
                  </div>
                  {passo === "pix" && conferindo && (
                    <p className="mt-3 flex items-center justify-center gap-2 rounded-[12px] bg-[#f5f3f7] px-3 py-2 text-[13.5px] font-semibold text-[#16121c]" role="status" data-testid="app-web-conferindo">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />Conferindo pagamento…
                    </p>
                  )}
                  {passo === "sucesso" ? <div className="mt-6">{telaVenda}</div> : telaVenda}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
