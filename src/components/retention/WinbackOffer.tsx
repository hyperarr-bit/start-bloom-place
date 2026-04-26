import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Loader2, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  onClose: () => void;
}

const FULL_MONTHLY = 14.9; // R$ por mês no plano anual cheio
const DISCOUNTED_MONTHLY = 2.98; // 80% off
const DISCOUNTED_YEARLY = 35.76;

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function WinbackOffer({ onClose }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("winback_offer_shown");
  }, []);

  const handleAccept = async () => {
    trackEvent("winback_offer_accepted");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/auth");
        return;
      }
      const { data, error } = await supabase.functions.invoke("abacatepay-checkout", {
        body: { billing: "annual", coupon: "WINBACK80" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("URL de checkout não retornada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar checkout");
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    trackEvent("winback_offer_dismissed");
    onClose();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-5 py-4">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="self-start p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Fechar oferta"
      >
        <X className="w-6 h-6" />
      </button>

      <main className="flex-1 flex flex-col items-center text-center pt-6 pb-8 max-w-md mx-auto w-full">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold tracking-tight mb-10"
        >
          Sua oferta única
        </motion.h1>

        {/* Hero badge */}
        <div className="relative my-2">
          {/* Sparkles around */}
          <Sparkles className="absolute -left-10 top-2 w-7 h-7 text-foreground/40" />
          <Sparkles className="absolute -right-12 top-6 w-9 h-9 text-foreground/60" />
          <Sparkles className="absolute -left-14 bottom-4 w-5 h-5 text-foreground/30" />
          <Sparkles className="absolute -right-8 -bottom-2 w-6 h-6 text-foreground/40" />

          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 180 }}
            className="rounded-3xl bg-foreground text-background px-10 py-8 shadow-2xl"
          >
            <div className="text-4xl font-black leading-tight">80% OFF</div>
            <div className="text-2xl font-bold tracking-wider mt-1">PARA SEMPRE</div>
          </motion.div>
        </div>

        {/* Price */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 flex items-baseline justify-center gap-3"
        >
          <span className="text-2xl text-muted-foreground line-through">
            R$ {fmt(FULL_MONTHLY)}
          </span>
          <span className="text-3xl font-bold">R$ {fmt(DISCOUNTED_MONTHLY)}</span>
          <span className="text-base text-muted-foreground">/mês</span>
        </motion.div>

        <p className="mt-6 text-sm text-muted-foreground max-w-xs leading-relaxed">
          Uma vez que você fechar essa oferta, ela vai embora.
          <br />
          Disponível só no plano <span className="font-semibold text-foreground">anual</span>.
        </p>

        {/* Plan card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 w-full rounded-2xl border-2 border-primary bg-card p-5 text-left"
        >
          <div className="text-[11px] font-bold tracking-widest text-primary uppercase text-center pb-3 border-b border-border">
            Plano anual · 12 meses · R$ {fmt(DISCOUNTED_YEARLY)}
          </div>
          <div className="flex items-center justify-between pt-4">
            <div>
              <div className="font-bold text-base">Plano Anual</div>
              <div className="text-xs text-muted-foreground">CORE PRO completo</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">R$ {fmt(DISCOUNTED_MONTHLY)}</div>
              <div className="text-xs text-muted-foreground">/mês</div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full mt-6 h-14 text-base font-semibold"
          onClick={handleAccept}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Redirecionando...
            </>
          ) : (
            "Garantir 80% OFF agora"
          )}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-green-500" />
          Sem compromisso — cancele quando quiser
        </p>
      </main>
    </div>
  );
}
