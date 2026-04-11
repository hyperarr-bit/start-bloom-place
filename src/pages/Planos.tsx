import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Loader2, Copy, CheckCircle2, Clock, User, Mail, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface PixData {
  brCode: string;
  brCodeBase64: string;
  pixId: string;
  status: string;
  expiresAt: string | null;
  amount: number;
  planName: string;
}

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const isValidCpf = (cpf: string) => cpf.replace(/\D/g, "").length === 11;
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type Step = "plans" | "form" | "pix";
type PaymentMethod = "pix" | "card";

const Planos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSubscribed } = useAuth();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Form state
  const [step, setStep] = useState<Step>("plans");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

  useEffect(() => {
    if (searchParams.get("success") === "true") toast.success("Assinatura realizada com sucesso! 🎉");
    if (searchParams.get("canceled") === "true") toast.info("Checkout cancelado.");
  }, [searchParams]);

  // Countdown timer
  useEffect(() => {
    if (!pixData?.expiresAt) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(pixData.expiresAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        setPixData(null);
        setStep("plans");
        toast.info("PIX expirado. Gere um novo.");
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [pixData?.expiresAt]);

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

  const handleGoToForm = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      navigate("/auth");
      return;
    }
    setEmail(user.email || "");
    setName(user.user_metadata?.display_name || user.user_metadata?.full_name || "");
    setStep("form");
  };

  const handleGeneratePix = async () => {
    if (!name.trim()) { toast.error("Preencha seu nome completo."); return; }
    if (!isValidEmail(email)) { toast.error("Email inválido."); return; }
    if (!isValidCpf(cpf)) { toast.error("CPF inválido. Use o formato XXX.XXX.XXX-XX."); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("abacatepay-pix", {
        body: { billing, name: name.trim(), email: email.trim(), cpf: cpf.replace(/\D/g, "") },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.checkoutUrl) {
        // Billing API didn't return inline PIX, redirect to checkout
        window.open(data.checkoutUrl, "_blank");
        toast.success("Redirecionando para o pagamento...");
        return;
      }
      setPixData(data);
      setStep("pix");
      toast.success("PIX gerado! Escaneie o QR Code ou copie o código.");
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("not authenticated") || msg.includes("missing sub claim")) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        navigate("/auth");
      } else {
        toast.error(msg || "Erro ao gerar PIX");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!pixData?.brCode) return;
    await navigator.clipboard.writeText(pixData.brCode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleBack = () => {
    if (step === "pix") { setPixData(null); setStep("form"); }
    else if (step === "form") setStep("plans");
    else navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">
            {step === "form" ? "Seus dados" : step === "pix" ? "Pagamento PIX" : "Escolha seu plano"}
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-8">
        {isSubscribed && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">✅ Você já é assinante CORE Pro!</p>
            <p className="text-xs text-muted-foreground">Para cancelar, entre em contato pelo email suporte@coreaplicativo.com</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "pix" && pixData ? (
            <motion.div key="pix" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="rounded-2xl border-2 border-primary/20 bg-card p-6 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-bold text-lg">Pagamento via PIX</h2>
                <p className="text-sm text-muted-foreground">{pixData.planName}</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(pixData.amount)}</p>
              </div>
              {pixData.brCodeBase64 && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl">
                    <img src={pixData.brCodeBase64.startsWith("data:") ? pixData.brCodeBase64 : `data:image/png;base64,${pixData.brCodeBase64}`} alt="QR Code PIX" className="w-48 h-48" />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Ou copie o código PIX:</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-lg p-3 text-xs font-mono break-all max-h-20 overflow-y-auto">{pixData.brCode}</div>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 self-start">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {secondsLeft !== null && secondsLeft > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" /><span>Expira em {formatTime(secondsLeft)}</span>
                </div>
              )}
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground text-center">Após o pagamento, sua assinatura será ativada automaticamente.</p>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => { setPixData(null); setStep("form"); }}>← Voltar</Button>
              </div>
            </motion.div>
          ) : step === "form" ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="rounded-2xl border-2 border-primary/20 bg-card p-6 space-y-6">
              <div className="text-center space-y-1">
                <h2 className="font-bold text-lg">Dados para pagamento</h2>
                <p className="text-sm text-muted-foreground">Preencha seus dados para gerar o PIX</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm"><User className="w-4 h-4" />Nome completo</Label>
                  <Input id="name" placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4" />Email</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="flex items-center gap-2 text-sm"><CreditCard className="w-4 h-4" />CPF</Label>
                  <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} inputMode="numeric" />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleGeneratePix} disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando PIX...</> : "Gerar PIX e pagar"}
              </Button>
            </motion.div>
          ) : (
            <motion.div key="plans" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted">
                <button onClick={() => setBilling("monthly")} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${billing === "monthly" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Mensal</button>
                <button onClick={() => setBilling("annual")} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all relative ${billing === "annual" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                  Anual
                  {billing === "annual" && <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">-25%</span>}
                </button>
              </div>

              <motion.div key={billing} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-primary/20 bg-card p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><span className="text-xl font-black text-primary">C</span></div>
                  <div><h2 className="font-bold text-lg">CORE Pro</h2><p className="text-xs text-muted-foreground">Acesso completo</p></div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">R$ {currentPlan.price}</span>
                  <span className="text-muted-foreground">{currentPlan.period}</span>
                </div>
                {billing === "annual" && <p className="text-xs text-green-600 font-medium">{plans.annual.savings}</p>}
                <ul className="space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm"><Check className="w-4 h-4 text-green-500 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Button className="w-full" size="lg" onClick={handleGoToForm} disabled={isSubscribed}>
                  {isSubscribed ? "Já assinante" : "Assinar CORE PRO"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">Pagamento via PIX · Cancele quando quiser</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Planos;
