import { motion, useAnimation } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const SLICES = [
  { label: "10% OFF", from: "hsl(220 14% 96%)", to: "hsl(220 14% 88%)", text: "hsl(222 20% 25%)" },
  { label: "Tente +", from: "hsl(var(--primary) / 0.20)", to: "hsl(var(--primary) / 0.35)", text: "hsl(var(--primary))" },
  { label: "30% OFF", from: "hsl(220 14% 96%)", to: "hsl(220 14% 88%)", text: "hsl(222 20% 25%)" },
  { label: "Quase!", from: "hsl(var(--primary) / 0.20)", to: "hsl(var(--primary) / 0.35)", text: "hsl(var(--primary))" },
  { label: "5% OFF", from: "hsl(220 14% 96%)", to: "hsl(220 14% 88%)", text: "hsl(222 20% 25%)" },
  { label: "Vazio", from: "hsl(var(--primary) / 0.20)", to: "hsl(var(--primary) / 0.35)", text: "hsl(var(--primary))" },
  { label: "20% OFF", from: "hsl(220 14% 96%)", to: "hsl(220 14% 88%)", text: "hsl(222 20% 25%)" },
  { label: "50% OFF", from: "hsl(var(--primary))", to: "hsl(var(--primary) / 0.78)", text: "hsl(var(--primary-foreground))", winning: true },
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

interface Props {
  attemptId: string | null;
  onSpinComplete: () => void;
  /** Texto da fatia vencedora. Default = winback de cancelamento; o paywall
   *  passa o prêmio dele (hoje ambos = VITALÍCIO R$14,90 via PixCheckout). */
  prizeLabel?: string;
  /** Giro curto (~3s no total). O paywall usa: quem entra aqui está FUGINDO
   *  (clicou X/voltar) e a animação de ~6s matava 37% antes do prêmio
   *  (dado 18–20/07: 112 giros → 70 chegaram no downsell). O winback de
   *  cancelamento mantém o ritmo padrão — lá a pessoa não está escapando. */
  quick?: boolean;
}

export function WinbackWheel({ attemptId, onSpinComplete, prizeLabel, quick }: Props) {
  const controls = useAnimation();
  const [phase, setPhase] = useState<"spinning" | "done">("spinning");
  const startedRef = useRef(false);

  useEffect(() => {
    if (attemptId) {
      supabase
        .from("winback_attempts")
        .update({ wheel_shown_at: new Date().toISOString() })
        .eq("id", attemptId)
        .then(() => {});
    }
  }, [attemptId]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      // Sem attemptId = roleta reutilizada fora do winback (ex.: funil) — quem
      // chama emite o próprio evento; não polui as métricas de winback.
      if (attemptId) trackEvent("winback_wheel_spun", { auto: true });
      const targetCenter = WIN_INDEX * SLICE_DEG + SLICE_DEG / 2;
      const fullSpins = 6 * 360;
      const jitter = (Math.random() - 0.5) * (SLICE_DEG * 0.25);
      const finalAngle = fullSpins + (360 - targetCenter) + jitter;

      await new Promise((r) => setTimeout(r, quick ? 150 : 400));

      await controls.start({
        rotate: finalAngle,
        transition: { duration: quick ? 2.2 : 4.6, ease: [0.16, 0.84, 0.28, 1] },
      });

      setPhase("done");
      if (attemptId) {
        await supabase
          .from("winback_attempts")
          .update({ wheel_spun_at: new Date().toISOString() })
          .eq("id", attemptId);
      }
      setTimeout(onSpinComplete, quick ? 650 : 1100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 py-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.18), transparent 65%)",
        }}
      />

      <div className="text-center space-y-2">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold"
        >
          <Sparkles className="w-3 h-3" />
          Sua oferta está sendo sorteada
        </motion.div>
        <motion.h2
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold leading-tight tracking-tight"
        >
          {phase === "done" ? (
            <>Parabéns!<br />Você ganhou um prêmio</>
          ) : (
            <>Estamos girando<br />para você...</>
          )}
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-72 h-72"
      >
        <div
          aria-hidden
          className="absolute inset-[-14px] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(var(--primary)) 0deg, transparent 90deg, hsl(var(--primary)) 180deg, transparent 270deg, hsl(var(--primary)) 360deg)",
            filter: "blur(18px)",
            opacity: 0.4,
          }}
        />

        {/* Pointer */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="relative flex flex-col items-center">
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "13px solid transparent",
                borderRight: "13px solid transparent",
                borderTop: "24px solid hsl(var(--primary))",
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
              }}
            />
            <div className="absolute -top-2 w-5 h-5 rounded-full bg-primary border-[3px] border-background shadow-lg" />
          </div>
        </div>

        <motion.div
          className="w-full h-full rounded-full relative"
          animate={controls}
          style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.28))" }}
        >
          <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="w-full h-full">
            <defs>
              {SLICES.map((s, i) => (
                <linearGradient key={i} id={`slice-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={s.from} />
                  <stop offset="100%" stopColor={s.to} />
                </linearGradient>
              ))}
              <radialGradient id="wheel-shine" cx="50%" cy="35%" r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="60%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>

            <circle cx={CENTER} cy={CENTER} r={RADIUS + 8} fill="hsl(var(--primary))" />
            <circle cx={CENTER} cy={CENTER} r={RADIUS + 3} fill="hsl(var(--background))" />

            {SLICES.map((s, i) => (
              <path
                key={i}
                d={slicePath(i)}
                fill={`url(#slice-grad-${i})`}
                stroke="hsl(var(--background))"
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
              return (
                <text
                  key={i}
                  x={tx}
                  y={ty}
                  fill={s.text}
                  fontSize={s.winning ? 15 : 13}
                  fontWeight={s.winning ? 800 : 700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rotate} ${tx} ${ty})`}
                  style={{ letterSpacing: 0.3 }}
                >
                  {s.winning && prizeLabel ? prizeLabel : s.label}
                </text>
              );
            })}

            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * (360 / 16) - 90) * (Math.PI / 180);
              const cx = CENTER + Math.cos(a) * (RADIUS - 9);
              const cy = CENTER + Math.sin(a) * (RADIUS - 9);
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={2.4}
                  fill="hsl(var(--background))"
                  opacity="0.9"
                />
              );
            })}
          </svg>
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-card to-muted border-[3px] border-primary shadow-xl flex items-center justify-center">
            <Crown className="w-6 h-6 text-primary" />
          </div>
        </div>
      </motion.div>

      <motion.p
        key={`p-${phase}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-muted-foreground text-center max-w-xs"
      >
        {phase === "done"
          ? "Revelando seu prêmio..."
          : "Boa sorte! Seu desconto exclusivo já vem aí."}
      </motion.p>
    </div>
  );
}
