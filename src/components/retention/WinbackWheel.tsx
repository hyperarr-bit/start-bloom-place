import { motion, useAnimation } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

/**
 * Roleta "Win exclusive offers" — sempre para na fatia 🎁 (que é revelada como 80%).
 * Adaptada à identidade visual do app: tokens semânticos, sem gradientes berrantes.
 */
const SLICES = [
  { label: "50%", color: "hsl(var(--primary) / 0.85)" },
  { label: "Sem sorte", color: "hsl(var(--muted))" },
  { label: "70%", color: "hsl(var(--accent))" },
  { label: "90%", color: "hsl(var(--primary) / 0.6)" },
  { label: "30%", color: "hsl(var(--destructive) / 0.7)" },
  { label: "🎁", color: "hsl(var(--foreground))", isPrize: true },
];

const SLICE_DEG = 360 / SLICES.length;
// índice 5 = 🎁. Centro da fatia: i*60 + 30 = 330. Para alinhar com o ponteiro (topo, 0deg)
// rotação alvo final: -330 + N*360 (várias voltas) — subtração inverte sentido.
const TARGET_INDEX = 5;
const TARGET_DEG = -(TARGET_INDEX * SLICE_DEG + SLICE_DEG / 2) + 360 * 6; // 6 voltas

interface Props {
  onContinue: () => void;
}

export function WinbackWheel({ onContinue }: Props) {
  const controls = useAnimation();
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");

  useEffect(() => {
    trackEvent("winback_wheel_shown");
  }, []);

  const spin = async () => {
    if (phase !== "idle") return;
    setPhase("spinning");
    trackEvent("winback_wheel_spun");
    await controls.start({
      rotate: TARGET_DEG,
      transition: { duration: 4.2, ease: [0.17, 0.67, 0.32, 0.99] },
    });
    setPhase("done");
  };

  const handleContinue = () => {
    trackEvent("winback_wheel_continued");
    onContinue();
  };

  // Build conic-gradient CSS for the wheel
  const conic = SLICES.map((s, i) => {
    const start = i * SLICE_DEG;
    const end = (i + 1) * SLICE_DEG;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(", ");

  return (
    <div className="flex flex-col items-center text-center px-6 pt-8 pb-6 min-h-screen bg-background">
      <div className="space-y-2 mb-10 mt-4">
        <h1 className="text-3xl font-bold tracking-tight">Ofertas exclusivas</h1>
        <p className="text-muted-foreground text-base">
          Garanta seu desconto <span className="text-primary font-semibold">permanente</span>
        </p>
      </div>

      <div className="relative w-72 h-72 my-6">
        {/* Pointer */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 z-10">
          <div
            className="w-0 h-0"
            style={{
              borderTop: "12px solid transparent",
              borderBottom: "12px solid transparent",
              borderRight: "20px solid hsl(var(--primary))",
            }}
          />
        </div>

        {/* Wheel */}
        <motion.div
          animate={controls}
          initial={{ rotate: 0 }}
          className="w-full h-full rounded-full border-4 border-foreground/20 shadow-2xl relative overflow-hidden"
          style={{ background: `conic-gradient(${conic})` }}
        >
          {SLICES.map((s, i) => {
            const angle = i * SLICE_DEG + SLICE_DEG / 2;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 origin-left text-sm font-bold text-background flex items-center justify-end pr-3"
                style={{
                  width: "50%",
                  height: "32px",
                  transform: `translate(0, -50%) rotate(${angle}deg)`,
                  color: s.isPrize ? "hsl(var(--background))" : "hsl(var(--background))",
                }}
              >
                {s.isPrize ? <Gift className="w-5 h-5" /> : s.label}
              </div>
            );
          })}
          {/* Center hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-foreground border-4 border-background flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-background" />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 w-full max-w-xs space-y-3">
        {phase !== "done" ? (
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold"
            onClick={spin}
            disabled={phase === "spinning"}
          >
            {phase === "spinning" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Girando...
              </>
            ) : (
              "Girar a roleta"
            )}
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              🎉 Você ganhou uma oferta surpresa!
            </p>
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold"
              onClick={handleContinue}
            >
              Revelar minha oferta
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
