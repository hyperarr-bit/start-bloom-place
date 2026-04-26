import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PaymentStatus } from "@/components/PaymentStatus";
import { CancelFlowDialog } from "@/components/retention/CancelFlowDialog";
import { WinbackFlow } from "@/components/retention/WinbackFlow";
import { useWinbackTrigger } from "@/hooks/use-winback-trigger";

const Planos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSubscribed, trialExpired, user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const winback = useWinbackTrigger();
  const allowExitRef = useRef(false);
  const winbackRef = useRef(winback);
  winbackRef.current = winback;

  useEffect(() => {
    trackEvent("planos_view", { source: searchParams.get("from") ?? "direct" });
  }, []);

  const shouldGuard = !!user && !isSubscribed && trialExpired;

  // Intercept browser back button (popstate) when we should guard the exit.
  // We push a sentinel state on mount; on back, we re-push it and trigger winback.
  useEffect(() => {
    if (!shouldGuard) return;
    window.history.pushState({ planosGuard: true }, "");

    const onPopState = async () => {
      if (allowExitRef.current || winbackRef.current.alreadyShown) return;
      // Re-push so the user stays on /planos
      window.history.pushState({ planosGuard: true }, "");
      const opened = await winbackRef.current.triggerNow("abandon_planos");
      if (!opened) {
        allowExitRef.current = true;
        navigate(-1);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [shouldGuard, navigate]);

  // Intercept the in-page back button.
  const handleBack = useCallback(async () => {
    if (!shouldGuard || allowExitRef.current || winback.alreadyShown) {
      navigate(-1);
      return;
    }
    const opened = await winback.triggerNow("abandon_planos");
    if (!opened) {
      allowExitRef.current = true;
      navigate(-1);
    }
  }, [shouldGuard, winback, navigate]);

  // After winback closes, allow leaving on the next attempt.
  const handleWinbackClose = () => {
    allowExitRef.current = true;
    winback.close();
  };

  const plans = {
    monthly: { price: "19,90", period: "/mês" },
    annual: { price: "14,90", period: "/mês", savings: "Economia de R$ 60/ano" },
  };

  const currentPlan = plans[billing];

  const features = [
    "Todos os 16 módulos desbloqueados",
    "Finanças, Treino, Dieta, Rotina e mais",
    "Dados sincronizados e seguros",
    "Atualizações e novos recursos",
    "Suporte prioritário",
  ];

  const handleCheckout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      navigate("/auth");
      return;
    }

    setLoading(true);
    winback.markIntent();
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: { billing },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("not authenticated") || msg.includes("missing sub claim")) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        navigate("/auth");
      } else {
        toast.error(msg || "Erro ao iniciar checkout");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentStatus />
      <WinbackFlow open={winback.open} onClose={handleWinbackClose} attemptId={winback.attemptId} />
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Escolha seu plano</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-8">
        {isSubscribed && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              ✅ Você já é assinante CORE PRO!
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelOpen(true)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Cancelar assinatura
            </Button>
          </div>
        )}

        <CancelFlowDialog open={cancelOpen} onOpenChange={setCancelOpen} />

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted">
          <button
            onClick={() => setBilling("monthly")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              billing === "monthly" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all relative ${
              billing === "annual" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Anual
            {billing === "annual" && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                -25%
              </span>
            )}
          </button>
        </div>

        {/* Plan card */}
        <motion.div
          key={billing}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-primary/20 bg-card p-6 space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">CORE PRO</h2>
              <p className="text-xs text-muted-foreground">Acesso completo</p>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">R$ {currentPlan.price}</span>
            <span className="text-muted-foreground">{currentPlan.period}</span>
          </div>

          {billing === "annual" && (
            <p className="text-xs text-green-600 font-medium">
              {plans.annual.savings}
            </p>
          )}

          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={loading || isSubscribed}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Redirecionando...</>
            ) : isSubscribed ? (
              "Já assinante"
            ) : (
              "Assinar CORE PRO"
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Você escolhe Pix ou Cartão na próxima tela · Cartão renova automaticamente ·
            Pix você renova manualmente a cada {billing === "annual" ? "ano" : "mês"}
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Planos;
