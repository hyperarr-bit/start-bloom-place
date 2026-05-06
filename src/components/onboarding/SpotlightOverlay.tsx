import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

export interface SpotlightStep {
  /** CSS selector of the element to highlight (e.g. `[data-spotlight="financeiro"]`) */
  selector: string;
  /** Caption shown next to the highlight */
  label: string;
  /** When true, the step auto-advances on click of the target. Default: true */
  advanceOnClick?: boolean;
  /** Activation action that, when fired, auto-advances this step (or finishes the tour if last). */
  advanceOnAction?: string;
}

interface SpotlightOverlayProps {
  moduleKey: "financas" | "rotina" | "dieta" | "treino";
  steps: SpotlightStep[];
  /** [legacy] activation actions that dismiss the entire spotlight when fired. Prefer advanceOnAction per step. */
  activationActions?: string[];
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8;

export const SpotlightOverlay = ({ moduleKey, steps, activationActions = [] }: SpotlightOverlayProps) => {
  const { get, set } = useUserData();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // decide whether to show on mount
  useEffect(() => {
    const target = get<string>("quickstart-target-module", "");
    const done = get<string>(`spotlight-done-${moduleKey}`, "");
    if (target === moduleKey && !done) {
      setActive(true);
      trackEvent("spotlight_shown", { module: moduleKey });
    }
  }, [moduleKey, get]);

  const finish = useCallback((reason: "completed" | "dismissed") => {
    set(`spotlight-done-${moduleKey}`, "true");
    if (reason === "completed") set("quickstart-target-module", "");
    trackEvent(reason === "completed" ? "quickstart_completed" : "spotlight_dismissed", { module: moduleKey });
    setActive(false);
  }, [set, moduleKey]);

  // listen for activation events to auto-advance / finish.
  // Debounced per step: a single user action (e.g. addHabit) may write to
  // multiple keys that match the same activation rule, firing the event
  // several times in the same tick. We must only advance ONCE per step.
  useEffect(() => {
    if (!active) return;
    let advanced = false;
    const onActivation = (e: Event) => {
      if (advanced) return;
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      if (!detail?.action) return;
      const currentStep = steps[stepIdx];
      if (currentStep?.advanceOnAction === detail.action) {
        advanced = true;
        if (stepIdx >= steps.length - 1) finish("completed");
        else setStepIdx(i => i + 1);
        return;
      }
      if (activationActions.includes(detail.action)) {
        advanced = true;
        finish("completed");
      }
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, [active, activationActions, finish, steps, stepIdx]);

  // measure the current target & re-measure on resize / scroll / mutations
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;

    let el: Element | null = null;
    let advanceHandler: (() => void) | null = null;

    const measure = () => {
      el = document.querySelector(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Don't auto-scroll — let the user navigate to the target themselves.

    measure();
    const interval = setInterval(measure, 250); // robust to lazy-rendered elements
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    // attach click forwarder so the user's click on the highlight area still
    // hits the underlying element AND advances the step
    const onPageClick = (e: MouseEvent) => {
      const target = document.querySelector(step.selector);
      if (!target) return;
      if (target.contains(e.target as Node)) {
        // If step waits for an explicit activation action, never advance on click.
        if (step.advanceOnAction) return;
        if (step.advanceOnClick !== false) {
          // last step → finish; otherwise advance
          setTimeout(() => {
            if (stepIdx >= steps.length - 1) {
              finish("completed");
            } else {
              setStepIdx(i => i + 1);
            }
          }, 250);
        }
      }
    };
    document.addEventListener("click", onPageClick, true);
    advanceHandler = () => document.removeEventListener("click", onPageClick, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      advanceHandler?.();
    };
  }, [active, stepIdx, steps]);

  const step = active ? steps[stepIdx] : null;

  const scrollToTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step]);

  if (!active || !step) return null;

  // Compute label position. Default: above the target (so it never covers
  // forms/menus that open below the target). Fall back to below when the
  // target is too close to the top of the viewport.
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const labelBelow = rect ? rect.top < 110 : true;

  // Detect when target is off-screen (above or below viewport) so we can
  // show an always-visible "scroll here" banner that takes the user to it.
  const offScreen: "above" | "below" | null = !rect
    ? null
    : rect.top + rect.height < 60
      ? "above"
      : rect.top > viewportH - 60
        ? "below"
        : null;

  // Dim the screen only on navigation steps (no advanceOnAction).
  // Action steps keep the screen normal so user can interact freely.
  const dim = !step.advanceOnAction;

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
        {dim && (rect ? (
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id={`spot-mask-${moduleKey}`}>
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={rect.left - PADDING}
                  y={rect.top - PADDING}
                  width={rect.width + PADDING * 2}
                  height={rect.height + PADDING * 2}
                  rx={10}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.65)"
              mask={`url(#spot-mask-${moduleKey})`}
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/60" />
        ))}

        {/* Pulsing ring around the target */}
        {rect && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [1, 1.06, 1], opacity: 1 }}
            transition={{ scale: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
            className="absolute rounded-[12px] border-2 border-primary"
            style={{
              top: rect.top - PADDING,
              left: rect.left - PADDING,
              width: rect.width + PADDING * 2,
              height: rect.height + PADDING * 2,
              boxShadow: "0 0 0 4px hsl(var(--primary) / 0.25), 0 0 30px hsl(var(--primary) / 0.45)",
            }}
          />
        )}

        {/* Animated arrow + label bubble */}
        {rect && (
          <motion.div
            key={`bubble-${stepIdx}`}
            initial={{ opacity: 0, y: labelBelow ? -8 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="absolute pointer-events-auto"
            style={{
              top: labelBelow ? rect.top + rect.height + PADDING + 8 : Math.max(8, rect.top - 90),
              left: Math.max(12, Math.min(rect.left + rect.width / 2 - 130, window.innerWidth - 272)),
              width: 260,
            }}
          >
            <div className="relative">
              {labelBelow && (
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2"
                >
                  <ArrowDown className="w-6 h-6 text-primary rotate-180" strokeWidth={3} />
                </motion.div>
              )}
              <div className="bg-card border border-primary/40 rounded-xl shadow-2xl p-3 relative">
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">
                  Passo {stepIdx + 1} de {steps.length}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {step.label}
                </p>
              </div>
              {!labelBelow && (
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2"
                >
                  <ArrowDown className="w-6 h-6 text-primary" strokeWidth={3} />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
        {/* Off-screen banner — always visible, taps to scroll to target */}
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
      </motion.div>
    </AnimatePresence>
  );
};
