import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import type { Sequencia } from "./use-conquistas";
import { Fogo } from "./Fogo";

/**
 * A linha da sequência embaixo do anel da Home (26/09): "🔥 12 dias · falta
 * 1 coisa hoje ›". É a porta das Conquistas no dia a dia — a tela só existia
 * no menu, e quase ninguém chegava nela.
 *
 * (02/10) o fogo tem a cor da faixa e a linha diz O QUÊ falta — a ação da
 * pessoa ("falta 1 coisa: marque o treino de terça"), não um texto fixo.
 */
export const LinhaSequencia = ({ seq }: { seq: Sequencia }) => {
  const navigate = useNavigate();
  const cor = { color: seq.dias > 0 ? seq.faixa.meio : "hsl(var(--streak, var(--warning)))" };
  return (
    <button
      type="button"
      onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
      className="mt-4 pt-3 w-full border-t border-border/60 flex items-center gap-1.5 text-[12.5px] text-left whitespace-nowrap overflow-hidden"
      data-testid="linha-sequencia"
      data-faixa={seq.dias > 0 ? seq.faixa.id : "apagado"}
    >
      <Fogo dias={seq.dias} tamanho={17} semBrilho />
      {seq.dias > 0 ? (
        <>
          <b className="font-bold tabular-nums" style={cor}>
            {seq.dias} {seq.dias === 1 ? "dia" : "dias"}
          </b>
          <span className="text-muted-foreground" aria-hidden>·</span>
          {seq.hojeFeito ? (
            <span className="font-semibold inline-flex items-center gap-1" style={{ color: "hsl(var(--garantido, var(--success)))" }}>
              garantido hoje <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
            </span>
          ) : (
            <span className="text-muted-foreground truncate" data-testid="linha-sequencia-acao">falta 1 coisa hoje: {seq.acao.texto}</span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground truncate">Comece sua sequência: {seq.acao.texto}</span>
      )}
      <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground shrink-0" aria-hidden />
    </button>
  );
};
