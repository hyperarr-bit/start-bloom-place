import { Routes, Route, useParams, Link, Navigate } from "react-router-dom";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { DemoModeProvider } from "@/hooks/use-demo-mode";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { getDemoSeeds } from "@/lib/preview-seeds";
import { MODULE_COMPONENTS } from "@/lib/preview-modules";
import Home from "@/pages/Home";

const DemoBanner = () => (
  <div className="demo-banner bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[12px] md:text-sm">
    <div className="h-full max-w-5xl mx-auto px-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span className="truncate">
          <strong>Demonstração</strong> — dados fictícios, nada é salvo.
        </span>
      </div>
      <Link
        to="/auth?signup=1"
        className="shrink-0 bg-white text-violet-700 font-semibold px-3 py-1 rounded-md hover:bg-white/90 transition text-[11px] md:text-xs whitespace-nowrap"
      >
        Assinar
      </Link>
    </div>
  </div>
);

const DemoModuleView = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const key = (moduleKey ?? "").toLowerCase();
  const Component = MODULE_COMPONENTS[key];
  if (!Component) return <Navigate to="/demo" replace />;
  return (
    <RouteErrorBoundary routeName={`demo-${key}`}>
      <Component />
    </RouteErrorBoundary>
  );
};

/**
 * Full navigable demo: the real app HOME + every module, rendered under one
 * shared in-memory store (nothing persists). Module pages and home launchers
 * remap their navigation via useAppNavigate so the visitor stays inside /demo;
 * account/profile actions are gated by useDemoMode. The "Assinar" CTA is the
 * single way out into the paid funnel.
 */
const Demo = () => {
  // Seed once per demo session so edits made while navigating stick around.
  const seeds = useMemo(() => getDemoSeeds(), []);
  return (
    <DemoModeProvider>
      <PreviewUserDataProvider seeds={seeds}>
        <div className="demo-shell min-h-screen bg-background">
          <DemoBanner />
          <div className="demo-content">
            <RouteErrorBoundary routeName="demo-home">
              <Routes>
                <Route index element={<Home />} />
                <Route path=":moduleKey" element={<DemoModuleView />} />
                <Route path="*" element={<Navigate to="/demo" replace />} />
              </Routes>
            </RouteErrorBoundary>
          </div>
        </div>
      </PreviewUserDataProvider>
    </DemoModeProvider>
  );
};

export default Demo;
