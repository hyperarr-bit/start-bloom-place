import { useEffect } from "react";
import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Sparkles, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

import Index from "@/pages/Index";
import Rotina from "@/pages/Rotina";
import DesenvolvimentoPessoal from "@/pages/DesenvolvimentoPessoal";
import Saude from "@/pages/Saude";
import Casa from "@/pages/Casa";
import Estudos from "@/pages/Estudos";
import Biblioteca from "@/pages/Biblioteca";
import Beleza from "@/pages/Beleza";
import Viagens from "@/pages/Viagens";
import Carreira from "@/pages/Carreira";
import Treino from "@/pages/Treino";
import Dieta from "@/pages/Dieta";
import Hiperfoco from "@/pages/Hiperfoco";
import Relacionamentos from "@/pages/Relacionamentos";
import PetPage from "@/pages/Pet";
import Detox from "@/pages/Detox";

const MODULE_COMPONENTS: Record<string, React.ComponentType> = {
  financas: Index,
  rotina: Rotina,
  desenvolvimento: DesenvolvimentoPessoal,
  saude: Saude,
  casa: Casa,
  estudos: Estudos,
  biblioteca: Biblioteca,
  beleza: Beleza,
  viagens: Viagens,
  carreira: Carreira,
  treino: Treino,
  dieta: Dieta,
  hiperfoco: Hiperfoco,
  mente: Hiperfoco,
  relacionamentos: Relacionamentos,
  pet: PetPage,
  detox: Detox,
};

// Estático de propósito: sticky aqui brigava com o header sticky do módulo e
// cobria títulos de cards no scroll do celular. O CTA persistente é o de baixo.
const PreviewBanner = ({ funnel }: { funnel?: boolean }) => (
  <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[12px] md:text-sm">
    <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {funnel
            ? <><strong>Experimente à vontade</strong> — dados de exemplo.</>
            : <><strong>Demonstração</strong> — dados fictícios, nada é salvo.</>}
        </span>
      </div>
      {!funnel && (
        <Link
          to="/auth"
          className="shrink-0 bg-white text-violet-700 font-semibold px-3 py-1 rounded-md hover:bg-white/90 transition text-[11px] md:text-xs whitespace-nowrap"
        >
          Criar conta
        </Link>
      )}
    </div>
  </div>
);

/** CTA fixo no rodapé da demo — no funil volta pro cadastro; fora dele, cria conta. */
const DemoCta = ({ funnel }: { funnel?: boolean }) => (
  <div
    className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
  >
    <div className="max-w-md mx-auto px-4 pt-3 flex items-center gap-3">
      <p className="text-xs text-muted-foreground leading-tight flex-1">
        Gostou? Crie sua conta e leve isso com os <strong className="text-foreground">seus números</strong>.
      </p>
      <Link
        to={funnel ? "/comecar?step=signup" : "/comecar"}
        onClick={() => trackEvent("funnel_click", { cta: funnel ? "demo_quase_la" : "demo_create_account" })}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 hover:bg-primary/90 transition"
      >
        {funnel ? "Quase lá" : "Criar conta"} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  </div>
);

const Preview = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const [params] = useSearchParams();
  const funnel = params.get("funnel") === "1";
  const key = (moduleKey ?? "").toLowerCase();
  const Component = MODULE_COMPONENTS[key];

  // Telemetria do funil: a demo (app real) é um passo do funil.
  useEffect(() => {
    if (funnel) trackEvent("funnel_view", { step: "demo" });
  }, [funnel]);

  if (!Component) {
    return <Navigate to="/lp" replace />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PreviewBanner funnel={funnel} />
      <PreviewUserDataProvider moduleKey={key}>
        <RouteErrorBoundary routeName={`preview-${key}`}>
          <Component />
        </RouteErrorBoundary>
      </PreviewUserDataProvider>
      <DemoCta funnel={funnel} />
    </div>
  );
};

export default Preview;
