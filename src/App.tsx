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




const RootGate = () => {
  const { loading } = useAuth();
  if (loading) return null;
  return <Navigate to="/home" replace />;
};


import Home from "./pages/Home";
import Acesso from "./pages/Acesso";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Inicio from "./pages/Inicio";
import Planos from "./pages/Planos";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import Index from "./pages/Index";
import Rotina from "./pages/Rotina";
import DesenvolvimentoPessoal from "./pages/DesenvolvimentoPessoal";
import Saude from "./pages/Saude";
import Casa from "./pages/Casa";
import Estudos from "./pages/Estudos";
import Biblioteca from "./pages/Biblioteca";
import Beleza from "./pages/Beleza";
import Viagens from "./pages/Viagens";
import Carreira from "./pages/Carreira";
import Treino from "./pages/Treino";
import Dieta from "./pages/Dieta";
import Hiperfoco from "./pages/Hiperfoco";
import Relacionamentos from "./pages/Relacionamentos";
import PetPage from "./pages/Pet";
import Detox from "./pages/Detox";
import Conquistas from "./pages/Conquistas";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/update-password" element={<PageTransition><UpdatePassword /></PageTransition>} />
        <Route path="/planos" element={<ProtectedRoute><PageTransition><Planos /></PageTransition></ProtectedRoute>} />
        <Route path="/" element={<RootGate />} />
        <Route path="/home" element={<ProtectedRoute allowGuest><PageTransition><Home /></PageTransition></ProtectedRoute>} />
        <Route path="/financas" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="financas"><TrackedModule moduleId="financas"><Index /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/rotina" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="rotina"><TrackedModule moduleId="rotina"><Rotina /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/desenvolvimento" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="desenvolvimento"><TrackedModule moduleId="desenvolvimento"><DesenvolvimentoPessoal /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/saude" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="saude"><TrackedModule moduleId="saude"><Saude /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/casa" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="casa"><TrackedModule moduleId="casa"><Casa /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/estudos" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="estudos"><TrackedModule moduleId="estudos"><Estudos /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/biblioteca" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="biblioteca"><TrackedModule moduleId="biblioteca"><Biblioteca /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/beleza" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="beleza"><TrackedModule moduleId="beleza"><Beleza /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/viagens" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="viagens"><TrackedModule moduleId="viagens"><Viagens /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/carreira" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="carreira"><TrackedModule moduleId="carreira"><Carreira /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/treino" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="treino"><TrackedModule moduleId="treino"><Treino /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/dieta" element={<ProtectedRoute allowGuest><PageTransition><RouteErrorBoundary routeName="dieta"><TrackedModule moduleId="dieta"><Dieta /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/hiperfoco" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="hiperfoco"><TrackedModule moduleId="hiperfoco"><Hiperfoco /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/relacionamentos" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="relacionamentos"><TrackedModule moduleId="relacionamentos"><Relacionamentos /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/pet" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="pet"><TrackedModule moduleId="pet"><PetPage /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/detox" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="detox"><TrackedModule moduleId="detox"><Detox /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/conquistas" element={<ProtectedRoute><PageTransition><RouteErrorBoundary routeName="conquistas"><TrackedModule moduleId="conquistas"><Conquistas /></TrackedModule></RouteErrorBoundary></PageTransition></ProtectedRoute>} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

import { useIsTikTokBrowser } from "@/hooks/use-in-app-browser";
import { AccessGateUI } from "@/components/AccessGateUI";

const App = () => {
  const { isTikTok } = useIsTikTokBrowser();

  if (isTikTok) {
    return (
      <ThemeProvider>
        <Sonner />
        <AccessGateUI />
      </ThemeProvider>
    );
  }

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
