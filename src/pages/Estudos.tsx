import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import {
  ArrowLeft, Plus, X, Trash2, Check, GraduationCap, BookOpen,
  Clock, ArrowRight, FileText, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ──
interface Course { id: string; name: string; link?: string; }
interface ContentRow { id: string; name: string; leitura: boolean; resumo: boolean; }
interface Exam { id: string; title: string; date: string; time: string; color: string; done: boolean; }
interface Notebook {
  id: string; date: string; curso: string; materia: string;
  resumo: string; planoLeitura: string; duvidas: string; frases: string;
}

// ── Constants ──
const weekDays = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"];
const allDays = [...weekDays, "FINAL DE SEMANA"];

const dayTopBorder: Record<string, string> = {
  SEGUNDA: "border-t-4 border-t-pink-400",
  TERÇA: "border-t-4 border-t-yellow-400",
  QUARTA: "border-t-4 border-t-sky-400",
  QUINTA: "border-t-4 border-t-green-400",
  SEXTA: "border-t-4 border-t-orange-400",
  "FINAL DE SEMANA": "",
};

const dayBg: Record<string, string> = {
  "FINAL DE SEMANA": "bg-indigo-100 dark:bg-indigo-900/30",
};

const examColors = [
  "border-l-4 border-l-pink-400 bg-pink-50 dark:bg-pink-950/20",
  "border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
  "border-l-4 border-l-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
  "border-l-4 border-l-green-400 bg-green-50 dark:bg-green-950/20",
  "border-l-4 border-l-purple-400 bg-purple-50 dark:bg-purple-950/20",
];

const defaultScheduleHours = ["7h30", "8h", "9h", "10h", "11h", "12h", "13h", "14h"];
const hourBadgeColors = [
  "bg-pink-200 dark:bg-pink-800/40",
  "bg-indigo-200 dark:bg-indigo-800/40",
  "bg-purple-200 dark:bg-purple-800/40",
  "bg-yellow-200 dark:bg-yellow-800/40",
  "bg-green-200 dark:bg-green-800/40",
  "bg-sky-200 dark:bg-sky-800/40",
  "bg-orange-200 dark:bg-orange-800/40",
  "bg-rose-200 dark:bg-rose-800/40",
];

const TABS = [
  { v: "estudos", l: "Estudos", icon: "📝" },
  { v: "grade", l: "Grade", icon: "🎓" },
  { v: "tarefas", l: "Tarefas", icon: "✅" },
  { v: "caderno", l: "Caderno", icon: "📓" },
  { v: "pomodoro", l: "Pomodoro", icon: "🍅" },
];

const Estudos = () => {
  const navigate = useNavigate();

  // CURSOS
  const [cursosAndamento, setCursosAndamento] = usePersistedState<Course[]>("estudos-cursos-andamento", []);
  const [cursosDesejo, setCursosDesejo] = usePersistedState<Course[]>("estudos-cursos-desejo", []);
  const [newCursoAndamento, setNewCursoAndamento] = useState("");
  const [newCursoDesejo, setNewCursoDesejo] = useState("");
  const [newCursoDesejoLink, setNewCursoDesejoLink] = useState("");

  // CONTEÚDO TRACKER
  const [subjects, setSubjects] = usePersistedState<ContentRow[]>("estudos-subjects", []);
  const [newSubject, setNewSubject] = useState("");

  // PROVAS E ENTREGAS
  const [exams, setExams] = usePersistedState<Exam[]>("estudos-exams", []);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [newExamTime, setNewExamTime] = useState("");

  // GRADE HORÁRIA
  const [scheduleName, setScheduleName] = usePersistedState("estudos-schedule-name", "GRADE FACULDADE");
  const [schedule, setSchedule] = usePersistedState<Record<string, Record<string, string>>>("estudos-schedule",
    Object.fromEntries(defaultScheduleHours.map(h => [h, Object.fromEntries(weekDays.map(d => [d, ""]))]))
  );
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editCellValue, setEditCellValue] = useState("");

  // TAREFAS DA SEMANA
  const [weekTasks, setWeekTasks] = usePersistedState<Record<string, { text: string; done: boolean }[]>>("estudos-week-tasks",
    Object.fromEntries(allDays.map(d => [d, []]))
  );
  const [newWeekTask, setNewWeekTask] = useState<Record<string, string>>({});

  // CADERNO
  const [notebooks, setNotebooks] = usePersistedState<Notebook[]>("estudos-notebooks", []);

  // POMODORO
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = usePersistedState("estudos-pomodoro-count", 0);

  useEffect(() => {
    if (!pomodoroRunning || pomodoroTime <= 0) return;
    const t = setTimeout(() => setPomodoroTime(prev => prev - 1), 1000);
    if (pomodoroTime === 1) { setPomodoroRunning(false); setPomodoroCount(pomodoroCount + 1); setPomodoroTime(25 * 60); }
    return () => clearTimeout(t);
  }, [pomodoroRunning, pomodoroTime]);

  const startEditCell = (hour: string, day: string) => {
    setEditingCell(`${hour}-${day}`);
    setEditCellValue(schedule[hour]?.[day] || "");
  };
  const saveCell = (hour: string, day: string) => {
    setSchedule({ ...schedule, [hour]: { ...schedule[hour], [day]: editCellValue } });
    setEditingCell(null);
  };

  const addNotebook = () => {
    setNotebooks([{
      id: Date.now().toString(), date: new Date().toLocaleDateString("pt-BR"),
      curso: "", materia: "", resumo: "", planoLeitura: "", duvidas: "", frases: "",
    }, ...notebooks]);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" /> MEUS ESTUDOS
            </h1>
            <p className="text-[11px] text-muted-foreground">Cursos, grade, provas, tarefas e caderno</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <ModuleTip moduleId="estudos" tips={[
          "Organize cursos em andamento e sua lista de desejos",
          "Monte sua grade horária semanal editável",
          "Registre provas e trabalhos com datas de entrega",
          "Use o caderno para anotar resumos e dúvidas das aulas",
        ]} />

        <Tabs defaultValue="estudos" className="w-full">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full">
              {TABS.map(t => (
                <TabsTrigger key={t.v} value={t.v} className="text-[10px] gap-1 px-2.5">
                  <span>{t.icon}</span> {t.l}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ══════════ ESTUDOS ══════════ */}
          <TabsContent value="estudos" className="space-y-4 mt-4">

            {/* Cursos em Andamento */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-yellow-300 dark:bg-yellow-700/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2">📝 CURSOS EM ANDAMENTO</span>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 divide-y divide-border">
                {cursosAndamento.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 group">
                    <span className="text-sm font-medium">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <button onClick={() => setCursosAndamento(prev => prev.filter(x => x.id !== c.id))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
                {cursosAndamento.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum curso adicionado</div>
                )}
                <div className="px-4 py-2">
                  <div className="flex gap-2">
                    <Input value={newCursoAndamento} onChange={e => setNewCursoAndamento(e.target.value)}
                      placeholder="Adicionar curso..." className="h-8 text-xs rounded-lg"
                      onKeyDown={e => {
                        if (e.key === "Enter" && newCursoAndamento.trim()) {
                          setCursosAndamento(prev => [...prev, { id: Date.now().toString(), name: newCursoAndamento.trim() }]);
                          setNewCursoAndamento("");
                        }
                      }} />
                    <Button size="sm" className="h-8 px-3" onClick={() => {
                      if (newCursoAndamento.trim()) {
                        setCursosAndamento(prev => [...prev, { id: Date.now().toString(), name: newCursoAndamento.trim() }]);
                        setNewCursoAndamento("");
                      }
                    }}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cursos que Desejo */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-sky-300 dark:bg-sky-700/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2">💻 CURSOS QUE DESEJO</span>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/20 divide-y divide-border">
                {cursosDesejo.map(c => (
                  <div key={c.id} className="px-4 py-3 group">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{c.name}</span>
                      <button onClick={() => setCursosDesejo(prev => prev.filter(x => x.id !== c.id))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    {c.link && (
                      <a href={c.link} target="_blank" rel="noopener noreferrer"
                        className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/50 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{c.link}</span>
                      </a>
                    )}
                  </div>
                ))}
                {cursosDesejo.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">Sua lista de desejos de cursos</div>
                )}
                <div className="px-4 py-2 space-y-1.5">
                  <Input value={newCursoDesejo} onChange={e => setNewCursoDesejo(e.target.value)}
                    placeholder="Nome do curso..." className="h-8 text-xs rounded-lg" />
                  <div className="flex gap-2">
                    <Input value={newCursoDesejoLink} onChange={e => setNewCursoDesejoLink(e.target.value)}
                      placeholder="Link (opcional)" className="h-8 text-xs rounded-lg flex-1" />
                    <Button size="sm" className="h-8 px-3" onClick={() => {
                      if (newCursoDesejo.trim()) {
                        setCursosDesejo(prev => [...prev, { id: Date.now().toString(), name: newCursoDesejo.trim(), link: newCursoDesejoLink.trim() || undefined }]);
                        setNewCursoDesejo(""); setNewCursoDesejoLink("");
                      }
                    }}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Conteúdo Tracker Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-stone-300 dark:bg-stone-700/60">
                      <th className="text-left px-3 py-2.5 font-black uppercase tracking-wider text-sm">CONTEÚDO</th>
                      <th className="text-center px-3 py-2.5 font-bold text-sm">Leitura</th>
                      <th className="text-center px-3 py-2.5 font-bold text-sm">Resumo</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-stone-50 dark:bg-stone-950/20">
                    {subjects.map((s, i) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2.5 text-sm font-medium">{s.name}</td>
                        {(["leitura", "resumo"] as const).map(field => (
                          <td key={field} className="text-center px-3 py-2.5">
                            <button onClick={() => { const u = [...subjects]; u[i] = { ...s, [field]: !s[field] }; setSubjects(u); }}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${s[field] ? "bg-blue-500 border-blue-500" : "border-muted-foreground/30"}`}>
                              {s[field] && <Check className="w-3 h-3 text-white" />}
                            </button>
                          </td>
                        ))}
                        <td className="px-2">
                          <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))}
                            className="opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Empty rows for visual consistency */}
                    {Array.from({ length: Math.max(0, 3 - subjects.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-t border-border">
                        <td className="px-3 py-2.5 text-sm text-muted-foreground/30">—</td>
                        <td className="text-center px-3 py-2.5">
                          <div className="w-5 h-5 rounded border-2 border-muted-foreground/20 mx-auto" />
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <div className="w-5 h-5 rounded border-2 border-muted-foreground/20 mx-auto" />
                        </td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-stone-50 dark:bg-stone-950/20 px-3 py-2 border-t border-border">
                <div className="flex gap-2">
                  <Input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                    placeholder="Novo conteúdo..." className="h-8 text-xs rounded-lg"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newSubject.trim()) {
                        setSubjects([...subjects, { id: Date.now().toString(), name: newSubject.trim(), leitura: false, resumo: false }]);
                        setNewSubject("");
                      }
                    }} />
                  <Button size="sm" className="h-8" onClick={() => {
                    if (newSubject.trim()) {
                      setSubjects([...subjects, { id: Date.now().toString(), name: newSubject.trim(), leitura: false, resumo: false }]);
                      setNewSubject("");
                    }
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>

            {/* Provas, Trabalhos e Entregas */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-stone-400 dark:bg-stone-600/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">📝 PROVAS, TRABALHOS E ENTREGAS</span>
              </div>
              <div className="bg-stone-100 dark:bg-stone-950/20 p-4 space-y-2">
                {exams.sort((a, b) => a.date.localeCompare(b.date)).map(ex => (
                  <div key={ex.id} className={`rounded-lg px-4 py-3 ${ex.color} group`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold">{ex.title}</span>
                        <span className="text-sm text-muted-foreground"> - {ex.date ? new Date(ex.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""} {ex.time && `- ${ex.time}`}</span>
                      </div>
                      <button onClick={() => setExams(exams.filter(x => x.id !== ex.id))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
                {exams.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma prova ou entrega registrada</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Input value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} placeholder="Título" className="text-xs h-8 flex-1 rounded-lg" />
                  <Input type="date" value={newExamDate} onChange={e => setNewExamDate(e.target.value)} className="text-xs h-8 w-32 rounded-lg" />
                  <Input value={newExamTime} onChange={e => setNewExamTime(e.target.value)} placeholder="Hora" className="text-xs h-8 w-16 rounded-lg" />
                  <Button size="sm" className="h-8" onClick={() => {
                    if (newExamTitle.trim()) {
                      setExams([...exams, {
                        id: Date.now().toString(), title: newExamTitle.trim(), date: newExamDate, time: newExamTime,
                        color: examColors[exams.length % examColors.length], done: false,
                      }]);
                      setNewExamTitle(""); setNewExamDate(""); setNewExamTime("");
                    }
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ══════════ GRADE HORÁRIA ══════════ */}
          <TabsContent value="grade" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-amber-300 dark:bg-amber-700/60 px-4 py-3 text-center">
                <span className="text-3xl">🧑‍🎓</span>
                <div className="mt-1">
                  <Input value={scheduleName} onChange={e => setScheduleName(e.target.value)}
                    className="text-center text-sm font-black uppercase tracking-wider bg-transparent border-none h-auto p-0 focus-visible:ring-0"
                    placeholder="NOME DA GRADE" />
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-stone-300/50 dark:bg-stone-700/30">
                      <th className="text-left px-2 py-2 font-black uppercase text-[10px] tracking-wider w-16">HORÁRIO</th>
                      {weekDays.map(d => (
                        <th key={d} className="text-left px-2 py-2 font-black uppercase text-[10px] tracking-wider">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(schedule).map((hour, hIdx) => (
                      <tr key={hour} className="border-t border-amber-200 dark:border-amber-800/30">
                        <td className="px-2 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${hourBadgeColors[hIdx % hourBadgeColors.length]}`}>
                            {hour}
                          </span>
                        </td>
                        {weekDays.map(day => {
                          const key = `${hour}-${day}`;
                          const val = schedule[hour]?.[day] || "";
                          const isEditing = editingCell === key;
                          return (
                            <td key={day} className="px-1 py-1">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <Input value={editCellValue} onChange={e => setEditCellValue(e.target.value)}
                                    className="text-[10px] h-6 min-w-[70px] rounded"
                                    onKeyDown={e => e.key === "Enter" && saveCell(hour, day)} autoFocus
                                    onBlur={() => saveCell(hour, day)} />
                                </div>
                              ) : (
                                <div onClick={() => startEditCell(hour, day)}
                                  className={`rounded px-1.5 py-1 text-[10px] min-h-[28px] cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors ${val ? "font-medium" : "text-muted-foreground/30"}`}>
                                  {val || ""}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ══════════ TAREFAS DA SEMANA ══════════ */}
          <TabsContent value="tarefas" className="space-y-4 mt-4">
            {/* Header card */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-stone-300 dark:bg-stone-700/50 px-4 py-4 text-center">
                <h2 className="text-lg font-black uppercase tracking-wider">TAREFAS DA SEMANA</h2>
              </div>
            </div>

            {/* Day cards */}
            {allDays.map(day => {
              const tasks = weekTasks[day] || [];
              const isWeekend = day === "FINAL DE SEMANA";
              return (
                <div key={day} className={`rounded-xl border border-border overflow-hidden ${dayTopBorder[day] || ""} ${isWeekend ? dayBg[day] || "" : ""}`}>
                  <div className="px-4 pt-3 pb-1">
                    <h3 className="text-sm font-black uppercase">{day}</h3>
                  </div>
                  <div className="px-4 pb-3 space-y-2">
                    {tasks.filter(t => t.text).map((task, ti) => (
                      <div key={ti} className="flex items-center gap-2.5 group">
                        <button onClick={() => {
                          const u = { ...weekTasks };
                          u[day] = tasks.map((t, j) => j === ti ? { ...t, done: !t.done } : t);
                          setWeekTasks(u);
                        }} className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${task.done ? "bg-blue-500 border-blue-500" : "border-muted-foreground/30"}`}>
                          {task.done && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
                        <button onClick={() => {
                          const u = { ...weekTasks }; u[day] = tasks.filter((_, j) => j !== ti); setWeekTasks(u);
                        }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    {/* Empty checkbox slots */}
                    {tasks.filter(t => t.text).length < 2 && Array.from({ length: 2 - tasks.filter(t => t.text).length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex items-center gap-2.5">
                        <div className="w-4.5 h-4.5 rounded border-2 border-muted-foreground/20 shrink-0" />
                      </div>
                    ))}
                    <div className="flex gap-1.5 pt-1">
                      <Input value={newWeekTask[day] || ""} onChange={e => setNewWeekTask({ ...newWeekTask, [day]: e.target.value })}
                        placeholder="Nova tarefa..." className="text-xs h-7 rounded-lg"
                        onKeyDown={e => {
                          if (e.key === "Enter" && newWeekTask[day]?.trim()) {
                            setWeekTasks({ ...weekTasks, [day]: [...tasks, { text: newWeekTask[day].trim(), done: false }] });
                            setNewWeekTask({ ...newWeekTask, [day]: "" });
                          }
                        }} />
                      <Button size="sm" className="h-7 px-2" onClick={() => {
                        if (newWeekTask[day]?.trim()) {
                          setWeekTasks({ ...weekTasks, [day]: [...tasks, { text: newWeekTask[day].trim(), done: false }] });
                          setNewWeekTask({ ...newWeekTask, [day]: "" });
                        }
                      }}><Plus className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* ══════════ CADERNO ══════════ */}
          <TabsContent value="caderno" className="space-y-4 mt-4">
            <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={addNotebook}>
              <Plus className="w-3 h-3 mr-1" /> Nova Anotação
            </Button>

            {notebooks.map((n, ni) => {
              const update = (field: keyof Notebook, value: string) => {
                const u = [...notebooks]; u[ni] = { ...n, [field]: value }; setNotebooks(u);
              };
              return (
                <div key={n.id} className="space-y-3">
                  {/* Meta cards */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">Data: {n.date}</p>
                      <button onClick={() => setNotebooks(notebooks.filter(x => x.id !== n.id))}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    <hr className="border-amber-300 dark:border-amber-700" />
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <Input value={n.curso} onChange={e => update("curso", e.target.value)}
                      placeholder="Curso:" className="text-sm font-bold border-none p-0 h-auto focus-visible:ring-0" />
                    <hr className="border-amber-300 dark:border-amber-700 mt-2" />
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <Input value={n.materia} onChange={e => update("materia", e.target.value)}
                      placeholder="Matéria:" className="text-sm font-bold border-none p-0 h-auto focus-visible:ring-0" />
                    <hr className="border-amber-300 dark:border-amber-700 mt-2" />
                  </div>

                  {/* Resumo */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-amber-400 dark:bg-amber-700/60 h-2" />
                    <div className="border-t-4 border-t-stone-800 dark:border-t-stone-300 px-4 pt-3 pb-1">
                      <p className="text-sm font-black">Resumo:</p>
                    </div>
                    <div className="px-4 pb-3">
                      <Textarea value={n.resumo} onChange={e => update("resumo", e.target.value)}
                        placeholder="Escreva o resumo da aula..." className="text-sm border-none p-0 min-h-[60px] focus-visible:ring-0 resize-none" />
                    </div>
                  </div>

                  {/* Plano de Leitura */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-blue-300 dark:bg-blue-700/60 px-4 py-2.5">
                      <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2">📚 PLANO DE LEITURA</span>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-950/20 px-4 py-3">
                      <Textarea value={n.planoLeitura} onChange={e => update("planoLeitura", e.target.value)}
                        placeholder="1. Livro — Autor (Capítulos)&#10;2. ..." className="text-sm border-none p-0 min-h-[60px] focus-visible:ring-0 resize-none bg-transparent" />
                    </div>
                  </div>

                  {/* Dúvidas */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-pink-300 dark:bg-pink-700/60 px-4 py-2.5">
                      <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2">❓ DÚVIDAS</span>
                    </div>
                    <div className="bg-pink-50 dark:bg-pink-950/20 px-4 py-3">
                      <Textarea value={n.duvidas} onChange={e => update("duvidas", e.target.value)}
                        placeholder="• Sua dúvida aqui..." className="text-sm border-none p-0 min-h-[60px] focus-visible:ring-0 resize-none bg-transparent" />
                    </div>
                  </div>

                  {/* Frases e Ideias */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-stone-400 dark:bg-stone-600/60 px-4 py-2.5">
                      <span className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">💡 FRASES E IDEIAS</span>
                    </div>
                    <div className="bg-stone-100 dark:bg-stone-950/20 px-4 py-3">
                      <Textarea value={n.frases} onChange={e => update("frases", e.target.value)}
                        placeholder="Anote frases importantes e ideias..." className="text-sm border-none p-0 min-h-[60px] focus-visible:ring-0 resize-none bg-transparent" />
                    </div>
                  </div>

                  {/* Separator between notebooks */}
                  {ni < notebooks.length - 1 && <hr className="border-border my-4" />}
                </div>
              );
            })}

            {notebooks.length === 0 && (
              <div className="text-center py-10">
                <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Comece a anotar suas aulas 📝</p>
              </div>
            )}
          </TabsContent>

          {/* ══════════ POMODORO ══════════ */}
          <TabsContent value="pomodoro" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-red-300 dark:bg-red-700/60 px-4 py-2.5 text-center">
                <span className="text-sm font-black uppercase tracking-wider">🍅 POMODORO DE ESTUDOS</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 p-6 text-center">
                <div className="w-40 h-40 mx-auto rounded-full border-8 border-red-200 dark:border-red-500/30 flex items-center justify-center mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-black font-mono">
                      {Math.floor(pomodoroTime / 60).toString().padStart(2, "0")}:{(pomodoroTime % 60).toString().padStart(2, "0")}
                    </p>
                    <p className="text-xs text-muted-foreground">minutos</p>
                  </div>
                </div>
                <div className="flex justify-center gap-2 mb-4">
                  {!pomodoroRunning ? (
                    <Button onClick={() => setPomodoroRunning(true)} className="bg-red-500 hover:bg-red-600 text-white">▶ Iniciar</Button>
                  ) : (
                    <Button variant="outline" onClick={() => setPomodoroRunning(false)}>⏸ Pausar</Button>
                  )}
                  <Button variant="ghost" onClick={() => { setPomodoroRunning(false); setPomodoroTime(25 * 60); }}>🔄 Resetar</Button>
                </div>
                <div className="flex justify-center gap-2 mb-4">
                  {[15, 25, 45, 60].map(m => (
                    <button key={m} onClick={() => { setPomodoroRunning(false); setPomodoroTime(m * 60); }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${pomodoroTime === m * 60 && !pomodoroRunning ? "bg-red-500 text-white border-red-500" : "border-border"}`}>
                      {m}min
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">🍅 Pomodoros concluídos: <span className="font-bold">{pomodoroCount}</span></p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Estudos;
