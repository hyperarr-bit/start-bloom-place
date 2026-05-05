import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const GracePeriodBanner = () => {
  const { inGracePeriod, graceDaysLeft, paymentMethod } = useAuth();
  const navigate = useNavigate();

  if (!inGracePeriod) return null;

  const days = graceDaysLeft ?? 0;
  const methodLabel = paymentMethod === "pix" ? "PIX" : "cartão";

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-start gap-2 flex-1">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <strong>Não conseguimos processar sua cobrança no {methodLabel}.</strong>{" "}
            Você tem mais{" "}
            <strong>{days} {days === 1 ? "dia" : "dias"}</strong> para regularizar
            ou seu acesso ao CORE será removido.
          </div>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => navigate("/planos")}
          className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
        >
          Atualizar pagamento
        </Button>
      </div>
    </div>
  );
};
