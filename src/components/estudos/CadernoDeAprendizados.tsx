/**
 * "O QUE APRENDI" na aba Caderno — todos os cursos misturados, com busca e
 * filtro por curso.
 *
 * Por que aqui e não na aba Estudos: a aba Estudos é de GESTÃO (cadastrar
 * curso, prova, conteúdo), e o registro nasce lá, dentro do curso. O Caderno
 * é a única aba de RELEITURA do módulo — é onde a pessoa já vai quando quer
 * rever a aula. Um registro que só se escreve e nunca se relê não vale o
 * toque; esta seção é o que transforma "aprendi isso" em algo que volta.
 *
 * Fica ACIMA das anotações longas de propósito: são frases curtas de muitos
 * dias, o caderno de aula é texto longo de um dia. Quem tem os dois vê
 * primeiro o que se consulta rápido.
 */
import { useMemo, useState } from "react";
import { Lightbulb, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EntradaAprendizado } from "./EntradaAprendizado";
import { filtrarAprendizados, misturarCursos, rotuloAprendizados, type Aprendizado, type AprendizadosPorCurso } from "./aprendizados";

export const CadernoDeAprendizados = ({ mapa, cursos, onEditar, onApagar, onIrParaCursos }: {
  mapa: AprendizadosPorCurso;
  /** id → nome dos cursos em andamento (pro filtro e pro rótulo). */
  cursos: { id: string; name: string }[];
  onEditar: (cursoId: string, novo: Aprendizado) => void;
  onApagar: (cursoId: string, id: string) => void;
  /** Vazio → leva pra aba Estudos, onde se registra. */
  onIrParaCursos: () => void;
}) => {
  const [busca, setBusca] = useState("");
  const [cursoFiltro, setCursoFiltro] = useState<string | null>(null);

  const nomes = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c.name])), [cursos]);
  const todos = useMemo(() => misturarCursos(mapa, nomes), [mapa, nomes]);
  const visiveis = useMemo(() => filtrarAprendizados(todos, busca, cursoFiltro), [todos, busca, cursoFiltro]);

  /** Só cursos que TÊM aprendizado viram chip — chip que filtra pra lista
   *  vazia é chip inútil. Curso removido entra como chip também. */
  const chips = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const a of todos) if (!vistos.has(a.cursoId)) vistos.set(a.cursoId, a.cursoNome);
    return [...vistos.entries()];
  }, [todos]);

  return (
    <div className="rounded-xl border border-border overflow-hidden" data-testid="caderno-aprendizados">
      <div className="bg-indigo-300 dark:bg-indigo-700/60 px-4 py-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Lightbulb className="w-4 h-4" /> O QUE APRENDI</span>
        {todos.length > 0 && <span className="text-[11px] font-semibold">{rotuloAprendizados(todos.length)}</span>}
      </div>
      <div className="bg-indigo-50 dark:bg-indigo-950/20 px-3 py-3 space-y-2.5">
        {todos.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Cada aula deixa algo. Registre no curso: o que aprendeu, de qual slide, e por que é bom — aqui você relê tudo.
            </p>
            <button type="button" onClick={onIrParaCursos}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold active:scale-[0.98] transition-transform">
              Ir pros cursos
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no que aprendi..." aria-label="Buscar aprendizados"
                className="pl-8 h-9 text-xs rounded-lg bg-card" />
            </div>
            {chips.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setCursoFiltro(null)} aria-pressed={cursoFiltro === null}
                  className={`min-h-[32px] px-2.5 rounded-full border text-[11px] font-semibold transition-colors ${cursoFiltro === null ? "bg-indigo-600 border-indigo-600 text-white" : "border-border bg-card text-muted-foreground"}`}>
                  Todos
                </button>
                {chips.map(([id, nome]) => (
                  <button key={id} type="button" onClick={() => setCursoFiltro(cursoFiltro === id ? null : id)} aria-pressed={cursoFiltro === id}
                    className={`min-h-[32px] px-2.5 rounded-full border text-[11px] font-semibold transition-colors ${cursoFiltro === id ? "bg-indigo-600 border-indigo-600 text-white" : "border-border bg-card text-muted-foreground"}`}>
                    {nome}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {visiveis.map((a) => (
                <EntradaAprendizado key={`${a.cursoId}-${a.id}`} entrada={a} cursoNome={a.cursoNome}
                  onEditar={(novo) => onEditar(a.cursoId, novo)} onApagar={() => onApagar(a.cursoId, a.id)} />
              ))}
              {visiveis.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Nada com "{busca.trim()}"{cursoFiltro ? " neste curso" : ""}.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
