import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

/**
 * Roleta do prêmio (paywall + winback de cancelamento). Redesign 15/07:
 * - TAP pra girar (era giro automático): a pessoa AGE → o prêmio parece
 *   ganho, não dado — e segura a atenção de quem apertou "voltar" (dado de
 *   14/07: 44 de 84 fechavam durante os ~6s de animação passiva).
 * - Giro de ~2,2s (era 4,6s + esperas) e celebração com confete.
 * - Cores da marca (accent magenta) no lugar do cinza herdado do winback.
 */

const SLICES = [
  { label: "10% OFF" },
  { label: "😅 Quase" },
  { label: "30% OFF" },
  { label: "🍀 Tente +" },
  { label: "5% OFF" },
  { label: "🎁 Mimo" },
  { label: "20% OFF" },
  { label: "", winning: true }, // texto = prizeLabel (2 linhas)
];

const SLICE_DEG = 360 / SLICES.length;
const WIN_INDEX = 7;
const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const RADIUS = 140;

function slicePath(index: number) {
  const startAngle = index * SLICE_DEG - 90;
  const endAngle = startAngle + SLICE_DEG;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = CENTER + RADIUS * Math.cos(startRad);
  const y1 = CENTER + RADIUS * Math.sin(startRad);
  const x2 = CENTER + RADIUS * Math.cos(endRad);
  const y2 = CENTER + RADIUS * Math.sin(endRad);
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`;
}

/** Confete leve em framer-motion — sem lib nova, sem canvas. */
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        delay: Math.random() * 0.25,
        rot: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 6,
        color: ["hsl(330 65% 50%)", "hsl(330 80% 70%)", "hsl(45 90% 55%)", "hsl(160 70% 45%)", "hsl(215 80% 60%)"][i % 5],
        round: Math.random() > 0.5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center z-30" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: -10, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: 380 + Math.random() * 80, opacity: [1, 1, 0], rotate: p.rot }}
          transition={{ duration: 1.6 + Math.random() * 0.6, delay: p.delay, ease: "easeIn" }}
          className="absolute"
          style={{
            width: p.size,
            height: p.size * (p.round ? 1 : 0.45),
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  attemptId: string | null;
  onSpinComplete: () => void;
  /** Texto da fatia vencedora (o paywall passa o prêmio dele). */
  prizeLabel?: string;
}

export function WinbackWheel({ attemptId, onSpinComplete, prizeLabel = "VITALÍCIO R$19,90" }: Props) {
  const controls = useAnimation();
  const [phase, setPhase] = useState<"ready" | "spinning" | "done">("ready");
  const spinningRef = useRef(false);

  // Prêmio em 2 linhas na fatia ("VITALÍCIO R$19,90" → "VITALÍCIO" / "R$19,90")
  const prizeLines = useMemo(() => {
    const parts = prizeLabel.split(" ");
    if (parts.length < 2) return [prizeLabel];
    return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
  }, [prizeLabel]);

  useEffect(() => {
    if (attemptId) {
      supabase
        .from("winback_attempts")
        .update({ wheel_shown_at: new Date().toISOString() })
        .eq("id", attemptId)
        .then(() => {});
    }
  }, [attemptId]);

  const spin = async () => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setPhase("spinning");

    if (attemptId) trackEvent("winback_wheel_spun", { auto: false });
    else trackEvent("funnel_click", { cta: "wheel_spin" });

    const targetCenter = WIN_INDEX * SLICE_DEG + SLICE_DEG / 2;
    const fullSpins = 4 * 360;
    const jitter = (Math.random() - 0.5) * (SLICE_DEG * 0.25);
    const finalAngle = fullSpins + (360 - targetCenter) + jitter;

    await controls.start({
      rotate: finalAngle,
      transition: { duration: 2.2, ease: [0.12, 0.8, 0.2, 1] },
    });

    setPhase("done");
    if (attemptId) {
      await supabase
        .from("winback_attempts")
        .update({ wheel_spun_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    setTimeout(onSpinComplete, 1500);
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 py-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, hsl(var(--accent) / 0.16), transparent 65%)",
        }}
      />

      {phase === "done" && <ConfettiBurst />}

      <div className="text-center space-y-2">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold"
        >
          <Gift className="w-3 h-3" />
          Roleta de boas-vindas · prêmio garantido
        </motion.div>
        <motion.h2
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold leading-tight tracking-tight"
        >
          {phase === "ready" && <>Você ganhou<br />1 giro grátis 🎯</>}
          {phase === "spinning" && <>Girando...</>}
          {phase === "done" && <>🎉 Você ganhou!</>}
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-72 h-72"
      >
        {/* aro de brilho */}
        <div
          aria-hidden
          className="absolute inset-[-14px] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(var(--accent)) 0deg, transparent 90deg, hsl(var(--accent)) 180deg, transparent 270deg, hsl(var(--accent)) 360deg)",
            filter: "blur(18px)",
            opacity: 0.45,
          }}
        />

        {/* Ponteiro */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="relative flex flex-col items-center">
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "13px solid transparent",
                borderRight: "13px solid transparent",
                borderTop: "24px solid hsl(var(--accent))",
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
              }}
            />
            <div className="absolute -top-2 w-5 h-5 rounded-full bg-accent border-[3px] border-white shadow-lg" />
          </div>
        </div>

        <motion.div
          className="w-full h-full rounded-full relative"
          animate={controls}
          style={{ filter: "drop-shadow(0 18px 40px hsl(var(--accent) / 0.3))" }}
        >
          <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="w-full h-full">
            <defs>
              <linearGradient id="slice-win" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(330 70% 56%)" />
                <stop offset="100%" stopColor="hsl(330 65% 42%)" />
              </linearGradient>
              <linearGradient id="slice-soft" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(330 60% 97%)" />
                <stop offset="100%" stopColor="hsl(330 50% 92%)" />
              </linearGradient>
              <linearGradient id="slice-plain" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(0 0% 100%)" />
                <stop offset="100%" stopColor="hsl(40 20% 95%)" />
              </linearGradient>
              <radialGradient id="wheel-shine" cx="50%" cy="35%" r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="60%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>

            {/* aro externo */}
            <circle cx={CENTER} cy={CENTER} r={RADIUS + 8} fill="hsl(var(--accent))" />
            <circle cx={CENTER} cy={CENTER} r={RADIUS + 3} fill="hsl(0 0% 100%)" />

            {SLICES.map((s, i) => (
              <path
                key={i}
                d={slicePath(i)}
                fill={s.winning ? "url(#slice-win)" : i % 2 === 0 ? "url(#slice-plain)" : "url(#slice-soft)"}
                stroke="hsl(0 0% 100%)"
                strokeWidth="2"
              />
            ))}

            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#wheel-shine)" pointerEvents="none" />

            {SLICES.map((s, i) => {
              const angle = i * SLICE_DEG + SLICE_DEG / 2 - 90;
              const rad = (angle * Math.PI) / 180;
              const tx = CENTER + Math.cos(rad) * (RADIUS * 0.62);
              const ty = CENTER + Math.sin(rad) * (RADIUS * 0.62);
              const rotate = i * SLICE_DEG + SLICE_DEG / 2;
              if (s.winning) {
                return (
                  <text
                    key={i}
                    x={tx}
                    y={ty}
                    fill="#fff"
                    fontSize={13.5}
                    fontWeight={800}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${rotate} ${tx} ${ty})`}
                    style={{ letterSpacing: 0.3 }}
                  >
                    {prizeLines.map((line, li) => (
                      <tspan key={li} x={tx} dy={li === 0 ? (prizeLines.length > 1 ? -7 : 0) : 14}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                );
              }
              return (
                <text
                  key={i}
                  x={tx}
                  y={ty}
                  fill="hsl(330 30% 38%)"
                  fontSize={12.5}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rotate} ${tx} ${ty})`}
                  style={{ letterSpacing: 0.3 }}
                >
                  {s.label}
                </text>
              );
            })}

            {/* luzinhas do aro */}
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * (360 / 16) - 90) * (Math.PI / 180);
              const cx = CENTER + Math.cos(a) * (RADIUS - 9);
              const cy = CENTER + Math.sin(a) * (RADIUS - 9);
              return (
                <circle key={i} cx={cx} cy={cy} r={2.4} fill="hsl(0 0% 100%)" opacity="0.9" />
              );
            })}
          </svg>
        </motion.div>

        {/* centro */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-white border-[3px] border-accent shadow-xl flex items-center justify-center text-2xl">
            🎁
          </div>
        </div>
      </motion.div>

      {/* CTA girar / revelação */}
      <div className="h-16 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.div
              key="spin-btn"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {/* pulso infinito num wrapper separado — dentro do child do
                  AnimatePresence ele nunca "termina" e trava o exit */}
              <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
                <button
                  onClick={spin}
                  className="h-14 px-12 rounded-full bg-accent text-accent-foreground text-lg font-extrabold tracking-wide shadow-[0_12px_34px_-8px_hsl(var(--accent)/0.6)] active:scale-95 transition-transform"
                >
                  GIRAR
                </button>
              </motion.div>
            </motion.div>
          )}
          {phase === "spinning" && (
            <motion.p
              key="spin-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground"
            >
              Boa sorte! 🤞
            </motion.p>
          )}
          {phase === "done" && (
            <motion.div
              key="prize"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-6 py-3 text-base font-extrabold shadow-[0_12px_34px_-8px_hsl(var(--accent)/0.6)]"
            >
              🏆 {prizeLabel}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
