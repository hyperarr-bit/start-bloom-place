import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

export interface SpotlightStep {
  selector: string;
  label: string;
  advanceOnClick?: boolean;
  advanceOnAction?: string;
  /** Optional: storage key to inspect; if it already has data on mount, auto-advance. */
  checkKey?: string;
  /** Optional: custom predicate to determine whether the data at checkKey counts as "done". */
  checkValue?: (v: any) => boolean;
  /** Optional: called when this step becomes active (e.g. to switch tabs). */
  onEnter?: () => void;
  /** Optional: show a "Pular este passo" link inside the bubble. */
  skippable?: boolean;
  /** Optional: force bubble placement above/below target. Defaults to auto. */
  placement?: "auto" | "above" | "below";
}

interface SpotlightOverlayProps {
  moduleKey: "financas" | "rotina" | "dieta" | "treino" | "metas" | "saude" | "hiperfoco" | "estudos" | "carreira" | "biblioteca" | "casa" | "beleza" | "viagens" | "relacionamentos" | "pet" | "detox";
  steps: SpotlightStep[];
  activationActions?: string[];
  /** Optional: called when the tutorial is fully completed (not dismissed). If provided, suppresses the default completion modal. */
  onComplete?: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8;

export const SpotlightOverlay = ({ moduleKey, steps, activationActions = [], onComplete }: SpotlightOverlayProps) => {
  const { get, set, isGuest, loaded } = useUserData();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [isReplay, setIsReplay] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  // Refs keep the activation listener stable across step changes,
  // so events fired in the same tick aren't lost.
  const stepIdxRef = useRef(0);
  const stepsRef = useRef(steps);
  stepIdxRef.current = stepIdx;
  stepsRef.current = steps;

  useEffect(() => {
    // Wait for user data to load before deciding whether to show the tutorial.
    // Otherwise, on first render `done` reads as "" (fallback) and the overlay
    // would briefly activate and intercept clicks even when the tutorial was
    // already completed.
    if (!loaded) return;
    const target = get<string>("quickstart-target-module", "");
    const done = get<string>(`spotlight-done-${moduleKey}`, "");
    const forceNewUser = !!get<string>("force-new-user-tutorial", "") || (typeof localStorage !== "undefined" && localStorage.getItem("force-new-user-tutorial") === "true");
    // REVER TUTORIAL (19/07): o "Rever tutorial" grava os módulos escolhidos em
    // tutorial-replay-modules — o tour roda pra VETERANO também quando o módulo
    // está nessa lista. (Antes o replay limpava spotlight-done, mas a condição
    // abaixo só liga pra guest/recém-cadastrado e o else re-marcava como visto
    // na hora — clicava e caía na aba normal, bug real do dono.)
    const replayList = get<string[]>("tutorial-replay-modules", []);
    const replayPending = Array.isArray(replayList) && replayList.includes(moduleKey);

    // Tutorial guiado (spotlight) roda no modo convidado OU para recém-cadastrados.
    //
    // 26/07 — até aqui a condição do recém-cadastrado era `moduleKey ===
    // "financas"`, cravado. Isso é resto do pivô "só finanças" de 12/07, que
    // foi REVERTIDO: o CORE voltou a ser os 16 módulos, mas a linha ficou.
    // Efeito: quem acabava de criar conta caía no tour de FINANÇAS mesmo tendo
    // escolhido outro módulo, e o tutorial parecia "começar dentro do módulo
    // errado" em vez de na tela de escolha (bug relatado pelo dono).
    //
    // O motivo original de existir o atalho continua válido:
    // quickstart-target-module é gravado enquanto a pessoa ainda é convidada e
    // não cruza a fronteira convidado→logado. A saída certa não é cravar um
    // módulo — é ler `tutorial-selected-modules`, que o próprio picker grava e
    // que sobrevive ao cadastro.
    const selecionadosRaw = get<string[]>("tutorial-selected-modules", []);
    const selecionados = Array.isArray(selecionadosRaw) ? selecionadosRaw : [];
    const escolhido = target === moduleKey || (forceNewUser && selecionados.includes(moduleKey));

    const shouldShow = replayPending || ((isGuest || forceNewUser) && !done && escolhido);
    if (shouldShow) {
      setActive(true);
      setIsReplay(replayPending);
      trackEvent("quickstart_module_opened", { module: moduleKey, is_guest: isGuest, replay: replayPending });
      trackEvent("spotlight_shown", { module: moduleKey, is_guest: isGuest, replay: replayPending });
    } else {
      setActive(false);
      // Para usuários logados (sem flag de tutorial), marca como concluído para não reaparecer.
      if (!isGuest && !forceNewUser && !done) {
        set(`spotlight-done-${moduleKey}`, "true");
      }
    }
  }, [moduleKey, get, set, isGuest, loaded]);


  // Track step views (drop-off analytics) + fire onEnter callback
  useEffect(() => {
    if (!active) return;
    const cur = stepsRef.current[stepIdx];
    if (!cur) return;
    trackEvent("spotlight_step_view", {
      module: moduleKey,
      step: stepIdx,
      total: stepsRef.current.length,
      label: cur.label,
    });
    try { cur.onEnter?.(); } catch {}
  }, [active, stepIdx, moduleKey]);

  const finish = useCallback((reason: "completed" | "dismissed") => {
    set(`spotlight-done-${moduleKey}`, "true");
    // replay: terminou OU pulou, sai da fila — não reaparece na próxima visita
    const rl = get<string[]>("tutorial-replay-modules", []);
    if (Array.isArray(rl) && rl.includes(moduleKey)) {
      set("tutorial-replay-modules", rl.filter((k) => k !== moduleKey));
    }
    if (reason === "completed") set("quickstart-target-module", "");
    // App só finanças: ao terminar OU pular, limpa o flag de novo usuário pra não reabrir
    // e mantém o usuário no Finanças (sem o bounce legado pra /home).
    try { set("force-new-user-tutorial", ""); localStorage.removeItem("force-new-user-tutorial"); } catch {}
    trackEvent(reason === "completed" ? "quickstart_completed" : "spotlight_dismissed", { module: moduleKey });
    setActive(false);

    /*
     * PULAR ≠ ENCERRAR (27/07, relato do dono: "cliquei em pular tutorial em
     * finanças e simplesmente acabou o tutorial tudo").
     *
     * Pular vale por ESTE módulo. Se ainda há outros na fila, a pessoa volta
     * pro seletor — que é onde ela decide o próximo ou encerra de vez. Antes
     * ela ficava parada dentro do módulo, sem nada indicando que o tutorial
     * continuava, e concluía (com razão) que tinha acabado tudo.
     */
    if (reason === "dismissed") {
      const restantes = (Array.isArray(rl) ? rl : []).filter((k) => k !== moduleKey);
      if (restantes.length > 0) { navigate("/home"); return; }
    }

    if (reason === "completed") {
      if (onComplete) {
        try { onComplete(); } catch {}
      } else {
        setShowCompletion(true);
      }
    }
  }, [set, get, moduleKey, onComplete, navigate]);

  /* Altura real do balão, lida do DOM a cada passo (o texto muda de tamanho). */
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubbleH, setBubbleH] = useState(0);
  useLayoutEffect(() => {
    const h = bubbleRef.current?.getBoundingClientRect().height ?? 0;
    if (h && Math.abs(h - bubbleH) > 1) setBubbleH(h);
  });

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const advance = useCallback(() => {
    const idx = stepIdxRef.current;
    const total = stepsRef.current.length;
    if (idx >= total - 1) finishRef.current("completed");
    else setStepIdx(idx + 1);
  }, []);

