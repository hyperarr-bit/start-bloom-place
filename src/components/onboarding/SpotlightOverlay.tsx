import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, Check, ChevronRight, X } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";

export interface SpotlightStep {
  selector: string;
  label: string;
  advanceOnClick?: boolean;
  advanceOnAction?: string;
  /** Optional: storage key to inspect; if it already has data on mount, auto-advance. */
  checkKey?: string;
}

interface SpotlightOverlayProps {
  moduleKey: "financas" | "rotina" | "dieta" | "treino";
  steps: SpotlightStep[];
  activationActions?: string[];
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 6;

export const SpotlightOverlay = ({ moduleKey, steps, activationActions = [] }: SpotlightOverlayProps) => {
  const { get, set, isGuest } = useUserData();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Refs so the activation listener stays attached across step changes
  // and never misses events fired in the same tick the step advances.
  const stepIdxRef = useRef(0);
  const stepsRef = useRef(steps);
  stepIdxRef.current = stepIdx;
  stepsRef.current = steps;

  useEffect(() => {
    if (!isGuest) return;
    const target = get<string>("quickstart-target-module", "");
    const done = get<string>(`spotlight-done-${moduleKey}`, "");
    if (target === moduleKey && !done) {
      setActive(true);
      trackEvent("spotlight_shown", { module: moduleKey });
    }
  }, [moduleKey, get, isGuest]);

  const finish = useCallback((reason: "completed" | "dismissed") => {
    set(`spotlight-done-${moduleKey}`, "true");
    if (reason === "completed") set("quickstart-target-module", "");
    trackEvent(reason === "completed" ? "quickstart_completed" : "spotlight_dismissed", { module: moduleKey });
    setActive(false);
  }, [set, moduleKey]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  const advance = useCallback(() => {
    const idx = stepIdxRef.current;
    const total = stepsRef.current.length;
    if (idx >= total - 1) finishRef.current("completed");
    else setStepIdx(idx + 1);
  }, []);

  // Single, stable activation listener (attached once when active).
  useEffect(() => {
    if (!active) return;
    const onActivation = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      const action = detail?.action;
      if (!action) return;
      const idx = stepIdxRef.current;
      const cur = stepsRef.current[idx];
      if (cur?.advanceOnAction === action) {
        advance();
      } else if (activationActions.includes(action)) {
        finishRef.current("completed");
      }
    };
    window.addEventListener("core:activation", onActivation);
    return () => window.removeEventListener("core:activation", onActivation);
  }, [active, advance, activationActions]);

  // Fallback: when entering a step, if the underlying data already exists,
  // skip ahead. Prevents getting stuck if activation event was missed.
  useEffect(() => {
    if (!active) return;
    const cur = steps[stepIdx];
    if (!cur?.checkKey) return;
    const v = get<any>(cur.checkKey, null);
    const has =
      v != null &&
      ((Array.isArray(v) && v.length > 0) ||
        (typeof v === "object" && Object.keys(v).length > 0) ||
        (typeof v === "string" && v.trim().length > 0));
    if (has) {
      const t = setTimeout(() => advance(), 400);
      return () => clearTimeout(t);
    }
  }, [active, stepIdx, steps, get, advance]);

  // Measure target & re-measure on resize/scroll
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

  const step = active ? steps[stepIdx] : null;

  const scrollToTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step]);

  if (!active || !step) return null;

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  // Bottom panel reserves ~96px; consider target offscreen if hidden behind it.
  const PANEL_H = 96;
  const offScreen: "above" | "below" | null = !rect
    ? null
    : rect.top + rect.height < 60
      ? "above"
      : rect.top > viewportH - PANEL_H - 20
        ? "below"
        : null;

  return (
    <AnimatePresence>
      <motion.div
        key="spotlight-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] pointer-events-none"
      >
        {/* Soft ring around the target — no heavy backdrop, never covers content */}
        {rect && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="absolute rounded-full"
              style={{
                top: rect.top + rect.height / 2 - (Math.max(rect.width, rect.height) + 24) / 2,
                left: rect.left + rect.width / 2 - (Math.max(rect.width, rect.height) + 24) / 2,
                width: Math.max(rect.width, rect.height) + 24,
                height: Math.max(rect.width, rect.height) + 24,
                background: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0) 70%)",
              }}
            />
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.9, 0.5, 0.9] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute rounded-[10px] border-2 border-primary/80"
              style={{
                top: rect.top - PADDING,
                left: rect.left - PADDING,
                width: rect.width + PADDING * 2,
                height: rect.height + PADDING * 2,
                boxShadow: "0 0 0 3px hsl(var(--primary) / 0.18)",
              }}
            />
          </>
        )}

        {/* Bottom panel — fixed, never covers fields, always visible */}
        <motion.div
          key={`panel-${stepIdx}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-auto fixed left-0 right-0 z-[210]"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-md px-3">
            <div className="bg-card/95 backdrop-blur border border-border shadow-2xl rounded-2xl p-3 flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i < stepIdx
                        ? "w-3 bg-primary/60"
                        : i === stepIdx
                          ? "w-5 bg-primary"
                          : "w-3 bg-muted"
                    }`}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary leading-tight">
                  Passo {stepIdx + 1} de {steps.length}
                </p>
                <p className="text-xs font-medium text-foreground leading-snug mt-0.5 truncate">
                  {step.label}
                </p>
              </div>
              {offScreen ? (
                <button
                  onClick={scrollToTarget}
                  className="shrink-0 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                >
                  {offScreen === "below" ? <ArrowDown className="w-3.5 h-3.5" strokeWidth={3} /> : <ArrowUp className="w-3.5 h-3.5" strokeWidth={3} />}
                  Ver
                </button>
              ) : !step.advanceOnAction ? (
                <button
                  onClick={advance}
                  className="shrink-0 h-9 px-3 rounded-xl bg-foreground text-background text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                >
                  {stepIdx >= steps.length - 1 ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
              ) : null}
              <button
                onClick={() => finish("dismissed")}
                aria-label="Pular tutorial"
                className="shrink-0 h-7 w-7 rounded-full hover:bg-muted text-muted-foreground flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => finish("dismissed")}
              className="block mx-auto mt-1.5 text-[10px] text-muted-foreground/70 hover:text-muted-foreground"
            >
              Pular tutorial
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
