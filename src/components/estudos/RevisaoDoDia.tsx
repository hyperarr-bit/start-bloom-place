/**
 * REVISAR HOJE — os flashcards do dia, um por vez (11/09).
 *
 * Fica no topo do Caderno, acima do "O que aprendi": primeiro o que a
 * memória pede, depois a consulta. Fluxo de um cartão: frente (pergunta ou
 * referência) → "Mostrar resposta" → verso (o aprendizado e o por quê) →
 * "Não lembrei" / "Lembrei". A linha de baixo do verso é o método Feynman
 * em uma frase: explica em voz alta antes de virar. Sem cartão vencido, o
 * bloco vira uma linha só, e sem nenhum aprendizado ele nem aparece.
 *
 * O estado da sessão (qual cartão, virado ou não) é local; o que persiste
 * é só a agenda em `estudos-revisoes`.
 */
import { useMemo, useState } from "react";
import { Brain, Check, RotateCcw } from "lucide-react";
import { localDayKey } from "@/lib/utils";
import { misturarCursos, type AprendizadosPorCurso } from "./aprendizados";
import { contarVencendoEm, frenteDoCartao, paraRevisarHoje, responder, type Revisoes } from "./revisao";

const amanha = () => { const d = new Date(); return localDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); };

export const RevisaoDoDia = ({ mapa, cursos, revisoes, onResponder }: {
  mapa: AprendizadosPorCurso;
  cursos: { id: string; name: string }[];
  revisoes: Revisoes;
  onResponder: (id: string, lembrou: boolean) => void;
}) => {
  const nomes = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c.name])), [cursos]);
  const todos = useMemo(() => misturarCursos(mapa, nomes), [mapa, nomes]);
  const hoje = localDayKey();
  const fila = useMemo(() => paraRevisarHoje(todos, revisoes, hoje), [todos, revisoes, hoje]);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [acertos, setAcertos] = useState(0);

  if (todos.length === 0) return null;

  const total = feitos + fila.length;
  const cartao = fila[0];

  if (!cartao) {
    const proximos = contarVencendoEm(todos, revisoes, amanha());
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3" data-testid="revisao-vazia">
        <Check className="w-4 h-4 text-green-600 shrink-0" />
        <p className="text-xs text-muted-foreground">
          {feitos > 0
            ? `Revisão de hoje feita: ${acertos} de ${feitos} lembrados. `
            : "Nada pra revisar hoje. "}
          {proximos > 0 ? `Amanhã ${proximos === 1 ? "volta 1 cartão" : `voltam ${proximos} cartões`}.` : "Cada aprendizado novo vira um cartão no dia seguinte."}
        </p>
      </div>
    );
  }

  const { deixa, pergunta } = frenteDoCartao(cartao);
  const decidir = (lembrou: boolean) => {
    onResponder(cartao.id, lembrou);
    setFeitos((n) => n + 1);
    if (lembrou) setAcertos((n) => n + 1);
    setVirado(false);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden" data-testid="revisao-do-dia">
      <div className="bg-indigo-200 dark:bg-indigo-800/60 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Brain className="w-4 h-4" /> Revisar hoje</span>
        <span className="text-[11px] font-bold tabular-nums">{feitos + 1} de {total}</span>
      </div>
      <div className="bg-indigo-50/80 dark:bg-indigo-950/20 p-4 space-y-3">
        {deixa && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{deixa}</p>}
        <p className="text-base font-semibold leading-snug">{pergunta}</p>

        {!virado ? (
          <button
            type="button"
            onClick={() => setVirado(true)}
            className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 active:scale-[0.99] transition-transform"
          >
            Mostrar resposta
          </button>
        ) : (
          <div className="space-y-3" data-testid="verso">
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-sm whitespace-pre-wrap break-words">{cartao.aprendi}</p>
              {cartao.porque && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words mt-1">
                  <span className="font-semibold">Por quê:</span> {cartao.porque}
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Bateu com o que você explicaria pra um amigo? Responde com honestidade: é assim que o cartão volta na hora certa.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => decidir(false)}
                className="rounded-lg border border-border bg-card text-sm font-semibold py-2.5 flex items-center justify-center gap-1.5 hover:bg-muted/50">
                <RotateCcw className="w-3.5 h-3.5" /> Não lembrei
              </button>
              <button type="button" onClick={() => decidir(true)}
                className="rounded-lg bg-green-600 text-white text-sm font-semibold py-2.5 flex items-center justify-center gap-1.5 hover:bg-green-700">
                <Check className="w-3.5 h-3.5" /> Lembrei
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
