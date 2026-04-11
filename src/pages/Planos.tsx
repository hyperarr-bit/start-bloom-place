import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Customer data for checkout
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso! 🎉");
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelado.");
    }
  }, [searchParams]);

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, phone, tax_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (profile.display_name) setCustomerName(profile.display_name);
        if (profile.phone) setCustomerPhone(profile.phone);
        if (profile.tax_id) setCustomerTaxId(profile.tax_id);
      }
    };
    loadProfile();
  }, []);

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
    // Check auth first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      navigate("/auth");
      return;
    }

    // Check if we have all required data
    if (!customerName.trim() || !customerPhone.trim() || !customerTaxId.trim()) {
      setShowForm(true);
      toast.info("Preencha seus dados para continuar com o pagamento");
      return;
    }

    setLoading(true);
    try {
      // Save profile data
      await supabase
        .from("profiles")
        .update({
          display_name: customerName,
          phone: customerPhone,
          tax_id: customerTaxId,
        })
        .eq("id", user.id);

      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: { billing, customerName, customerPhone, customerTaxId },
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
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
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

          {/* Customer data form */}
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pt-2 border-t border-border"
            >
              <p className="text-xs text-muted-foreground font-medium">
                Dados para pagamento
              </p>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId" className="text-xs">CPF ou CNPJ</Label>
                <Input
                  id="taxId"
                  placeholder="123.456.789-01"
                  value={customerTaxId}
                  onChange={(e) => setCustomerTaxId(formatCPF(e.target.value))}
                />
              </div>
            </motion.div>
          )}

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
            ) : showForm ? (
              "Continuar para pagamento"
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
