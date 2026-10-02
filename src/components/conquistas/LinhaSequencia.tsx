import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Flame } from "lucide-react";
import type { Sequencia } from "./use-conquistas";

/**
 * A linha da sequência embaixo do anel da Home (26/09): "🔥 12 dias · falta
 * 1 coisa hoje ›". É a porta das Conquistas no dia a dia — a tela só existia
 * no menu, e quase ninguém chegava nela.
 *
 * (02/10) a linha diz O QUÊ falta — a ação da pessoa ("falta 1 coisa: marque o
 * treino de terça"), não um texto fixo. Na HOME ela é de UMA cor só: a do SCORE
 * do tema (amarelo no Original, azul no Índigo…) — o fogo, os dias e o
 * "garantido" (dono 02/10: "cores demais"). O fogo por faixa (laranja,
 * vermelho, roxo, azul, dourado) mora só na tela de Conquistas.
 */
export const LinhaSequencia = ({ seq }: { seq: Sequencia }) => {
  const navigate = useNavigate();
  const cor = { color: "hsl(var(--score-ring, var(--warning)))" };
  return (
    <button
      type="button"
      onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
      className="mt-4 pt-3 w-full border-t border-border/60 flex items-center gap-1.5 text-[12.5px] text-left whitespace-nowrap overflow-hidden"
      data-testid="linha-sequencia"
    >
      <Flame
        className={`w-[17px] h-[17px] shrink-0${seq.dias > 0 ? "" : " text-muted-foreground"}`}
        style={seq.dias > 0 ? { ...cor, fill: "currentColor", fillOpacity: 0.22 } : undefined}
        strokeWidth={2.2}
        aria-hidden
        data-testid="linha-sequencia-fogo"
      />
      {seq.dias > 0 ? (
        <>
          <b className="font-bold tabular-nums" style={cor} data-testid="linha-sequencia-dias">
            {seq.dias} {seq.dias === 1 ? "dia" : "dias"}
          </b>
          <span className="text-muted-foreground" aria-hidden>·</span>
          {seq.hojeFeito ? (
            <span className="font-semibold inline-flex items-center gap-1" style={cor} data-testid="linha-sequencia-garantido">
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
