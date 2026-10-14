import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { entrarComApple, entrarComGoogle } from "@/lib/auth-nativo";
import { guardarDestino } from "@/lib/destino-seguro";
import { isInAppBrowser } from "@/lib/funnel";
import { getAuthRedirectUrl } from "@/lib/utils";
import { persistLeadSource } from "@/lib/lead-source";
import { isNativeShell } from "@/lib/native-shell";
import { ENTRADA_APP } from "@/lib/rotas-web";
import { getSeedsForModule } from "@/lib/preview-seeds";
import { MODULO_DO_TIPO, type ItemDaDemo } from "@/lib/demo-guiada";
import { VoltaDaDemoProvider, type VoltaDaDemo } from "@/lib/volta-da-demo";
import { capturarAtribuicao, decidirGravacao, idsDoAnuncio, lerAtribuicao, montarPorta, sessaoDaPorta, type AtribuicaoPorta, type PortaNaConta } from "@/pages/porta/atribuicao";
import { CardPorta, LOGO_PORTA } from "@/pages/porta/telas";
import { ContaPorta, type Resultado } from "@/pages/porta/ContaPorta";
import { SucessoPorta, type Plataforma } from "@/pages/porta/SucessoPorta";
import { irPraLoja } from "@/pages/porta/navegar";
import { abrirAppComCodigo, codigoDaPortaOk } from "@/pages/porta/handoff";
import { msDesdeANavegacao } from "@/pages/porta/medicao";
import {
  AREA_DO_MODULO, BOTAO_CRIAR, CONTA_TITULO, FAIXA_TEXTO, FIM_TEXTO, FIM_TITULO, MODULOS_DEMO, SEGUNDOS_ATE_A_FOLHA,
  TOPO_SELO, VARIANTE, VOLTAR_DEMO, contaTexto, moduloDaUrl, type ModuloDemo,
} from "./conteudo";
import { FolhaDemo } from "./FolhaDemo";
import { aindaEsta, codificarItens, decodificarItens, itemDaGravacao, juntarItem, levarItensParaConta, type BancoDosItens } from "./itens";

/**
 * O FUNIL-DEMO — coreaplicativo.com.br/experimente (14/10, campanha nova; a Porta do /comece fica como está).
 * Inspirado no "Controle Next": o anúncio abre o APP DE VERDADE com dados de exemplo, a pessoa mexe à vontade
 * (tudo em memória), e "Criar conta" está sempre à vista. Só na WEB (SoNaWeb no App.tsx + cinto aqui). noindex.
 *
 *   DEMO   topo (CORE · Modo demonstração · Entrar · [Criar conta]) + faixa "Demonstração com dados de exemplo ·
 *          Criar conta" + pílulas dos 5 módulos (Finanças, Rotina, Treino, Saúde, Dieta — ordem do uso real;
 *          `?m=` escolhe o 1º) + o módulo REAL (infra do /preview: PreviewUserDataProvider) + "Gostou?" no fim.
 *          Folha de baixo 1x por sessão: aos 30 s OU na 2ª troca de módulo — não bloqueia nada.
 *   CONTA  a MESMA conta da Porta (ContaPorta: Apple / Google com o aviso do Instagram / e-mail+senha), com o
 *          título deste funil. Atribuição da Porta (user_metadata.porta, só se AUSENTE) + `variante: "demo"`.
 *          CompleteRegistration 1x por conta nova (pixel + CAPI, mesmo eventID) — igual à Porta.
 *   SUCESSO a MESMA tela da Porta (SucessoPorta): iPhone = App Store (abre sozinha em 3 s, 1x) e, na volta,
 *          "Abrir o CORE" já logado (core://entrar?h=<código do porta-handoff>); Android = Play; computador = QR.
 *
 * O passo mora na URL (`passo=conta|sucesso`; `voltou` = volta do Google/Apple), então o Voltar do navegador
 * volta pra demo. O que ELA anotou (gasto, hábito digitado, exercício digitado) vai pra conta — ver ./itens.ts.
 * Exemplo NUNCA vai. Sem preço, sem "sem cartão", sem área de transferência.
 *
 * Eventos (todos com porta_session_id + ids do anúncio + variante "demo"):
 *   demo_view {modulo, tempo_ms, entrada}       1ª vez que cada módulo aparece nesta página (tempo desde a navegação)
 *   demo_pilula {de, para, n}                   trocou de módulo pelas pílulas (n = nº da troca)
 *   demo_edicao {modulo, chave}                 1ª mexida da pessoa em cada módulo
 *   demo_item {tipo, n}                         achou um item criado por ela (o que pode seguir pra conta)
 *   demo_folha_view {gatilho: "30s"|"pilula"} · demo_folha_criar {gatilho} · demo_folha_fechar {gatilho, via}
 *   demo_criar_conta_click {origem: "topo"|"faixa"|"folha"|"fim"|"seta", modulo, ms_na_demo, itens}
 *   demo_entrar_click {}
 *   demo_itens_conta {ok, n, chaves, erro}      os itens dela gravados na conta
 *   + os da Porta: porta_passo {passo: "conta"|"sucesso", resposta: "view"}, porta_conta_erro, porta_conta_iniciada,
 *     porta_conta_criada, porta_conta_existe, porta_erro, porta_google_bloqueado, porta_codigo, porta_loja_click,
 *     porta_voltou_aba, porta_abrir_app_click.
 * Pixel: ViewContent (content_name "porta_demo") 1x por sessão; CompleteRegistration igual à Porta.
 */

