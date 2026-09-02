/**
 * BLOCO DE FASES — contadores do dia + fechamento de semana e mês.
 *
 * Nasceu dentro da Carreira ("Meu Dia") e virou componente por um pedido
 * escrito, avaliação 5★ de 01/09:
 *
 *   "no plano de carreira na primeira página tem fases de hoje / fechamentos
 *    da semana e mês, gostaria da mesma página na rotina para acompanhar a
 *    evolução diária também de anotações de como foi o mês baseado no que
 *    marcamos com o toque do lápis para reorganizarmos, e a quantidade de
 *    vezes que fizemos aquilo no dia consequentemente"
 *
 * A extração foi barata porque o tipo já tinha nascido neutro: `WorkPhase` é
 * { id, nome, memo, counts } — não há uma linha de carreira dentro dele, e
 * `counts` sempre foi por dia (localDayKey). O que era específico morava só
 * nas STRINGS (nome das fases padrão, "tarefa do trabalho") e nas CHAVES de
 * armazenamento. As duas coisas viraram props.
 *
 * CHAVES SEPARADAS por instância, de propósito. Carreira e Rotina contam
 * coisas diferentes ("Follow-up" x "Beber água"), e juntar os dois baldes
 * misturaria o fechamento do mês de quem usa os dois módulos — que é
 * justamente a pessoa que pediu.
 */
import { useState } from "react";
import { localDayKey, semanaAtualId, parseLocalDay } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, Trash2, Edit2, BookMarked, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const genId = () => crypto.randomUUID();

/** `counts` é por dia (localDayKey) — o fechamento do mês soma as chaves do mês. */
export type Fase = { id: string; nome: string; memo: string; counts: Record<string, number> };
export type TarefaDoDia = { id: string; texto: string; feito: boolean; dia: string };

export interface BlocoDeFasesProps {
  /** Chave de armazenamento das fases (ex.: "career-day-phases"). */
  chaveFases: string;
  /** Chave de armazenamento das tarefas (ex.: "career-day-tasks"). */
  chaveTarefas: string;
  /** Fases sugeridas na primeira abertura — o vocabulário do módulo. */
  fasesPadrao: Fase[];
  /** Título da caixa de contadores. */
  tituloFases?: string;
  /** Frase da lista vazia de fases. */
  vazioFases?: string;
  /** Placeholder do campo de nova tarefa. */
  placeholderTarefa?: string;
}

