import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { entrarComApple, entrarComGoogle } from "@/lib/auth-nativo";
import { guardarDestino } from "@/lib/destino-seguro";
import { isInAppBrowser } from "@/lib/funnel";
import { getAuthRedirectUrl } from "@/lib/utils";
import { persistLeadSource } from "@/lib/lead-source";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { capturarAtribuicao, decidirGravacao, idsDoAnuncio, lerAtribuicao, montarPorta, sessaoDaPorta, type AtribuicaoPorta, type PortaNaConta } from "./atribuicao";
import {
  ABERTURA_TUDO, DICA_ORGANIZA, OPCOES_AREA, OPCOES_ORGANIZA, PERGUNTA_AREA, PERGUNTA_DOR, PERGUNTA_NUMERO, PERGUNTA_ORGANIZA,
  alternarOrganiza, labelDe, rotaDe, type EscolhaPorta,
} from "./conteudo";
import { CardPorta, PerguntaMulti, PerguntaPorta, TopoPorta } from "./telas";
import { ContaPorta, type Resultado } from "./ContaPorta";
import { SucessoPorta, type Plataforma } from "./SucessoPorta";
import { irPraLoja } from "./navegar";
import { abrirAppComCodigo, codigoDaPortaOk } from "./handoff";
import { lerHtmlDaPorta, msDesdeANavegacao } from "./medicao";

/** Sucesso: segundos até a loja abrir sozinha (como a Dinzo: "Abrindo a App Store…"). */
export const SEGUNDOS_ATE_A_LOJA = 3;
const CHAVE_LOJA_AUTO = "porta-loja-auto";

/**
 * A PORTA iPHONE — coreaplicativo.com.br/comece (10/10). Só na WEB (o app
 * nativo nunca monta: a rota fica atrás do SoNaWeb no App.tsx). noindex.
 *
 * v5 (12/10, dono: "quero o funil igual o do Dinzo, mesmo design, só adaptando o quiz"): TOPO FIXO igual em
 * todos os passos (logo · PLANO GRATUITO · "Monte seu plano de 3 dias" · "4 perguntas rápidas…") + UM card
 * branco onde tudo acontece:
 *   1 área → 2 a dor da área → 3 o número da área → 4 "Como você organiza isso hoje?" (multi) → 5 CONTA (Apple,
 *   Google, e-mail + senha; a campanha fica em user_metadata.porta) → 6 SUCESSO ("Agora é só entrar", loja
 *   abre sozinha em ~3 s, 1x por sessão; na volta da aba, "Abrir o CORE" com o código do porta-handoff).
 * Saíram (v5): o com × sem, a tela do plano, o "Último passo" e a tela 7 antiga.
 *
 * SEM o preço do produto em lugar nenhum. "3 dias grátis" só na conta do iPhone; nunca "sem cartão".
 *
 * Eventos (analytics_events, todos com porta_session_id + ids do anúncio):
 *   porta_html {t_ms, html_id}   v4: do index.html, ANTES do React (ver ./medicao.ts); porta_erro_js {msg} também
 *   porta_view {attr…, tempo_ms, tela1_visivel, html_id, html_ms}   1ª carga da sessão
 *   porta_passo {passo, area, resposta}  v5: "area" (tocou a área), "p2" (a dor), "p3" (o número), "organiza"
 *                                        (resposta = rótulos marcados, separados por vírgula), "conta" (abriu a
 *                                        conta, resposta "view"), "sucesso" (viu o sucesso, resposta "view")
 *                                        [v3/v4 também tinham "abertura", "comsem", "plano", "instrucao"]
 *   porta_conta_erro {campo, motivo}     tocou "Criar conta" com e-mail/senha faltando (1 por campo)
 *   porta_conta_iniciada {metodo}
 *   porta_conta_criada {metodo, existente, event_id, gravou}
 *   porta_loja_click {plataforma, loja, via: "botao"|"auto"}   (keepalive: a página sai pra loja)
 *   porta_voltou_aba {}
 *   porta_google_bloqueado {}            tocou no Google dentro do Instagram/Facebook (aviso, sem OAuth)
 *   porta_codigo {ok, erro, email}       pediu o código do "abrir o app já logado" (porta-handoff; a mesma
 *                                        chamada manda o e-mail "entre no CORE" com o código)
 *   porta_abrir_app_click {onde}         tocou em "Abrir o CORE" (core://entrar?h=…) no sucesso
 * (Área de transferência é PROIBIDA — dono 10/10. Nada aqui copia nem lê o clipboard.)
 * Pixel: ViewContent na 1ª carga; CompleteRegistration (eventID = porta.event_id) na conta nova (+ a CAPI "registro").
 */