const lazyModulo = (carregar: () => Promise<{ default?: unknown }>) =>
  lazy(async () => {
    const mod = await carregar();
    if (mod && typeof mod.default !== "undefined") return mod as { default: React.ComponentType };
    throw new Error("Failed to fetch dynamically imported module (módulo resolveu vazio)");
  });
const COMPONENTES: Record<ModuloDemo, React.ComponentType> = {
  financas: lazyModulo(() => import("@/pages/Index")),
  rotina: lazyModulo(() => import("@/pages/Rotina")),
  treino: lazyModulo(() => import("@/pages/Treino")),
  saude: lazyModulo(() => import("@/pages/Saude")),
  dieta: lazyModulo(() => import("@/pages/Dieta")),
};

const CarregandoModulo = () => (
  <div className="min-h-[60vh] px-4 pt-6 space-y-3 animate-pulse" aria-busy="true" aria-label="Carregando">
    <div className="h-8 w-40 rounded-lg bg-muted" />
    <div className="h-10 rounded-xl bg-muted/70" />
    <div className="h-40 rounded-2xl bg-muted/60" />
    <div className="h-24 rounded-2xl bg-muted/50" />
  </div>
);

/** Sucesso: segundos até a loja abrir sozinha (igual à Porta). */
export const SEGUNDOS_ATE_A_LOJA = 3;
const CHAVE_LOJA_AUTO = "demo-loja-auto";
const CHAVE_FOLHA = "demo-folha-v1";
export const CHAVE_ESTADO_DEMO = "demo-estado-v1";
export const PARAM_ESTADO = "pe";
export const PARAM_SESSAO = "ps";
export const URL_QR = "https://coreaplicativo.com.br/baixar?origem=porta_demo_qr";
/** a gravação dos itens dela não segura a tela do sucesso mais que isso */
const MS_ITENS = 5000;

export type OrigemCriar = "topo" | "faixa" | "folha" | "fim" | "seta";
type Passo = "demo" | "conta" | "sucesso";

export type EstadoDemo = {
  /** "sucesso" depois da conta (o resto do passo mora na URL) */
  concluido: boolean;
  eventId: string;
  metodo: string | null;
  email: string | null;
  codigo?: string | null;
  emailEnviado?: boolean;
  /** os itens dela (codificados), fixados no toque em "Criar conta" */
  itens: string[];
  origem?: OrigemCriar | null;
  /** o CompleteRegistration já saiu pra este eventID (1x por conta nova) */
  crEnviado?: string | null;
};

