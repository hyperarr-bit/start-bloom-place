import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/hooks/use-theme";
import { trackEvent, captureInstallReferrer, capturarDispositivoApp } from "@/lib/analytics";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { UserDataProvider } from "@/hooks/use-user-data";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TrialBanner } from "@/components/TrialBanner";
import { PortaoBoasVindas } from "@/components/onboarding/PortaoBoasVindas";
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TrackedModule } from "@/components/TrackedModule";
import { GlobalWinback } from "@/components/retention/GlobalWinback";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import { captureLeadSource } from "@/lib/lead-source";
import { getFunnelArea, AREAS } from "@/lib/funnel";
import { isNativeShell } from "@/lib/native-shell";
import { testeLiberado } from "@/lib/teste-gratis";
import { TesteBanner, TrilhaDoTeste, RetomadaPosCompra } from "@/components/teste/TesteGratis";
// v61: tutorial pós-pago do trial (Missão dos 3 dias) — B1 boas-vindas do
// pagante, B2 holofote fail-open, B3 celebração por dia vencido.
import { MissaoDoTrial } from "@/components/missao/MissaoDoTrial";
import { SaveOfferDowngrade } from "@/components/missao/SaveOfferDowngrade";
import { useLembretes } from "@/hooks/use-lembretes";
import { useViradaDoMes } from "@/hooks/use-virada-do-mes";

// Capture acquisition source as early as possible (runs once at module load)
captureLeadSource();




/** O app é o COMPLETO de 16 módulos (decisão de 12/07): a raiz do logado é a
 *  HOME HUB. Duas exceções de primeira sessão, ambas promessas de funil:
 *  1. Vitrine: quem escolheu uma área pousa NELA — mas só na 1ª abertura
 *     (flag core-area-landed); depois a raiz vira a Home.
 *  2. Funil finanças: novo usuário com tutorial pendente cai em /financas
 *     até concluir/pular o spotlight (que limpa o force-new-user-tutorial).
 *  Bônus: o "voltar" dos 15 módulos é navigate("/") — passa por aqui, então
 *  voltar de qualquer módulo agora leva à Home (era Finanças, loop torto). */
const AREA_LANDED_KEY = "core-area-landed";
const PWA_KEY = "core-pwa";

/** Ícone na tela inicial = app instalado, não anúncio: quem abre por ali já
 *  comprou (ou vai logar), então deslogado vai pro LOGIN e não pro funil de
 *  venda. O manifest carrega ?fonte=pwa no start_url; guardamos a marca porque
 *  o param só existe no lançamento, e navegações internas voltam sem ele. */
const ehPwa = () => {
  try {
    if (new URLSearchParams(window.location.search).get("fonte") === "pwa") {
      localStorage.setItem(PWA_KEY, "true");
      return true;
    }
    if (localStorage.getItem(PWA_KEY) === "true") return true;
  } catch { /* noop */ }
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (window.navigator as { standalone?: boolean }).standalone === true;
};

/** Chegou pela raiz MAS carregando marca de campanha (encurtador, redirect do
 *  anúncio, link com utm colado à mão)? Então é tráfego pago e vai pro FUNIL,
 *  não pra home institucional — a home é pra quem digita o domínio. Sem esta
 *  peneira, a home de 24/08 roubaria venda de quem clicou no anúncio. */
const PARAMS_DE_ANUNCIO = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ttclid", "gbraid", "wbraid", "ref"];
const temMarcaDeAnuncio = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return PARAMS_DE_ANUNCIO.some((k) => !!p.get(k));
  } catch { return false; }
};

/**
 * Rota que SÓ EXISTE NA WEB (trava de 25/07). O app da loja embarca a SPA
 * inteira — os funis de venda estão todos dentro do .aab, cada um com
 * "acesso vitalício por R$ 27,90 no Pix" na tela. Hoje nenhum botão do app
 * leva até lá, mas basta um redirect futuro, um link no histórico ou um deep
 * link pra expor pagamento externo ao revisor do Google. A trava fica na
 * ROTA, não dentro de cada funil: os funis são páginas congeladas de
 * experimento e não podem depender de alguém lembrar da regra.
 */
