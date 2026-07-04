import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { UserDataProvider } from "@/hooks/use-user-data";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TrialBanner } from "@/components/TrialBanner";
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TrackedModule } from "@/components/TrackedModule";
import { GlobalWinback } from "@/components/retention/GlobalWinback";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import { QuickSignupModal } from "@/components/onboarding/QuickSignupModal";
import { captureLeadSource } from "@/lib/lead-source";

// Capture acquisition source as early as possible (runs once at module load)
captureLeadSource();




const RootGate = () => {
  const { loading, user } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/financas" replace />;
  return <Navigate to="/comecar" replace />;
};


// Leves / necessários cedo (LP anônima, auth) — ficam no bundle inicial.
import Acesso from "./pages/Acesso";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Inicio from "./pages/Inicio";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import LandingPage from "./pages/lp/LpFinancas";
import Comecar from "./pages/Comecar";
import TutorialLab from "./pages/TutorialLab";
import NotFound from "./pages/NotFound";

// Code-splitting: rotas pesadas (módulos do app, checkout, admin) saem do
// bundle inicial e carregam sob demanda — a LP/anônimo carrega leve.
const Planos = lazy(() => import("./pages/Planos"));
const Index = lazy(() => import("./pages/Index"));
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
const Preview = lazy(() => import("./pages/Preview"));

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminFunnel = lazy(() => import("./pages/admin/AdminFunnel"));
const AdminSubscribers = lazy(() => import("./pages/admin/AdminSubscribers"));

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/update-password" element={<PageTransition><UpdatePassword /></PageTransition>} />
        <Route path="/planos" element={<ProtectedRoute><PageTransition><Planos /></PageTransition></ProtectedRoute>} />
        <Route path="/" element={<RootGate />} />
        {/* LP aposentada — o funil (/comecar) é a entrada. Redireciona links/ads antigos. */}
        <Route path="/lp" element={<Navigate to="/comecar" replace />} />
        <Route path="/comecar" element={<PageTransition><Comecar /></PageTransition>} />
        <Route path="/tutorial-proto" element={<PageTransition><TutorialLab /></PageTransition>} />
        <Route path="/preview/:moduleKey" element={<PageTransition><Preview /></PageTransition>} />
        {/* Pivot "só finanças": a Home (hub multi-módulo) foi aposentada — entra direto no Finanças. */}
        <Route path="/home" element={<Navigate to="/financas" replace />} />
        <Route path="/financas" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="financas"><TrackedModule moduleId="financas"><Index /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/rotina" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="rotina"><TrackedModule moduleId="rotina"><Rotina /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/desenvolvimento" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="desenvolvimento"><TrackedModule moduleId="desenvolvimento"><DesenvolvimentoPessoal /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/saude" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="saude"><TrackedModule moduleId="saude"><Saude /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/casa" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="casa"><TrackedModule moduleId="casa"><Casa /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/estudos" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="estudos"><TrackedModule moduleId="estudos"><Estudos /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/biblioteca" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="biblioteca"><TrackedModule moduleId="biblioteca"><Biblioteca /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/beleza" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="beleza"><TrackedModule moduleId="beleza"><Beleza /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/viagens" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="viagens"><TrackedModule moduleId="viagens"><Viagens /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/carreira" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="carreira"><TrackedModule moduleId="carreira"><Carreira /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/treino" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="treino"><TrackedModule moduleId="treino"><Treino /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/dieta" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="dieta"><TrackedModule moduleId="dieta"><Dieta /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/hiperfoco" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="hiperfoco"><TrackedModule moduleId="hiperfoco"><Hiperfoco /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/relacionamentos" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="relacionamentos"><TrackedModule moduleId="relacionamentos"><Relacionamentos /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/pet" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="pet"><TrackedModule moduleId="pet"><PetPage /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/detox" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="detox"><TrackedModule moduleId="detox"><Detox /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/conquistas" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="conquistas"><TrackedModule moduleId="conquistas"><Conquistas /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="funil" element={<AdminFunnel />} />
          <Route path="assinantes" element={<AdminSubscribers />} />
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
                  <Route path="/inicio" element={<Inicio />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="*" element={<AnimatedRoutes />} />
                </Routes>
                <TrialBanner />
                <GlobalWinback />
                <QuickSignupModal />
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
