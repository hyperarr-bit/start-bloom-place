import { useEffect, useRef, useState } from "react";
import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { DEMO_MODULES } from "@/lib/funnel";

// Fechamento ativo do tour (pico-fim): quem abre o 2º módulo já está engajado —
// é a hora de puxar pro cadastro, antes de esfriar fuçando.
const TOUR_VISITED_KEY = "core_tour_visited";
const TOUR_NUDGE_DISMISSED_KEY = "core_tour_nudge_dismissed";

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

/** Demo guiada do funil vitrine (tour=vida): navegação curada entre os 5
 *  módulos do criativo — liberdade com corrimão, não os 16 de uma vez. */
const DemoTourNav = ({ current }: { current: string }) => (
  <div className="sticky top-0 z-[60] bg-background/95 backdrop-blur border-b border-border">
    <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
      {DEMO_MODULES.map((m) => {
        const active = m.key === current;
        return (
          <Link
            key={m.key}
            to={`/preview/${m.key}?funnel=1&tour=vida`}
            onClick={() => trackEvent("funnel_click", { cta: "demo_tour_module", module: m.key })}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            <span>{m.emoji}</span> {m.label}
          </Link>
        );
      })}
      <span className="shrink-0 inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground border border-dashed border-border">
        +11 no app completo
      </span>
    </div>
  </div>
);

/** CTA fixo no rodapé da demo — no funil volta pro cadastro; fora dele, cria conta.
 *  No tour vitrine o cadastro é em /inicio (preserva a área escolhida). */
const DemoCta = ({ funnel, tour }: { funnel?: boolean; tour?: boolean }) => {
  const to = tour ? "/inicio?step=signup" : funnel ? "/comecar?step=signup" : "/comecar";
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center gap-3">
        <p className="text-xs text-muted-foreground leading-tight flex-1">
          Gostou? Crie sua conta e leve isso com os <strong className="text-foreground">seus números</strong>.
        </p>
        <Link
          to={to}
          onClick={() => trackEvent("funnel_click", { cta: funnel ? "demo_quase_la" : "demo_create_account" })}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 hover:bg-primary/90 transition"
        >
          {funnel ? "Quase lá" : "Criar conta"} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

/** Banner de fechamento ativo: aparece quando a pessoa abre o 2º módulo do
 *  tour — "você já viu N de 16, bora com os SEUS dados?". Some ao dispensar. */
const DemoTourNudge = ({ count }: { count: number }) => {
  const [show, setShow] = useState(true);
  if (!show) return null;
  const dismiss = () => {
    try { sessionStorage.setItem(TOUR_NUDGE_DISMISSED_KEY, "1"); } catch { /* noop */ }
    setShow(false);
  };
  return (
    <div
      className="fixed inset-x-0 bottom-[64px] z-[71] px-4 pointer-events-none"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-primary bg-card p-3 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary text-primary-foreground text-lg shrink-0">✨</span>
        <div className="flex-1 leading-tight">
          <p className="text-[13.5px] font-bold">Você já viu {count} de 16 módulos</p>
          <p className="text-[11.5px] text-muted-foreground">Bora montar tudo com os seus dados de verdade?</p>
        </div>
        <Link
          to="/inicio?step=signup"
          onClick={() => trackEvent("funnel_click", { cta: "demo_nudge_signup", modules: count })}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground font-semibold text-[13px] px-3 py-2 hover:bg-primary/90 transition"
        >
          Criar conta <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button onClick={dismiss} aria-label="Dispensar" className="shrink-0 -mr-1 p-1 text-muted-foreground/60 hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Preview = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const [params] = useSearchParams();
  const funnel = params.get("funnel") === "1";
  const tour = params.get("tour") === "vida";
  const key = (moduleKey ?? "").toLowerCase();
  const Component = MODULE_COMPONENTS[key];

  // Nudge de fechamento: nº de módulos DISTINTOS abertos no tour (sessionStorage).
  const [nudgeCount, setNudgeCount] = useState(0);
  const nudgeFiredRef = useRef(false);

  // Telemetria do funil: a demo (app real) é um passo do funil.
  // No tour, cada módulo visitado conta — mede quantos cômodos a pessoa abre.
  useEffect(() => {
    if (funnel) trackEvent("funnel_view", { step: "demo", ...(tour ? { tour: "vida", module: key } : {}) });
    if (!tour) return;
    let visited: string[] = [];
    try { visited = JSON.parse(sessionStorage.getItem(TOUR_VISITED_KEY) || "[]"); } catch { visited = []; }
    if (!visited.includes(key)) {
      visited.push(key);
      try { sessionStorage.setItem(TOUR_VISITED_KEY, JSON.stringify(visited)); } catch { /* noop */ }
    }
    const dismissed = (() => { try { return sessionStorage.getItem(TOUR_NUDGE_DISMISSED_KEY) === "1"; } catch { return false; } })();
    setNudgeCount(visited.length >= 2 && !dismissed ? visited.length : 0);
    if (visited.length >= 2 && !dismissed && !nudgeFiredRef.current) {
      nudgeFiredRef.current = true;
      trackEvent("funnel_view", { step: "demo_nudge", tour: "vida", modules: visited.length });
    }
  }, [funnel, tour, key]);

  if (!Component) {
    return <Navigate to="/lp" replace />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PreviewBanner funnel={funnel} />
      {tour && <DemoTourNav current={key} />}
      <PreviewUserDataProvider key={key} moduleKey={key}>
        <RouteErrorBoundary routeName={`preview-${key}`}>
          <Component />
        </RouteErrorBoundary>
      </PreviewUserDataProvider>
      {tour && nudgeCount >= 2 && <DemoTourNudge count={nudgeCount} />}
      <DemoCta funnel={funnel} tour={tour} />
    </div>
  );
};

export default Preview;
