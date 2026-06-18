import { useParams, Link, Navigate } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { MODULE_COMPONENTS } from "@/lib/preview-modules";
import { Sparkles } from "lucide-react";

const PreviewBanner = () => (
  <div className="sticky top-0 z-[60] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[12px] md:text-sm">
    <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
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

const Preview = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const key = (moduleKey ?? "").toLowerCase();
  const Component = MODULE_COMPONENTS[key];

  if (!Component) {
    return <Navigate to="/lp" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PreviewBanner />
      <PreviewUserDataProvider moduleKey={key}>
        <RouteErrorBoundary routeName={`preview-${key}`}>
          <Component />
        </RouteErrorBoundary>
      </PreviewUserDataProvider>
    </div>
  );
};

export default Preview;
