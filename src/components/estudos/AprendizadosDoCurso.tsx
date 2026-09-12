/**
 * O bloco que fica DENTRO da linha de um curso em andamento: progresso em
 * aulas + o registro "O que aprendi".
 *
 * Pedido do dono (09/09): "Não tem como acrescentar o que aprendi no curso.
 * Tipo: aprendi isso, esse slide é bom por causa disso." Então o registro
 * mora no curso — a pessoa está com a aula aberta, toca em "Aprendi hoje" e
 * escreve. O Caderno relê tudo depois (CadernoDeAprendizados).
 *
 * PROGRESSO: até aqui "Aula 12 de 30" era texto livre na nota do curso —
 * ninguém conseguia somar nem mostrar barra. `aulasFeitas`/`aulasTotal`
 * são opcionais no Course: curso antigo sem os campos não ganha barra nem
 * mostra "undefined", e "+1 aula" começa a contar do zero.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Plus } from "lucide-react";
import { EntradaAprendizado, FormularioAprendizado, type RascunhoAprendizado } from "./EntradaAprendizado";
import { maisRecentesPrimeiro, rotuloAprendizados, type Aprendizado } from "./aprendizados";
import { localDayKey } from "@/lib/utils";

const RASCUNHO_VAZIO: RascunhoAprendizado = { referencia: "", aprendi: "", porque: "", pergunta: "" };

export interface ProgressoDoCurso {
  aulasFeitas?: number;
  aulasTotal?: number;
}

/** Barra + "Aula 12 de 30" + "+1 aula". Sem `aulasTotal` a barra some e o
 *  texto vira "12 aulas feitas" (ou nada, se nunca contou). */
export const ProgressoEmAulas = ({ nome, progresso, onAvancar }: {
  nome: string;
  progresso: ProgressoDoCurso;
  onAvancar: () => void;
}) => {
  const feitas = Number(progresso.aulasFeitas) || 0;
  const total = Number(progresso.aulasTotal) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((feitas / total) * 100)) : 0;
  const concluido = total > 0 && feitas >= total;
  const rotulo = total > 0
    ? `Aula ${Math.min(feitas, total)} de ${total}`
    : feitas > 0 ? `${feitas} ${feitas === 1 ? "aula feita" : "aulas feitas"}` : "";

  return (
    <div className="flex items-center gap-2" data-testid="progresso-curso">
      <div className="flex-1 min-w-0">
        {total > 0 && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label={`Progresso de ${nome}`}
            aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(feitas, total)}>
            <div className={`h-full rounded-full transition-all ${concluido ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {rotulo && <p className="text-[10px] text-muted-foreground mt-0.5">{rotulo}{concluido ? " · concluído 🎉" : ""}</p>}
      </div>
      {!concluido && (
        <button type="button" onClick={onAvancar} aria-label={`Marcar mais uma aula de ${nome} como feita`}
          className="h-8 px-2.5 rounded-lg border border-border bg-card text-[11px] font-semibold text-muted-foreground shrink-0 active:scale-[0.98] transition-transform">
          +1 aula
        </button>
      )}
    </div>
  );
};

export const AprendizadosDoCurso = ({ cursoId, nome, progresso, entradas, aberto, onAbrir, onSalvar, onEditar, onApagar, onAvancarAula }: {
  cursoId: string;
  nome: string;
  progresso: ProgressoDoCurso;
  entradas: Aprendizado[];
  aberto: boolean;
  onAbrir: (aberto: boolean) => void;
  onSalvar: (novo: Aprendizado, avancarAula: boolean) => void;
  onEditar: (novo: Aprendizado) => void;
  onApagar: (id: string) => void;
  onAvancarAula: () => void;
}) => {
  const [escrevendo, setEscrevendo] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoAprendizado>(RASCUNHO_VAZIO);
  /** "avançar 1 aula" nasce LIGADO só quando há total de aulas: aí registrar
   *  o aprendizado da aula e marcar a aula como feita é o mesmo gesto. Sem
   *  total, a pessoa nem começou a contar — não inventar contagem por ela. */
  const temTotal = (Number(progresso.aulasTotal) || 0) > 0;
  const [avancar, setAvancar] = useState(temTotal);

  const abrirFormulario = () => {
    setRascunho(RASCUNHO_VAZIO);
    setAvancar(temTotal);
    setEscrevendo(true);
    if (!aberto) onAbrir(true);
  };

  const salvar = () => {
    const aprendi = rascunho.aprendi.trim();
    if (!aprendi) return;
    onSalvar({
      id: Date.now().toString(),
      data: localDayKey(),
      aprendi,
      referencia: rascunho.referencia.trim() || undefined,
      porque: rascunho.porque.trim() || undefined,
      pergunta: rascunho.pergunta.trim() || undefined,
    }, avancar);
    setEscrevendo(false);
    setRascunho(RASCUNHO_VAZIO);
  };

  const lista = maisRecentesPrimeiro(entradas);
  const n = entradas.length;

  return (
    <div className="space-y-2" data-testid={`aprendizados-curso-${cursoId}`}>
      <ProgressoEmAulas nome={nome} progresso={progresso} onAvancar={onAvancarAula} />

      <div className="flex items-center gap-1">
        {/* O contador É o toque que expande: sem um "ver mais" separado que
            ninguém acha. Com zero, o rótulo convida em vez de mostrar "0". */}
        <button type="button" onClick={() => onAbrir(!aberto)} aria-expanded={aberto}
          aria-label={`Aprendizados de ${nome}`}
          className={`min-h-[36px] flex-1 flex items-center gap-1.5 text-left text-xs font-semibold rounded-lg -ml-1 px-1 ${n > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
          <Lightbulb className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{n > 0 ? rotuloAprendizados(n) : "O que aprendi"}</span>
          {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {!escrevendo && (
          <button type="button" onClick={abrirFormulario} aria-label={`Registrar o que aprendi em ${nome}`}
            className="h-8 px-2.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 active:scale-[0.98] transition-transform">
            <Plus className="w-3 h-3" /> Aprendi hoje
          </button>
        )}
      </div>

      {escrevendo && (
        <FormularioAprendizado
          rascunho={rascunho}
          onChange={setRascunho}
          onSalvar={salvar}
          onCancelar={() => { setEscrevendo(false); setRascunho(RASCUNHO_VAZIO); }}
          extra={
            <label className="flex items-center gap-2 text-xs text-muted-foreground min-h-[36px] cursor-pointer">
              <input type="checkbox" checked={avancar} onChange={(e) => setAvancar(e.target.checked)}
                aria-label="Avançar 1 aula" className="w-4 h-4 rounded border-border accent-indigo-600" />
              <span>Avançar 1 aula{temTotal ? ` (vai pra ${Math.min((Number(progresso.aulasFeitas) || 0) + 1, Number(progresso.aulasTotal))} de ${progresso.aulasTotal})` : ""}</span>
            </label>
          }
        />
      )}

      {aberto && (
        <div className="space-y-1.5">
          {lista.map((a) => (
            <EntradaAprendizado key={a.id} entrada={a} onEditar={onEditar} onApagar={() => onApagar(a.id)} />
          ))}
          {n === 0 && !escrevendo && (
            <p className="text-[11px] text-muted-foreground px-1 pb-1">
              Nada registrado ainda. Toque em "Aprendi hoje" depois de cada aula: o que aprendeu, de qual slide, e por que é bom.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
