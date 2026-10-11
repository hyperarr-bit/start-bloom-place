import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
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
import { ABERTURA_TUDO, OPCOES_AREA, PERGUNTA_AREA, PERGUNTA_DOR, PERGUNTA_NUMERO, comSemDa, labelDe, rotaDe, type EscolhaPorta } from "./conteudo";
import { WelcomePorta } from "./WelcomePorta";
import { ComSemPorta, PerguntaPorta, PlanoPorta } from "./telas";
import { ContaPorta, type Resultado } from "./ContaPorta";
import { SalvoPorta, type Plataforma } from "./SalvoPorta";
import { irPraLoja } from "./navegar";
import { InstrucaoPorta } from "./InstrucaoPorta";

/** Tela 7: segundos até abrir a loja sozinha (como a Dinzo). Dá pra ler "toque em Entrar" antes. */
export const SEGUNDOS_ATE_A_LOJA = 4;
/** "Último passo": segundos até abrir a loja sozinho (dá tempo de ver os 2 prints). */
export const SEGUNDOS_NA_INSTRUCAO = 10;
const CHAVE_LOJA_AUTO = "porta-loja-auto";

/**
 * A PORTA iPHONE — coreaplicativo.com.br/comece (10/10). Só na WEB (o app
 * nativo nunca monta: a rota fica atrás do SoNaWeb no App.tsx). noindex.
 *
 * anúncio → welcome com vídeo → área + as 2 perguntas do funil do app (a dor e
 * o número) → com × sem o CORE → plano de 3 dias com cadeado → CRIA A CONTA no
 * site (Apple, Google ou e-mail + senha; a campanha fica gravada em
 * user_metadata.porta) → "Pronto, salvo":
 * baixa o app, toca em "Entrar" (abaixo do Começar) com o mesmo e-mail → o
 * paywall do app (3 dias grátis, já no ar) liga o teste à conta.
 *
 * SEM o preço do produto em lugar nenhum; "dias grátis" só na tela 7.
 *
 * Eventos (analytics_events, todos com porta_session_id + ids do anúncio):
 *   porta_view {attr…}           1ª carga da sessão
 *   porta_passo {passo, area, resposta}
 *   porta_conta_iniciada {metodo}
 *   porta_conta_criada {metodo, existente, event_id, gravou}
 *   porta_loja_click {plataforma, loja}   (keepalive: a página sai pra loja)
 *   porta_voltou_aba {}
 *   porta_google_bloqueado {}            tocou no Google dentro do Instagram/Facebook (aviso, sem OAuth)
 * Pixel: ViewContent na welcome; CompleteRegistration (eventID = porta.event_id) na conta nova.
 */
export type Passo = "welcome" | "area" | "p2" | "p3" | "comsem" | "plano" | "conta" | "instrucao" | "salvo";
export const ORDEM: Passo[] = ["welcome", "area", "p2", "p3", "comsem", "plano", "conta", "instrucao", "salvo"];

