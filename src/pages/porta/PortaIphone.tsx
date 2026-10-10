import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { entrarComGoogle } from "@/lib/auth-nativo";
import { guardarDestino } from "@/lib/destino-seguro";
import { isInAppBrowser } from "@/lib/funnel";
import { getAuthRedirectUrl } from "@/lib/utils";
import { persistLeadSource } from "@/lib/lead-source";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { capturarAtribuicao, decidirGravacao, idsDoAnuncio, lerAtribuicao, montarPorta, sessaoDaPorta, type AtribuicaoPorta, type PortaNaConta } from "./atribuicao";
import { OPCOES_AREA, PERGUNTA_2, PERGUNTA_3, PERGUNTA_3_OPCOES, PERGUNTA_AREA, comSemDa, rotaDe, type EscolhaPorta } from "./conteudo";
import { WelcomePorta } from "./WelcomePorta";
import { ComSemPorta, PerguntaPorta, PlanoPorta } from "./telas";
import { ContaPorta, type Resultado } from "./ContaPorta";
import { SalvoPorta, type Plataforma } from "./SalvoPorta";

/**
 * A PORTA iPHONE — coreaplicativo.com.br/comece (10/10). Só na WEB (o app
 * nativo nunca monta: a rota fica atrás do SoNaWeb no App.tsx). noindex.
 *
 * anúncio → welcome com vídeo → 3 perguntas de 1 toque → com × sem o CORE →
 * plano de 3 dias com cadeado → CRIA A CONTA no site (Google ou e-mail com
 * código; a campanha fica gravada em user_metadata.porta) → "Pronto, salvo":
 * baixa o app, toca em "Entrar" (abaixo do Começar) com o mesmo e-mail → o
 * paywall do app (3 dias grátis, já no ar) liga o teste à conta.
 *
 * SEM PREÇO em lugar nenhum; "dias grátis" só na tela 7.
 *
 * Eventos (analytics_events, todos com porta_session_id + ids do anúncio):
 *   porta_view {attr…}           1ª carga da sessão
 *   porta_passo {passo, area, resposta}
 *   porta_conta_iniciada {metodo}
 *   porta_conta_criada {metodo, existente, event_id, gravou}
 *   porta_loja_click {plataforma, loja}   (keepalive: a página sai pra loja)
 *   porta_voltou_aba {}
 * Pixel: ViewContent na welcome; CompleteRegistration (eventID = porta.event_id) na conta nova.
 */
export type Passo = "welcome" | "area" | "p2" | "p3" | "comsem" | "plano" | "conta" | "salvo";
export const ORDEM: Passo[] = ["welcome", "area", "p2", "p3", "comsem", "plano", "conta", "salvo"];

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

