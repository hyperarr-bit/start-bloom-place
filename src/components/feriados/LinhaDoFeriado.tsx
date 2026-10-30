import { CalendarHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import { feriadoDoDia, textoDoFeriado } from "@/lib/feriados";
import { useMostrarFeriados } from "@/hooks/use-feriados";

/**
 * A linha informativa do feriado (28/10) — "Feriado: Proclamação da República". Não é tarefa:
 * não tem caixinha, não conta pro score nem pra sequência, não gera aviso. Some se o dia não é
 * feriado ou se a pessoa desligou "Mostrar feriados".
 */
export function LinhaDoFeriado({ dia, className }: { dia: string; className?: string }) {
  const [mostrar] = useMostrarFeriados();
  const f = mostrar ? feriadoDoDia(dia) : null;
  if (!f) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-[12px] font-semibold text-rose-700 dark:text-rose-300", className)} data-testid="linha-feriado">
      <CalendarHeart className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {textoDoFeriado(f)}
    </p>
  );
}
