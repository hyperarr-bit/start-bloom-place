import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/hooks/use-theme";
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
import { useLembretes } from "@/hooks/use-lembretes";

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

const RootGate = () => {
  const { loading, user } = useAuth();
  if (loading) return null;
  // APP DA LOJA (Capacitor): install novo vai pra ENTRADA_APP — o welcome
  // "grade viva" é um overlay DENTRO do funil (rota própria causava flash
  // branco na transição). PWA continua indo pro login (quem instala PWA já
  // comprou).
  if (!user && isNativeShell()) return <Navigate to={ENTRADA_APP} replace />;
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
  if (!user) return <Navigate to={ehPwa() ? "/entrar" : "/comecar"} replace />;

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
const Planos = lazy(() => import("./pages/Planos"));
// A /planos do SHELL (24/07): a web vende vitalício no Pix, e Pix dentro do
// binário da loja é pagamento externo — motivo exato da remoção do Cal AI.
const PlanosApp = lazy(() => import("./pages/PlanosApp"));
// Páginas legais exigidas pelo Play (política, termos, exclusão de conta).
const Privacidade = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacidade })));
const Termos = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Termos })));
const ExcluirConta = lazy(() => import("./pages/Legal").then((m) => ({ default: m.ExcluirConta })));
const Index = lazy(() => import("./pages/Index"));
const Home = lazy(() => import("./pages/Home"));
const Rotina = lazy(() => import("./pages/Rotina"));
const DesenvolvimentoPessoal = lazy(() => import("./pages/DesenvolvimentoPessoal"));
const Saude = lazy(() => import("./pages/Saude"));
const Casa = lazy(() => import("./pages/Casa"));
const Estudos = lazy(() => import("./pages/Estudos"));
const Biblioteca = lazy(() => import("./pages/Biblioteca"));
const Beleza = lazy(() => import("./pages/Beleza"));
const Viagens = lazy(() => import("./pages/Viagens"));
const Carreira = lazy(() => import("./pages/Carreira"));
const Treino = lazy(() => import("./pages/Treino"));
const Dieta = lazy(() => import("./pages/Dieta"));
const Hiperfoco = lazy(() => import("./pages/Hiperfoco"));
const Relacionamentos = lazy(() => import("./pages/Relacionamentos"));
const PetPage = lazy(() => import("./pages/Pet"));
const Detox = lazy(() => import("./pages/Detox"));
const Conquistas = lazy(() => import("./pages/Conquistas"));
const Retrospectiva = lazy(() => import("./pages/Retrospectiva"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Preview = lazy(() => import("./pages/Preview"));
// Funil V2 (experimento 15/07): rota paralela, chunk próprio — não pesa no funil atual.
const ComecarV2 = lazy(() => import("./pages/v2/ComecarV2"));
const PlanoV3 = lazy(() => import("./pages/v3/Plano"));
// Funis CONGELADOS pra teste (24/07, pedido do dono). Cada um é uma cópia de
// uma versão que já rodou, num diretório próprio e com chunk próprio: abrir
// /funil-* não muda NADA no /comecar e /inicio que estão vendendo.
//   dia14 → 83c0d98 (14/07 22:30), sem downsell e sem X no paywall
//   radar → baae257 (23/07 20:20), ordem radar→demo→PLANO com o gráfico 3,6→8,5
//   v1    → d18e4fd (20/07 23:12), o último antes da ordem mudar
const ComecarDia14 = lazy(() => import("./pages/funis/dia14/ComecarDia14"));
const ComecarRadar = lazy(() => import("./pages/funis/radar/ComecarRadar"));
const ComecarFunilV1 = lazy(() => import("./pages/funis/v1/ComecarV1"));
// Recepção do pagante (15/07): destino do e-mail de boas-vindas pós-Pix.
const BemVindo = lazy(() => import("./pages/BemVindo"));

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminFunnel = lazy(() => import("./pages/admin/AdminFunnel"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminPagantes = lazy(() => import("./pages/admin/AdminPagantes"));

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

const AnimatedRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  usarPreCarregamentoDosModulos(!!user);
  // Lembretes de conta a vencer: reagendam sozinhos quando o módulo de
  // Finanças muda. Aqui dentro porque precisa do Router (o toque no aviso
  // navega) e do UserDataProvider.
  useLembretes();
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
        <Route path="/" element={<RootGate />} />
        {/* LP aposentada — o funil (/comecar) é a entrada. Redireciona links/ads antigos. */}
        <Route path="/lp" element={<Navigate to="/comecar" replace />} />
        <Route path="/comecar" element={<PageTransition><RouteErrorBoundary routeName="funil"><Comecar /></RouteErrorBoundary></PageTransition>} />
        <Route path="/comecar-v2" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-v2"><ComecarV2 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/plano" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-v3"><PlanoV3 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/funil-dia14" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-dia14"><ComecarDia14 /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        <Route path="/funil-radar" element={<SoNaWeb><PageTransition><RouteErrorBoundary routeName="funil-radar"><ComecarRadar /></RouteErrorBoundary></PageTransition></SoNaWeb>} />
        {/* ENTRADA_APP: mesmo funil do /funil-radar, mas SEM a trava SoNaWeb
            — esta é a porta do app da loja. O radar é seguro no shell: o
            paywall dele é o PaywallFlow, que bifurca pra assinatura e
            esconde o card de vitalício quando isNativeShell(). */}
        <Route path="/app" element={<PageTransition><RouteErrorBoundary routeName="funil-app"><ComecarRadar /></RouteErrorBoundary></PageTransition>} />
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
