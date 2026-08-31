import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
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
/** Volta da demo no shell: o funil que armou a demo deixa o endereço em
 *  core-demo-volta (funil W); sem ele, a porta clássica do /app. */
const voltaDaDemoShell = () => {
  try { return sessionStorage.getItem("core-demo-volta") || "/app?step=compromissos"; } catch { return "/app?step=compromissos"; }
};

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
            to={`/preview/${m.key}?funnel=1&tour=vida${from ? `&from=${from}` : ""}`}
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

/** Funis de teste congelados (24/07): a demo é a MESMA página pros três, então
 *  eles carimbam `&from=` na URL e a volta devolve pro funil de origem. Sem
 *  isso a pessoa sai do /funil-radar e volta no /inicio, trocando de funil
 *  justo antes da tela de venda. Whitelist fechada — `from` desconhecido cai
 *  no comportamento normal. */
const FUNIS_TESTE: Record<string, { path: string; volta: "signup" }> = {
  // 27/07: os TRÊS voltam em ?step=signup. O radar voltava em "plano" porque
  // tinha a tela SEU PLANO entre a demo e o cadastro — ela saiu quando o funil
  // do app foi alinhado ao esqueleto do dia 14 (ver ComecarRadar).
  // 31/08: o /inicio virou o funil W (Pix). O dia 14 continua vivo, mas agora
  // só em /funil-dia14 — quem entra na demo por ele tem que voltar pra lá, e
  // não cair no funil novo no meio do caminho.
  dia14: { path: "/funil-dia14", volta: "signup" },
  radar: { path: "/funil-radar", volta: "signup" },
  v1: { path: "/funil-v1", volta: "signup" },
};

/** Volta pro funil de teste preservando a trilha: ?porta=vida é o que faz o
 *  funil rodar em modo vitrine (fora do /inicio ele não sabe disso sozinho). */
const voltaFunilTeste = (from: string, tour?: boolean) => {
  const f = FUNIS_TESTE[from];
  if (!f) return null;
  return `${f.path}?step=${f.volta}${tour ? "&porta=vida" : ""}`;
};

/** CTA fixo no rodapé da demo — no funil volta pro funil; fora dele, cria conta.
 *  27/07: a demo PROVA e devolve direto pro CADASTRO, como no dia 14. (Antes
 *  devolvia pra tela SEU PLANO, que saiu do funil do app.) */
const DemoCta = ({ funnel, tour, from }: { funnel?: boolean; tour?: boolean; from?: string }) => {
  // APP DA LOJA (26/07): todos os destinos abaixo são rotas da WEB, e as duas
  // usadas na prática — /funil-radar e /inicio — entraram na trava SoNaWeb
  // quando eu fechei o vazamento do Pix. A trava manda pra ENTRADA_APP, que
  // abre no welcome azul: a pessoa tocava em "Criar conta" no fim da demo e
  // era devolvida ao começo do funil. Bug que eu mesmo introduzi.
  //
  // O fallback do tour na web era "/inicio?step=plano" — e o /inicio (dia 14)
  // NUNCA entendeu "plano": caía em "start" e reiniciava o funil. Só não
  // explodia porque o dia 14 sempre carimba &from=dia14 e nunca chega aqui.
  // Corrigido de passagem.
  const shell = isNativeShell();
  const to = shell
    // v83.1 (dono, 28/08): a demo virou o passo do FUNIL Me+ — a volta cai no
    // "quer organizar sua vida?" (compromissos → contrato → paywall), não
    // direto no offer: o contrato assinado é o preditor de 3× da autópsia.
    // Funil W (29/08): quem armou a demo pode deixar outra volta em
    // core-demo-volta — senão, o /app de sempre.
    ? voltaDaDemoShell()
    : (from && voltaFunilTeste(from, tour))
      ?? (funnel || tour ? "/comecar?step=signup" : "/comecar");
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center gap-3">
        <p className="text-xs text-muted-foreground leading-tight flex-1">
          {shell
            ? <>Isso tudo trabalhando com os <strong className="text-foreground">seus dados</strong>.</>
            : <>Gostou? Crie sua conta e leve isso com os <strong className="text-foreground">seus números</strong>.</>}
        </p>
        <Link
          to={to}
          onClick={() => trackEvent("funnel_click", { cta: funnel ? "demo_quase_la" : "demo_create_account" })}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 hover:bg-primary/90 transition"
        >
          {shell ? "Quero o meu assim" : funnel ? "Quase lá" : "Criar conta"} <ArrowRight className="w-4 h-4" />
        </Link>
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
    : (from && voltaFunilTeste(from, true)) ?? "/comecar?step=signup";
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

/** v83.1 — "tutorial mostrando onde clicar" (dono): coach-mark de 1 passo no
 *  1º mount da demo dentro do shell. Some sozinho em 6s ou no toque; 1× por
 *  sessão. Aponta os dois controles que importam: a barra de módulos e o CTA. */
const DICA_DEMO_KEY = "core-demo-dica";
const DicaDemoShell = () => {
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem(DICA_DEMO_KEY) !== "1"; } catch { return true; }
  });
  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(DICA_DEMO_KEY, "1"); } catch { /* noop */ }
    trackEvent("demo_dica_view", {});
    const id = window.setTimeout(() => setShow(false), 6000);
    return () => window.clearTimeout(id);
  }, [show]);
  if (!show) return null;
  return (
    <button
      onClick={() => setShow(false)}
      className="fixed inset-x-0 z-[72] px-4 pointer-events-none"
      style={{ top: "calc(var(--app-safe-top, 0px) + 96px)" }}
      aria-label="Fechar dica"
    >
      <span className="max-w-md mx-auto pointer-events-auto flex items-start gap-2.5 rounded-2xl bg-[#16121c] text-white p-3.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-300 text-left">
        <span className="text-[18px] leading-none pt-0.5">👆</span>
        <span className="flex-1 text-[12.5px] leading-snug">
          <b>Isso aqui é o app de verdade</b> — mexe à vontade. Troca de módulo na barra
          de cima; quando terminar, o botão lá embaixo continua teu plano.
        </span>
      </span>
    </button>
  );
};

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
    <div className={`min-h-screen bg-background pb-20 ${tour ? "demo-com-tour" : ""}`}>
      {!embed && <PreviewBanner funnel={funnel} />}
      {tour && <DemoTourNav current={key} from={from} />}
      {tour && funnel && isNativeShell() && <DicaDemoShell />}
      <PreviewUserDataProvider key={key} moduleKey={key}>
        <RouteErrorBoundary routeName={`preview-${key}`}>
          <Component />
        </RouteErrorBoundary>
      </PreviewUserDataProvider>
      {tour && nudgeCount >= 2 && <DemoTourNudge count={nudgeCount} from={from} />}
      {!embed && <DemoCta funnel={funnel} tour={tour} from={from} />}
    </div>
  );
};

export default Preview;
