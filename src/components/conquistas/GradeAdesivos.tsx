import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Lock } from "lucide-react";
import type { Badge } from "@/components/gamification/types";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { Adesivo, giroDoAdesivo } from "./adesivos-arte";

/** Papel pontilhado de planner (a cor do ponto segue o tema). */
export const PAPEL_PONTILHADO = {
  backgroundImage: "radial-gradient(circle, hsl(var(--foreground) / .13) 1.4px, transparent 1.6px)",
  backgroundSize: "22px 22px",
};

interface Props {
  folha: Badge[];
  abertos: number;
  proximo: Badge | null;
  diasDeSequencia: number;
  onSelecionar: (b: Badge) => void;
}

/**
 * MEUS ADESIVOS (26/09): a folha de adesivos em 4 colunas no papel
 * pontilhado — os conquistados coloridos e colados meio tortos, os que faltam
 * tracejados com o quanto já tem ("3/7", "R$ 80"). O rodapé aponta o próximo.
 *
 * Dos que faltam, a folha mostra só os mais perto (fechando a fileira), como
 * na peça aprovada: 30 círculos tracejados de uma vez viram lista de afazeres
 * e escondem o que a pessoa acabou de colar. "Ver todos" abre o resto.
 */
export const GradeAdesivos = ({ folha, abertos, proximo, diasDeSequencia, onSelecionar }: Props) => {
  const [todos, setTodos] = useState(false);
  const colados = folha.filter((b) => b.unlocked);
  const faltam = folha.filter((b) => !b.unlocked);
  const resto = colados.length % 4;
  const quantosFaltam = todos ? faltam.length : Math.min(faltam.length, resto ? 4 - resto : 4);
  const visiveis = [...colados, ...faltam.slice(0, quantosFaltam)];
  const escondidos = faltam.length - quantosFaltam;

  return (
    <section className="rounded-2xl border border-border overflow-hidden bg-card" aria-labelledby="titulo-adesivos" data-testid="meus-adesivos">
      <div className="h-11 px-4 flex items-center border-b border-border">
        <h2 id="titulo-adesivos" className="text-[13px] font-extrabold tracking-wide">MEUS ADESIVOS</h2>
        <span className="ml-auto text-[12.5px] font-bold tabular-nums">
          {abertos} de {folha.length}
        </span>
      </div>
      <div className="bg-[#fffdf8] dark:bg-card" style={PAPEL_PONTILHADO}>
        <div className="grid grid-cols-4 gap-x-1 gap-y-1 px-2 pt-3 pb-2.5">
          {visiveis.map((b, i) => {
            const rotulo = rotuloProgresso(b);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelecionar(b)}
                data-adesivo-celula={b.id}
                data-aberto={b.unlocked ? "true" : "false"}
                className="flex flex-col items-center gap-1 pt-0.5 pb-1 rounded-xl active:scale-95 transition-transform min-w-0"
              >
                {b.unlocked ? (
                  <Adesivo
                    id={b.id}
                    tamanho={72}
                    className="w-16 h-16 min-[400px]:w-[72px] min-[400px]:h-[72px]"
                    style={{ transform: `rotate(${giroDoAdesivo(i)}deg)` }}
                  />
                ) : (
                  <span className="my-1.5 w-[52px] h-[52px] min-[400px]:w-[60px] min-[400px]:h-[60px] rounded-full border-2 border-dashed border-foreground/15 bg-muted/40 grid place-items-center text-muted-foreground font-extrabold text-[11.5px] min-[400px]:text-[12px] tabular-nums leading-none px-1 text-center">
                    {rotulo ?? <Lock className="w-4 h-4" aria-hidden />}
                  </span>
                )}
                <span className={`text-[10.5px] font-extrabold leading-[1.1] text-center px-0.5 ${b.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                  {b.name}
                </span>
              </button>
            );
          })}
        </div>
        {(escondidos > 0 || todos) && faltam.length > 0 && (
          <button
            type="button"
            onClick={() => setTodos((t) => !t)}
            aria-expanded={todos}
            className="w-full pb-2.5 -mt-0.5 text-[12px] font-semibold text-muted-foreground inline-flex items-center justify-center gap-1"
          >
            {todos ? (
              <>Mostrar menos <ChevronUp className="w-3.5 h-3.5" aria-hidden /></>
            ) : (
              <>Ver todos · mais {escondidos} a caminho <ChevronDown className="w-3.5 h-3.5" aria-hidden /></>
            )}
          </button>
        )}
      </div>
      {proximo && (
        <button
          type="button"
          onClick={() => onSelecionar(proximo)}
          className="w-full px-4 py-2.5 border-t border-border text-[12px] text-muted-foreground flex items-center gap-2 text-left"
        >
          <span className="flex-1 min-w-0">
            Próximo: <b className="text-foreground">{proximo.name}</b> — {textoFalta(proximo, diasDeSequencia)}
          </span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
        </button>
      )}
    </section>
  );
};