/**
 * Porta de entrada do app da loja. TEM NOME PRÓPRIO de propósito.
 *
 * Até 26/07 o shell entrava por "/inicio" escrito na mão em três lugares.
 * Em 25/07 o /inicio foi repontado pro funil do dia 14 (mudança de WEB,
 * correta) — e o app foi junto sem ninguém perceber, porque compartilhava a
 * rota. Resultado: quem instalava o app caía no funil do navegador, sem a
 * welcome, e com "Quero pra sempre — R$ 27,90 no Pix" na tela, que é
 * pagamento externo na cara do revisor do Google.
 *
 * Enquanto isso a trava SoNaWeb, criada pra evitar exatamente isso,
 * despejava o usuário em /inicio — ou seja, dentro do problema.
 *
 * Com a constante, repontar /inicio nunca mais mexe no app.
 */
/*
 * 26/07: a porta era "/comecar" — errado. Aquele é o funil ANTIGO, só de
 * finanças ("O que mais te atrapalha hoje?"). O funil DO APP é o radar:
 * pergunta a ÁREA da vida, tem o SeuPlanoGauge (a tela "Seu plano" do
 * estudo Cal AI/BitePal de 23/07) antes do paywall, e 8 ramos isNativeShell()
 * de estilo próprio. Ele foi congelado em /funil-radar no dia 25/07 e ficou
 * inalcançável pelo app.
 */
const ENTRADA_APP = "/app";

const SoNaWeb = ({ children }: { children: ReactNode }) =>
  isNativeShell() ? <Navigate to={ENTRADA_APP} replace /> : <>{children}</>;

/**
 * CERCA DA DEMO NO SHELL (28/08, foto do dono): a demo do funil renderiza os
 * módulos REAIS, e a seta ← de todo módulo faz navigate("/home") — pro
 * visitante anônimo isso cai no redirect de auth e parece "outro funil"
 * (mesma família do incidente /inicio). A cerca da web (RootGate, 24/07) só
 * cobre "/". Aqui: enquanto a demo do funil está armada, QUALQUER saída de
 * /preview que não seja pro próprio funil (/app) volta pra continuação do
 * funil, e a flag morre no primeiro pouso legítimo.
 */
function GuardaDemoShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeShell()) return;
    try {
      if (pathname.startsWith("/preview")) return;             // dentro da demo
      if (sessionStorage.getItem("core-demo-guarda") !== "1") return;
      // A flag SÓ morre no pouso em /app: o redirect de auth do /home dispara
      // no render (mais fundo na árvore) e ganha a corrida do primeiro
      // navigate — consumir a flag cedo deixava a pessoa em /auth (provado
      // por CDP 28/08). Mantendo a flag, cada parada errada re-redireciona
      // até convergir no funil.
      if (pathname.startsWith("/app")) {
        sessionStorage.removeItem("core-demo-guarda");
        return;
      }
      trackEvent("demo_fuga_redirecionada", { para: pathname });
      navigate("/app?step=compromissos", { replace: true });
    } catch { /* cerca nunca derruba navegação */ }
  }, [pathname, navigate]);
  return null;
}