export type Passo = "area" | "p2" | "p3" | "organiza" | "conta" | "sucesso";
export const ORDEM: Passo[] = ["area", "p2", "p3", "organiza", "conta", "sucesso"];
/** A barra de progresso do card (o sucesso não tem barra, como na Dinzo). */
const PROGRESSO: Partial<Record<Passo, number>> = { area: 0.1, p2: 0.3, p3: 0.5, organiza: 0.7, conta: 0.88 };
/** O estado salvo das versões antigas (localStorage "porta-estado-v1") cai no equivalente novo, sem quebrar:
 *  v1/v2 welcome/area e v3/v4 abertura (área + dor numa tela) → a dor se a área já estava marcada, senão a área;
 *  comsem/plano (v4: já respondeu o número) → organiza; instrucao/salvo → sucesso. */
const PASSO_ANTIGO: Record<string, Passo> = { welcome: "area", abertura: "area", comsem: "organiza", plano: "organiza", instrucao: "sucesso", salvo: "sucesso" };
export const migrarPasso = (p: unknown): Passo | null =>
  typeof p !== "string" ? null : (ORDEM as string[]).includes(p) ? (p as Passo) : PASSO_ANTIGO[p] ?? null;

export type EstadoPorta = {
  passo: Passo;
  escolha: EscolhaPorta | null;
  p2: string | null;
  p3: string | null;
  /** v5: o passo 4 (multi-seleção) — ids de OPCOES_ORGANIZA */
  p4?: string[] | null;
  eventId: string;
  metodo: string | null;
  email: string | null;
  /** 10/10: código de uso único do porta-handoff (abre o app já logado). Ausente = só o "toque em Entrar". */
  codigo?: string | null;
  /** o porta-handoff disse que o e-mail com o código saiu (a faixa verde do sucesso) */
  emailEnviado?: boolean;
};

export const CHAVE_ESTADO = "porta-estado-v1";
let memoriaEstado: EstadoPorta | null = null;
/** só pros testes */
export function _zerarEstadoPorta(): void { memoriaEstado = null; }