export type EstadoPorta = {
  passo: Passo;
  escolha: EscolhaPorta | null;
  p2: string | null;
  p3: string | null;
  eventId: string;
  metodo: string | null;
  email: string | null;
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
    if (e && ORDEM.includes(e.passo) && typeof e.eventId === "string") { memoriaEstado = e; return e; }
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
    return { passo: "conta", escolha: (o.escolha ?? null) as EscolhaPorta | null, p2: o.p2 ?? null, p3: o.p3 ?? null, eventId: o.eventId, metodo: null, email: null };
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

  const [estado, setEstadoCru] = useState<EstadoPorta>(() => lerEstado() ?? estadoDaUrl() ?? { passo: "welcome", escolha: null, p2: null, p3: null, eventId: novoId(), metodo: null, email: null });
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

  /* porta_view: uma vez por sessão da Porta, com a atribuição inteira */
  useEffect(() => {
    if (!inicio.current?.nova) return;
    const { origem, ...a } = inicio.current.attr;
    trackEvent("porta_view", { ...a, atribuicao: origem, porta_session_id: sessao, plataforma, in_app: emInApp, retomou: estado.passo !== "welcome" ? estado.passo : null });
    fireMetaEvent("ViewContent", { content_name: "porta_iphone", content_category: "porta" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [estado.passo]);

  const ir = (passo: Passo, extra: Partial<EstadoPorta> = {}) => setEstado((e) => ({ ...e, ...extra, passo }));
  const passoFeito = (passo: string, resposta: string | null, area: string | null = estadoRef.current.escolha) =>
    trackEvent("porta_passo", { passo, area, resposta, ...ids() });

  /* as respostas como o APP guarda (chave → texto da opção): atrapalha + gasto|consistencia */
  const respostas = (e: EstadoPorta = estadoRef.current): PortaNaConta["respostas"] => {
    const r = rotaDe(e.escolha);
    const num = PERGUNTA_NUMERO[r];
    return {
      area: e.escolha ?? "dinheiro", rota: r, p2: e.p2, p3: e.p3,
      atrapalha: labelDe(PERGUNTA_DOR[r].opts, e.p2), [num.key]: labelDe(num.opts, e.p3),
    };
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
        void persistLeadSource(supabase, u.id);
      }
      trackEvent("porta_conta_criada", { metodo, existente, event_id: eventId, gravou: dec.gravar, area: e.escolha, ...ids() });
      // 10/10: no celular, antes da tela 7, o "Último passo: no app, toque em Entrar" (computador vai direto pro QR)
      setEstado((x) => ({ ...x, passo: plataformaDaWeb() === "web" ? "salvo" : "instrucao", metodo, email: u.email ?? x.email, eventId }));
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
    if ((e.passo === "conta" && social) || (paramPasso === "voltou" && e.passo !== "salvo" && e.passo !== "instrucao")) void concluir(social ? (e.metodo as string) : "google");
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
      q.set(PARAM_ESTADO, JSON.stringify({ escolha: e.escolha, p2: e.p2, p3: e.p3, eventId: e.eventId }));
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

  /* ---------------------------------------------------------- tela 7: loja */
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

  /* 10/10 (dono: "no Dinzo, depois de alguns segundos ele redireciona automático pra loja"): na tela 7, no
   * celular, conta SEGUNDOS_ATE_A_LOJA e abre a loja sozinha — 1x por sessão (recarregar não repete; quem volta
   * da loja não é jogado de novo). No Instagram a App Store abre POR CIMA da página: fechando a loja, a pessoa
   * volta e ainda vê o "toque em Entrar". Computador: nunca (lá é o QR). */
  const [contagem, setContagem] = useState<number | null>(null);
  useEffect(() => {
    if (estado.passo !== "salvo" || plataforma === "web") return;
    let ja = false;
    try { ja = sessionStorage.getItem(CHAVE_LOJA_AUTO) === "1"; } catch { /* sem storage: segue */ }
    if (ja || clicouLoja.current) return;
    setContagem(SEGUNDOS_ATE_A_LOJA);
    let n = SEGUNDOS_ATE_A_LOJA;
    const t = window.setInterval(() => {
      n -= 1;
      if (clicouLoja.current) { window.clearInterval(t); setContagem(null); return; }
      if (n > 0) { setContagem(n); return; }
      window.clearInterval(t);
      setContagem(null);
      try { sessionStorage.setItem(CHAVE_LOJA_AUTO, "1"); } catch { /* noop */ }
      const loja = plataforma === "android" ? "android" : "ios";
      onLoja(loja, "auto");
      irPraLoja(hrefLoja(loja));
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, plataforma]);

  /* 10/10 (dono: "não tá indo automático pro app depois de uns 10 segundos naquela tela"): o "Último passo"
   * também conta (SEGUNDOS_NA_INSTRUCAO) e abre a loja sozinho — dá tempo de ver os 2 prints; o botão adianta. */
  const baixarDaInstrucao = (via: "botao" | "auto") => {
    const loja = plataforma === "android" ? "android" : "ios";
    passoFeito("instrucao", via === "auto" ? "baixar_auto" : "baixar");
    onLoja(loja, via);
    try { sessionStorage.setItem(CHAVE_LOJA_AUTO, "1"); } catch { /* noop */ }
    setEstado((x) => ({ ...x, passo: "salvo" }));
  };
  const [contagemInstrucao, setContagemInstrucao] = useState<number | null>(null);
  useEffect(() => {
    if (estado.passo !== "instrucao" || plataforma === "web") { setContagemInstrucao(null); return; }
    let n = SEGUNDOS_NA_INSTRUCAO;
    setContagemInstrucao(n);
    const t = window.setInterval(() => {
      n -= 1;
      if (estadoRef.current.passo !== "instrucao" || clicouLoja.current) { window.clearInterval(t); setContagemInstrucao(null); return; }
      if (n > 0) { setContagemInstrucao(n); return; }
      window.clearInterval(t);
      setContagemInstrucao(null);
      const loja = plataforma === "android" ? "android" : "ios";
      baixarDaInstrucao("auto");
      irPraLoja(hrefLoja(loja));
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.passo, plataforma]);

  /* ---------------------------------------------------------- render */
  if (estado.passo === "welcome") {
    return (
      <WelcomePorta
        onComecar={() => { passoFeito("welcome", "comecar", null); ir("area"); }}
        onEntrar={() => { trackEvent("porta_entrar_click", { ...ids() }); navigate("/entrar"); }}
        onVideo={(ok, motivo) => trackEvent("porta_video", { ok, motivo: motivo ?? null, ...ids() })}
      />
    );
  }

  const indice = ORDEM.indexOf(estado.passo);
  const comBarra = indice >= 1 && indice <= 6;
  const voltar = () => { if (indice > 0 && estado.passo !== "salvo" && estado.passo !== "instrucao") ir(ORDEM[indice - 1]); };

  let tela: React.ReactNode = null;
  if (estado.passo === "area") {
    tela = (
      <PerguntaPorta
        testid="porta-area" titulo={PERGUNTA_AREA} opcoes={OPCOES_AREA}
        onEscolher={(o) => { passoFeito("area", o.id, o.id); ir("p2", { escolha: o.id as EscolhaPorta, p2: null, p3: null }); }}
      />
    );
  } else if (estado.passo === "p2") {
    // a DOR (quiz_1 do app); quem entrou por "Tudo" vê a linha de abertura do app em cima
    const q = PERGUNTA_DOR[rota];
    tela = <PerguntaPorta testid="porta-p2" abertura={estado.escolha === "tudo" ? ABERTURA_TUDO : undefined} titulo={q.q} opcoes={q.opts} onEscolher={(o) => { passoFeito("p2", o.label); ir("p3", { p2: o.id }); }} />;
  } else if (estado.passo === "p3") {
    // o NÚMERO da rota (dinheiro: quiz_3 "gasto"; as outras: quiz_2 "consistencia")
    const q = PERGUNTA_NUMERO[rota];
    tela = <PerguntaPorta testid="porta-p3" titulo={q.q} opcoes={q.opts} onEscolher={(o) => { passoFeito("p3", o.label); ir("comsem", { p3: o.id }); }} />;
  } else if (estado.passo === "comsem") {
    tela = <ComSemPorta dados={comSemDa(rota, estado.p3)} onNext={() => { passoFeito("comsem", "seguir"); ir("plano"); }} />;
  } else if (estado.passo === "plano") {
    tela = <PlanoPorta rota={rota} dor={estado.p2} onDesbloquear={() => { passoFeito("plano", "desbloquear"); ir("conta"); }} />;
  } else if (estado.passo === "conta") {
    tela = (
      <ContaPorta
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
      />
    );
  } else if (estado.passo === "instrucao") {
    const loja = plataforma === "android" ? "android" : "ios";
    tela = (
      <InstrucaoPorta
        plataforma={plataforma}
        metodo={estado.metodo ?? "senha"}
        email={estado.email ?? user?.email ?? ""}
        hrefLoja={hrefLoja(loja)}
        contagem={contagemInstrucao}
        onBaixar={() => baixarDaInstrucao("botao")}
      />
    );
  } else if (estado.passo === "salvo") {
    tela = (
      <SalvoPorta
        email={estado.email ?? user?.email ?? ""}
        metodo={estado.metodo ?? "senha"}
        plataforma={plataforma}
        voltou={voltou}
        contagem={contagem}
        hrefLoja={hrefLoja}
        qrUrl={URL_QR}
        onLoja={onLoja}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white text-[#16121c] antialiased" data-testid="porta" data-passo={estado.passo}>
      <div className="mx-auto w-full max-w-[430px] min-h-[100dvh] flex flex-col px-5" style={{ paddingTop: "calc(10px + env(safe-area-inset-top))" }}>
        {comBarra && (
          <div className="flex items-center gap-3 h-11" data-testid="porta-topo">
            <button type="button" onClick={voltar} aria-label="Voltar" className="grid place-items-center w-9 h-9 -ml-2 rounded-full text-[#16121c] active:bg-[#f2eff5]" data-testid="porta-voltar">
              <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
            </button>
            <div className="flex-1 h-1.5 rounded-full bg-[#efedf2] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={indice}>
              <motion.div className="h-full rounded-full bg-[#16121c]" initial={false} animate={{ width: `${(indice / 6) * 100}%` }} transition={{ duration: 0.35, ease: "easeOut" }} />
            </div>
            <span className="w-7" aria-hidden />
          </div>
        )}
        <motion.div key={estado.passo} className={`flex-1 flex flex-col ${comBarra ? "pt-4" : "pt-8"}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
          {tela}
        </motion.div>
      </div>
    </div>
  );
}