const RootGate = () => {
  const { loading, user } = useAuth();
  if (loading) return null;
  // APP DA LOJA (Capacitor): install novo vai pra ENTRADA_APP — o welcome
  // "grade viva" é um overlay DENTRO do funil (rota própria causava flash
  // branco na transição). PWA continua indo pro login (quem instala PWA já
  // comprou).
  if (!user && isNativeShell()) {
    // TESTE GRÁTIS ATIVO (16/08): convidado com teste rodando abre no HUB —
    // ele já passou pelo funil e plantou a semente; devolver pro funil seria
    // recomeçar a venda pra quem está no meio do teste. Expirado, o
    // ProtectedRoute manda pro paywall do dia 3.
    if (testeLiberado()) return <Navigate to="/home" replace />;
    return <Navigate to={ENTRADA_APP} replace />;
  }
  // Fugiu da demo do tour vitrine pela seta ← (que aponta pra "/")? Devolve
  // pro funil do vitrine na PONTE, não pro /comecar de finanças (bug 24/07).
  if (!user) {
    try {
      const t = Number(sessionStorage.getItem("core-demo-tour") ?? 0);
      // no app o retorno da demo tem que voltar pra porta do shell, não pro
      // funil da web (ver ENTRADA_APP)
      if (t && Date.now() - t < 30 * 60_000)
        return <Navigate to={`${isNativeShell() ? ENTRADA_APP : "/inicio"}?step=analise`} replace />;
    } catch { /* noop */ }
  }
  /* A RAIZ DA WEB, deslogado. Duas viradas na história desta linha:
   *
   * 10/08 — mandava pra "/comecar", resquício de quando ele era a entrada.
   * Quem digitava coreaplicativo.com.br caía no funil ANTIGO (só finanças)
   * enquanto 86% do tráfego pago já entrava pelo /inicio com a porta das 5
   * áreas. Dois funis vendendo o mesmo produto, e o pior deles atendendo
   * quem chega pela marca — tráfego mais quente, veio pelo nome.
   *
   * 24/08 — a raiz deixou de ser um redirect e virou SITE INSTITUCIONAL.
   *
   * Motivo: a inscrição da empresa no Apple Developer Program foi recusada
   * porque a URL enviada (o funil) parecia "em fase de construção, com
   * conteúdo limitado e não relacionado à empresa da inscrição". Sem uma home
   * de verdade — com menu, preço, contato e a pessoa jurídica no rodapé — não
   * existe App Store.
   *
   * A venda não é sacrificada: o funil segue em /inicio, o tráfego pago segue
   * indo pra lá (peneira de temMarcaDeAnuncio) e todo CTA da home despeja no
   * mesmo funil. Quem cai aqui é o visitante de MARCA — digitou o domínio,
   * tráfego mais quente — e o revisor de loja, que antes via um quiz. */
  if (!user) {
    if (ehPwa()) return <Navigate to="/entrar" replace />;
    if (temMarcaDeAnuncio()) return <Navigate to={`/inicio${window.location.search}`} replace />;
    return <SiteHome />;
  }

  const area = getFunnelArea();
  let landed = true;
  let forceNew = false;
  try {
    landed = !!localStorage.getItem(AREA_LANDED_KEY);
    forceNew = localStorage.getItem("force-new-user-tutorial") === "true";
  } catch { /* noop */ }

  // A flag de usuário-novo só vale pra conta RECÉM-CRIADA (<48h). Órfã em
  // conta veterana (replay v1 de 19/07) mandava o app abrir em /financas
  // toda vez, antes do hub montar e se auto-sanear — limpa aqui também.
  const contaNova = !!user.created_at && Date.now() - new Date(user.created_at).getTime() < 48 * 3600e3;
  if (forceNew && !contaNova) {
    try { localStorage.removeItem("force-new-user-tutorial"); } catch { /* noop */ }
    forceNew = false;
  }

  /*
   * APP DA LOJA: nasce no HUB, sempre (27/07, relato do dono).
   *
   * "É estranho porque a home inicial é hub, o app não nasce no financas, o
   * tutorial também não. Por que essa porra nasce no financas?"
   *
   * Ele está certo, e a origem é histórica: despejar a pessoa direto no
   * módulo que ela escolheu no funil é regra da WEB, escrita quando o
   * produto era só finanças e o funil vendia uma planilha. No app o
   * primeiro contato passou a ser o hub — é lá que mora o "Por onde você
   * quer começar?", é de lá que o tutorial parte. Cair direto no módulo
   * pulava a única tela que explica que existem 16.
   *
   * A escolha do funil não se perde: ela continua no localStorage e é o que
   * o seletor do tutorial usa pra já vir marcada.
   *
   * A web fica exatamente como estava — o funil em escala é dela.
   */
  if (isNativeShell()) {
    try { localStorage.setItem(AREA_LANDED_KEY, "true"); } catch { /* noop */ }
    return <Navigate to="/home" replace />;
  }

  if (area && !landed) {
    try { localStorage.setItem(AREA_LANDED_KEY, "true"); } catch { /* noop */ }
    return <Navigate to={area !== "dinheiro" ? `/${AREAS[area].module}` : "/financas"} replace />;
  }
  if (!area && forceNew) return <Navigate to="/financas" replace />;
  return <Navigate to="/home" replace />;
};


