import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowLeft, CheckCircle2 } from "lucide-react";
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
}

interface SpotlightOverlayProps {
  moduleKey: "financas" | "rotina" | "dieta" | "treino";
  steps: SpotlightStep[];
  activationActions?: string[];
  /** Optional: called when the tutorial is fully completed (not dismissed). If provided, suppresses the default completion modal. */
  onComplete?: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8;

export const SpotlightOverlay = ({ moduleKey, steps, activationActions = [], onComplete }: SpotlightOverlayProps) => {
  const { get, set, isGuest } = useUserData();
  const [active, setActive] = useState(false);
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
    const target = get<string>("quickstart-target-module", "");
    const done = get<string>(`spotlight-done-${moduleKey}`, "");
    // Auto-trigger for financas when user hasn't seen the tutorial yet,
    // even without an explicit quickstart target (no Home/module-picker flow).
    const shouldShow = !done && (target === moduleKey || moduleKey === "financas");
    if (shouldShow) {
      setActive(true);
      trackEvent("spotlight_shown", { module: moduleKey, is_guest: isGuest });
    }
  }, [moduleKey, get, isGuest]);


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
    if (reason === "completed") set("quickstart-target-module", "");
    trackEvent(reason === "completed" ? "quickstart_completed" : "spotlight_dismissed", { module: moduleKey });
    setActive(false);
    if (reason === "completed") {
      if (onComplete) {
        try { onComplete(); } catch {}
      } else {
        setShowCompletion(true);
      }
    }
  }, [set, moduleKey, onComplete]);

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
  useEffect(() => {
    if (!active) return;
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
  }, [active, stepIdx, steps, get, advance]);

  // Measure target & re-measure
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;

    const measure = () => {
      const el = document.querySelector(step.selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    measure();
    const interval = setInterval(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    const onPageClick = (e: MouseEvent) => {
      const target = document.querySelector(step.selector);
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

  // Fallback card timer: if target stays missing >800ms, show a centered hint.
  useEffect(() => {
    if (!active) return;
    if (rect) { setShowFallback(false); return; }
    const t = setTimeout(() => {
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
  // Always show the bubble ABOVE the target so it never covers the card content.
  // Only flip below if there's truly no room above (target glued to the top).
  const labelBelow = rect ? rect.top < 90 : false;

  const offScreen: "above" | "below" | null = !rect
    ? null
    : rect.top + rect.height < 60
      ? "above"
      : rect.top > viewportH - 60
        ? "below"
        : null;

  const BUBBLE_W = 260;
  const bubbleLeft = rect
    ? Math.max(12, Math.min(rect.left + rect.width / 2 - BUBBLE_W / 2, window.innerWidth - BUBBLE_W - 12))
    : 0;
  const targetCenterX = rect ? rect.left + rect.width / 2 : 0;
  // Arrow X relative to bubble's left edge, clamped inside bubble
  const arrowX = rect ? Math.max(16, Math.min(targetCenterX - bubbleLeft, BUBBLE_W - 16)) : BUBBLE_W / 2;

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
        {rect && (
          <motion.div
            key={`bubble-${stepIdx}`}
            initial={{ opacity: 0, y: labelBelow ? -8 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="absolute pointer-events-none"
            style={{
              top: labelBelow ? rect.top + rect.height + PADDING + 18 : Math.max(8, rect.top - 120),
              left: bubbleLeft,
              width: BUBBLE_W,
            }}
          >
            <div className="relative">
              {labelBelow && (
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-5"
                  style={{ left: arrowX, transform: "translateX(-50%)" }}
                >
                  <ArrowUp className="w-5 h-5 text-foreground/70" strokeWidth={2.5} />
                </motion.div>
              )}
              <div className="bg-card border border-border rounded-xl shadow-xl p-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Passo {stepIdx + 1} de {steps.length}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {step.label}
                </p>
              </div>
              {!labelBelow && (
                <motion.div
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-5"
                  style={{ left: arrowX, transform: "translateX(-50%)" }}
                >
                  <ArrowDown className="w-5 h-5 text-foreground/70" strokeWidth={2.5} />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {offScreen && (
          <motion.button
            key={`offscreen-${offScreen}`}
            initial={{ opacity: 0, y: offScreen === "below" ? 20 : -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={scrollToTarget}
            className={`fixed left-1/2 -translate-x-1/2 pointer-events-auto bg-primary text-primary-foreground rounded-full shadow-2xl px-4 py-2 flex items-center gap-2 text-xs font-bold z-[210] ${
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-6 pointer-events-auto bg-card border border-border rounded-xl shadow-2xl p-3 z-[210]"
            style={{ width: "min(320px, calc(100vw - 24px))" }}
          >
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
              Passo {stepIdx + 1} de {steps.length}
            </p>
            <p className="text-sm font-semibold text-foreground leading-snug mb-2">
              {step.label}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Não estou encontrando este item na tela. Navegue até ele ou toque em Pular.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => finish("dismissed")}
                className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1"
              >
                Pular tutorial
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