let memoriaEstado: EstadoDemo | null = null;
let memoriaFolha = false;
/** só pros testes */
export function _zerarEstadoDemo(): void { memoriaEstado = null; memoriaFolha = false; }

const novoId = (): string => {
  try { return `porta_cr_${crypto.randomUUID()}`; } catch { return `porta_cr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }
};
const RE_EVENT_ID = /^porta_cr_[a-z0-9-]{6,60}$/i;

function lerEstado(): EstadoDemo | null {
  if (memoriaEstado) return memoriaEstado;
  try {
    const raw = localStorage.getItem(CHAVE_ESTADO_DEMO);
    if (!raw) return null;
    const e = JSON.parse(raw) as EstadoDemo;
    if (e && typeof e.eventId === "string" && RE_EVENT_ID.test(e.eventId)) {
      memoriaEstado = { ...e, concluido: !!e.concluido, itens: codificarItens(decodificarItens(e.itens)) };
      return memoriaEstado;
    }
  } catch { /* noop */ }
  return null;
}
function gravarEstado(e: EstadoDemo): void {
  memoriaEstado = e;
  try { localStorage.setItem(CHAVE_ESTADO_DEMO, JSON.stringify(e)); } catch { /* storage bloqueado: fica a memória */ }
}
/** Instagram → "Abrir no navegador" (o Google não entra no Instagram): o eventID e os itens vão na URL. */
function estadoDaUrl(): EstadoDemo | null {
  try {
    const raw = new URLSearchParams(window.location.search).get(PARAM_ESTADO);
    if (!raw) return null;
    const o = JSON.parse(raw) as { eventId?: unknown; itens?: unknown };
    if (typeof o.eventId !== "string" || !RE_EVENT_ID.test(o.eventId)) return null;
    return { concluido: false, eventId: o.eventId, metodo: null, email: null, itens: codificarItens(decodificarItens(o.itens)) };
  } catch {
    return null;
  }
}
const folhaJaVista = (): boolean => {
  if (memoriaFolha) return true;
  try { return sessionStorage.getItem(CHAVE_FOLHA) === "1"; } catch { return false; }
};
const marcarFolhaVista = () => {
  memoriaFolha = true;
  try { sessionStorage.setItem(CHAVE_FOLHA, "1"); } catch { /* noop */ }
};

const plataformaDaWeb = (): Plataforma => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
};
const appDoWebview = (): string => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /Instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ? "Facebook" : "navegador deste app";
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
const comTempo = <T,>(p: Promise<T>, ms: number, seEsgotar: T): Promise<T> =>
  Promise.race([p, new Promise<T>((r) => window.setTimeout(() => r(seEsgotar), ms))]);

/** A rota: o app da loja NUNCA monta o funil (cinto além do SoNaWeb do App.tsx). */
export default function ExperimenteRota() {
  if (isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
  return <Experimente />;
}

export function Experimente() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const modulo = moduloDaUrl(params.get("m"));
  const paramPasso = params.get("passo");

  // atribuição + sessão da Porta: na 1ª renderização, antes de qualquer troca de URL
  const inicio = useRef<{ attr: AtribuicaoPorta; sessao: string; nova: boolean; entrada: ModuloDemo; t0: number } | null>(null);
  if (!inicio.current) {
    const attr = capturarAtribuicao();
    let psUrl: string | null = null;
    try { psUrl = new URLSearchParams(window.location.search).get(PARAM_SESSAO); } catch { /* noop */ }
    const s = sessaoDaPorta(psUrl);
    inicio.current = { attr, sessao: s.id, nova: s.nova, entrada: modulo, t0: Date.now() };
  }
  const sessao = inicio.current.sessao;
  const attrAgora = () => lerAtribuicao() ?? inicio.current!.attr;
  const ids = () => ({ ...idsDoAnuncio(attrAgora(), sessao), variante: VARIANTE });
  const plataforma = useMemo(plataformaDaWeb, []);
  const emInApp = useMemo(isInAppBrowser, []);

  const [estado, setEstadoCru] = useState<EstadoDemo>(() => lerEstado() ?? estadoDaUrl() ?? { concluido: false, eventId: novoId(), metodo: null, email: null, itens: [] });
  const setEstado = useCallback((f: (e: EstadoDemo) => EstadoDemo) => {
    setEstadoCru((e) => { const n = f(e); gravarEstado(n); return n; });
  }, []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const passo: Passo =
    paramPasso === "sucesso" ? (estado.concluido ? "sucesso" : "conta")
      : paramPasso === "conta" || paramPasso === "voltou" ? "conta"
        : "demo";

  /* noindex + título, só enquanto o funil está montado */
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-demo", "");
    document.head.appendChild(meta);
    const tituloAntes = document.title;
    document.title = "CORE · Experimente o app";
    return () => { meta.remove(); document.title = tituloAntes; };
  }, []);

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }, [passo, modulo]);

  /* ---------------------------------------------------------- a demo */
  // o que ela mexeu, por módulo (só memória): trocar de módulo e voltar mantém as mudanças dela
  const mexidas = useRef<Partial<Record<ModuloDemo, Record<string, unknown>>>>({});
  const moduloRef = useRef(modulo);
  moduloRef.current = modulo;
  const editados = useRef(new Set<string>());
  const [itens, setItens] = useState<ItemDaDemo[]>(() => decodificarItens(estado.itens));
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const ler = (m: ModuloDemo) => (k: string): unknown => {
    const mx = mexidas.current[m];
    if (mx && k in mx) return mx[k];
    return getSeedsForModule(m)[k];
  };

  const aoGravar = useCallback((chave: string, valor: unknown, anterior: unknown, gesto: boolean) => {
    const m = moduloRef.current;
    (mexidas.current[m] ??= {})[chave] = valor;
    if (!gesto) return;
    if (!editados.current.has(m)) {
      editados.current.add(m);
      trackEvent("demo_edicao", { modulo: m, chave, ...ids() });
    }
    const item = itemDaGravacao(m, chave, valor, anterior, ler(m));
    if (!item) return;
    const n = juntarItem(itensRef.current, item);
    if (n !== itensRef.current) {
      itensRef.current = n;
      setItens(n);
      trackEvent("demo_item", { tipo: item.tipo, n: n.length, modulo: m, ...ids() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sementeDoModulo = useCallback((s: Record<string, unknown>) => ({ ...s, ...(mexidas.current[moduloRef.current] ?? {}) }), []);

  /* demo_view: 1ª vez de cada módulo nesta página; ViewContent 1x por sessão */
  const vistos = useRef(new Set<string>());
  useEffect(() => {
    if (passo !== "demo" || vistos.current.has(modulo)) return;
    const entrada = vistos.current.size === 0;
    vistos.current.add(modulo);
    const extra: Record<string, unknown> = {};
    if (entrada) {
      const { origem, ...a } = inicio.current!.attr;
      Object.assign(extra, a, { atribuicao: origem, plataforma, in_app: emInApp, sessao_nova: inicio.current!.nova });
    }
    trackEvent("demo_view", { modulo, tempo_ms: msDesdeANavegacao(), entrada, ...extra, ...ids() });
    if (entrada && inicio.current!.nova) fireMetaEvent("ViewContent", { content_name: "porta_demo", content_category: "porta" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, modulo]);

  /* a folha de baixo: 1x por sessão, aos 30 s de demo ou na 2ª troca de módulo; nunca depois de ela ir pra conta */
  const [folha, setFolha] = useState<null | "30s" | "pilula">(null);
  const mostrarFolha = useCallback((gatilho: "30s" | "pilula") => {
    if (folhaJaVista()) return;
    marcarFolhaVista();
    setFolha(gatilho);
    trackEvent("demo_folha_view", { gatilho, modulo: moduloRef.current, ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (passo !== "demo" || folhaJaVista()) return;
    const t = window.setTimeout(() => mostrarFolha("30s"), SEGUNDOS_ATE_A_FOLHA * 1000);
    return () => window.clearTimeout(t);
  }, [passo, mostrarFolha]);
  const fecharFolha = (via: "botao" | "x") => {
    if (folha) trackEvent("demo_folha_fechar", { gatilho: folha, via, ...ids() });
    setFolha(null);
  };

  const trocas = useRef(0);
  const trocarModulo = (para: ModuloDemo) => {
    if (para === modulo) return;
    trocas.current += 1;
    trackEvent("demo_pilula", { de: modulo, para, n: trocas.current, ...ids() });
    const q = new URLSearchParams(params);
    q.set("m", para);
    navigate({ search: `?${q.toString()}` }, { replace: true });
    if (trocas.current === 2) mostrarFolha("pilula");
  };

  const urlDoPasso = (p: "conta" | "sucesso" | null): string => {
    const q = new URLSearchParams(params);
    q.delete(PARAM_ESTADO);
    if (p) q.set("passo", p); else q.delete("passo");
    if (!q.get("m")) q.set("m", modulo);
    return `/experimente?${q.toString()}`;
  };
  /** O que vai pra conta: só o que ela criou E ainda está lá. Fixado aqui (a conta pode sair da página: Google, Safari). */
  const fixarItens = (): ItemDaDemo[] => {
    const valendo = itensRef.current.filter((i) => aindaEsta(i, ler(MODULO_DO_TIPO[i.tipo] as ModuloDemo)));
    setEstado((e) => ({ ...e, itens: codificarItens(valendo) }));
    return valendo;
  };
  const cliqueCriar = (origem: OrigemCriar) => {
    const valendo = fixarItens();
    marcarFolhaVista(); // foi pra conta: a folha não tem mais o que dizer
    setEstado((e) => ({ ...e, origem }));
    trackEvent("demo_criar_conta_click", { origem, modulo, ms_na_demo: Date.now() - inicio.current!.t0, itens: valendo.length, ...ids() });
  };
  const abrirConta = (origem: OrigemCriar) => {
    cliqueCriar(origem);
    if (origem === "folha") setFolha(null);
    navigate(urlDoPasso("conta"));
  };

  /* a seta ← do cabeçalho dos módulos: na demo, vai pra conta (mesma fonte do botão, como no /preview) */
  const volta: VoltaDaDemo = { destino: urlDoPasso("conta"), aoTocar: () => cliqueCriar("seta"), modulo, extras: { variante: VARIANTE } };

  /* ---------------------------------------------------------- conta e sucesso */
  useEffect(() => {
    if (passo === "conta" || passo === "sucesso") trackEvent("porta_passo", { passo, area: AREA_DO_MODULO[modulo], resposta: "view", ...ids() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  const respostas = (): PortaNaConta["respostas"] => {
    const area = AREA_DO_MODULO[inicio.current!.entrada];
    return {
      area, rota: area, p2: null, p3: null,
      modulo: inicio.current!.entrada,
      modulos: [...vistos.current].join(",") || inicio.current!.entrada,
      itens: String(estadoRef.current.itens.length),
      origem: estadoRef.current.origem ?? null,
    };
  };
  const portaDaConta = (eventId: string, metodo: string, agora?: number) =>
    ({ ...montarPorta({ attr: capturarAtribuicao({ search: "" }), respostas: respostas(), eventId, sessao, metodo, agora }), variante: VARIANTE });

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

  const concluindo = useRef(false);
  const pediuNaVolta = useRef(false);
  const concluir = async (metodo: string): Promise<Resultado> => {
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
        const { error } = await supabase.auth.updateUser({ data: { porta: portaDaConta(eventId, metodo, agora) } });
        if (error) trackEvent("porta_erro", { onde: "gravar_porta", msg: (error.message || "").slice(0, 160), ...ids() });
      }
      const crJa = e.crEnviado === eventId;
      if (!existente && !crJa) {
        fireMetaEvent("CompleteRegistration", { content_name: "porta_iphone", status: true }, eventId);
        try { void supabase.functions.invoke("porta-handoff", { body: { acao: "registro", event_id: eventId } }).catch(() => {}); } catch { /* noop */ }
        void persistLeadSource(supabase, u.id);
      }
      // os itens que ELA criou na demo (nunca o exemplo) — esperando no máximo MS_ITENS
      const meus = decodificarItens(e.itens);
      if (meus.length) {
        const r = await comTempo(levarItensParaConta(supabase as unknown as BancoDosItens, u.id, meus), MS_ITENS, { ok: false, chaves: [], erro: "tempo" });
        trackEvent("demo_itens_conta", { ok: r.ok, n: meus.length, chaves: r.chaves.join(","), erro: r.erro ?? null, ...ids() });
      }
      trackEvent("porta_conta_criada", { metodo, existente, event_id: eventId, gravou: dec.gravar, area: AREA_DO_MODULO[inicio.current!.entrada], ...ids() });
      setEstado((x) => ({ ...x, concluido: true, metodo, email: u.email ?? x.email, eventId, crEnviado: !existente || crJa ? eventId : x.crEnviado ?? null }));
      navigate(urlDoPasso("sucesso"), { replace: true });
      pediuNaVolta.current = true; // o "recarregou no sucesso" lá embaixo não pede um 2º código
      void pedirCodigo();
      return { ok: true };
    } catch {
      concluindo.current = false;
      return { ok: false, erro: "Não consegui salvar agora. Tenta de novo." };
    }
  };

  /* volta do Google/Apple (/auth/callback → /experimente?passo=voltou) */
  useEffect(() => {
    if (authLoading || !user) return;
    const e = estadoRef.current;
    const social = e.metodo === "google" || e.metodo === "apple";
    if (!e.concluido && ((passo === "conta" && social) || paramPasso === "voltou")) void concluir(social ? (e.metodo as string) : "google");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const social = async (metodo: "google" | "apple"): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo, ...ids() });
    setEstado((e) => ({ ...e, metodo }));
    guardarDestino(`/experimente?m=${modulo}&passo=voltou`);
    const { error } = await (metodo === "apple" ? entrarComApple() : entrarComGoogle());
    if (error) {
      setEstado((e) => ({ ...e, metodo: null }));
      trackEvent("porta_erro", { onde: `oauth_${metodo}`, msg: (error.message || "").slice(0, 160), ...ids() });
      return { ok: false, erro: `Não consegui abrir ${metodo === "apple" ? "a Apple" : "o Google"}. Use seu e-mail aqui embaixo.` };
    }
    return { ok: true };
  };

  const onGoogleBloqueado = () => {
    trackEvent("porta_google_bloqueado", { app: appDoWebview(), ...ids() });
    try {
      const e = estadoRef.current;
      const q = new URLSearchParams(window.location.search);
      q.set(PARAM_ESTADO, JSON.stringify({ eventId: e.eventId, itens: e.itens }));
      q.set(PARAM_SESSAO, sessao);
      q.set("passo", "conta");
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}`);
    } catch { /* noop */ }
  };

  const entrarComSenha = async (email: string, senha: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return !error;
  };
  const onCriarConta = async (email: string, senha: string): Promise<Resultado> => {
    trackEvent("porta_conta_iniciada", { metodo: "senha", ...ids() });
    const e = estadoRef.current;
    const porta = portaDaConta(e.eventId, "senha");
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

  /* recarregou no sucesso sem código: tenta 1x */
  useEffect(() => {
    if (pediuNaVolta.current || authLoading || !user) return;
    if (passo !== "sucesso" || codigoDaPortaOk(estado.codigo)) return;
    pediuNaVolta.current = true;
    void pedirCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, passo]);

  /* sucesso: loja (igual à Porta) */
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
    const q = new URLSearchParams({ origem: "porta_demo" });
    const conteudo = a?.utm_content || a?.ad_id || "";
    if (conteudo) q.set("utm_content", conteudo);
    if (loja) q.set("loja", loja);
    return `/baixar?${q.toString()}`;
  };
  const onLoja = (loja: "ios" | "android", via: "botao" | "auto" = "botao") => {
    clicouLoja.current = true;
    trackEventBeacon("porta_loja_click", { plataforma, loja, via, metodo: estadoRef.current.metodo, ...ids() });
  };
  const [abrindo, setAbrindo] = useState(false);
  const cancelouAuto = useRef(false);
  useEffect(() => {
    if (passo !== "sucesso" || plataforma === "web") return;
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
  }, [passo, plataforma]);
  const cancelarAuto = () => {
    if (!abrindo) return;
    cancelouAuto.current = true;
    setAbrindo(false);
  };

  /* ---------------------------------------------------------- render */
  if (passo !== "demo") {
    const comCodigo = plataforma === "ios" && codigoDaPortaOk(estado.codigo);
    return (
      <div className="min-h-[100dvh] bg-[#f6f5f7] text-[#16121c] antialiased" data-testid="demo-funil" data-passo={passo} onPointerDownCapture={cancelarAuto}>
        <div className="mx-auto w-full max-w-[440px] px-5 pb-10" style={{ paddingTop: "calc(18px + env(safe-area-inset-top))" }}>
          <header className="relative flex items-center justify-center h-10" data-testid="demo-topo-conta">
            {passo === "conta" && (
              <button
                type="button" onClick={() => navigate(urlDoPasso(null))} aria-label={VOLTAR_DEMO} data-testid="demo-voltar"
                className="absolute left-0 grid place-items-center w-10 h-10 rounded-[11px] border border-[#e3e0e6] bg-white text-[#16121c] active:bg-[#f3f1f5]"
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={2.2} />
              </button>
            )}
            <span className="flex items-center gap-2">
              <img src={LOGO_PORTA} alt="" width={28} height={28} className="w-7 h-7 rounded-[8px] border border-[#e6e3e9] bg-white" />
              <span className="text-[21px] font-black tracking-[-0.03em] leading-none">CORE</span>
            </span>
          </header>
          <CardPorta progresso={null} passo={passo}>
            {passo === "conta" ? (
              <ContaPorta
                titulo={CONTA_TITULO}
                texto={contaTexto(decodificarItens(estado.itens))}
                mostrarTeste={plataforma === "ios"}
                emInApp={emInApp}
                appDoWebview={appDoWebview()}
                mostrarApple={plataforma !== "android"}
                emailLogado={!authLoading && user ? user.email ?? null : null}
                onApple={() => social("apple")}
                onGoogle={() => social("google")}
                onGoogleBloqueado={onGoogleBloqueado}
                onCriarConta={onCriarConta}
                onEntrarComSenha={onEntrarComSenha}
                onSalvarNestaConta={onSalvarNestaConta}
                onTrocarConta={async () => { await supabase.auth.signOut(); }}
                onErroCampo={(campo, motivo) => trackEvent("porta_conta_erro", { campo, motivo, ...ids() })}
              />
            ) : (
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
            )}
          </CardPorta>
          {passo === "conta" && (
            <button type="button" onClick={() => navigate(urlDoPasso(null))} className="mt-4 mx-auto flex h-10 px-4 items-center text-[14px] text-[#6b6670]" data-testid="demo-voltar-texto">
              {VOLTAR_DEMO}
            </button>
          )}
        </div>
      </div>
    );
  }

  const Modulo = COMPONENTES[modulo];
  return (
    <VoltaDaDemoProvider value={volta}>
      <div className="demo-com-tour min-h-[100dvh] bg-background [overflow-x:clip]" data-testid="demo-funil" data-passo="demo" data-modulo={modulo}>
        <NavDemo
          modulo={modulo}
          onTrocar={trocarModulo}
          onCriar={() => abrirConta("topo")}
          onEntrar={() => { trackEvent("demo_entrar_click", { modulo, ...ids() }); navigate("/entrar"); }}
        />
        <div className="bg-secondary text-foreground text-[12.5px] border-b border-border" data-testid="demo-faixa">
          <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-center gap-1.5 text-center">
            <span className="text-muted-foreground">{FAIXA_TEXTO}</span>
            <span aria-hidden className="text-muted-foreground">·</span>
            <button type="button" onClick={() => abrirConta("faixa")} className="font-semibold underline underline-offset-2" data-testid="demo-faixa-criar">{BOTAO_CRIAR}</button>
          </div>
        </div>
        <PreviewUserDataProvider key={modulo} moduleKey={modulo} semente={sementeDoModulo} aoGravar={aoGravar}>
          <RouteErrorBoundary routeName={`experimente-${modulo}`}>
            <Suspense fallback={<CarregandoModulo />}>
              <div data-testid={`demo-modulo-${modulo}`}><Modulo /></div>
            </Suspense>
          </RouteErrorBoundary>
        </PreviewUserDataProvider>
        <section className="max-w-md mx-auto px-4 pt-4 pb-[calc(28px+env(safe-area-inset-bottom))]" data-testid="demo-fim">
          <div className="rounded-[20px] border border-border bg-card px-5 py-5 text-center">
            <p className="text-[18px] font-extrabold tracking-[-0.02em] leading-tight text-balance">{FIM_TITULO}</p>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground text-pretty">{FIM_TEXTO}</p>
            <button
              type="button" onClick={() => abrirConta("fim")} data-testid="demo-fim-criar"
              className="mt-4 w-full h-[50px] rounded-[12px] bg-foreground text-background text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[.985] transition-transform"
            >
              Criar conta grátis <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
        {folha && <FolhaDemo onCriar={() => { trackEvent("demo_folha_criar", { gatilho: folha, ...ids() }); abrirConta("folha"); }} onFechar={fecharFolha} />}
      </div>
    </VoltaDaDemoProvider>
  );
}

