import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  Wallet,
  Target,
  TrendingUp,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { trackEvent, getAttributionParams } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PaymentStatus } from "@/components/PaymentStatus";
import { CancelFlowDialog } from "@/components/retention/CancelFlowDialog";
import { useWinbackTrigger } from "@/hooks/use-winback-trigger";

const MODULE_GROUPS: Array<{
  icon: typeof Wallet;
  title: string;
  items: string[];
}> = [
  {
    icon: Wallet,
    title: "Controle do dia a dia",
    items: [
      "Receitas, despesas e contas fixas",
      "Contas a vencer com lembretes",
      "Dívidas e parcelamentos",
    ],
  },
  {
    icon: Target,
    title: "Metas e desejos",
    items: [
      "Metas de economia com progresso",
      "Lista de desejos planejada",
      "Orçamento mensal e anual",
    ],
  },
  {
    icon: TrendingUp,
    title: "Crescer o patrimônio",
    items: [
      "Investimentos acompanhados",
      "Saúde financeira com score",
      "Simuladores de juros e metas",
    ],
  },
  {
    icon: BarChart3,
    title: "Visão clara",
    items: [
      "Painel com saldo do mês",
      "Relatórios por categoria",
      "Limites de gasto por categoria",
    ],
  },
];

const Planos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSubscribed, user } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const winback = useWinbackTrigger();

  useEffect(() => {
    trackEvent("planos_view", { source: searchParams.get("from") ?? "direct" });
  }, []);

  const shouldOfferWinback = !!user && !isSubscribed;

  const exitToPrevious = useCallback(() => {
    if (shouldOfferWinback) winback.markIntent();
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate, shouldOfferWinback, winback]);

  useEffect(() => {
    if (!shouldOfferWinback) return;
    const onPopState = () => winback.markIntent();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [shouldOfferWinback, winback]);

  const handleBack = useCallback(() => exitToPrevious(), [exitToPrevious]);

  const plans = {
    monthly: { price: "14,90", period: "/mês" },
    annual: { price: "3,90", period: "/mês", savings: "R$ 46,80 no ano (em até 12x ou Pix) · economia de R$ 132" },
  };
  const currentPlan = plans[billing];

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
      const { data, error } = await supabase.functions.invoke("cakto-checkout", {
        body: { billing, attribution: getAttributionParams() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
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

      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Escolha seu plano</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-8 pb-32 sm:pb-10">
        {isSubscribed && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-primary">
              Você já é assinante CORE PRO
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

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30">
            <Crown className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Seu dinheiro, finalmente sob controle
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Gastos, contas a vencer, metas, investimentos e sua saúde financeira — num painel só.
          </p>
        </div>

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
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              −R$132
            </span>
          </button>
        </div>

        {/* Plan card */}
        <motion.div
          key={billing}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl border-2 border-primary/30 bg-card p-6 sm:p-8 space-y-5 shadow-xl shadow-primary/10 overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">CORE PRO</h3>
                <p className="text-xs text-muted-foreground">Acesso completo</p>
              </div>
            </div>
            {billing === "annual" && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded-md">
                Mais escolhido
              </span>
            )}
          </div>

          <div className="space-y-1">
            {billing === "annual" && (
              <p className="text-sm text-muted-foreground line-through">
                R$ 14,90/mês
              </p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight">
                R$ {currentPlan.price}
              </span>
              <span className="text-muted-foreground">{currentPlan.period}</span>
            </div>
            {billing === "annual" && (
              <p className="text-xs text-primary font-medium">
                {plans.annual.savings}
              </p>
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={loading || isSubscribed}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Redirecionando...
              </>
            ) : isSubscribed ? (
              "Já assinante"
            ) : (
              "Assinar agora"
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cancele quando quiser · Garantia de 7 dias · Sem fidelidade</span>
          </div>
        </motion.div>

        {/* All modules benefits */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold">O que está incluído</h3>
            <p className="text-xs text-muted-foreground">
              Finanças completo, sem limites
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {MODULE_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div
                  key={group.title}
                  className="rounded-xl border border-border bg-card p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm">{group.title}</h4>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sticky CTA mobile */}
      {!isSubscribed && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <div className="leading-tight">
              <p className="text-[11px] text-muted-foreground">A partir de</p>
              <p className="text-base font-bold">
                R$ {currentPlan.price}
                <span className="text-xs font-normal text-muted-foreground">
                  {currentPlan.period}
                </span>
              </p>
            </div>
            <Button onClick={handleCheckout} disabled={loading} className="flex-1 max-w-[60%]">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Assinar agora"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planos;