// Leves / necessários cedo (LP anônima, auth) — ficam no bundle inicial.
import Acesso from "./pages/Acesso";
import Auth from "./pages/Auth";
import Entrar from "./pages/Entrar";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import LandingPage from "./pages/lp/LpFinancas";
import Comecar from "./pages/Comecar";
// dia14 é o funil do /inicio (25/07) — import EAGER: a URL do tráfego de
// anúncio não pode ter flash de loading (lazy quebraria fora do Suspense).
import ComecarDia14Eager from "./pages/funis/dia14/ComecarDia14";
import TutorialLab from "./pages/TutorialLab";
import NotFound from "./pages/NotFound";

// Code-splitting: rotas pesadas (módulos do app, checkout, admin) saem do
// bundle inicial e carregam sob demanda — a LP/anônimo carrega leve.
//
// BLINDAGEM (16/08): se um import dinâmico resolver VAZIO — chunk apagado por
// deploy, servidor devolvendo o index.html no lugar do JS (fallback de SPA),
// ou alguém engolindo o vite:preloadError — o React lê `undefined.default` e
// o boundary recebe um TypeError genérico que ele não reconhece como erro de
// chunk: a pessoa fica presa numa tela morta que um F5 resolveria. Aqui o
// módulo vazio vira um erro de chunk DE VERDADE, com o texto que o
// RouteErrorBoundary já sabe identificar pra recarregar sozinho.
const lazyPage = <T,>(carregar: () => Promise<T>) =>
  lazy(async () => {
    const mod = (await carregar()) as { default?: unknown } | undefined;
    if (mod && typeof mod.default !== "undefined") {
      return mod as { default: React.ComponentType<unknown> };
    }
    throw new Error("Failed to fetch dynamically imported module (módulo resolveu vazio)");
  });

