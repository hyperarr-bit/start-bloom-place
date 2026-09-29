import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartaoBeleza, FaixaBeleza, TEMA_BELEZA } from "@/components/beleza/kit";
import { LinhaDoCuidado } from "@/components/beleza/Cuidados";
import { useCuidados } from "@/components/beleza/use-cuidados";

/**
 * PRÓXIMOS CUIDADOS na Home (28/09, Onda 1 da Beleza): os 3 que vencem primeiro,
 * com o FALTA. Opcional como todo widget — entra pelo "Adicionar widget" ou pelo
 * "Pôr" que a aba CUIDADOS oferece depois do primeiro cuidado. Tocar abre a Beleza
 * em CUIDADOS. App antigo sem este widget: a grade da Home pula id sem componente.
 */
export const CuidadosWidget = () => {
  const navigate = useNavigate();
  const x = useCuidados();
  const abrir = () => navigate("/beleza?aba=cuidados");
  const tres = x.ordenados.slice(0, 3);
  return (
    <CartaoBeleza className={cn(TEMA_BELEZA)} data-testid="cuidados-widget" data-card="proximos-cuidados">
      <FaixaBeleza icone={<CalendarClock className="w-4 h-4 text-bz-acento" />} titulo="PRÓXIMOS CUIDADOS" />
      {tres.length ? (
        tres.map((c) => <LinhaDoCuidado key={c.id} c={c} hoje={x.hoje} onAbrir={abrir} />)
      ) : (
        <p className="px-4 py-3 border-t border-bz-linha text-[13px] text-bz-suave">Unha, sobrancelha, depilação: o CORE conta os dias e avisa.</p>
      )}
      <button type="button" onClick={abrir} className="w-full flex items-center gap-2 px-4 h-12 border-t border-bz-linha bg-bz-papel text-[13px] font-bold text-bz-acento active:bg-bz-blush" data-testid="abrir-cuidados">
        Abrir cuidados <ChevronRight className="w-4 h-4 ml-auto" aria-hidden="true" />
      </button>
    </CartaoBeleza>
  );
};