const novoId = (): string => {
  try { return `porta_cr_${crypto.randomUUID()}`; } catch { return `porta_cr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
};

function lerEstado(): EstadoPorta | null {
  if (memoriaEstado) return memoriaEstado;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoPorta;
    const passo = e ? migrarPasso(e.passo) : null;
    if (e && passo && typeof e.eventId === "string") {
      // v1–v4 na área/abertura com a área marcada: segue pra dor (a dor e o número são respondidos de novo)
      const n: EstadoPorta = passo === "area"
        ? { ...e, passo: e.escolha ? "p2" : "area", p2: null, p3: null }
        : { ...e, passo };
      if (!Array.isArray(n.p4)) n.p4 = null;
      memoriaEstado = n;
      return n;
    }
  } catch { /* noop */ }
  return null;
}
function gravarEstado(e: EstadoPorta): void {
  memoriaEstado = e;
  try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(e)); } catch { /* storage bloqueado: fica a memória */ }
}

const plataformaDaWeb = (): Plataforma => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};

const JA_EXISTE = /already registered|already been registered|user already|already exists/i;
const msgErroCadastro = (m: string): string =>
  /password|senha/i.test(m) && /weak|short|least|characters|fraca/i.test(m)
    ? "Essa senha é fraca. Use pelo menos 6 caracteres, com letras e números."
    : /invalid.*email|email.*invalid|valid email|unable to validate email/i.test(m)
      ? "Esse e-mail parece errado. Confere e tenta de novo."
      : /rate|limit|security purposes|seconds/i.test(m)
        ? "Muitas tentativas seguidas. Espera um minutinho e tenta de novo."
        : "Não consegui criar a conta agora. Tenta de novo em alguns segundos.";

/* HANDOFF PRO NAVEGADOR (v2): no Instagram o Google não funciona; a pessoa toca em
 * ⋯ → "Abrir no navegador" e a MESMA URL abre no Safari, que não tem o storage do
 * Instagram. Por isso, ao mostrar o aviso, as respostas (`pe`) e a sessão da
 * Porta (`ps`) vão pra URL: no Safari ela cai direto na tela da conta. */
export const PARAM_ESTADO = "pe";
export const PARAM_SESSAO = "ps";
function estadoDaUrl(): EstadoPorta | null {
  try {
    const raw = new URLSearchParams(window.location.search).get(PARAM_ESTADO);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<EstadoPorta>;
    const okId = (v: unknown) => v === null || v === undefined || (typeof v === "string" && /^[a-z0-9_-]{1,40}$/i.test(v));
    if (!okId(o.escolha) || !okId(o.p2) || !okId(o.p3) || typeof o.eventId !== "string" || !/^porta_cr_[a-z0-9-]{6,60}$/i.test(o.eventId)) return null;
    const p4 = Array.isArray(o.p4) && o.p4.length <= 8 && o.p4.every((x) => typeof x === "string" && okId(x)) ? (o.p4 as string[]) : null;
    return { passo: "conta", escolha: (o.escolha ?? null) as EscolhaPorta | null, p2: o.p2 ?? null, p3: o.p3 ?? null, p4, eventId: o.eventId, metodo: null, email: null };
  } catch {
    return null;
  }
}
const appDoWebview = (): string => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /Instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ? "Facebook" : "navegador deste app";
};

export const URL_QR = "https://coreaplicativo.com.br/baixar?origem=porta_qr";

/** A rota: o app da loja NUNCA monta a Porta (cinto além do SoNaWeb do App.tsx). */
export default function PortaIphoneRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <PortaIphone />;
}

export function PortaIphone() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const paramPasso = useMemo(() => { try { return new URLSearchParams(window.location.search).get("passo"); } catch { return null; } }, []);

  // atribuição + sessão: na 1ª renderização, antes de qualquer redirect/limpeza
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    let psUrl: string | null = null;
    try { psUrl = new URLSearchParams(window.location.search).get(PARAM_SESSAO); } catch { /* noop */ }
    const s = sessaoDaPorta(psUrl);
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = () => idsDoAnuncio(attrAgora(), sessao);

  const [estado, setEstadoCru] = useState<EstadoPorta>(() => lerEstado() ?? estadoDaUrl() ?? { passo: "area", escolha: null, p2: null, p3: null, p4: null, eventId: novoId(), metodo: null, email: null });
  const setEstado = useCallback((f: (e: EstadoPorta) => EstadoPorta) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const rota = rotaDe(estado.escolha);
  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);

  /* noindex + título, só enquanto a Porta está montada */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-porta", "");
    document.head.appendChild(meta);
    const tituloAntes = document.title;
    document.title = "CORE · Seu plano de 3 dias";
    return () => { meta.remove(); document.title = tituloAntes; };
  }, []);

  /* porta_view: uma vez por sessão da Porta, com a atribuição inteira.
   * v4: + tempo_ms (performance.now() na montagem = do início da navegação até a tela existir), se a tela 1
   * ficou visível, e o html_id/html_ms do porta_html do index.html (quem tem porta_html e não tem porta_view
   * desistiu ANTES da tela aparecer). */
  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    const html = lerHtmlDaPorta();
    let visivel: boolean | null = null;
    try { visivel = document.visibilityState === "visible"; } catch { /* noop */ }
    const tela1 = estado.passo === "area" && !!document.querySelector("[data-testid='porta-q-area']");
    trackEvent("porta_view", {
      ...a, atribuicao: origem, porta_session_id: sessao, plataforma, in_app: emInApp, retomou: estado.passo !== "area" ? estado.passo : null,
      tempo_ms: msDesdeANavegacao(), visivel, tela1_visivel: tela1 && visivel !== false,
      html_id: html?.id ?? null, html_ms: html?.t ?? null,
    });
    fireMetaEvent("ViewContent", { content_name: "porta_iphone", content_category: "porta" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [estado.passo]);

  const ir = (passo: Passo, extra: Partial<EstadoPorta> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));
  const passoFeito = (passo: string, resposta: string | null, area: string | null = estadoRef.current.escolha) =>
    trackEvent("porta_passo", { passo, area, resposta, ...ids() });
  /* porta_passo "conta"/"sucesso": abriu a conta / viu o sucesso */
  useEffect(() => {
    if (estado.passo === "conta" || estado.passo === "sucesso") passoFeito(estado.passo, "view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo]);

  /* as respostas como o APP guarda (chave → texto da opção): atrapalha + gasto|consistencia (+ v5: organiza) */
  const respostas = (e: EstadoPorta = estadoRef.current): PortaNaConta["respostas"] => {
    const r = rotaDe(e.escolha);
    const num = PERGUNTA_NUMERO[r];
    const p4 = e.p4 && e.p4.length ? e.p4 : null;
    return {
      area: e.escolha ?? "dinheiro", rota: r, p2: e.p2, p3: e.p3,
      atrapalha: labelDe(PERGUNTA_DOR[r].opts, e.p2), [num.key]: labelDe(num.opts, e.p3),
      p4: p4 ? p4.join(",") : null, organiza: p4 ? rotulosOrganiza(p4) : null,
    };
  };

  /* ---------------------------------------------------------- o código do app já logado */
  /* 10/10: depois da conta, um código de uso único (porta-handoff "criar", 24 h, 1 uso) pra o app abrir
   * JÁ LOGADO pelo "Abrir o CORE" (core://entrar?h=…); a mesma chamada manda o e-mail com o código. Só
   * no iPhone (o app Android não sabe resgatar). NUNCA bloqueia: falhou, fica só o "toque em Entrar". */
  const pedirCodigo = async (): Promise<void> => {
    if (plataformaDaWeb() !== "ios") return;
    try {
      const { data, error } = await supabase.functions.invoke("porta-handoff", { body: { acao: "criar", metodo: estadoRef.current.metodo ?? "senha" } });
      const codigo = (data as { codigo?: unknown } | null)?.codigo;
      if (error || !codigoDaPortaOk(codigo)) {
        trackEvent("porta_codigo", { ok: false, erro: (error?.message || "sem_codigo").slice(0, 120), ...ids() });
        return;
      }
      const emailEnviado = !!(data as { email_enviado?: boolean } | null)?.email_enviado;
      setEstado((x) => ({ ...x, codigo, emailEnviado }));
      trackEvent("porta_codigo", { ok: true, email: emailEnviado, ...ids() });
    } catch (e) {
      trackEvent("porta_codigo", { ok: false, erro: String(e).slice(0, 120), ...ids() });
    }
  };

  /* ---------------------------------------------------------- a conta */
  const concluindo = useRef(false);
  const concluir = useCallback(async (metodo: string): Promise<Resultado> => {
    if (concluindo.current) return { ok: true };
    concluindo.current = true;
    try {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (!u) { concluindo.current = false; return { ok: false, erro: "Não consegui entrar. Tenta de novo." }; }
      const e = estadoRef.current;
      const atual = (u.user_metadata as { porta?: PortaNaConta } | undefined)?.porta;
      const agora = Date.now();
      const dec = decidirGravacao(u, sessao, agora);
      const existente = dec.existente;
      const eventId = atual?.event_id ?? e.eventId;
      if (dec.gravar) {
        const porta = montarPorta({ attr: capturarAtribuicao({ search: "" }), respostas: respostas(e), eventId, sessao, metodo, agora });
        const { error } = await supabase.auth.updateUser({ data: { porta } });
        if (error) trackEvent("porta_erro", { onde: "gravar_porta", msg: (error.message || "").slice(0, 160), ...ids() });
      }
      if (!existente) {
        fireMetaEvent("CompleteRegistration", { content_name: "porta_iphone", status: true }, eventId);
        // 11/10: o mesmo CompleteRegistration pela CAPI do site (servidor), com o MESMO eventID — a Meta deduplica.
        // Não bloqueia nada: se falhar, fica o do navegador.
        try { void supabase.functions.invoke("porta-handoff", { body: { acao: "registro", event_id: eventId } }).catch(() => {}); } catch { /* noop */ }
        void persistLeadSource(supabase, u.id);
      }
      trackEvent("porta_conta_criada", { metodo, existente, event_id: eventId, gravou: dec.gravar, area: e.escolha, ...ids() });
      setEstado((x) => ({ ...x, passo: "sucesso", metodo, email: u.email ?? x.email, eventId }));
      void pedirCodigo();
      return { ok: true };
    } catch {
      concluindo.current = false;
      return { ok: false, erro: "Não consegui salvar agora. Tenta de novo." };
    }
  }, [sessao, setEstado]);

  /* volta do Google/Apple (/auth/callback → /comece?passo=voltou) */
  useEffect(() => {
    if (authLoading || !user) return;
    const e = estadoRef.current;
    const social = e.metodo === "google" || e.metodo === "apple";
    if ((e.passo === "conta" && social) || (paramPasso === "voltou" && e.passo !== "sucesso")) void concluir(social ? (e.metodo as string) : "google");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const social = async (metodo: "google" | "apple"): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo, ...ids() });
    setEstado((e) => ({ ...e, passo: "conta", metodo }));
    guardarDestino("/comece?passo=voltou");
    const { error } = await (metodo === "apple" ? entrarComApple() : entrarComGoogle());
    if (error) {
      setEstado((e) => ({ ...e, metodo: null }));
      trackEvent("porta_erro", { onde: `oauth_${metodo}`, msg: (error.message || "").slice(0, 160), ...ids() });
      return { ok: false, erro: `Não consegui abrir ${metodo === "apple" ? "a Apple" : "o Google"}. Use seu e-mail aqui embaixo.` };
    }
    return { ok: true };
  };
  const onGoogle = () => social("google");
  const onApple = () => social("apple");

  /* Google dentro do Instagram/Facebook: NADA de OAuth (403 disallowed_useragent). Mostra o
   * aviso e põe as respostas na URL, pra elas irem junto no "Abrir no navegador". */
  const onGoogleBloqueado = () => {
    trackEvent("porta_google_bloqueado", { app: appDoWebview(), ...ids() });
    try {
      const e = estadoRef.current;
      const q = new URLSearchParams(window.location.search);
      q.set(PARAM_ESTADO, JSON.stringify({ escolha: e.escolha, p2: e.p2, p3: e.p3, p4: e.p4 ?? null, eventId: e.eventId }));
      q.set(PARAM_SESSAO, sessao);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}`);
    } catch { /* noop */ }
  };

  /* E-MAIL + SENHA (v2, sem código). Conta nova: signUp com a porta no `data` (a confirmação de
   * e-mail está desligada no projeto: mailer_autoconfirm = true, a sessão volta na hora, como nos
   * funis antigos da web). E-mail que já existe: entra com a MESMA senha; se não der, pede a senha
   * dela. Nunca cria 2ª conta. */
  const entrarComSenha = async (email: string, senha: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return !error;
  };
  const onCriarConta = async (email: string, senha: string): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo: "senha", ...ids() });
    const e = estadoRef.current;
    const porta = montarPorta({ attr: capturarAtribuicao({ search: "" }), respostas: respostas(e), eventId: e.eventId, sessao, metodo: "senha" });
    setEstado((x) => ({ ...x, metodo: "senha", email }));
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { porta }, emailRedirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    if (error && !JA_EXISTE.test(error.message || "")) {
      trackEvent("porta_erro", { onde: "criar_conta", msg: (error.message || "").slice(0, 160), ...ids() });
      return { ok: false, erro: msgErroCadastro(error.message || "") };
    }
    if (!error && data?.session) return concluir("senha");
    // já existe (ou o projeto pediu confirmação): tenta a mesma senha, nunca uma 2ª conta
    if (await entrarComSenha(email, senha)) return concluir("senha");
    trackEvent("porta_conta_existe", { ...ids() });
    return { ok: false, existe: true };
  };
  const onEntrarComSenha = async (email: string, senha: string): Promise<Resultado> => {
    if (await entrarComSenha(email, senha)) return concluir("senha");
    return { ok: false, erro: "Senha não bateu. Confere ou toque em Esqueci a senha." };
  };

  const onSalvarNestaConta = async (): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo: "sessao", ...ids() });
    return concluir("sessao");
  };

  /* recarregou no sucesso sem código (o pedido falhou ou a conta veio de outra aba): tenta 1x */
  const pediuNaVolta = useRef(false);
  useEffect(() => {
    if (pediuNaVolta.current || authLoading || !user) return;
    if (estado.passo !== "sucesso" || codigoDaPortaOk(estado.codigo)) return;
    pediuNaVolta.current = true;
    void pedirCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, estado.passo]);

  /* ---------------------------------------------------------- sucesso: loja */
  const clicouLoja = useRef(false);
  const avisouVolta = useRef(false);
  const [voltou, setVoltou] = useState(false);
  useEffect(() => {
    const aoMudar = () => {
      if (document.visibilityState !== "visible" || !clicouLoja.current) return;
      setVoltou(true);
      if (!avisouVolta.current) { avisouVolta.current = true; trackEvent("porta_voltou_aba", { ...ids() }); }
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hrefLoja = (loja: "ios" | "android" | null): string => {
    const a = attrAgora();
    const q = new URLSearchParams({ origem: "porta" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android", via: "botao" | "auto" = "botao") => {
    clicouLoja.current = true;
    trackEventBeacon("porta_loja_click", { plataforma, loja, via, metodo: estadoRef.current.metodo, ...ids() });
  };

  /* Sucesso, no celular (como a Dinzo: "Abrindo a App Store…"): conta SEGUNDOS_ATE_A_LOJA e abre a loja sozinha
   * — 1x por sessão (recarregar não repete; quem volta da loja não é jogado de novo). Qualquer toque na página
   * cancela o automático (a pessoa está lendo/agindo). No Instagram a App Store abre POR CIMA da página: fechando
   * a loja, a pessoa volta e ainda vê o "toque em Entrar". Computador: nunca (lá é o QR). */
  const [abrindo, setAbrindo] = useState(false);
  const cancelouAuto = useRef(false);
  useEffect(() => {
    if (estado.passo !== "sucesso" || plataforma === "web") return;
    let ja = false;
    try { ja = sessionStorage.getItem(CHAVE_LOJA_AUTO) === "1"; } catch { /* sem storage: segue */ }
    if (ja || clicouLoja.current || cancelouAuto.current) return;
    setAbrindo(true);
    const t = window.setTimeout(() => {
      setAbrindo(false);
      if (clicouLoja.current || cancelouAuto.current) return;
      try { sessionStorage.setItem(CHAVE_LOJA_AUTO, "1"); } catch { /* noop */ }
      const loja = plataforma === "android" ? "android" : "ios";
      onLoja(loja, "auto");
      irPraLoja(hrefLoja(loja));
    }, SEGUNDOS_ATE_A_LOJA * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, plataforma]);
  const cancelarAuto = () => {
    if (!abrindo) return;
    cancelouAuto.current = true;
    setAbrindo(false);
  };

  /* ---------------------------------------------------------- render */
  const indice = ORDEM.indexOf(estado.passo);
  const progresso = PROGRESSO[estado.passo] ?? null;
  const podeVoltar = indice > 0 && estado.passo !== "sucesso";
  const voltar = () => { if (podeVoltar) ir(ORDEM[indice - 1]); };

  let tela: React.ReactNode = null;
  if (estado.passo === "area") {
    tela = (
      <PerguntaPorta
        key="area" testid="porta-q-area" titulo={PERGUNTA_AREA} opcoes={OPCOES_AREA} inicial={estado.escolha}
        onEscolher={(o) => {
          const area = o.id as EscolhaPorta;
          passoFeito("area", area, area);
          // trocou de área: a dor e o número da área antiga não valem mais
          ir("p2", estadoRef.current.escolha === area ? { escolha: area } : { escolha: area, p2: null, p3: null });
        }}
      />
    );
  } else if (estado.passo === "p2") {
    const q = PERGUNTA_DOR[rota];
    tela = (
      <PerguntaPorta
        key={`p2-${rota}`} testid="porta-q-p2" titulo={q.q} opcoes={q.opts} inicial={estado.p2}
        sub={estado.escolha === "tudo" ? <span data-testid="porta-tudo">{ABERTURA_TUDO}</span> : undefined}
        onEscolher={(o) => { passoFeito("p2", o.label); ir("p3", { p2: o.id }); }}
      />
    );
  } else if (estado.passo === "p3") {
    const q = PERGUNTA_NUMERO[rota];
    tela = <PerguntaPorta key={`p3-${rota}`} testid="porta-q-p3" titulo={q.q} opcoes={q.opts} inicial={estado.p3} onEscolher={(o) => { passoFeito("p3", o.label); ir("organiza", { p3: o.id }); }} />;
  } else if (estado.passo === "organiza") {
    tela = (
      <PerguntaMulti
        testid="porta-q-organiza" titulo={PERGUNTA_ORGANIZA} sub={DICA_ORGANIZA} opcoes={OPCOES_ORGANIZA}
        inicial={estado.p4 ?? []} alternar={alternarOrganiza}
        onContinuar={(ids) => { passoFeito("organiza", rotulosOrganiza(ids)); ir("conta", { p4: ids }); }}
      />
    );
  } else if (estado.passo === "conta") {
    tela = (
      <ContaPorta
        mostrarTeste={plataforma === "ios"}
        emInApp={emInApp}
        appDoWebview={appDoWebview()}
        mostrarApple={plataforma !== "android"}
        emailLogado={!authLoading && user ? user.email ?? null : null}
        onApple={onApple}
        onGoogle={onGoogle}
        onGoogleBloqueado={onGoogleBloqueado}
        onCriarConta={onCriarConta}
        onEntrarComSenha={onEntrarComSenha}
        onSalvarNestaConta={onSalvarNestaConta}
        onTrocarConta={async () => { await supabase.auth.signOut(); }}
        onErroCampo={(campo, motivo) => trackEvent("porta_conta_erro", { campo, motivo, ...ids() })}
      />
    );
  } else if (estado.passo === "sucesso") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    tela = (
      <SucessoPorta
        plataforma={plataforma}
        metodo={estado.metodo ?? "senha"}
        voltou={voltou}
        abrindo={abrindo}
        emailEnviado={comCodigo && !!estado.emailEnviado}
        abrirApp={comCodigo ? abrirAppComCodigo(estado.codigo as string) : null}
        hrefLoja={hrefLoja}
        qrUrl={URL_QR}
        onLoja={onLoja}
        onAbrirApp={(onde) => trackEventBeacon("porta_abrir_app_click", { onde, voltou, metodo: estado.metodo, ...ids() })}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f6f5f7] text-[#16121c] antialiased" data-testid="porta" data-passo={estado.passo} onPointerDownCapture={cancelarAuto}>
      <div className="mx-auto w-full max-w-[440px] px-5 pb-10" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
        <TopoPorta />
        <CardPorta progresso={progresso} onVoltar={podeVoltar ? voltar : undefined} passo={estado.passo}>
          {tela}
        </CardPorta>
        {estado.passo === "area" && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => { trackEvent("porta_entrar_click", { ...ids() }); navigate("/entrar"); }} className="h-10 px-4 text-[14px] text-[#6b6670]" data-testid="porta-entrar">
              Já tem conta? <b className="text-[#16121c]">Entrar</b>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** os rótulos do passo 4, na ordem da tela, separados por vírgula */
const rotulosOrganiza = (ids: string[]): string =>
  OPCOES_ORGANIZA.filter((o) => ids.includes(o.id)).map((o) => o.label).join(", ");
