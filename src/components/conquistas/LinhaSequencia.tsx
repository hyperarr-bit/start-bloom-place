import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import { Check, ChevronRight, Flame } from "lucide-react";
import { Fogo } from "./Fogo";
import type { Sequencia } from "./use-conquistas";

/**
 * A linha da sequência embaixo do anel da Home (26/09): "🔥 12 dias · falta
 * 1 coisa hoje ›". É a porta das Conquistas no dia a dia — a tela só existia
 * no menu, e quase ninguém chegava nela.
 *
 * (02/10) a linha diz O QUÊ falta — a ação da pessoa ("falta 1 coisa: marque o
 * treino de terça"), não um texto fixo. Cores (dono 02/10, 2ª rodada): o FOGO e
 * os "N dias" na cor da FAIXA da sequência (laranja → vermelho → roxo → azul →
 * dourado — a recompensa aparece no dia a dia, como no Duolingo); o "garantido
 * hoje" na cor do SCORE do tema (amarelo no Original, azul no Índigo…), que é a
 * cor da Home. Nada de verde.
 */
export const LinhaSequencia = ({ seq }: { seq: Sequencia }) => {
  const navigate = useNavigate();
  const cor = { color: "hsl(var(--score-ring, var(--warning)))" };
  // os dias na cor da faixa, legível no claro e no escuro (as cores de texto do "hoje" da faixa)
  const corDosDias = { "--dias-c": seq.faixa.hojeTexto, "--dias-cd": seq.faixa.hojeTextoEscuro } as CSSProperties;
  return (
    <button
      type="button"
      onClick={() => navigate("/conquistas", { state: { origem: "home" } })}
      className="mt-4 pt-3 w-full border-t border-border/60 flex items-center gap-1.5 text-[12.5px] text-left whitespace-nowrap overflow-hidden"
      data-testid="linha-sequencia"
    >
      {seq.dias > 0 ? (
        <span className="inline-flex shrink-0" data-testid="linha-sequencia-fogo">
          <Fogo faixa={seq.faixa} tamanho={17} semBrilho />
        </span>
      ) : (
        <Flame className="w-[17px] h-[17px] shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden data-testid="linha-sequencia-fogo" />
      )}
      {seq.dias > 0 ? (
        <>
          <b className="font-bold tabular-nums text-[var(--dias-c)] dark:text-[var(--dias-cd)]" style={corDosDias} data-testid="linha-sequencia-dias">
            {seq.dias} {seq.dias === 1 ? "dia" : "dias"}
          </b>
          <span aria-hidden style={{ ...cor, opacity: 0.55 }} data-testid="linha-sequencia-ponto">·</span>
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
