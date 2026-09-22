import { useNavigate } from "react-router-dom";
import { ListChecks, ChevronRight } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Checkbox } from "@/components/ui/checkbox";
import { localDayKey } from "@/lib/utils";

/**
 * TAREFAS DE HOJE na Home (22/09). Chamado marcado como erro: "as tarefas
 * criadas em CARREIRA - ROTINA - CASA, qualquer lugar, não aparecem no
 * dashboard inicial :(". Não era bug — nenhum widget juntava as listas dos
 * módulos. Este junta, LENDO as mesmas chaves que cada tela grava, e o ✓
 * aqui escreve de volta na chave de origem (uma fonte de verdade por lista).
 *
 * Quem entra: Rotina (Urgências, Foco → tarefas, Meu dia → tarefas do dia),
 * Carreira (Meu dia) e Casa (tarefas da rotação e a limpeza diária). Vem no
 * seletor de widgets, opcional — a Home de ninguém muda sozinha.
 */

type Todo = { id: string; text: string; priority?: "alta" | "media" | "baixa"; done: boolean; dueDate?: string };
type TarefaDoDia = { id: string; texto: string; feito: boolean; dia: string };
type Urgencia = { id: string; text: string; done: boolean };
type Chore = { id: string; name: string; currentTurnIndex: number; lastRotation: string; done: boolean };
type Member = { id: string; name: string; emoji: string };
type CleaningSection = { id: string; name: string; color: string; items: { id: string; text: string; done: boolean }[] };

type Linha = {
  key: string;
  origem: "Rotina" | "Carreira" | "Casa";
  texto: string;
  feito: boolean;
  /** só leitura: tocar leva ao módulo (rotação da casa muda de dono, não "fica feita") */
  rota?: string;
  detalhe?: string;
  toggle?: () => void;
};

const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const TasksWidget = () => {
  const navigate = useNavigate();
  const hoje = localDayKey();
  const [todos, setTodos] = usePersistedState<Todo[]>("todo-list", []);
  const [rotinaDia, setRotinaDia] = usePersistedState<TarefaDoDia[]>("rotina-day-tasks", []);
  const [urgencias, setUrgencias] = usePersistedState<Urgencia[]>("rotina-urgencies", []);
  const [carreiraDia, setCarreiraDia] = usePersistedState<TarefaDoDia[]>("career-day-tasks", []);
  const [chores] = usePersistedState<Chore[]>("casa-chores", []);
  const [members] = usePersistedState<Member[]>("casa-members", []);
  const [limpeza, setLimpeza] = usePersistedState<CleaningSection[]>("casa-cleaning-routine", []);

  const linhas: Linha[] = [];

  lista<Urgencia>(urgencias).forEach((u) => linhas.push({
    key: `u-${u.id}`, origem: "Rotina", texto: u.text, feito: !!u.done, detalhe: "urgência",
    toggle: () => setUrgencias((prev) => lista<Urgencia>(prev).map((x) => (x.id === u.id ? { ...x, done: !x.done } : x))),
  }));

  // Foco → tarefas: as com prazo até hoje (vencidas primeiro), depois as sem prazo
  const comPrazo = lista<Todo>(todos).filter((t) => t?.dueDate && t.dueDate <= hoje);
  const semPrazo = lista<Todo>(todos).filter((t) => !t?.dueDate);
  [...comPrazo, ...semPrazo].forEach((t) => linhas.push({
    key: `t-${t.id}`, origem: "Rotina", texto: t.text, feito: !!t.done,
    detalhe: t.dueDate && t.dueDate < hoje ? "atrasada" : t.priority === "alta" ? "alta" : undefined,
    toggle: () => setTodos((prev) => lista<Todo>(prev).map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))),
  }));

  lista<TarefaDoDia>(rotinaDia).filter((t) => t?.dia === hoje).forEach((t) => linhas.push({
    key: `rd-${t.id}`, origem: "Rotina", texto: t.texto, feito: !!t.feito, detalhe: "meu dia",
    toggle: () => setRotinaDia((prev) => lista<TarefaDoDia>(prev).map((x) => (x.id === t.id ? { ...x, feito: !x.feito } : x))),
  }));

  lista<TarefaDoDia>(carreiraDia).filter((t) => t?.dia === hoje).forEach((t) => linhas.push({
    key: `cd-${t.id}`, origem: "Carreira", texto: t.texto, feito: !!t.feito, detalhe: "trabalho",
    toggle: () => setCarreiraDia((prev) => lista<TarefaDoDia>(prev).map((x) => (x.id === t.id ? { ...x, feito: !x.feito } : x))),
  }));

  const membros = lista<Member>(members);
  lista<Chore>(chores).forEach((c) => {
    const vez = membros.length ? membros[c.currentTurnIndex % membros.length] : null;
    linhas.push({ key: `ch-${c.id}`, origem: "Casa", texto: c.name, feito: false, detalhe: vez ? `vez de ${vez.name}` : undefined, rota: "/casa" });
  });

  lista<CleaningSection>(limpeza)
    .filter((s) => /di[aá]ri/i.test(String(s?.name ?? "")))
    .forEach((s) => lista<CleaningSection["items"][number]>(s.items).forEach((it) => linhas.push({
      key: `cl-${s.id}-${it.id}`, origem: "Casa", texto: it.text, feito: !!it.done, detalhe: "limpeza diária",
      toggle: () => setLimpeza((prev) => lista<CleaningSection>(prev).map((sec) => (sec.id !== s.id ? sec : {
        ...sec, items: lista<CleaningSection["items"][number]>(sec.items).map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)),
      }))),
    })));

  const pendentes = linhas.filter((l) => !l.feito);
  const feitas = linhas.filter((l) => l.feito);
  const mostrar = pendentes.slice(0, 8);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm" data-testid="tasks-widget">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Tarefas de hoje
        </h4>
        {linhas.length > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {feitas.length}/{linhas.length}
          </span>
        )}
      </div>

      {linhas.length === 0 ? (
        <button type="button" onClick={() => navigate("/rotina")} className="text-left text-xs text-muted-foreground" data-testid="tasks-vazio">
          Nada por aqui ainda. O que você criar em <span className="font-medium text-foreground">Rotina</span> (urgências, tarefas, meu dia),{" "}
          <span className="font-medium text-foreground">Carreira</span> (meu dia) e <span className="font-medium text-foreground">Casa</span> aparece nesta lista.
        </button>
      ) : (
        <div className="space-y-1">
          {mostrar.map((l) => (
            <div key={l.key} className="flex items-center gap-2.5 py-1">
              {l.toggle ? (
                <Checkbox checked={false} onCheckedChange={l.toggle} className="h-4 w-4" aria-label={`Concluir ${l.texto}`} />
              ) : (
                <span className="w-4 h-4 rounded border border-border/70 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => (l.rota ? navigate(l.rota) : l.toggle?.())}
                className="flex-1 min-w-0 text-left"
              >
                <span className="block text-xs font-medium truncate">{l.texto}</span>
                <span className="block text-[10px] text-muted-foreground truncate">
                  {l.origem}{l.detalhe ? ` · ${l.detalhe}` : ""}
                </span>
              </button>
              {l.rota && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </div>
          ))}
          {pendentes.length > mostrar.length && (
            <button type="button" onClick={() => navigate("/rotina")} className="text-[11px] text-muted-foreground pt-1">
              + {pendentes.length - mostrar.length} pendentes · abrir Rotina
            </button>
          )}
          {pendentes.length === 0 && (
            <p className="text-xs text-muted-foreground">Tudo feito por hoje ✓</p>
          )}
        </div>
      )}
    </div>
  );
};