/**
 * O topo grudado da demo: a barra (CORE · Modo demonstração · Entrar · Criar conta) + as pílulas.
 * Mesma mecânica da barra do tour do /preview (.demo-tour-nav): gruda no topo e publica a própria altura em
 * --demo-nav-h, pra o cabeçalho grudado do módulo ficar LOGO ABAIXO em vez de disputar o mesmo topo.
 */
function NavDemo({ modulo, onTrocar, onCriar, onEntrar }: { modulo: ModuloDemo; onTrocar: (m: ModuloDemo) => void; onCriar: () => void; onEntrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) el.closest(".demo-com-tour")?.setAttribute("style", `--demo-nav-h:${h}px`);
    };
    publicar();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="demo-tour-nav bg-background border-b border-border" data-testid="demo-nav">
      <div className="max-w-5xl mx-auto px-3 h-[54px] flex items-center gap-2" data-testid="demo-topo">
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <img src={LOGO_PORTA} alt="" width={28} height={28} className="w-7 h-7 shrink-0 rounded-[8px] border border-border bg-white" />
          <span className="min-w-0 leading-none">
            <span className="block text-[17px] font-black tracking-[-0.03em] text-foreground">CORE</span>
            <span className="block mt-[3px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate" data-testid="demo-selo">{TOPO_SELO}</span>
          </span>
        </span>
        <button type="button" onClick={onEntrar} className="shrink-0 h-10 px-2.5 text-[14px] font-semibold text-foreground" data-testid="demo-entrar">Entrar</button>
        <button
          type="button" onClick={onCriar} data-testid="demo-topo-criar"
          className="shrink-0 h-10 px-4 rounded-full bg-foreground text-background text-[14px] font-semibold active:scale-[.97] transition-transform"
        >
          {BOTAO_CRIAR}
        </button>
      </div>
      <div className="max-w-5xl mx-auto px-3 pb-2.5 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Módulos" data-testid="demo-pilulas">
        {MODULOS_DEMO.map((m) => {
          const ativo = m.key === modulo;
          return (
            <button
              key={m.key} type="button" role="tab" aria-selected={ativo} onClick={() => onTrocar(m.key)}
              data-testid={`demo-pilula-${m.key}`} data-ativo={ativo ? "" : undefined}
              className={`flex-auto shrink-0 min-h-10 rounded-full px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
                ativo ? "bg-foreground text-background" : "bg-card text-foreground border border-border active:bg-secondary"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
