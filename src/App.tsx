import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import { UserDataProvider } from "@/hooks/use-user-data";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TrialBanner } from "@/components/TrialBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TrackedModule } from "@/components/TrackedModule";
import { GlobalWinback } from "@/components/retention/GlobalWinback";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
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
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminConversion from "./pages/admin/AdminConversion";
import AdminChurn from "./pages/admin/AdminChurn";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminFunnel from "./pages/admin/AdminFunnel";
import AdminActivation from "./pages/admin/AdminActivation";
import AdminEmailVariants from "./pages/admin/AdminEmailVariants";
import AdminOnboarding from "./pages/admin/AdminOnboarding";
import AdminRetention from "./pages/admin/AdminRetention";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/update-password" element={<PageTransition><UpdatePassword /></PageTransition>} />
        <Route path="/planos" element={<ProtectedRoute><PageTransition><Planos /></PageTransition></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><PageTransition><Home /></PageTransition></ProtectedRoute>} />
        <Route path="/financas" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="financas"><Index /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/rotina" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="rotina"><Rotina /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/desenvolvimento" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="desenvolvimento"><DesenvolvimentoPessoal /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/saude" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="saude"><Saude /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/casa" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="casa"><Casa /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/estudos" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="estudos"><Estudos /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/biblioteca" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="biblioteca"><Biblioteca /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/beleza" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="beleza"><Beleza /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/viagens" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="viagens"><Viagens /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/carreira" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="carreira"><Carreira /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/treino" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="treino"><Treino /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/dieta" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="dieta"><Dieta /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/hiperfoco" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="hiperfoco"><Hiperfoco /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/relacionamentos" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="relacionamentos"><Relacionamentos /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/pet" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="pet"><PetPage /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/detox" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="detox"><Detox /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/conquistas" element={<ProtectedRoute><PageTransition><TrackedModule moduleId="conquistas"><Conquistas /></TrackedModule></PageTransition></ProtectedRoute>} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="conversao" element={<AdminConversion />} />
          <Route path="churn" element={<AdminChurn />} />
          <Route path="usuarios" element={<AdminUsers />} />
          <Route path="funil" element={<AdminFunnel />} />
          <Route path="ativacao" element={<AdminActivation />} />
          <Route path="emails" element={<AdminEmailVariants />} />
          <Route path="onboarding" element={<AdminOnboarding />} />
          <Route path="retention" element={<AdminRetention />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <UserDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineBanner />
          <BrowserRouter>
            <AnimatedRoutes />
            <TrialBanner />
            <GlobalWinback />
          </BrowserRouter>
        </TooltipProvider>
        </UserDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
