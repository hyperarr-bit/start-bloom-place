import { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Crown, Sparkles, Timer, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

/* =========================================================
   Roleta (gira e cai na oferta) — geometria SVG enxuta
   ========================================================= */

const SLICES = [
  { label: "5% OFF" },
  { label: "Quase!" },
  { label: "15% OFF" },
  { label: "Vazio" },
  { label: "30% OFF" },
  { label: "Tente +" },
  { label: "10% OFF" },
  { label: "OFERTA!", winning: true },
];
const SLICE_DEG = 360 / SLICES.length;
const WIN_INDEX = 7;
const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const RADIUS = 140;

function slicePath(index: number) {
  const start = (index * SLICE_DEG - 90) * (Math.PI / 180);
  const end = ((index + 1) * SLICE_DEG - 90) * (Math.PI / 180);
  const x1 = CENTER + RADIUS * Math.cos(start);
  const y1 = CENTER + RADIUS * Math.sin(start);
  const x2 = CENTER + RADIUS * Math.cos(end);
  const y2 = CENTER + RADIUS * Math.sin(end);
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`;
}

function DownsellWheel({ onDone }: { onDone: () => void }) {
  const controls = useAnimation();
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      trackEvent("downsell_wheel_spun", {});
      const targetCenter = WIN_INDEX * SLICE_DEG + SLICE_DEG / 2;
      const jitter = (Math.random() - 0.5) * (SLICE_DEG * 0.25);
      const finalAngle = 6 * 360 + (360 - targetCenter) + jitter;
      await new Promise((r) => setTimeout(r, 350));
      await controls.start({ rotate: finalAngle, transition: { duration: 4.4, ease: [0.16, 0.84, 0.28, 1] } });
      setDone(true);
      setTimeout(onDone, 950);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 py-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.18), transparent 65%)" }}
      />
      <div className="text-center space-y-2">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold"
        >
          <Sparkles className="w-3 h-3" /> Oferta de saída
        </motion.div>
        <motion.h2 key={String(done)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold leading-tight tracking-tight">
          {done ? (<>Você ganhou!<br />Veja sua oferta</>) : (<>Espera! Tem uma<br />oferta girando…</>)}
        </motion.h2>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="relative w-64 h-64 sm:w-72 sm:h-72">
        <div
          aria-hidden
          className="absolute inset-[-14px] rounded-full"
          style={{ background: "conic-gradient(from 0deg, hsl(var(--primary)) 0deg, transparent 90deg, hsl(var(--primary)) 180deg, transparent 270deg, hsl(var(--primary)) 360deg)", filter: "blur(18px)", opacity: 0.4 }}
        />
        {/* Ponteiro */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="relative flex flex-col items-center">
            <div className="w-0 h-0" style={{ borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "24px solid hsl(var(--primary))", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }} />
            <div className="absolute -top-2 w-5 h-5 rounded-full bg-primary border-[3px] border-background shadow-lg" />
          </div>
        </div>
        <motion.div className="w-full h-full rounded-full relative" animate={controls} style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.28))" }}>
          <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="w-full h-full">
            <defs>
              <radialGradient id="ds-shine" cx="50%" cy="35%" r="60%">
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
                fill={s.winning ? "hsl(var(--primary))" : i % 2 === 0 ? "hsl(220 14% 96%)" : "hsl(var(--primary) / 0.16)"}
                stroke="hsl(var(--background))"
                strokeWidth="2"
              />
            ))}
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#ds-shine)" pointerEvents="none" />
            {SLICES.map((s, i) => {
              const angle = (i * SLICE_DEG + SLICE_DEG / 2 - 90) * (Math.PI / 180);
              const tx = CENTER + Math.cos(angle) * (RADIUS * 0.62);
              const ty = CENTER + Math.sin(angle) * (RADIUS * 0.62);
              const rot = i * SLICE_DEG + SLICE_DEG / 2;
              return (
                <text
                  key={i}
                  x={tx}
                  y={ty}
                  fill={s.winning ? "hsl(var(--primary-foreground))" : "hsl(222 20% 30%)"}
                  fontSize={s.winning ? 15 : 12.5}
                  fontWeight={s.winning ? 800 : 700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rot} ${tx} ${ty})`}
                  style={{ letterSpacing: 0.3 }}
                >
                  {s.label}
                </text>
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

      <p className="text-sm text-muted-foreground text-center max-w-xs">
        {done ? "Revelando sua oferta exclusiva…" : "Reservamos um desconto especial só pra você não ir embora."}
      </p>
    </div>
  );
}

