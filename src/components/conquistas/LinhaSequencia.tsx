import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Flame } from "lucide-react";
import type { Sequencia } from "./use-conquistas";

/**
 * A linha da sequência embaixo do anel da Home (26/09): "🔥 12 dias · falta 1
 * coisa hoje ›". É a porta das Conquistas no dia a dia — a tela só existia no
 * menu, e quase ninguém chegava nela.
 */
export const LinhaSequencia = ({ seq }: { seq: Sequencia }) => {
  const navigate = useNavigate();
  const cor = { color: "hsl(var(--streak, var(--warning)))" };
  return (
    <button
      type="button"
      onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
      className="mt-4 pt-3 w-full border-t border-border/60 flex items-center gap-1.5 text-[12.5px] text-left whitespace-nowrap overflow-hidden"
      data-testid="linha-sequencia"
    >
      <Flame className="w-4 h-4 shrink-0" style={cor} strokeWidth={2.2} aria-hidden />
      {seq.dias > 0 ? (
        <>
          <b className="font-bold tabular-nums" style={cor}>
            {seq.dias} {seq.dias === 1 ? "dia" : "dias"}
          </b>
          <span className="text-muted-foreground" aria-hidden>·</span>
          {seq.hojeFeito ? (
            <span className="text-success font-semibold inline-flex items-center gap-1">
              garantido hoje <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
            </span>
          ) : (
            <span className="text-muted-foreground truncate">falta 1 coisa hoje</span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground truncate">Comece sua sequência: anote 1 coisa hoje</span>
      )}
      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground shrink-0" aria-hidden />
    </button>
  );
};