  // Single, stable activation listener
  useEffect(() => {
    if (!active) return;
    const onActivation = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      const action = detail?.action;
      if (!action) return;
      const cur = stepsRef.current[stepIdxRef.current];
      if (cur?.advanceOnAction === action) {
        advance();
      } else if (activationActions.includes(action)) {
        finishRef.current("completed");
      }
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, [active, advance, activationActions]);

  // Fallback: if data for this step already exists, auto-advance.
  // REPLAY: desligado — quem está REVENDO o tutorial tem dados em tudo; o
  // auto-avanço faria o tour voar sozinho (400ms/passo). Cada passo espera.
  useEffect(() => {
    if (!active || isReplay) return;
    const cur = steps[stepIdx];
    if (!cur?.checkKey) return;
    const v = get<any>(cur.checkKey, null);
    const has = cur.checkValue
      ? cur.checkValue(v)
      : v != null &&
        ((Array.isArray(v) && v.length > 0) ||
          (typeof v === "object" && Object.keys(v).length > 0) ||
          (typeof v === "string" && v.trim().length > 0));
    if (has) {
      const t = setTimeout(() => advance(), 400);
      return () => clearTimeout(t);
    }
  }, [active, isReplay, stepIdx, steps, get, advance]);

  // Measure target & re-measure
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;

    const measure = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      // Auto-scroll horizontally when the target (e.g. a tab) is off-screen
      // horizontally, so the user doesn't have to swipe to find it.
      const vw = window.innerWidth;
      if (r.right > vw - 8 || r.left < 8) {
        try { el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch {}
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    const interval = setInterval(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    const onPageClick = (e: MouseEvent) => {
      const target = document.querySelector(step.selector);
      const clicked = e.target as Element | null;
      const otherSpotlight = clicked?.closest?.("[data-spotlight]") as Element | null;
      // Only block clicks on other spotlight elements when our target exists.
      // If the current step's target is missing, allow free interaction so the
      // user can navigate back to it (e.g. reopen a closed drawer).
      if (
        target &&
        otherSpotlight &&
        otherSpotlight !== target &&
        !target.contains(otherSpotlight) &&
        !otherSpotlight.contains(target)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!target) return;
      if (target.contains(e.target as Node)) {
        if (step.advanceOnAction) return;
        if (step.advanceOnClick !== false) {
          setTimeout(() => advance(), 250);
        }
      }
    };
    document.addEventListener("click", onPageClick, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("click", onPageClick, true);
    };
  }, [active, stepIdx, steps, advance]);

  // If the current step's target is missing but a previous step's target is
  // present in the DOM, regress automatically. This handles cases like a drawer
  // being closed mid-tutorial: we go back to the step that opens it instead of
  // showing a confusing off-screen fallback.
  useEffect(() => {
    if (!active) return;
    if (rect) { setShowFallback(false); return; }
    const t = setTimeout(() => {
      for (let i = stepIdx - 1; i >= 0; i--) {
        const prev = steps[i];
        if (prev && document.querySelector(prev.selector)) {
          setStepIdx(i);
          return;
        }
      }
      setShowFallback(true);
      trackEvent("spotlight_target_missing", {
        module: moduleKey,
        step: stepIdx,
        selector: steps[stepIdx]?.selector ?? "",
      });
    }, 800);
    return () => clearTimeout(t);
  }, [active, rect, stepIdx, steps, moduleKey]);

  const step = active ? steps[stepIdx] : null;

  const scrollToTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step]);