export const BlocoDeFases = ({
  chaveFases,
  chaveTarefas,
  fasesPadrao,
  tituloFases = "🔁 FASES DE HOJE",
  vazioFases = "Crie as fases do seu dia — cada uma vira um contador.",
  placeholderTarefa = "Nova tarefa...",
}: BlocoDeFasesProps) => {
  const [phases, setPhases] = usePersistedState<Fase[]>(chaveFases, fasesPadrao);
  const [tasks, setTasks] = usePersistedState<TarefaDoDia[]>(chaveTarefas, []);
  const [novaFase, setNovaFase] = useState("");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [memoAberto, setMemoAberto] = useState<string | null>(null);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [mesOffset, setMesOffset] = useState(0);

  const hoje = localDayKey();
  const tarefasHoje = tasks.filter(t => t.dia === hoje);
  const feitasHoje = tarefasHoje.filter(t => t.feito).length;

  const contar = (id: string, delta: number) => setPhases(prev => prev.map(f => {
    if (f.id !== id) return f;
    const atual = f.counts[hoje] ?? 0;
    return { ...f, counts: { ...f.counts, [hoje]: Math.max(0, atual + delta) } };
  }));

  const addFase = () => {
    if (!novaFase.trim()) return;
    setPhases(prev => [...prev, { id: genId(), nome: novaFase.trim(), memo: "", counts: {} }]);
    setNovaFase("");
  };

  const addTarefa = () => {
    if (!novaTarefa.trim()) return;
    setTasks(prev => [...prev, { id: genId(), texto: novaTarefa.trim(), feito: false, dia: hoje }]);
    setNovaTarefa("");
  };

  // Fechamento da semana: soma os contadores de cada fase nos 7 dias da semana
  // escolhida (segunda→domingo, mesma âncora dos hábitos — semanaAtualId).
  const segundaBase = parseLocalDay(semanaAtualId());
  segundaBase.setDate(segundaBase.getDate() + semanaOffset * 7);
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(segundaBase);
    d.setDate(segundaBase.getDate() + i);
    return localDayKey(d);
  });
  const setDiasSemana = new Set(diasDaSemana);
  const totalDaFaseSemana = (f: Fase) => Object.entries(f.counts)
    .filter(([dia]) => setDiasSemana.has(dia))
    .reduce((s, [, n]) => s + n, 0);
  const tarefasDaSemana = tasks.filter(t => setDiasSemana.has(t.dia) && t.feito).length;
  const fmtDia = (k: string) => parseLocalDay(k).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const nomeSemana = `${fmtDia(diasDaSemana[0])} – ${fmtDia(diasDaSemana[6])}`;

  // Fechamento do mês: soma os contadores de cada fase no mês escolhido.
  const refMes = new Date();
  refMes.setDate(1);
  refMes.setMonth(refMes.getMonth() + mesOffset);
  const prefixoMes = `${refMes.getFullYear()}-${String(refMes.getMonth() + 1).padStart(2, "0")}`;
  const totalDaFase = (f: Fase) => Object.entries(f.counts)
    .filter(([dia]) => dia.startsWith(prefixoMes))
    .reduce((s, [, n]) => s + n, 0);
  const tarefasDoMes = tasks.filter(t => t.dia.startsWith(prefixoMes) && t.feito).length;
  const nomeMes = refMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Fases do dia */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-teal-200 dark:bg-teal-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">{tituloFases}</span>
          <span className="text-[9px] text-muted-foreground">toque no lápis pra renomear</span>
        </div>
        <div className="bg-teal-50 dark:bg-teal-950/20 p-3 space-y-2">
          {phases.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">{vazioFases}</p>
          )}
          {phases.map(f => (
            <div key={f.id} className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                {editId === f.id ? (
                  <Input autoFocus value={f.nome} className="h-8 text-sm"
                    onChange={e => setPhases(prev => prev.map(p => p.id === f.id ? { ...p, nome: e.target.value } : p))}
                    onBlur={() => setEditId(null)}
                    onKeyDown={e => e.key === "Enter" && setEditId(null)} />
                ) : (
                  <span className="flex-1 text-sm font-medium truncate">{f.nome}</span>
                )}
                <button onClick={() => setEditId(f.id)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Renomear fase">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setMemoAberto(memoAberto === f.id ? null : f.id)}
                  className={`p-1 ${f.memo ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`} aria-label="Memorando">
                  <BookMarked className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPhases(prev => prev.filter(p => p.id !== f.id))}
                  className="text-muted-foreground hover:text-destructive p-1" aria-label="Apagar fase">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-full text-lg" onClick={() => contar(f.id, -1)}>−</Button>
                <span className="text-2xl font-black tabular-nums w-12 text-center">{f.counts[hoje] ?? 0}</span>
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-full text-lg" onClick={() => contar(f.id, 1)}>+</Button>
              </div>
              {memoAberto === f.id && (
                <Textarea placeholder="Memorando — dúvidas, combinados, o que ficou pendente..."
                  value={f.memo} className="text-xs min-h-[60px]"
                  onChange={e => setPhases(prev => prev.map(p => p.id === f.id ? { ...p, memo: e.target.value } : p))} />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input placeholder="Nova fase..." value={novaFase} onChange={e => setNovaFase(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFase()} className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={addFase} aria-label="Adicionar fase"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* Tarefas de hoje */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-sky-200 dark:bg-sky-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">✅ TAREFAS DE HOJE</span>
          <span className="text-[9px] text-muted-foreground">{feitasHoje}/{tarefasHoje.length}</span>
        </div>
        <div className="bg-sky-50 dark:bg-sky-950/20 p-3 space-y-1.5">
          {tarefasHoje.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma tarefa hoje ainda.</p>
          )}
          {tarefasHoje.map(t => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg bg-card border border-border px-2.5 py-2">
              <Checkbox checked={t.feito}
                onCheckedChange={v => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, feito: !!v } : x))} />
              <span className={`flex-1 text-sm ${t.feito ? "line-through text-muted-foreground" : ""}`}>{t.texto}</span>
              <button onClick={() => setTasks(prev => prev.filter(x => x.id !== t.id))}
                className="text-muted-foreground hover:text-destructive" aria-label="Apagar tarefa">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input placeholder={placeholderTarefa} value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTarefa()} className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={addTarefa} aria-label="Adicionar tarefa"><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* Fechamento da semana */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-emerald-200 dark:bg-emerald-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">📈 FECHAMENTO DA SEMANA</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setSemanaOffset(s => s - 1)} className="p-0.5 hover:bg-background/50 rounded" aria-label="Semana anterior">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] font-medium min-w-[84px] text-center tabular-nums">{nomeSemana}</span>
            <button onClick={() => setSemanaOffset(s => Math.min(0, s + 1))} disabled={semanaOffset >= 0}
              className="p-0.5 hover:bg-background/50 rounded disabled:opacity-30" aria-label="Próxima semana">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-1.5">
          {phases.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Crie fases pra ver o total da semana.</p>
          )}
          {phases.map(f => (
            <div key={f.id} className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2">
              <span className="text-xs truncate">{f.nome}</span>
              <span className="text-sm font-bold tabular-nums">{totalDaFaseSemana(f)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Tarefas concluídas</span>
            <span className="text-sm font-bold tabular-nums">{tarefasDaSemana}</span>
          </div>
        </div>
      </div>

      {/* Fechamento do mês */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-violet-200 dark:bg-violet-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">📊 FECHAMENTO DO MÊS</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setMesOffset(m => m - 1)} className="p-0.5 hover:bg-background/50 rounded" aria-label="Mês anterior">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] font-medium capitalize min-w-[76px] text-center">{nomeMes}</span>
            <button onClick={() => setMesOffset(m => Math.min(0, m + 1))} disabled={mesOffset >= 0}
              className="p-0.5 hover:bg-background/50 rounded disabled:opacity-30" aria-label="Próximo mês">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="bg-violet-50 dark:bg-violet-950/20 p-3 space-y-1.5">
          {phases.map(f => (
            <div key={f.id} className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2">
              <span className="text-xs truncate">{f.nome}</span>
              <span className="text-sm font-bold tabular-nums">{totalDaFase(f)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">Tarefas concluídas</span>
            <span className="text-sm font-bold tabular-nums">{tarefasDoMes}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
