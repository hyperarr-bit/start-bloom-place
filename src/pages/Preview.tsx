import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useParams, Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { PreviewUserDataProvider } from "@/hooks/use-preview-user-data";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { DEMO_MODULES } from "@/lib/funnel";
import { ehFunilRoi2 } from "@/lib/funil-roi2";
import {
  bracoDaDemo, comBraco, comItem, estadoDaMissao, gravarEstadoDaMissao, itemDaDemo, tipoDoModulo,
  AREA_DO_TIPO, MODULO_DO_TIPO, PARAM_BRACO, type FimDaMissao, type ItemDaDemo,
} from "@/lib/demo-guiada";
import { aplicarItemNaDemo } from "@/lib/demo-guiada-registro";
import { sortearBracoDaDemo } from "@/lib/demo-guiada-braco";
import { comFunilB, comRespostas, ehFunilB, guardarRespostasNoAparelho, marcaDoFunilB, normalizarRespostas, respostasDaUrl, type RespostasDoFunilB } from "@/lib/funil-b";
import { VoltaDaDemoProvider, useVoltaDaDemo, type VoltaDaDemo } from "@/lib/volta-da-demo";
import type { OuvinteDaDemo, PonteDaDemo, TravaDoCta } from "@/components/demo-guiada/GuiaDaDemo";

/* DEMO GUIADA (28/09): a "Missão de 1 minuto" só desce quando o braço da demo
 * é "on" (src/lib/demo-guiada-braco.ts). Chave desligada = nada abaixo monta. */
const GuiaDaDemo = lazy(() => import("@/components/demo-guiada/GuiaDaDemo"));

// Fechamento ativo do tour (pico-fim): quem abre o 2º módulo já está engajado —
// é a hora de puxar pro cadastro, antes de esfriar fuçando.
/** Enquanto o chunk do módulo desce: mesma altura do cabeçalho + um pulso, sem texto que pisque. */
const CarregandoModulo = () => (
  <div className="min-h-[60vh] px-4 pt-6 space-y-3 animate-pulse" aria-busy="true" aria-label="Carregando">
    <div className="h-8 w-40 rounded-lg bg-muted" />
    <div className="h-10 rounded-xl bg-muted/70" />
    <div className="h-40 rounded-2xl bg-muted/60" />
    <div className="h-24 rounded-2xl bg-muted/50" />
  </div>
);

const TOUR_VISITED_KEY = "core_tour_visited";
const TOUR_NUDGE_DISMISSED_KEY = "core_tour_nudge_dismissed";

/* MÓDULOS SOB DEMANDA (22/09, varredura de velocidade): a demo importava os 16
 * módulos de uma vez — abrir /preview/financas baixava ~1,4 MB de JS antes de
 * pintar qualquer coisa, no passo da demo do funil pago. Agora cada módulo desce
 * quando é aberto (o mesmo lazy das rotas do App), e um chunk vazio vira erro
 * de chunk de verdade, que o RouteErrorBoundary sabe recarregar. */
const lazyModulo = (carregar: () => Promise<{ default?: unknown }>) =>
  lazy(async () => {
    const mod = await carregar();
    if (mod && typeof mod.default !== "undefined") return mod as { default: React.ComponentType };
    throw new Error("Failed to fetch dynamically imported module (módulo resolveu vazio)");
  });