  const completionModal = (
    <AnimatePresence>
      {showCompletion && (
        <motion.div
          key="completion-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-background/70 pointer-events-auto px-6"
          onClick={() => setShowCompletion(false)}
        >
          <motion.div
            key="completion-card"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl p-6 text-center"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
              className="relative mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <CheckCircle2 className="relative w-9 h-9 text-primary" strokeWidth={2.5} />
            </motion.div>
            <h3 className="relative text-lg font-bold text-foreground mb-2">
              Tutorial concluído! 🎉
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-5">
              Toque na seta
              <span className="inline-flex items-center justify-center w-6 h-6 mx-1.5 rounded-md bg-primary/15 align-middle">
                <ArrowLeft className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
              </span>
              no canto superior esquerdo para voltar e explorar outro módulo.
            </p>
            <button
              onClick={() => setShowCompletion(false)}
              className="relative w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Entendi
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!active || !step) return completionModal;


  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  // Prefer placing the bubble ABOVE the target. Only place below if there's
  // no room above.
  const spaceAbove = rect ? rect.top : 0;
  const autoBelow = rect ? spaceAbove < 130 : false;
  const labelBelow = step.placement === "above" ? false : step.placement === "below" ? true : autoBelow;

  const offScreen: "above" | "below" | null = !rect
    ? null
    : rect.top + rect.height < 10
      ? "above"
      : rect.top > viewportH - 60
        ? "below"
        : null;

  const BUBBLE_W = 288;
  const bubbleLeft = rect
    ? Math.max(12, Math.min(rect.left + rect.width / 2 - BUBBLE_W / 2, window.innerWidth - BUBBLE_W - 12))
    : 0;
  const targetCenterX = rect ? rect.left + rect.width / 2 : 0;
  // Arrow X relative to bubble's left edge, clamped inside bubble
  const arrowX = rect ? Math.max(16, Math.min(targetCenterX - bubbleLeft, BUBBLE_W - 16)) : BUBBLE_W / 2;

  /*
   * POSIÇÃO DO BALÃO — MEDIDA, não chutada (27/07).
   *
   * O cálculo antigo era `rect.top - 140`: 140 fixo, como se todo balão
   * tivesse a mesma altura. Um passo com 4 linhas de texto (o print do dono)
   * passa fácil de 160px — o balão descia POR CIMA do próprio campo que ele
   * manda preencher, e a seta ia parar dentro do botão "+". Agora a altura é
   * lida do DOM e o balão nunca invade o alvo.
   */
  // vão entre o balão e o alvo. Encolheu de 34 pra 14 quando a seta solta
  // virou bico colado no balão (27/07): o bico ocupa 6px, o resto é respiro.
  const ESPACO = 14;
  const alturaBalao = bubbleH || 150;
  const cabeAcima = rect ? rect.top - alturaBalao - ESPACO >= 8 : false;
  const cabeAbaixo = rect ? rect.top + rect.height + ESPACO + alturaBalao <= viewportH - 8 : false;
  // respeita o `placement` pedido pelo passo, mas só se couber de verdade
  const acimaFinal = step.placement === "below" ? false
    : step.placement === "above" ? cabeAcima
    : cabeAcima || !cabeAbaixo;
  const topoBalao = rect
    ? acimaFinal
      ? Math.max(8, rect.top - alturaBalao - ESPACO)
      : Math.min(viewportH - alturaBalao - 8, rect.top + rect.height + ESPACO)
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        key="spotlight-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[200] pointer-events-none"
      >
        {/*
          * DESTAQUE SEM APAGAR O APP (27/07 — 2ª rodada, correção do dono).
          *
          * A 1ª versão escurecia a tela toda e deixava um buraco no alvo.
          * Estava errado, e a frase do dono explica melhor que qualquer
          * justificativa minha: "o foco não é o botão, o foco é o app em si.
          * A missão do usuário não é só apertar o botão, é clicar lá, botar
          * seus dados e SÓ DEPOIS clicar no +".
          *
          * Escurecer 90% da tela pra iluminar um botão de 36px assume que a
          * tarefa é UM TOQUE. Não é: em Finanças a pessoa precisa ler os
          * campos, digitar duas coisas e só então salvar. O véu apagava
          * justamente o que ela tinha que ler — e ainda ensinava a olhar só
          * pro buraco iluminado, quando a primeira sessão existe pra ela
          * conhecer a TELA.
          *
          * Então: nada de véu. Fica o anel pulsando — que é o que o olho acha
          * em meio segundo — em volta da ÁREA DA TAREFA (ver os alvos em
          * Index.tsx: a linha inteira do formulário, não o "+"). O app
          * continua 100% legível, que é o ponto.
          */}
        {rect && (
          <motion.div
            key={`anel-${stepIdx}`}
            initial={{ opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: rect.top - PADDING,
              left: rect.left - PADDING,
              width: rect.width + PADDING * 2,
              height: rect.height + PADDING * 2,
              transformOrigin: "center",
              // um anel fino e um halo quase invisível. Nada pulsando: o que
              // pisca sem parar é o que cansa em três segundos.
              boxShadow: "0 0 0 1.5px hsl(var(--primary) / 0.85), 0 0 0 6px hsl(var(--primary) / 0.08)",
            }}
          />
        )}

        {rect && (
          <motion.div
            key={`bubble-${stepIdx}`}
            initial={{ opacity: 0, y: acimaFinal ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="absolute pointer-events-none"
            style={{ top: topoBalao, left: bubbleLeft, width: BUBBLE_W }}
          >
            {/*
              * BALÃO MINIMALISTA (27/07 — "tá muito agressivo, dá pra fazer um
              * design mais minimalista e bonito").
              *
              * O que saiu e por quê:
              *  - borda de 2px na cor da marca → virou fio de 1px quase neutro.
              *    Borda grossa colorida é o que faz o balão parecer alerta.
              *  - seta saltando em loop infinito → bico fixo colado no balão,
              *    do jeito que um balão de fala é. O que se move sem parar
              *    cansa em três segundos e rouba o olho da tarefa.
              *  - "PASSO 1 DE 11" em caixa alta e negrito → risquinho fino de
              *    progresso + "1 / 11" discreto. A informação continua lá, sem
              *    gritar o tamanho do tutorial na cara de quem começou.
              *  - sombra pesada → sombra larga e suave, que separa sem pesar.
              */}
            <div className="relative" ref={bubbleRef}>
              {/* bico do balão: quadrado girado com a MESMA borda e fundo do
                  card — some na emenda e vira um bico de verdade */}
              <div
                className="absolute w-3 h-3 rotate-45 bg-card border-l border-t border-black/[0.07] dark:border-white/10"
                style={{
                  left: arrowX,
                  transform: `translateX(-50%) rotate(45deg)`,
                  ...(acimaFinal
                    ? { bottom: -6, borderLeft: "none", borderTop: "none", borderRight: "1px solid rgba(0,0,0,0.07)", borderBottom: "1px solid rgba(0,0,0,0.07)" }
                    : { top: -6 }),
                }}
              />
              {/* data-tutorial-*: âncora estável pros testes lerem em que passo
                  o tour está sem depender de texto (um "28/02" na tela já se
                  passou por "passo 28 de 2" no meu próprio teste). */}
              <div
                data-tutorial-balao
                data-tutorial-passo={stepIdx + 1}
                data-tutorial-total={steps.length}
                data-tutorial-modulo={moduleKey}
                className="relative bg-card rounded-2xl border border-black/[0.07] dark:border-white/10 shadow-[0_10px_36px_-14px_rgba(0,0,0,0.35)] px-4 py-3.5 pointer-events-auto overflow-hidden"
              >
                {/* progresso: um fio, não um rótulo */}
                {/* Tentei uma barrinha de progresso no topo e ficou pior: com
                    1 de 11, o trecho preenchido vira um risquinho solto no
                    canto e lê como sujeira. O "1 / 11" abaixo já diz o mesmo
                    sem enfeite — que é o pedido. */}
                <p className="text-[14.5px] text-foreground leading-relaxed">
                  {step.label}
                </p>

                <div className="flex items-center justify-between gap-3 mt-3">
                  <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                    {stepIdx + 1} / {steps.length}
                  </span>
                  <div className="flex items-center gap-3">
                    {step.skippable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          trackEvent("spotlight_step_skipped", { module: moduleKey, step: stepIdx, label: step.label });
                          advance();
                        }}
                        className="text-[12px] font-medium text-primary/90 hover:text-primary transition-colors"
                      >
                        Pular este passo
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); finishRef.current("dismissed"); }}
                      className="text-[12px] text-muted-foreground/70 hover:text-foreground transition-colors"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {offScreen && (
          <motion.button
            key={`offscreen-${offScreen}`}
            initial={{ opacity: 0, x: "-50%", y: offScreen === "below" ? 20 : -20 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%" }}
            onClick={scrollToTarget}
            className={`fixed left-1/2 pointer-events-auto bg-primary text-primary-foreground rounded-full shadow-2xl px-4 py-2 flex items-center gap-2 text-xs font-bold z-[210] ${
              offScreen === "below" ? "bottom-6" : "top-6"
            }`}
          >
            {offScreen === "below" ? (
              <>
                <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                  <ArrowDown className="w-4 h-4" strokeWidth={3} />
                </motion.span>
                Role pra baixo
              </>
            ) : (
              <>
                <motion.span animate={{ y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                  <ArrowUp className="w-4 h-4" strokeWidth={3} />
                </motion.span>
                Role pra cima
              </>
            )}
          </motion.button>
        )}


        {!rect && showFallback && (
          <motion.div
            key="fallback-card"
            initial={{ opacity: 0, x: "-50%", y: 20 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%" }}
            className="fixed left-1/2 bottom-6 pointer-events-auto bg-card rounded-2xl border border-black/[0.07] dark:border-white/10 shadow-[0_10px_36px_-14px_rgba(0,0,0,0.35)] px-4 py-3.5 z-[210] overflow-hidden"
            style={{ width: "min(320px, calc(100vw - 24px))" }}
            data-tutorial-balao
            data-tutorial-passo={stepIdx + 1}
            data-tutorial-total={steps.length}
            data-tutorial-modulo={moduleKey}
            data-tutorial-fallback
          >
            {/* mesma pele do balão (27/07): este cartão aparece justo quando
                algo já saiu do esperado — não pode ainda parecer outro app */}
            <p className="text-[14.5px] text-foreground leading-relaxed">
              {step.label}
            </p>
            <p className="text-[12.5px] text-muted-foreground leading-snug mt-1.5">
              Não achei esse item aqui — vá até a tela dele, ou saia do tutorial.
            </p>
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                {stepIdx + 1} / {steps.length}
              </span>
              <button
                onClick={() => finish("dismissed")}
                className="text-[12px] text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Sair
              </button>
            </div>
          </motion.div>
        )}

      </motion.div>
    </AnimatePresence>
  );
};