/* =========================================================
   Oferta (mensal R$9,90 · anual R$2,99/mês) + checkout
   ========================================================= */

const PLAN = {
  monthly: { price: "9,90", suffix: "/mês", full: "14,90", note: "Cancele quando quiser" },
  annual: { price: "2,99", suffix: "/mês", full: "14,90", billed: "R$ 35,88/ano", note: "Economize R$ 142,92 no 1º ano" },
} as const;

const COUNTDOWN_SECONDS = 10 * 60;

function DownsellOffer({ onDismiss }: { onDismiss: () => void }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    trackEvent("downsell_offer_shown", {});
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const accept = async () => {
    setLoading(true);
    trackEvent("downsell_accepted", { billing });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: { billing, coupon: "DOWNSELL" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Não foi possível iniciar o checkout.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar checkout");
      setLoading(false);
    }
  };

  const PlanCard = ({ id }: { id: "monthly" | "annual" }) => {
    const p = PLAN[id];
    const active = billing === id;
    return (
      <button
        type="button"
        onClick={() => setBilling(id)}
        className={`relative w-full text-left rounded-2xl p-4 transition-all ${
          active ? "border-2 border-primary bg-primary/[0.06] shadow-md shadow-primary/10" : "border border-border bg-card hover:border-primary/40"
        }`}
      >
        {id === "annual" && (
          <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold tracking-wide">
            MAIS ESCOLHIDO
          </span>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{id === "annual" ? "Anual" : "Mensal"}</span>
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${active ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
            {active && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-primary">R$ {p.price}</span>
          <span className="text-sm text-muted-foreground">{p.suffix}</span>
        </div>
        <p className="text-[11px] text-muted-foreground line-through">De R$ {p.full}/mês</p>
        <p className="mt-0.5 text-[11px] font-medium text-primary">
          {"billed" in p ? `${p.billed} · ${p.note}` : p.note}
        </p>
      </button>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="space-y-4">
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wide"
        >
          <Crown className="w-3 h-3" /> OFERTA EXCLUSIVA DE SAÍDA
        </motion.div>
        <h2 className="text-2xl font-bold leading-tight">
          Leve o CORE completo<br />por bem menos
        </h2>
        <p className="text-xs text-muted-foreground">Os 16 módulos, sem fidelidade. Escolha seu plano:</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PlanCard id="annual" />
        <PlanCard id="monthly" />
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Timer className="w-3.5 h-3.5" />
        Oferta expira em <span className="font-mono font-bold text-foreground">{mm}:{ss}</span>
      </div>

      <Button size="lg" onClick={accept} disabled={loading || secondsLeft === 0} className="w-full h-14 text-base font-bold">
        {loading ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Redirecionando…</>) : "GARANTIR MINHA OFERTA"}
      </Button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5" /> Pix ou cartão · cancele quando quiser · sem fidelidade
      </div>

      <button onClick={onDismiss} className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 py-1">
        Não, obrigado
      </button>
    </motion.div>
  );
}

/* =========================================================
   Dialog (roleta → oferta)
   ========================================================= */

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DownsellDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<"wheel" | "offer">("wheel");

  useEffect(() => {
    if (open) setStep("wheel");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md w-[calc(100%-2rem)] max-h-[95vh] overflow-y-auto p-6 gap-0 [&>button]:hidden z-[200]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Oferta exclusiva de saída</DialogTitle>
        <DialogDescription className="sr-only">
          Gire a roleta e descubra o desconto que reservamos para você assinar o CORE.
        </DialogDescription>

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-50 w-10 h-10 rounded-full bg-background border-2 border-border hover:bg-muted shadow-md flex items-center justify-center text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        {step === "wheel" ? (
          <DownsellWheel onDone={() => setStep("offer")} />
        ) : (
          <DownsellOffer onDismiss={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