const msgErroOtp = (m: string): string =>
  /rate|limit|security purposes|seconds/i.test(m)
    ? "Já mandei um código há pouco. Confira a caixa de entrada e o spam."
    : /invalid.*email|email.*invalid|valid email/i.test(m)
      ? "Esse e-mail parece errado. Confere e tenta de novo."
      : "Não consegui mandar o código. Tenta de novo em alguns segundos.";

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
    const s = sessaoDaPorta();
    inicio.current = { attr, sessao: s.id, nova: s.nova };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = () => idsDoAnuncio(attrAgora(), sessao);

  const [estado, setEstadoCru] = useState<EstadoPorta>(() => lerEstado() ?? { passo: "welcome", escolha: null, p2: null, p3: null, eventId: novoId(), metodo: null, email: null });
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

  const respostas = (e: EstadoPorta = estadoRef.current): PortaNaConta["respostas"] => ({ area: e.escolha ?? "dinheiro", rota: rotaDe(e.escolha), p2: e.p2, p3: e.p3 });

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
      let existente = dec.existente;
      if (metodo === "link_email" && atual) {
        // voltou pelo link do e-mail (outro navegador, outra sessão): a conta é nova se nasceu há menos de 1 h
        const criada = u.created_at ? Date.parse(u.created_at) : NaN;
        existente = !(Number.isFinite(criada) && agora - criada < 60 * 60 * 1000);
      }
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
      setEstado((x) => ({ ...x, passo: "salvo", metodo, email: u.email ?? x.email, eventId }));
      return { ok: true };
    } catch {
      concluindo.current = false;
      return { ok: false, erro: "Não consegui salvar agora. Tenta de novo." };
    }
  }, [sessao, setEstado]);

  /* volta do Google (/auth/callback → /comece?passo=voltou) e do link do e-mail (?passo=salvo) */
  useEffect(() => {
    if (authLoading || !user) return;
    const e = estadoRef.current;
    if ((e.passo === "conta" && e.metodo === "google") || (paramPasso === "voltou" && e.passo !== "salvo")) { void concluir("google"); return; }
    if (paramPasso === "salvo" && e.passo !== "salvo") void concluir("link_email");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const onGoogle = async (): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo: "google", ...ids() });
    setEstado((e) => ({ ...e, passo: "conta", metodo: "google" }));
    guardarDestino("/comece?passo=voltou");
    const { error } = await entrarComGoogle();
    if (error) {
      setEstado((e) => ({ ...e, metodo: null }));
      return { ok: false, erro: "Não consegui abrir o Google. Use seu e-mail aqui embaixo." };
    }
    return { ok: true };
  };

  const onEnviarCodigo = async (email: string): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo: "email", ...ids() });
    const e = estadoRef.current;
    const porta = montarPorta({ attr: capturarAtribuicao({ search: "" }), respostas: respostas(e), eventId: e.eventId, sessao, metodo: "email" });
    setEstado((x) => ({ ...x, metodo: "email", email }));
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // vale só na CRIAÇÃO da conta (conta que já existe ignora): a 1ª atribuição nasce junto com a conta
        data: { porta },
        // se a pessoa tocar no link do e-mail em vez de digitar o código, volta pra tela 7
        emailRedirectTo: getAuthRedirectUrl(`/auth/callback?next=${encodeURIComponent("/comece?passo=salvo")}`),
      },
    });
    if (error) {
      trackEvent("porta_erro", { onde: "enviar_codigo", msg: (error.message || "").slice(0, 160), ...ids() });
      return { ok: false, erro: msgErroOtp(error.message || "") };
    }
    return { ok: true };
  };

  const onConferir = async (email: string, codigo: string): Promise<Resultado> => {
    const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
    if (error) {
      trackEvent("porta_erro", { onde: "conferir_codigo", msg: (error.message || "").slice(0, 160), ...ids() });
      return { ok: false, erro: /expired/i.test(error.message || "") ? "Esse código venceu. Peça outro." : "Código não bateu. Confere os números do e-mail." };
    }
    return concluir("email");
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
  const onLoja = (loja: "ios" | "android") => {
    clicouLoja.current = true;
    trackEventBeacon("porta_loja_click", { plataforma, loja, metodo: estadoRef.current.metodo, ...ids() });
  };

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
  const voltar = () => { if (indice > 0 && estado.passo !== "salvo") ir(ORDEM[indice - 1]); };

  let tela: React.ReactNode = null;
  if (estado.passo === "area") {
    tela = (
      <PerguntaPorta
        testid="porta-area" titulo={PERGUNTA_AREA} opcoes={OPCOES_AREA}
        onEscolher={(o) => { passoFeito("area", o.id, o.id); ir("p2", { escolha: o.id as EscolhaPorta, p2: null, p3: null }); }}
      />
    );
  } else if (estado.passo === "p2") {
    const q = PERGUNTA_2[rota];
    tela = <PerguntaPorta testid="porta-p2" titulo={q.q} opcoes={q.opts} onEscolher={(o) => { passoFeito("p2", o.id); ir("p3", { p2: o.id }); }} />;
  } else if (estado.passo === "p3") {
    tela = <PerguntaPorta testid="porta-p3" titulo={PERGUNTA_3} opcoes={PERGUNTA_3_OPCOES[rota]} onEscolher={(o) => { passoFeito("p3", o.id); ir("comsem", { p3: o.id }); }} />;
  } else if (estado.passo === "comsem") {
    tela = <ComSemPorta dados={comSemDa(rota, estado.p2)} onNext={() => { passoFeito("comsem", "seguir"); ir("plano"); }} />;
  } else if (estado.passo === "plano") {
    tela = <PlanoPorta rota={rota} p3={estado.p3} onDesbloquear={() => { passoFeito("plano", "desbloquear"); ir("conta"); }} />;
  } else if (estado.passo === "conta") {
    tela = (
      <ContaPorta
        emInApp={emInApp}
        emailLogado={!authLoading && user ? user.email ?? null : null}
        onGoogle={onGoogle}
        onEnviarCodigo={onEnviarCodigo}
        onConferir={onConferir}
        onSalvarNestaConta={onSalvarNestaConta}
        onTrocarConta={async () => { await supabase.auth.signOut(); }}
      />
    );
  } else if (estado.passo === "salvo") {
    tela = (
      <SalvoPorta
        email={estado.email ?? user?.email ?? ""}
        metodo={estado.metodo ?? "email"}
        plataforma={plataforma}
        voltou={voltou}
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
