import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const PixGraceBanner = () => {
  const navigate = useNavigate();
  const { gracePeriod, daysLeft } = useAuth();

  if (!gracePeriod) return null;

  return (
    <div className="mx-4 mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
          Sua assinatura via Pix venceu
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Renove em {daysLeft} {daysLeft === 1 ? "dia" : "dias"} para evitar o bloqueio do app.
        </p>
      </div>
      <Button size="sm" onClick={() => navigate("/planos")} className="flex-shrink-0">
        Renovar
      </Button>
    </div>
  );
};