const Index = lazyModulo(() => import("@/pages/Index"));
const Rotina = lazyModulo(() => import("@/pages/Rotina"));
const DesenvolvimentoPessoal = lazyModulo(() => import("@/pages/DesenvolvimentoPessoal"));
const Saude = lazyModulo(() => import("@/pages/Saude"));
const Casa = lazyModulo(() => import("@/pages/Casa"));
const Estudos = lazyModulo(() => import("@/pages/Estudos"));
const Biblioteca = lazyModulo(() => import("@/pages/Biblioteca"));
const Beleza = lazyModulo(() => import("@/pages/Beleza"));
const Viagens = lazyModulo(() => import("@/pages/Viagens"));
const Carreira = lazyModulo(() => import("@/pages/Carreira"));
const Treino = lazyModulo(() => import("@/pages/Treino"));
const Dieta = lazyModulo(() => import("@/pages/Dieta"));
const Hiperfoco = lazyModulo(() => import("@/pages/Hiperfoco"));
const Relacionamentos = lazyModulo(() => import("@/pages/Relacionamentos"));
const PetPage = lazyModulo(() => import("@/pages/Pet"));
const Detox = lazyModulo(() => import("@/pages/Detox"));

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
/** A volta que o funil deixou marcada, se deixou (o W grava o caminho dele). */
const voltaMarcada = (): string | null => {
  try { return sessionStorage.getItem("core-demo-volta"); } catch { return null; }
};
const voltaDaDemoShell = () => {
  try { return sessionStorage.getItem("core-demo-volta") || "/app?step=compromissos"; } catch { return "/app?step=compromissos"; }
};

/** `modulo` (27/09, funil ROI 2): na demo guiada da WEB a faixa diz que o
 *  módulo aberto é só o começo — "Finanças é só o começo — os 16 vêm juntos".
 *  É a única frase da demo que muda (a tela é o app real). */
