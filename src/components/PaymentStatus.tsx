import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { firePurchaseConversion } from "@/lib/google-ads";

type Status = "pending" | "confirmed" | "failed" | "canceled";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~60s

export const PaymentStatus = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { } = useAuth();

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const [open, setOpen] = useState(success || canceled);
  const [status, setStatus] = useState<Status>(
    canceled ? "canceled" : "pending"
  );
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!success || status !== "pending") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (cancelled) return;

        if (!error && data?.subscribed) {
          setStatus("confirmed");
          // Conversão de Compra do Google Ads — aqui é o único ponto em que
          // temos pagamento confirmado pelo servidor + retorno real do checkout.
          firePurchaseConversion({
            billingPeriod: data.billing_period,
            transactionId: data.subscription_end,
          });
          return;
        }

        setPollCount((c) => {
          const next = c + 1;
          if (next >= MAX_POLLS) {
            setStatus("failed");
          } else {
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
          return next;
        });
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [success, status]);

  const handleClose = () => {
    setOpen(false);
    // Clean URL
    searchParams.delete("success");
    searchParams.delete("canceled");
    setSearchParams(searchParams, { replace: true });
  };

  if (!open) return null;

  const config = {
    pending: {
      icon: <Loader2 className="w-8 h-8 text-primary animate-spin" />,
      bg: "bg-primary/10",
      title: "Confirmando pagamento…",
      desc: "Aguarde alguns segundos enquanto verificamos seu pagamento.",
      cta: null,
    },
    confirmed: {
      icon: <CheckCircle2 className="w-8 h-8 text-green-500" />,
      bg: "bg-green-500/10",
      title: "Pagamento confirmado!",
      desc: "Sua assinatura CORE PRO está ativa. Aproveite todos os módulos.",
      cta: (
        <>
          <Button className="w-full" onClick={() => { handleClose(); navigate("/"); }}>
            Começar a usar
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleClose}>
            Fechar
          </Button>
        </>
      ),
    },
    failed: {
      icon: <Clock className="w-8 h-8 text-yellow-500" />,
      bg: "bg-yellow-500/10",
      title: "Pagamento ainda não confirmado",
      desc: "Pode levar alguns minutos para o pagamento ser processado (especialmente Pix). Volte aqui em instantes — você receberá acesso assim que confirmar.",
      cta: (
        <>
          <Button className="w-full" onClick={() => window.location.reload()}>
            Verificar novamente
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleClose}>
            Fechar
          </Button>
        </>
      ),
    },
    canceled: {
      icon: <XCircle className="w-8 h-8 text-destructive" />,
      bg: "bg-destructive/10",
      title: "Checkout cancelado",
      desc: "Você cancelou o pagamento. Quando quiser, pode tentar de novo.",
      cta: (
        <Button className="w-full" onClick={handleClose}>
          Voltar aos planos
        </Button>
      ),
    },
  }[status];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4"
        onClick={status !== "pending" ? handleClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl"
        >
          <div className={`w-16 h-16 rounded-full ${config.bg} flex items-center justify-center mx-auto`}>
            {config.icon}
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold">{config.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{config.desc}</p>
          </div>
          {status === "pending" && (
            <p className="text-xs text-muted-foreground text-center">
              Tentativa {pollCount + 1} de {MAX_POLLS}
            </p>
          )}
          {config.cta && <div className="space-y-2">{config.cta}</div>}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
