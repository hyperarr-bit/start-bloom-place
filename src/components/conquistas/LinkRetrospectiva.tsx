import { useNavigate } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { menuNovoLigado } from "@/lib/menu-novo";

/**
 * A PORTA FIXA DA RETROSPECTIVA (1.0.18). Com o menu novo (lib/menu-novo) a Retrospectiva sai do menu da conta
 * (0,5% dos pagantes tocavam) — as outras entradas aparecem só às vezes (a faixa da Home nos dias 1–10, que some
 * com o X; o banner de Finanças; a notificação do dia 1º). Sem esta linha, depois do dia 10 ou do X ela ficaria
 * sem caminho. Mora no fim das Conquistas, discreta como o "Ver todos os adesivos". Com `menu_novo: off` o item
 * volta pro menu e esta linha não existe.
 */
export const LinkRetrospectiva = () => {
  const navigate = useNavigate();
  if (!menuNovoLigado()) return null;
  return (
    <button
      type="button"
      onClick={() => { trackEvent("conquistas_retrospectiva_click", {}); navigate("/retrospectiva?origem=conquistas"); }}
      className="w-full h-9 inline-flex items-center justify-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
      data-testid="conquistas-retrospectiva"
    >
      <Sparkles className="w-3.5 h-3.5" aria-hidden /> Retrospectiva do mês <ChevronRight className="w-3.5 h-3.5" aria-hidden />
    </button>
  );
};
