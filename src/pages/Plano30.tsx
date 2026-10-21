import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useKitPrimeiroMes } from "@/hooks/use-kit-primeiro-mes";
import { PlanoDe30Dias } from "@/components/kit/PlanoDe30Dias";
import { areaDoKit, urlDoDestino } from "@/lib/plano-30-areas";

/**
 * /plano-30 (21/10) — o plano de 30 dias da área comprada no downsell do presente (src/lib/plano-30-areas). Só pra
 * conta com a compra (sem ela, volta pra Home: nada de cadeado nem anúncio). Área Dinheiro → a aba "KIT 30 DIAS" de
 * Finanças, como sempre foi. A entrada é o item "Plano de 30 dias" do menu da conta.
 */
export default function Plano30() {
  const navigate = useNavigate();
  const { kit, loaded } = useKitPrimeiroMes();
  if (!loaded) return <div className="min-h-screen bg-background" />;
  if (!kit) return <Navigate to="/" replace />;
  if (areaDoKit(kit) === "dinheiro") return <Navigate to="/financas" replace />;
  return (
    <div className="min-h-screen bg-background" data-testid="pagina-plano-30">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-10">
        <button type="button" onClick={() => navigate("/")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground mb-3" aria-label="Voltar">
          <ArrowLeft className="w-4 h-4" /> <span>Início</span>
        </button>
        <PlanoDe30Dias irPara={(d) => navigate(urlDoDestino(d))} />
      </div>
    </div>
  );
}
