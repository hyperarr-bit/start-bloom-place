import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso! 🎉");
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelado.");
    }
  }, [searchParams]);

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

    // Open blank tab immediately for perceived speed
    const checkoutTab = window.open("about:blank", "_blank");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: { billing },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        if (checkoutTab) {
          checkoutTab.location.href = data.url;
        } else {
          window.location.href = data.url;
        }
        toast.success("Checkout aberto em nova aba!");
      }
    } catch (err: any) {
      checkoutTab?.close();
      const msg = err.message || "";
      if (msg.includes("not authenticated") || msg.includes("missing sub claim")) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        navigate("/auth");
      } else {
        toast.error(msg || "Erro ao iniciar checkout");
      }
    } finally {
      setLoading(false);
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
            <p className="text-xs text-muted-foreground">
              Para cancelar, entre em contato pelo email suporte@coreaplicativo.com
            </p>
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
              <Crown className="w-5 h-5 text-primary" />
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
              "Assinar CORE Pro"
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Pagamento via PIX · Cancele quando quiser
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Planos;
