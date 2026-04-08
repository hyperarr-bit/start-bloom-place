import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Planos = () => {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  const plans = {
    monthly: { price: "27,90", period: "/mês", total: "R$ 334,80/ano" },
    annual: { price: "14,90", period: "/mês", total: "R$ 178,80/ano", savings: "47% de desconto" },
  };

  const currentPlan = plans[billing];

  const features = [
    "Todos os 12 módulos desbloqueados",
    "Finanças, Treino, Dieta, Rotina e mais",
    "Dados sincronizados e seguros",
    "Atualizações e novos recursos",
    "Suporte prioritário",
  ];

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
                -47%
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

          <Button className="w-full" size="lg" onClick={() => {
            // Stripe checkout will be integrated here
            console.log("Checkout:", billing);
          }}>
            Assinar CORE Pro
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