const Planos = lazyPage(() => import("./pages/Planos"));
// A /planos do SHELL (24/07): a web vende vitalício no Pix, e Pix dentro do
// binário da loja é pagamento externo — motivo exato da remoção do Cal AI.
const PlanosApp = lazyPage(() => import("./pages/PlanosApp"));
// Páginas legais exigidas pelo Play (política, termos, exclusão de conta).
const Privacidade = lazyPage(() => import("./pages/Legal").then((m) => ({ default: m.Privacidade })));
const Termos = lazyPage(() => import("./pages/Legal").then((m) => ({ default: m.Termos })));
const ExcluirConta = lazyPage(() => import("./pages/Legal").then((m) => ({ default: m.ExcluirConta })));
// Site institucional da WEB (24/08) — home na raiz e página de suporte.
// Exigência da Apple pra inscrição da empresa: site completo, público, com
// contato. Ver src/pages/site/SiteHome.tsx e src/lib/empresa.ts.
const SiteHome = lazyPage(() => import("./pages/site/SiteHome"));
const Suporte = lazyPage(() => import("./pages/site/Suporte"));
const Index = lazyPage(() => import("./pages/Index"));
const Home = lazyPage(() => import("./pages/Home"));
const Rotina = lazyPage(() => import("./pages/Rotina"));
const DesenvolvimentoPessoal = lazyPage(() => import("./pages/DesenvolvimentoPessoal"));
const Saude = lazyPage(() => import("./pages/Saude"));
const Casa = lazyPage(() => import("./pages/Casa"));
const Estudos = lazyPage(() => import("./pages/Estudos"));
const Biblioteca = lazyPage(() => import("./pages/Biblioteca"));
const Beleza = lazyPage(() => import("./pages/Beleza"));
const Viagens = lazyPage(() => import("./pages/Viagens"));
const Carreira = lazyPage(() => import("./pages/Carreira"));
const Treino = lazyPage(() => import("./pages/Treino"));
const Dieta = lazyPage(() => import("./pages/Dieta"));
const Hiperfoco = lazyPage(() => import("./pages/Hiperfoco"));
const Relacionamentos = lazyPage(() => import("./pages/Relacionamentos"));
const PetPage = lazyPage(() => import("./pages/Pet"));
const Detox = lazyPage(() => import("./pages/Detox"));
const Conquistas = lazyPage(() => import("./pages/Conquistas"));
const Retrospectiva = lazyPage(() => import("./pages/Retrospectiva"));
const Notificacoes = lazyPage(() => import("./pages/Notificacoes"));
const Preview = lazyPage(() => import("./pages/Preview"));
// Funil V2 (experimento 15/07): rota paralela, chunk próprio — não pesa no funil atual.
const ComecarV2 = lazyPage(() => import("./pages/v2/ComecarV2"));
// /direto (15/08): o funil do dia 14 SEM A DEMO + tela de compromisso. Teste
// do dono contra o /inicio, que segue intocado como controle.
const ComecarDireto = lazyPage(() => import("./pages/funis/direto/ComecarDireto"));
const PlanoV3 = lazyPage(() => import("./pages/v3/Plano"));
// Funis CONGELADOS pra teste (24/07, pedido do dono). Cada um é uma cópia de
// uma versão que já rodou, num diretório próprio e com chunk próprio: abrir
// /funil-* não muda NADA no /comecar e /inicio que estão vendendo.
//   dia14 → 83c0d98 (14/07 22:30), sem downsell e sem X no paywall
//   radar → baae257 (23/07 20:20), ordem radar→demo→PLANO com o gráfico 3,6→8,5
//   v1    → d18e4fd (20/07 23:12), o último antes da ordem mudar
const ComecarDia14 = lazyPage(() => import("./pages/funis/dia14/ComecarDia14"));
const ComecarRadar = lazyPage(() => import("./pages/funis/radar/ComecarRadar"));
// v53 (16/08): o funil do TESTE GRÁTIS — a porta nova do shell. A web nunca
// o vê (a rota /app bifurca por isNativeShell); o radar segue na web como era.
const ComecarTeste = lazyPage(() => import("./pages/funis/teste/ComecarTeste"));
const ComecarFunilV1 = lazyPage(() => import("./pages/funis/v1/ComecarV1"));
// Recepção do pagante (15/07): destino do e-mail de boas-vindas pós-Pix.
const BemVindo = lazyPage(() => import("./pages/BemVindo"));

