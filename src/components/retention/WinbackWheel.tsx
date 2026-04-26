import { motion, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const SLICES = [
  { label: "Tente +", color: "hsl(var(--muted))" },
  { label: "10% OFF", color: "hsl(var(--accent))" },
  { label: "Quase!", color: "hsl(var(--muted))" },
  { label: "30% OFF", color: "hsl(var(--accent))" },
  { label: "Tente +", color: "hsl(var(--muted))" },
  { label: "50% OFF", color: "hsl(var(--accent))" },
  { label: "Vazio", color: "hsl(var(--muted))" },
  { label: "80% OFF", color: "hsl(var(--primary))" }, // Winning slice (index 7)
];

const SLICE_DEG = 360 / SLICES.length; // 45
const WIN_INDEX = 7;

interface Props {
  attemptId: string | null;
  onSpinComplete: () => void;
}

export function WinbackWheel({ attemptId, onSpinComplete }: Props) {
  const controls = useAnimation();
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);

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
    if (spinning || done) return;
    setSpinning(true);
    trackEvent("winback_wheel_spun", {});

    // Pointer is at top (12 o'clock). Slice 0 starts at top going clockwise.
    // To land on WIN_INDEX, rotate so its center is at top.
    const targetCenter = WIN_INDEX * SLICE_DEG + SLICE_DEG / 2; // degrees of slice center from start
    const fullSpins = 5 * 360;
    const finalAngle = fullSpins + (360 - targetCenter); // rotate counter-clockwise effect

    await controls.start({
      rotate: finalAngle,
      transition: { duration: 4.2, ease: [0.17, 0.67, 0.32, 1] },
    });

    setDone(true);
    if (attemptId) {
      await supabase
        .from("winback_attempts")
        .update({ wheel_spun_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    setTimeout(onSpinComplete, 900);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles className="w-3 h-3" />
          Você ganhou um giro grátis
        </div>
        <h2 className="text-2xl font-bold leading-tight">Gire e descubra<br />sua oferta secreta</h2>
        <p className="text-sm text-muted-foreground">Só agora, antes de você sair.</p>
      </div>

      <div className="relative w-72 h-72">
        {/* Pointer */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-primary drop-shadow-md" />
        </div>

        {/* Wheel */}
        <motion.div
          className="w-full h-full rounded-full border-4 border-primary/30 shadow-2xl relative overflow-hidden"
          animate={controls}
          style={{
            background: `conic-gradient(${SLICES.map(
              (s, i) => `${s.color} ${i * SLICE_DEG}deg ${(i + 1) * SLICE_DEG}deg`
            ).join(",")})`,
          }}
        >
          {SLICES.map((s, i) => {
            const angle = i * SLICE_DEG + SLICE_DEG / 2;
            return (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 origin-left text-[11px] font-bold text-foreground/90"
                style={{
                  transform: `rotate(${angle}deg) translateX(60px) rotate(90deg) translateX(-50%)`,
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </div>
            );
          })}
        </motion.div>

        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-card border-4 border-primary shadow-lg" />
        </div>
      </div>

      <Button
        size="lg"
        onClick={spin}
        disabled={spinning || done}
        className="w-full max-w-xs h-14 text-base font-semibold"
      >
        {done ? "Revelando prêmio..." : spinning ? "Girando..." : "GIRAR AGORA"}
      </Button>
    </div>
  );
}
