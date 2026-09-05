import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { DEMO_MODULES } from "@/lib/funnel";
import { DemoCta } from "@/components/demo/DemoCta";
import { DemoCoach } from "@/components/demo/DemoCoach";
import { coachJaVisto } from "@/components/demo/coach-passos";
import { voltaDaDemoShell, voltaMarcada, voltaFunilTeste, linkDoModuloDaDemo, abaPadraoDaDemo } from "@/components/demo/rotas";

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
// As voltas da demo (core-demo-volta, funis de teste) moram em
// components/demo/rotas.ts desde 05/09 — o CTA e o coach são testados sem
// importar as 16 páginas de módulo daqui.

const PreviewBanner = ({ funnel }: { funnel?: boolean }) => {
  /* v83.5 (dono): no APP o roxo era identidade que o app nunca teve — a demo
     é o app real, então o aviso VESTE o app (fundo do tema + grafite, faixa
     da status bar fica na cor padrão). O gradiente roxo segue na WEB. */
  if (funnel && isNativeShell()) {
    return (
      <div className="bg-background border-b border-border text-foreground text-[12px]">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-accent" />
          <span className="truncate"><strong>Experimente à vontade</strong> — dados de exemplo.</span>
        </div>
      </div>
    );
  }
  return (
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
};

/** Demo guiada do funil vitrine (tour=vida): navegação curada entre os 5
 *  módulos do criativo — liberdade com corrimão, não os 16 de uma vez. */
/**
 * BARRA DO TOUR (27/07 — bug do dono: "na web a parte de cima fica bonita, no
 * app fica meio bugado").
 *
 * Causa: esta barra é uma <div class="sticky top-0">, e a regra global que
 * empurra tudo que gruda pra baixo da status bar só casa com
 * `header.sticky.top-0` (index.css). Sem o empurrão, no app ela grudava em
 * top:0 — atrás da faixa opaca que cobre a status bar (.app-safe-top-guard,
 * z-index máximo). Sumia quase inteira, e o header do módulo, esse sim
 * empurrado, ficava sozinho no topo.
 *
 * Agora ela tem classe própria (.demo-tour-nav) que gruda em
 * var(--app-safe-top), e a altura real dela é publicada em --demo-nav-h pra o
 * header do módulo grudar LOGO ABAIXO em vez de disputar o mesmo topo. Altura
 * medida, não chutada: quem aumenta a fonte do sistema muda esse número.
 */
const DemoTourNav = ({ current, from }: { current: string; from?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) el.closest(".demo-com-tour")?.setAttribute("style", `--demo-nav-h:${h}px`);
    };
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
  <div ref={ref} className="demo-tour-nav bg-background/95 backdrop-blur border-b border-border">
    <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
      {DEMO_MODULES.map((m) => {
        const active = m.key === current;
        return (
          <Link
            key={m.key}
            // 05/09: o link já carrega a aba padrão do módulo (metas abre em METAS,
            // como nos outros quatro funis) — ver rotas.ts.
            to={linkDoModuloDaDemo(m.key, from)}
            onClick={() => trackEvent("funnel_click", { cta: "demo_tour_module", module: m.key })}
            // min-h-11 (44px): a auditoria de toque de 14/08 pegou estas
            // pílulas com 31px de altura — são a navegação mais tocada da
            // demo, e alvo curto vira "área não clicável" na avaliação.
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-[12.5px] font-semibold transition-colors ${
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
        +10 no app completo
      </span>
    </div>
  </div>
  );
};

/** Banner de fechamento ativo: aparece quando a pessoa abre o 2º módulo do
 *  tour — "você já viu N de 16, bora com os SEUS dados?". Some ao dispensar. */
const DemoTourNudge = ({ count, from }: { count: number; from?: string }) => {
  const [show, setShow] = useState(true);
  // No shell o destino é a porta do app; na web, o funil de origem. Fallback
  // em ?step=signup (o "plano" saiu — ver DemoCta).
  const to = isNativeShell()
    // v83.1: nudge também devolve pro ritual (compromissos → contrato → offer).
    ? voltaDaDemoShell()
    : voltaMarcada() ?? (from && voltaFunilTeste(from, true)) ?? "/comecar?step=signup";
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
          to={to}
          onClick={() => trackEvent("funnel_click", { cta: "demo_nudge_signup", modules: count })}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground font-semibold text-[13px] px-3 py-2 hover:bg-primary/90 transition"
        >
          {/* v83.1: no shell o cadastro vem DEPOIS da compra — "Criar conta" mentia */}
          {isNativeShell() ? "Quero o meu" : "Criar conta"} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button onClick={dismiss} aria-label="Dispensar" className="shrink-0 -mr-1 p-1 text-muted-foreground/60 hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* v83.1 tinha aqui a DicaDemoShell: um card escuro genérico de 6s ("isso aqui
 * é o app de verdade — mexe à vontade"), 1× por sessão. Saiu em 05/09 (v105):
 * a DEMO GUIADA (components/demo/DemoCoach) aponta, no módulo que a pessoa
 * escolheu, o resumo, as abas e a barra dos outros módulos, em 3 passos. */

const Preview = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const [params] = useSearchParams();
  const funnel = params.get("funnel") === "1";
  const tour = params.get("tour") === "vida";
  // De qual funil de teste a pessoa saiu (whitelist em FUNIS_TESTE); vazio =
  // funil de produção, comportamento inalterado.
  const from = params.get("from") ?? undefined;
  // Embutido no funil v2 (?embed=v2): o v2 põe a própria moldura/selo/CTA por
  // fora, então o banner e o rodapé daqui saem de cena. Sem o parâmetro,
  // NADA muda — o preview de sempre segue idêntico pro funil atual.
  const embed = params.get("embed") === "v2";
  const key = (moduleKey ?? "").toLowerCase();
  const Component = MODULE_COMPONENTS[key];

  // CERCA DO TOUR (bug 24/07): a seta ← dos módulos navega pra "/" e o
  // RootGate mandava o visitante pro /comecar (funil de FINANÇAS) — fuga do
  // vitrine. Marca o tour ativo; o RootGate devolve pra /inicio?step=analise.
  useEffect(() => {
    if (!tour) return;
    try { sessionStorage.setItem("core-demo-tour", String(Date.now())); } catch { /* noop */ }
  }, [tour]);

  // CERCA DO SHELL (28/08): arma a guarda que devolve pro funil quem sai da
  // demo pela seta ← dos módulos (navigate("/home") → parecia "outro funil").
  // Quem consome é o GuardaDemoShell no App. Só no app da loja + funil.
  useEffect(() => {
    if (!funnel || !isNativeShell()) return;
    try { sessionStorage.setItem("core-demo-guarda", "1"); } catch { /* noop */ }
  }, [funnel]);

  // FAIXA DA STATUS BAR: v83.4 pintava de roxo pra casar com o banner; o dono
  // vetou ("nunca botamos isso") e o banner do shell virou cor do app — a
  // faixa padrão (background) já casa sozinha. Sem override aqui.

  // Nudge de fechamento: nº de módulos DISTINTOS abertos no tour (sessionStorage).
  const [nudgeCount, setNudgeCount] = useState(0);
  const nudgeFiredRef = useRef(false);

  // DEMO GUIADA (v105): coach de 3 passos no 1º módulo aberto, 1× por sessão.
  // 05/09: também na WEB (o dono quer os dois funis idênticos) — a demo é a
  // mesma página nos dois, e é onde 14% somem no app. O Preview NÃO remonta ao trocar de módulo (mesmo
  // elemento de rota), então o módulo do coach fica preso ao 1º aberto; um
  // pulo de módulo com ele aberto o fecha (o coach conta os passos vistos).
  const [coachModule, setCoachModule] = useState<string | null>(() =>
    tour && funnel && key in MODULE_COMPONENTS && !coachJaVisto() ? key : null);
  useEffect(() => {
    if (coachModule && key !== coachModule) setCoachModule(null);
  }, [key, coachModule]);

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

  // ABA CERTA DO MÓDULO DE METAS (05/09, ver rotas.ts): o W abre a demo de
  // metas sem ?tab=metas e a pessoa caía em SOBRE MIM. Normaliza a URL uma
  // vez, com replace — mesma rota, o Preview não remonta e o funnel_view do
  // mount sai só uma vez; o módulo lê a aba da URL ao montar, depois disto.
  const buscaComAba = tour ? abaPadraoDaDemo(key, params.toString()) : null;
  if (buscaComAba) {
    return <Navigate to={`/preview/${key}?${buscaComAba}`} replace />;
  }

  return (
    <div className={`min-h-screen bg-background pb-20 ${tour ? "demo-com-tour" : ""}`}>
      {!embed && <PreviewBanner funnel={funnel} />}
      {tour && <DemoTourNav current={key} from={from} />}
      <PreviewUserDataProvider key={key} moduleKey={key}>
        <RouteErrorBoundary routeName={`preview-${key}`}>
          <Component />
        </RouteErrorBoundary>
      </PreviewUserDataProvider>
      {/* o nudge espera o coach fechar — dois cards flutuando ao mesmo tempo é ruído */}
      {tour && nudgeCount >= 2 && !coachModule && <DemoTourNudge count={nudgeCount} from={from} />}
      {!embed && <DemoCta funnel={funnel} tour={tour} from={from} />}
      {coachModule && <DemoCoach module={coachModule} onDone={() => setCoachModule(null)} />}
    </div>
  );
};

export default Preview;