const AdminLogin = lazyPage(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazyPage(() => import("./pages/admin/AdminLayout"));
const AdminFunnel = lazyPage(() => import("./pages/admin/AdminFunnel"));
const AdminCampaigns = lazyPage(() => import("./pages/admin/AdminCampaigns"));
const AdminUsuarios = lazyPage(() => import("./pages/admin/AdminUsuarios"));
const AdminPagantes = lazyPage(() => import("./pages/admin/AdminPagantes"));

const queryClient = new QueryClient();

/**
 * Pré-carrega os módulos mais usados enquanto o app está ocioso.
 *
 * Os módulos são lazy: no PRIMEIRO toque em cada um, o React suspende, o
 * fallback pinta uma tela vazia enquanto o pedaço baixa, e só então o módulo
 * aparece. Era o "os módulos abrem bruscamente" — não era a animação (o
 * PageTransition já faz fade), era o vão do download.
 *
 * A ordem segue o uso real medido em 30 dias (19.182 aberturas): finanças
 * 677 pessoas, rotina 322, treino 222, dieta 194, biblioteca 141 (a de maior
 * tempo por pessoa). requestIdleCallback garante que isso nunca dispute banda
 * com o que está na tela.
 */
const usarPreCarregamentoDosModulos = (ligado: boolean) => {
  useEffect(() => {
    if (!ligado) return;
    const chunks = [
      () => import("./pages/Index"),
      () => import("./pages/Rotina"),
      () => import("./pages/Treino"),
      () => import("./pages/Dieta"),
      () => import("./pages/Biblioteca"),
    ];
    const agendar: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function"
        ? (cb) => window.requestIdleCallback(cb, { timeout: 4000 })
        : (cb) => window.setTimeout(cb, 1500);
    const id = agendar(() => { chunks.forEach((carregar) => { carregar().catch(() => {}); }); });
    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [ligado]);
};

/**
 * DEEP LINKS — fora das rotas, de propósito (29/07).
 *
 * Este ouvinte morava dentro do AnimatedRoutes, que é a rota CORINGA
 * (`path="*"`). Só que `/entrar`, `/auth`, `/auth/callback`, `/acesso` e
 * `/inicio` têm rota PRÓPRIA, declarada antes do coringa — nessas telas o
 * AnimatedRoutes não está montado e ninguém estava ouvindo.
 *
 * Isso não incomodava enquanto o único deep link era o atalho do ícone (que
 * chega com o app em qualquer lugar e navega). Passou a doer quando o link
 * virou a VOLTA DO LOGIN com Google: quem tocava no botão a partir do
 * /entrar autenticava e voltava pra um app que não estava escutando —
 * exatamente o beco sem saída que a gente tinha acabado de fechar, só que por
 * outro caminho. Descoberto com token real disparado por adb, não no papel.
 *
 * Aqui dentro do BrowserRouter (precisa do useNavigate) e fora do <Routes>:
 * monta uma vez e vive enquanto o app viver.
 */
/**
 * Uma linha de telemetria que responde "QUAL WebView está na minha base?"
 * (04/08). Três dias de caça a bugs de WebView antigo (globalThis, inset,
 * dvh, env()) foram no escuro porque ninguém sabia a versão do Chromium dos
 * aparelhos reais. Um evento por sessão, só no shell.
 */
const jaReportouWebView = { atual: false };
const TelemetriaWebView = () => {
  useEffect(() => {
    if (!isNativeShell() || jaReportouWebView.atual) return;
    jaReportouWebView.atual = true;
    const ua = navigator.userAgent;
    const chrome = /Chrome\/(\d+)/.exec(ua)?.[1] ?? "?";
    trackEvent("webview_info", { chrome, android: /Android (\d+)/.exec(ua)?.[1] ?? "?", ua: ua.slice(0, 160) });
    void captureInstallReferrer();
    void capturarDispositivoApp();
  }, []);
  return null;
};

const DeepLinks = () => {
  const navigate = useNavigate();
  // navigate troca de identidade a cada navegação; com ele nas deps o efeito
  // reexecutava, reinstalava o ouvinte e relia o link de abertura — era isso
  // que fazia o atalho abrir a tela certa e voltar sozinho pra anterior.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    if (!isNativeShell()) return;
    let desligar = () => {};
    import("@/lib/deep-link")
      .then((m) => m.ligarDeepLinks((rota) => navigateRef.current(rota)))
      .then((fn) => { desligar = fn; })
      .catch(() => {});
    return () => desligar();
  }, []);
  return null;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  usarPreCarregamentoDosModulos(!!user);
  // Lembretes de conta a vencer: reagendam sozinhos quando o módulo de
  // Finanças muda. Aqui dentro porque precisa do Router (o toque no aviso
  // navega) e do UserDataProvider.
  useLembretes();
  // Arquiva lançamentos de meses passados que ficaram no balde do mês
  // corrente. Aqui em cima porque quem chega na retrospectiva pela
  // notificação não passa por Finanças — e era essa pessoa que via o mês
  // vazio. Ver use-virada-do-mes.ts pro diagnóstico completo.
  useViradaDoMes();
  useEffect(() => {
    if (!isNativeShell()) return;
    import("@/lib/notificacoes")
      .then((m) => m.ligarToqueNaNotificacao((rota) => navigate(rota)))
      .catch(() => {});
  }, [navigate]);

  // Deep links `core://` — hoje quem manda são os atalhos do toque longo no
  // ícone. Precisa do Router pelo mesmo motivo do bloco acima.
  //
  // Deps VAZIAS e navigate por ref de propósito: o `navigate` do react-router
  // troca de identidade a cada navegação, e com ele nas deps o efeito
  // reexecutava toda vez — reinstalando o ouvinte e relendo o link de
  // abertura. Era isso que fazia o atalho abrir a tela certa e voltar sozinho
  // pra anterior.
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/update-password" element={<PageTransition><UpdatePassword /></PageTransition>} />
        <Route path="/planos" element={<ProtectedRoute><PageTransition>{isNativeShell() ? <PlanosApp /> : <Planos />}</PageTransition></ProtectedRoute>} />
        {/* Legais: públicas de propósito — o revisor do Google abre sem conta */}
        <Route path="/privacidade" element={<PageTransition><Privacidade /></PageTransition>} />
        <Route path="/termos" element={<PageTransition><Termos /></PageTransition>} />
        <Route path="/excluir-conta" element={<PageTransition><ExcluirConta /></PageTransition>} />
        {/* URL de suporte pública — a Apple exige uma pra aprovar a inscrição
            da empresa, e o revisor abre sem conta (igual às legais acima).
            SoNaWeb porque a página fala de compra no site ("o Pix costuma
            liberar em segundos"): dentro do binário da loja isso é pagamento
            externo, a mesma trava dos funis. O revisor da Apple abre pelo
            NAVEGADOR, então a exigência dela continua atendida. */}
        <Route path="/suporte" element={<SoNaWeb><PageTransition><Suporte /></PageTransition></SoNaWeb>} />
        <Route path="/" element={<RootGate />} />
        {/* LP aposentada — o funil (/comecar) é a entrada. Redireciona links/ads antigos. */}
        <Route path="/lp" element={<Navigate to="/comecar" replace />} />
        <Route path="/comecar" element={<PageTransition><RouteErrorBoundary routeName="funil"><Comecar /></RouteErrorBoundary></PageTransition>} />
        <Route path="/direto" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-direto"><ComecarDireto /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/comecar-v2" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-v2"><ComecarV2 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/plano" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-v3"><PlanoV3 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/funil-dia14" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-dia14"><ComecarDia14 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/funil-radar" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-radar"><ComecarRadar /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        {/* ENTRADA_APP: a porta do app da loja. v53 (16/08): no SHELL renderiza
            o funil do TESTE GRÁTIS (4 perguntas → app real em modo guiado →
            paywall de assinatura no dia 3). Na web, /app continua o radar de
            sempre — a bifurcação é pelo ELEMENTO da rota, nunca pela rota
            (lição do /inicio de 26/07: reapontar rota compartilhada quebrou
            o app junto). */}
        <Route path="/app" element={<PageTransition><RouteErrorBoundary routeName="funil-app">{isNativeShell() ? <ComecarTeste /> : <ComecarRadar />}</RouteErrorBoundary></PageTransition>} />
        <Route path="/funil-v1" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-v1"><ComecarFunilV1 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/bem-vindo" element={<PageTransition><RouteErrorBoundary routeName="bem-vindo"><BemVindo /></RouteErrorBoundary></PageTransition>} />
        <Route path="/tutorial-proto" element={<PageTransition><TutorialLab /></PageTransition>} />
        <Route path="/preview/:moduleKey" element={<PageTransition><Preview /></PageTransition>} />
        {/* Volta dos 16 módulos (funil vitrine, jul/2026): a Home hub reabriu. */}
        <Route path="/home" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="home"><Home /></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/financas" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="financas"><TrackedModule moduleId="financas"><Index /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/rotina" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="rotina"><TrackedModule moduleId="rotina"><Rotina /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/desenvolvimento" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="desenvolvimento"><TrackedModule moduleId="desenvolvimento"><DesenvolvimentoPessoal /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/saude" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="saude"><TrackedModule moduleId="saude"><Saude /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/casa" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="casa"><TrackedModule moduleId="casa"><Casa /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/estudos" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="estudos"><TrackedModule moduleId="estudos"><Estudos /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/biblioteca" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="biblioteca"><TrackedModule moduleId="biblioteca"><Biblioteca /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/beleza" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="beleza"><TrackedModule moduleId="beleza"><Beleza /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/viagens" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="viagens"><TrackedModule moduleId="viagens"><Viagens /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/carreira" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="carreira"><TrackedModule moduleId="carreira"><Carreira /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/treino" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="treino"><TrackedModule moduleId="treino"><Treino /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/dieta" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="dieta"><TrackedModule moduleId="dieta"><Dieta /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/hiperfoco" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="hiperfoco"><TrackedModule moduleId="hiperfoco"><Hiperfoco /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/relacionamentos" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="relacionamentos"><TrackedModule moduleId="relacionamentos"><Relacionamentos /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/pet" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="pet"><TrackedModule moduleId="pet"><PetPage /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/detox" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="detox"><TrackedModule moduleId="detox"><Detox /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/conquistas" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="conquistas"><TrackedModule moduleId="conquistas"><Conquistas /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        {/* Destino da notificação mensal e do item do menu. Fora do TrackedModule:
            não é módulo, é uma tela transversal que lê todos eles. */}
        <Route path="/retrospectiva" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="retrospectiva"><Retrospectiva /></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/notificacoes" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="notificacoes"><Notificacoes /></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="funil" element={<AdminFunnel />} />
          <Route path="campanhas" element={<AdminCampaigns />} />
          <Route path="usuarios" element={<AdminUsuarios />} />
          {/* Assinantes removida (inútil) — rota antiga cai no funil via catch-all */}
          <Route path="pagantes" element={<AdminPagantes />} />
          {/* Compat: qualquer rota antiga do admin cai no funil novo. */}
          <Route path="*" element={<Navigate to="/admin/funil" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
    </Suspense>
  );
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const App = () => {


  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <UserDataProvider>
          <TooltipProvider>
          <AppShell>
            <Toaster />
            <Sonner />
            <div className="app-safe-shell">
              <OfflineBanner />
              <BrowserRouter>
                <ScrollToTop />
                <DeepLinks />
                <GuardaDemoShell />
                <TelemetriaWebView />
                <GracePeriodBanner />
                <Routes>
                  <Route path="/acesso" element={<Acesso />} />
                  {/* URL limpa do funil vitrine (criativo "app pra vida inteira").
                      A WelcomeScreen legada que morava aqui não tinha nenhum link interno. */}
                  {/* /inicio ficou de fora da trava enquanto ERA a porta do
                      app. Agora o shell entra por ENTRADA_APP, e o /inicio é
                      só o funil do dia 14 da web — que termina no paywall de
                      Pix vitalício. Sem SoNaWeb aqui, um link no histórico ou
                      um deep link recoloca pagamento externo dentro do app. */}
                  <Route path="/inicio" element={<SoNaWeb><RouteErrorBoundary routeName="funil"><ComecarDia14Eager /></RouteErrorBoundary></SoNaWeb>} />
                  {/* Porta de entrada do e-mail pós-compra da Cakto */}
                  <Route path="/entrar" element={<Entrar />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="*" element={<AnimatedRoutes />} />
                </Routes>
                <TrialBanner />
                {/* v53: as duas superfícies do teste grátis do shell — a faixa
                    "Dia X de 3" (comprador quente) e a semente guiada por cima
                    do módulo real. Ambas se auto-anulam fora do shell. */}
                <TesteBanner />
                <TrilhaDoTeste />
                <RetomadaPosCompra />
                <MissaoDoTrial />
            <SaveOfferDowngrade />
                {/* Os 10 segundos depois de assinar: celebração antes do
                    produto cru (pedido do dono 27/07, inspirado no BitePal). */}
                <PortaoBoasVindas />
                <GlobalWinback />
                {/* QuickSignupModal APOSENTADO 16/07: era o gate do modo visitante (teste grátis) — prendia cliente com sessão expirada numa tela sem saída ("Entrar" navegava por baixo do overlay). Visitante agora nem entra no app: ProtectedRoute sem allowGuest redireciona pro /auth. */}
              </BrowserRouter>
            </div>
            <div className="app-safe-top-guard" aria-hidden="true" />
          </AppShell>
          </TooltipProvider>
          </UserDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