const PreviewBanner = ({ funnel, modulo }: { funnel?: boolean; modulo?: string }) => {
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
          <span className={modulo ? "leading-snug" : "truncate"} data-testid="demo-faixa">
            {funnel && modulo
              ? <><strong>Demo</strong> · dados de exemplo · <strong>{modulo} é só o começo — os 16 vêm juntos</strong></>
              : funnel
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
const DemoTourNav = ({ current, from, ajustarLink, aoTrocar, faixa }: {
  current: string;
  from?: string;
  /** Demo guiada: as pílulas levam o braço e o item junto (a URL sobrevive ao apagão de storage). */
  ajustarLink?: (url: string) => string;
  /** Demo guiada: trocar de módulo no meio da missão encerra a missão. */
  aoTrocar?: (modulo: string) => void;
  /** Demo guiada: a faixa "Missão de 1 minuto", grudada embaixo das pílulas. */
  faixa?: ReactNode;
}) => {
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
        const destino = `/preview/${m.key}?funnel=1&tour=vida${from ? `&from=${from}` : ""}`;
        return (
          <Link
            key={m.key}
            to={ajustarLink ? ajustarLink(destino) : destino}
            onClick={() => { trackEvent("funnel_click", { cta: "demo_tour_module", module: m.key }); aoTrocar?.(m.key); }}
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
    {faixa}
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
  // 31/08: o /inicio virou o funil W (Pix); o dia 14 ficou só em /funil-dia14.
  // 19/09 (ordem do dono, "como era no dia 8 de agosto"): o dia 14 VOLTOU a
  // ser o /inicio — a volta da demo tem que cair na porta do tráfego pago, não
  // na rota de teste (o /funil-dia14 é o mesmo componente; quem entrou por
  // ele volta pra ele pelo referrer, sem quebrar o teste).
  dia14: { path: "/inicio", volta: "signup" },
  radar: { path: "/funil-radar", volta: "signup" },
  v1: { path: "/funil-v1", volta: "signup" },
};

/** Volta pro funil de teste preservando a trilha: ?porta=vida é o que faz o
 *  funil rodar em modo vitrine (fora do /inicio ele não sabe disso sozinho). */
const voltaFunilTeste = (from: string, tour?: boolean) => {
  const f = FUNIS_TESTE[from];
  if (!f) return null;
  // quem entrou na demo pela rota de TESTE volta pra ela (o funil abre a demo
  // por navegação completa, então o referrer é a página do funil)
  const path = from === "dia14" && typeof document !== "undefined" && /\/funil-dia14/.test(document.referrer) ? "/funil-dia14" : f.path;
  return `${path}?step=${f.volta}${tour ? "&porta=vida" : ""}`;
};

/** Pra onde o botão de baixo da demo leva (sem o item da demo guiada — quem
 *  põe o item é o Preview, antes de publicar pro botão e pra seta ←).
 *  P5 (30/09): saiu de dentro do DemoCta pra seta ← dos módulos usar a MESMA
 *  conta (src/lib/volta-da-demo.tsx). */
const destinoDoBotaoDaDemo = ({ funnel, tour, from }: { funnel?: boolean; tour?: boolean; from?: string }): string =>
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
  isNativeShell()
    // v83.1 (dono, 28/08): a demo virou o passo do FUNIL Me+ — a volta cai no
    // "quer organizar sua vida?" (compromissos → contrato → paywall), não
    // direto no offer: o contrato assinado é o preditor de 3× da autópsia.
    // Funil W (29/08): quem armou a demo pode deixar outra volta em
    // core-demo-volta — senão, o /app de sempre.
    ? voltaDaDemoShell()
    /* 31/08 (bronca do dono: "na demo, quando clica em voltar, vai pra um
       funil diferente"). O W abre a demo com ?from=w, e `from` só é resolvido
       pela lista FUNIS_TESTE — que tem dia14/radar/v1 e NÃO tem o w. Sem
       correspondência, caía no /comecar: outro funil, outro paywall, outra
       oferta. A marca que o próprio funil deixou (core-demo-volta) vale mais
       que qualquer tabela, porque ela carrega o caminho REAL de origem. */
    : voltaMarcada()
      ?? (from && voltaFunilTeste(from, tour))
      ?? (funnel || tour ? "/comecar?step=signup" : "/comecar");

/** CTA fixo no rodapé da demo — no funil volta pro funil; fora dele, cria conta.
 *  27/07: a demo PROVA e devolve direto pro CADASTRO, como no dia 14. (Antes
 *  devolvia pra tela SEU PLANO, que saiu do funil do app.) */
/** A faixa do "Criar conta" é fixa no rodapé (z-70) e cobria o que os módulos
 *  também fixam lá embaixo: o Iniciar Sessão/Finalizar do Treino, o Salvar da
 *  folha de edição da Grade (tocar em Salvar levava pro cadastro), o fim do
 *  Pergunte ao CORE (varredura 26/09). Agora: some enquanto houver janela ou
 *  folha aberta, e publica a própria altura na mesma variável que a faixa do
 *  teste grátis usa, pra barra fixa do módulo subir junto. */
const useDialogoAberto = () => {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const confere = () => setAberto(!!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
    confere();
    const obs = new MutationObserver(confere);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => obs.disconnect();
  }, []);
  return aberto;
};

const DemoCta = ({ funnel, trava }: {
  funnel?: boolean;
  /** Demo guiada (30/09, trava SUAVE): enquanto existe, o botão vira "1 toque e é
   *  seu →" e o toque reacende a missão em vez de sair — a missão desarma no 1º
   *  registro, em 20 s ou nesse 1º toque (o 2º toque é o "Quase lá" de sempre). */
  trava?: TravaDoCta | null;
}) => {
  // P5 (30/09): o destino (já com o item da demo guiada) e o efeito do toque
  // vêm do que o Preview publica — a MESMA fonte da seta ← dos módulos.
  const volta = useVoltaDaDemo();
  const dialogoAberto = useDialogoAberto();
  const faixaRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const raiz = document.documentElement.style;
    const el = faixaRef.current;
    if (!el || dialogoAberto) { raiz.removeProperty("--teste-banner-h"); return; }
    const publica = () => raiz.setProperty("--teste-banner-h", `${el.offsetHeight}px`);
    publica();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publica) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); raiz.removeProperty("--teste-banner-h"); };
  }, [dialogoAberto]);
  const shell = isNativeShell();
  if (dialogoAberto || !volta) return null;
  if (trava) {
    return (
      <div
        ref={faixaRef}
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto px-4 pt-3 flex items-center gap-3">
          <p className="text-xs text-muted-foreground leading-tight flex-1">
            Missão de 1 minuto · <strong className="text-foreground">falta 1 toque</strong>
          </p>
          <button
            type="button"
            onClick={trava.aoTocar}
            data-testid="demo-cta-travado"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 hover:bg-primary/90 transition"
          >
            {trava.rotulo} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      ref={faixaRef}
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center gap-3">
        <p className="text-xs text-muted-foreground leading-tight flex-1">
          {shell
            ? <>Isso tudo trabalhando com os <strong className="text-foreground">seus dados</strong>.</>
            : funnel && ehFunilRoi2()
              ? <>Gostou? Leva isso com os <strong className="text-foreground">seus números</strong>.</>
              : <>Gostou? Crie sua conta e leve isso com os <strong className="text-foreground">seus números</strong>.</>}
        </p>
        <Link
          to={volta.destino}
          onClick={() => { trackEvent("funnel_click", { cta: funnel ? "demo_quase_la" : "demo_create_account" }); volta.aoTocar?.(); }}
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
const DemoTourNudge = ({ count, from, ajustarLink }: { count: number; from?: string; ajustarLink?: (url: string) => string }) => {
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
          to={ajustarLink ? ajustarLink(to) : to}
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

  /* DEMO GUIADA (28/09) — a "Missão de 1 minuto" (src/lib/demo-guiada*.ts).
   * `braco` null = fora do experimento (chave desligada): NADA abaixo muda a
   * demo — sem faixa, sem item, links e eventos iguais aos de hoje (travado em
   * src/test/demo-guiada-off.test.tsx). Só na web, só no funil com o tour.
   * "off" = controle do A/B (a demo de hoje, com o braço nos eventos).
   * O SORTEIO do A/B é aqui, na ENTRADA da demo do funil do dia 14 (a 1ª
   * abertura, sem braço na URL) — e o braço é carimbado na URL logo abaixo. */
  const navigate = useNavigate();
  /* FUNIL B (30/09, src/lib/funil-b.ts): o braço vem na URL (`f=b`, carimbado na
   * porta). Na demo ele muda três coisas: a missão ganha os 2 toques do quiz
   * (quanto sai por mês / vitória da semana), as pílulas e a volta levam `f=b`
   * + as respostas junto, e a volta cai em `?step=guardando` (preço antes da
   * conta) em vez do cadastro. Chave desligada = `f=b` ignorado = a demo de hoje. */
  const [funilB] = useState<boolean>(() => !!funnel && !!tour && !embed && !isNativeShell() && ehFunilB(params));
  const [braco] = useState<"on" | "off" | null>(() => {
    if (!funnel || !tour || embed || isNativeShell()) return null;
    if (funilB) return "on"; // o B é a missão: não depende da chave da demo guiada
    const naUrl = bracoDaDemo(params);
    if (naUrl || from !== "dia14") return naUrl;
    const sorteado = sortearBracoDaDemo(); // chave desligada = null = a demo de hoje
    return sorteado === "1" ? "on" : sorteado === "0" ? "off" : null;
  });
  // B: as respostas do quiz que viraram toques (URL > sessão), e a memória mais nova pra volta
  const [respostas, setRespostas] = useState<RespostasDoFunilB>(() =>
    funilB ? { ...normalizarRespostas(estadoDaMissao().respostas), ...respostasDaUrl(params) } : {});
  const respostasRef = useRef(respostas);
  respostasRef.current = respostas;
  // braço carimbado na URL (replace): recarregar, voltar e trocar de módulo mantêm o braço
  // mesmo com o storage zerado pelo navegador do Instagram
  useEffect(() => {
    if (!braco || params.get(PARAM_BRACO)) return;
    const comOBraco = new URLSearchParams(params);
    comOBraco.set(PARAM_BRACO, braco === "on" ? "1" : "0");
    navigate({ search: `?${comOBraco.toString()}` }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [item, setItem] = useState<ItemDaDemo | null>(() => (braco === "on" ? itemDaDemo(params) : null));
  const tipo = braco === "on" ? tipoDoModulo(key) : null;
  const [guiaAberta, setGuiaAberta] = useState(() => {
    if (!tipo) return false;
    const e = estadoDaMissao();
    // uma missão por demo: começa no módulo da área e não volta depois de acabar
    return !e.fim && !e.item && !item && (!e.inicio || e.inicio === key);
  });
  useEffect(() => {
    if (guiaAberta && !estadoDaMissao().inicio) gravarEstadoDaMissao({ inicio: key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ouvinteRef = useRef<OuvinteDaDemo | null>(null);
  const encaminharGravacao = useCallback((k: string, v: unknown, a: unknown, g: boolean) => ouvinteRef.current?.(k, v, a, g), []);
  // 30/09: os chips da missão gravam no snapshot pela ponte; a trava suave do CTA fixo vem da missão
  const ponteRef = useRef<PonteDaDemo | null>(null);
  const [trava, setTrava] = useState<TravaDoCta | null>(null);
  const eventoDaMissao = (nome: string, extra: Record<string, unknown>) =>
    trackEvent(nome, { guia: "on", modulo: key, ...(tipo ? { area: AREA_DO_TIPO[tipo], tipo } : {}), ...marcaDoFunilB(funilB), ...extra });
  const encerrarMissao = (motivo: FimDaMissao) => {
    gravarEstadoDaMissao({ fim: motivo });
    setGuiaAberta(false);
  };
  // B: a resposta do quiz virou um toque na missão — guarda (memória, sessão, aparelho) e leva na URL
  const aoResposta = (chave: "gasto" | "consistencia" | "vitoria", label: string) => {
    const novas = normalizarRespostas({ ...respostasRef.current, [chave]: label });
    respostasRef.current = novas;
    setRespostas(novas);
    gravarEstadoDaMissao({ respostas: { [chave]: label } });
    guardarRespostasNoAparelho(tipo ? AREA_DO_TIPO[tipo] : null, novas);
    eventoDaMissao("demo_guia_resposta", { chave, answer: label });
  };
  // B: tudo que sai da demo leva o braço (f=b), as respostas e — na volta — o passo "guardando"
  const comB = (url: string) => (funilB ? comRespostas(comFunilB(url), respostasRef.current) : url);
  // pílulas: o braço e o item vão junto (a URL sobrevive ao apagão de storage do Instagram)
  const ajustarPilula = braco ? (url: string) => comB(comItem(comBraco(url, braco), item)) : undefined;
  // volta pro cadastro ("Quase lá", aviso dos módulos, "Levar isso pros meus números"): o item vai junto
  const ajustarVolta = item || funilB ? (url: string) => comB(comItem(url, item)) : undefined;
  const aoTrocarModulo = guiaAberta
    ? (destino: string) => {
        if (destino === key) return;
        // trocar de módulo NO MEIO da missão encerra a missão (sem prender, sem voltar sozinho);
        // com o item já anotado, é só explorar
        if (item) eventoDaMissao("demo_guia_explorar", { via: "barra", para: destino });
        else eventoDaMissao("demo_guia_pular", { motivo: "trocou_modulo", para: destino });
        encerrarMissao(item ? "explorar" : "trocou_modulo");
      }
    : undefined;
  // o "Quase lá" e a seta ← dos módulos (P5): a missão acaba do mesmo jeito; `via` só mede por onde saiu
  const aoTocarQuaseLa = guiaAberta
    ? (via?: "seta") => {
        if (item) eventoDaMissao("demo_guia_levar", { via: via ?? "cta" });
        else eventoDaMissao("demo_guia_pular", { motivo: "quase_la", ...(via ? { via } : {}) });
        encerrarMissao(item ? "levar" : "quase_la");
      }
    : undefined;
  const voltaDaMissao = () => voltaMarcada() ?? (from && voltaFunilTeste(from, tour)) ?? "/comecar?step=signup";
  /* P5 (30/09): o que o botão de baixo faz, publicado pra seta ← do cabeçalho
   * de todo módulo (src/lib/volta-da-demo.tsx) — mesmo destino, com o item da
   * demo guiada, e o mesmo fim de missão. Antes a seta ia pro /auth (Treino,
   * Dieta, Saúde…) ou pro /comecar (Finanças, Rotina, Metas…). */
  const destinoDaVolta = destinoDoBotaoDaDemo({ funnel, tour, from });
  const volta: VoltaDaDemo = {
    destino: ajustarVolta ? ajustarVolta(destinoDaVolta) : destinoDaVolta,
    aoTocar: aoTocarQuaseLa,
    modulo: key,
    ...(braco ? { extras: { guia: braco, ...marcaDoFunilB(funilB) } } : {}),
  };

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
  // P5 (30/09): a seta agora vai direto pra volta do funil (volta-da-demo);
  // a cerca fica como rede de segurança (Voltar do Android, links soltos).
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
    if (funnel) trackEvent("funnel_view", { step: "demo", ...(tour ? { tour: "vida", module: key } : {}), ...(braco ? { guia: braco } : {}), ...marcaDoFunilB(funilB) });
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
  }, [funnel, tour, key, braco, funilB]);

  if (!Component) {
    return <Navigate to="/lp" replace />;
  }

  return (
    <VoltaDaDemoProvider value={volta}>
    <div className={`min-h-screen bg-background pb-20 ${tour ? "demo-com-tour" : ""}`}>
      {!embed && (
        <PreviewBanner
          funnel={funnel}
          modulo={tour && funnel && !isNativeShell() && ehFunilRoi2() ? DEMO_MODULES.find((m) => m.key === key)?.label : undefined}
        />
      )}
      {tour && (
        <DemoTourNav
          current={key}
          from={from}
          ajustarLink={ajustarPilula}
          aoTrocar={aoTrocarModulo}
          faixa={guiaAberta && tipo ? (
            <Suspense fallback={null}>
              <GuiaDaDemo
                modulo={key}
                tipo={tipo}
                ouvinte={ouvinteRef}
                ponte={ponteRef}
                aoItem={(novo) => { gravarEstadoDaMissao({ item: novo }); setItem(novo); }}
                aoFim={encerrarMissao}
                irParaCadastro={(novo) => navigate(comB(comItem(voltaDaMissao(), novo)))}
                aoTravar={setTrava}
                funilB={funilB && tipo ? { area: AREA_DO_TIPO[tipo], respostas, aoResposta } : undefined}
              />
            </Suspense>
          ) : undefined}
        />
      )}
      {tour && funnel && isNativeShell() && <DicaDemoShell />}
      <PreviewUserDataProvider
        key={key}
        moduleKey={key}
        semente={item && MODULO_DO_TIPO[item.tipo] === key ? (sementes) => aplicarItemNaDemo(sementes, item) : undefined}
        aoGravar={guiaAberta ? encaminharGravacao : undefined}
        ponte={guiaAberta ? ponteRef : undefined}
      >
        <RouteErrorBoundary routeName={`preview-${key}`}>
          <Suspense fallback={<CarregandoModulo />}>
            <Component />
          </Suspense>
        </RouteErrorBoundary>
      </PreviewUserDataProvider>
      {tour && nudgeCount >= 2 && <DemoTourNudge count={nudgeCount} from={from} ajustarLink={ajustarVolta} />}
      {!embed && <DemoCta funnel={funnel} trava={guiaAberta ? trava : null} />}
    </div>
    </VoltaDaDemoProvider>
  );
};

export default Preview;
