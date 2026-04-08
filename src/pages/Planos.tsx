import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Zap, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const Planos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSubscribed } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso! 🎉");
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelado.");
    }
  }, [searchParams]);

  const plans = {
    monthly: { price: "19,90", period: "/mês", total: "R$ 238,80/ano" },
    annual: { price: "14,90", period: "/mês", total: "R$ 178,80/ano", savings: "25% de desconto" },
  };

  const currentPlan = plans[billing];

  const features = [
    "Todos os 12 módulos desbloqueados",
    "Finanças, Treino, Dieta, Rotina e mais",
    "Dados sincronizados e seguros",
    "Atualizações e novos recursos",
    "Suporte prioritário",
  ];

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { billing },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao iniciar checkout: " + (err.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao abrir portal: " + (err.message || "tente novamente"));
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Escolha seu plano</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-8">
        {isSubscribed && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              ✅ Você já é assinante CORE Pro!
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings className="w-4 h-4 mr-2" />}
              Gerenciar assinatura
            </Button>
          </div>
        )}

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
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">CORE Pro</h2>
              <p className="text-xs text-muted-foreground">Acesso completo</p>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">R$ {currentPlan.price}</span>
            <span className="text-muted-foreground">{currentPlan.period}</span>
          </div>

          {billing === "annual" && (
            <p className="text-xs text-green-600 font-medium">
              {currentPlan.total} · {plans.annual.savings}
            </p>
          )}
          {billing === "monthly" && (
            <p className="text-xs text-muted-foreground">{currentPlan.total}</p>
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
              "Assinar CORE Pro"
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Cancele quando quiser. Sem fidelidade.
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Planos;
