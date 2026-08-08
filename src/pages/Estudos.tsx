import { useState, useEffect, useMemo } from "react";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { parseLocalDay } from "@/lib/utils";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft, Plus, X, Trash2, Check, GraduationCap, BookOpen,
  Clock, ArrowRight, FileText, ExternalLink, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Textarea } from "@/components/ui/textarea";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";


// ── Types ──
/** `link` e `notes` são OPCIONAIS de propósito: já existe curso salvo de gente
 *  de verdade sem esses campos. Campo novo nunca pode ser obrigatório aqui —
 *  quem já tinha lista continua abrindo a lista igual. */
interface Course { id: string; name: string; link?: string; notes?: string; }
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

/** Sábado é COLUNA da grade, não o "FINAL DE SEMANA" das tarefas (aquele é
 *  outro dado, outra aba). Só aparece se a pessoa pedir — quem estuda de
 *  segunda a sexta não merece uma coluna vazia espremendo a tabela no celular. */
const SABADO = "SÁBADO";
const scheduleDays = [...weekDays, SABADO];

/** "7h30" → 450 minutos. Aceita "8h", "19:30", "19". O que não parece horário
 *  ("noite", "EAD") devolve null: vai pro fim da tabela, mas NUNCA some — é
 *  texto que o usuário digitou e a grade agora aceita horário livre. */
const horaEmMinutos = (h: string): number | null => {
  const m = h.trim().match(/^(\d{1,2})\s*[h:]?\s*(\d{1,2})?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2] || 0);
};

/** Link colado sem protocolo ("coursera.org/x") vira caminho RELATIVO e o
 *  clique jogava a pessoa pra dentro do próprio app numa rota inexistente. */
const normalizarLink = (v: string): string | undefined => {
  const t = (v || "").trim();
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
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
  const reportTab = useTabReporter();
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // CURSOS
  const [cursosAndamento, setCursosAndamento] = usePersistedState<Course[]>("estudos-cursos-andamento", []);
  const [cursosDesejo, setCursosDesejo] = usePersistedState<Course[]>("estudos-cursos-desejo", []);
  const [newCursoAndamento, setNewCursoAndamento] = useState("");
  const [newCursoAndamentoLink, setNewCursoAndamentoLink] = useState("");
  const [newCursoDesejo, setNewCursoDesejo] = useState("");
  const [newCursoDesejoLink, setNewCursoDesejoLink] = useState("");
  /** Qual curso está com o painel de link+anotações aberto (o ícone de papel). */
  const [cursoAberto, setCursoAberto] = useState<string | null>(null);

  // CONTEÚDO TRACKER
  const [subjects, setSubjects] = usePersistedState<ContentRow[]>("estudos-subjects", []);
  const [newSubject, setNewSubject] = useState("");
  const [subjectEditId, setSubjectEditId] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState("");

  // PROVAS E ENTREGAS
  const [exams, setExams] = usePersistedState<Exam[]>("estudos-exams", []);
  const [newExamTitle, setNewExamTitle] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [newExamTime, setNewExamTime] = useState("");
  const [examEditId, setExamEditId] = useState<string | null>(null);
  const [examDraft, setExamDraft] = useState({ title: "", date: "", time: "" });

  // GRADE HORÁRIA
  // FORMATO PRESERVADO de propósito: continua `Record<hora, Record<dia, texto>>`
  // na MESMA chave "estudos-schedule". Tudo que a grade ganhou (horário livre,
  // sábado, mover matéria) cabe nesse shape — linha nova é chave nova, sábado é
  // coluna nova dentro da linha. Zero migração, zero risco pra quem já digitou
  // a grade inteira. Quem tem só de SEGUNDA a SEXTA lê `[SABADO]` como
  // undefined e o `|| ""` resolve.
  const [scheduleName, setScheduleName] = usePersistedState("estudos-schedule-name", "GRADE FACULDADE");
  const [schedule, setSchedule] = usePersistedState<Record<string, Record<string, string>>>("estudos-schedule",
    Object.fromEntries(defaultScheduleHours.map(h => [h, Object.fromEntries(weekDays.map(d => [d, ""]))]))
  );
  /** Chave NOVA (aditiva, default false): só liga/desliga a coluna de sábado. */
  const [gradeSabado, setGradeSabado] = usePersistedState("estudos-grade-sabado", false);
  const [novoHorario, setNovoHorario] = useState("");
  const [erroHorario, setErroHorario] = useState("");
  const [horaEditando, setHoraEditando] = useState<string | null>(null);
  const [horaRascunho, setHoraRascunho] = useState("");
  const [horaParaApagar, setHoraParaApagar] = useState<string | null>(null);
  /** Célula aberta no editor. Guarda origem (hour/day) e DESTINO (paraHora/
   *  paraDia) — é o que transforma "editar" em "mover" sem drag-and-drop. */
  const [celula, setCelula] = useState<{ hour: string; day: string; texto: string; paraHora: string; paraDia: string } | null>(null);

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

  // ── CURSOS EM ANDAMENTO ──
  /** O link entra JUNTO com o curso: a seta da lista só existe se houver link,
   *  e até aqui o formulário nem perguntava — por isso a seta era enfeite. */
  const addCursoAndamento = () => {
    const nome = newCursoAndamento.trim();
    if (!nome) return;
    setCursosAndamento(prev => [...prev, { id: Date.now().toString(), name: nome, link: normalizarLink(newCursoAndamentoLink) }]);
    setNewCursoAndamento(""); setNewCursoAndamentoLink("");
  };
  const atualizarCurso = (id: string, campo: "link" | "notes", valor: string) =>
    setCursosAndamento(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));

  // ── GRADE: linhas de horário ──
  // A grade é livre agora, então a pessoa pode criar "19h30" depois do "7h30".
  // Ordenar na EXIBIÇÃO (e não na gravação) põe a aula da noite no fim sem
  // mexer no que está salvo.
  const horarios = useMemo(() => (
    Object.keys(schedule)
      .map((h, i) => ({ h, i, min: horaEmMinutos(h) }))
      .sort((a, b) => {
        if (a.min === null && b.min === null) return a.i - b.i;
        if (a.min === null) return 1;
        if (b.min === null) return -1;
        return a.min - b.min || a.i - b.i;
      })
      .map(x => x.h)
  ), [schedule]);

  const temAulaNoSabado = useMemo(
    () => Object.values(schedule).some(linha => (linha?.[SABADO] || "").trim() !== ""),
    [schedule]
  );
  // Nunca esconder dado digitado: se já existe aula no sábado, a coluna aparece
  // mesmo com o botão desligado (ex.: grade importada de outro aparelho).
  const mostrarSabado = gradeSabado || temAulaNoSabado;
  const gradeDays = mostrarSabado ? scheduleDays : weekDays;

  const adicionarHorario = () => {
    const h = novoHorario.trim();
    if (!h) return;
    if (schedule[h]) { setErroHorario(`"${h}" já está na grade`); return; }
    // Linha nova nasce com TODOS os dias (sábado incluso) pra não depender de
    // quando a coluna foi ligada.
    setSchedule({ ...schedule, [h]: Object.fromEntries(scheduleDays.map(d => [d, ""])) });
    setNovoHorario(""); setErroHorario("");
  };

  const removerHorario = (hour: string) => {
    const next = { ...schedule };
    delete next[hour];
    setSchedule(next);
    setHoraParaApagar(null);
  };

  const renomearHorario = (antigo: string) => {
    const nome = horaRascunho.trim();
    setHoraEditando(null);
    if (!nome || nome === antigo) return;
    if (schedule[nome]) return; // renomear pra um horário existente fundiria as duas linhas e comeria aula
    // Reconstrói preservando a ordem de inserção (a exibição reordena depois).
    const next: Record<string, Record<string, string>> = {};
    for (const h of Object.keys(schedule)) next[h === antigo ? nome : h] = schedule[h];
    setSchedule(next);
  };

  // ── GRADE: célula (escrever / mover / apagar) ──
  const abrirCelula = (hour: string, day: string) => {
    setHoraParaApagar(null);
    setCelula({ hour, day, texto: schedule[hour]?.[day] || "", paraHora: hour, paraDia: day });
  };

  const salvarCelula = () => {
    if (!celula) return;
    const { hour, day, paraHora, paraDia } = celula;
    const texto = celula.texto.trim();
    const mudouDeLugar = hour !== paraHora || day !== paraDia;
    const next: Record<string, Record<string, string>> = {};
    for (const h of Object.keys(schedule)) next[h] = { ...schedule[h] };
    if (!next[hour]) next[hour] = {};
    if (!next[paraHora]) next[paraHora] = {};
    if (mudouDeLugar) {
      // TROCA em vez de sobrescrever: se o destino já tem aula, ela vem pra
      // origem. Mover jamais pode apagar matéria em silêncio.
      next[hour][day] = next[paraHora][paraDia] || "";
      next[paraHora][paraDia] = texto;
    } else {
      next[hour][day] = texto;
    }
    setSchedule(next);
    setCelula(null);
  };

  const limparCelula = () => {
    if (!celula) return;
    const next: Record<string, Record<string, string>> = {};
    for (const h of Object.keys(schedule)) next[h] = { ...schedule[h] };
    if (next[celula.hour]) next[celula.hour][celula.day] = "";
    setSchedule(next);
    setCelula(null);
  };

  // ── EDIÇÃO INLINE (mesmo padrão do IncomeTable e do caderno aqui embaixo) ──
  const salvarSubject = () => {
    const nome = subjectDraft.trim();
    if (!nome) return;
    setSubjects(subjects.map(s => s.id === subjectEditId ? { ...s, name: nome } : s));
    setSubjectEditId(null);
  };

  const salvarExam = () => {
    const titulo = examDraft.title.trim();
    if (!titulo) return;
    setExams(exams.map(e => e.id === examEditId
      ? { ...e, title: titulo, date: examDraft.date, time: examDraft.time.trim() }
      : e));
    setExamEditId(null);
  };

  const addNotebook = () => {
    setNotebooks([{
      id: Date.now().toString(), date: new Date().toLocaleDateString("pt-BR"),
      curso: "", materia: "", resumo: "", planoLeitura: "", duvidas: "", frases: "",
    }, ...notebooks]);
  };

  const [activeTab, setActiveTab] = useState("estudos");
  useScrollActiveTabIntoView(activeTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SpotlightOverlay
        moduleKey="estudos"
        steps={[
          
          { selector: '[data-spotlight="tab-grade"]', label: "Monte sua grade horária semanal.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-tarefas"]', label: "Registre provas e trabalhos com prazos.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <GraduationCap className="w-5 h-5 text-indigo-600" />
          <h1 className="text-base font-bold tracking-tight">ESTUDOS</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.v}
              data-spotlight={`tab-${tab.v}`}
              onClick={() => handleTabChange(tab.v)}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.v ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.l}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <ModuleTip moduleId="estudos" tips={[
          "Organize cursos em andamento e sua lista de desejos",
          "Monte sua grade horária semanal editável",
          "Registre provas e trabalhos com datas de entrega",
          "Use o caderno para anotar resumos e dúvidas das aulas",
        ]} />

        {activeTab === "estudos" && <div className="space-y-4">

            {/* Cursos em Andamento */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-yellow-300 dark:bg-yellow-700/60 px-4 py-2.5">
                <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2">📝 CURSOS EM ANDAMENTO</span>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 divide-y divide-border">
                {cursosAndamento.map(c => {
                  const aberto = cursoAberto === c.id;
                  const temNota = (c.notes || "").trim() !== "";
                  return (
                    <div key={c.id} className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium flex-1 min-w-0 break-words">{c.name}</span>
                        <div className="flex items-center shrink-0">
                          {/* A seta só existe quando há PRA ONDE ir. Ícone que não
                              faz nada foi exatamente a reclamação da usuária
                              ("essa parte de seta e papel não funciona?"). Sem
                              link cadastrado ela some — quem quiser cadastrar
                              abre o papel do lado. */}
                          {c.link && (
                            <a href={c.link} target="_blank" rel="noopener noreferrer"
                              aria-label={`Abrir ${c.name} em nova aba`}
                              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                          <button onClick={() => setCursoAberto(aberto ? null : c.id)}
                            aria-label={`${aberto ? "Fechar" : "Abrir"} anotações de ${c.name}`}
                            aria-expanded={aberto}
                            className={`h-9 w-9 flex items-center justify-center rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors ${temNota || aberto ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}>
                            <FileText className="w-4 h-4" />
                          </button>
                          {/* Lixeira SEM hover: celular não tem hover, então a
                              ÚNICA ação viva da linha era justamente a invisível. */}
                          <button onClick={() => setCursosAndamento(prev => prev.filter(x => x.id !== c.id))}
                            aria-label={`Excluir ${c.name}`}
                            className="h-9 w-9 flex items-center justify-center rounded-lg">
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>

                      {aberto && (
                        <div className="pb-2 space-y-2">
                          {/* O link também se edita AQUI: curso cadastrado antes
                              desta tela não tinha como ganhar link nenhum. */}
                          <Input value={c.link || ""}
                            onChange={e => atualizarCurso(c.id, "link", e.target.value)}
                            onBlur={e => atualizarCurso(c.id, "link", normalizarLink(e.target.value) || "")}
                            placeholder="Link do curso (opcional)" className="h-9 text-xs rounded-lg" />
                          <Textarea value={c.notes || ""}
                            onChange={e => atualizarCurso(c.id, "notes", e.target.value)}
                            placeholder="Anotações deste curso: onde parou, o que revisar, prazo do certificado..."
                            className="text-xs rounded-lg min-h-[80px] resize-none" />
                        </div>
                      )}
                      {!aberto && temNota && (
                        <button onClick={() => setCursoAberto(c.id)}
                          className="pb-2 text-left w-full text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-wrap"
                          aria-label={`Ver anotações de ${c.name}`}>
                          {c.notes}
                        </button>
                      )}
                    </div>
                  );
                })}
                {cursosAndamento.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhum curso adicionado</div>
                )}
                <div className="px-4 py-2 space-y-1.5">
                  <Input value={newCursoAndamento} onChange={e => setNewCursoAndamento(e.target.value)}
                    placeholder="Adicionar curso..." className="h-9 text-xs rounded-lg"
                    onKeyDown={e => e.key === "Enter" && addCursoAndamento()} />
                  <div className="flex gap-2">
                    <Input value={newCursoAndamentoLink} onChange={e => setNewCursoAndamentoLink(e.target.value)}
                      placeholder="Link (opcional)" className="h-9 text-xs rounded-lg flex-1"
                      onKeyDown={e => e.key === "Enter" && addCursoAndamento()} />
                    <Button size="sm" className="h-9 px-3" onClick={addCursoAndamento}
                      aria-label="Adicionar curso em andamento"><Plus className="w-3 h-3" /></Button>
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
                  <div key={c.id} className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium flex-1 min-w-0 break-words">{c.name}</span>
                      {/* Mesma correção da lista de cima: excluir não pode
                          depender de hover, que no celular não acontece. */}
                      <button onClick={() => setCursosDesejo(prev => prev.filter(x => x.id !== c.id))}
                        aria-label={`Excluir ${c.name}`}
                        className="h-9 w-9 flex items-center justify-center rounded-lg shrink-0">
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
                    placeholder="Nome do curso..." className="h-9 text-xs rounded-lg" />
                  <div className="flex gap-2">
                    <Input value={newCursoDesejoLink} onChange={e => setNewCursoDesejoLink(e.target.value)}
                      placeholder="Link (opcional)" className="h-9 text-xs rounded-lg flex-1" />
                    <Button size="sm" className="h-9 px-3" aria-label="Adicionar curso desejado" onClick={() => {
                      if (newCursoDesejo.trim()) {
                        setCursosDesejo(prev => [...prev, { id: Date.now().toString(), name: newCursoDesejo.trim(), link: normalizarLink(newCursoDesejoLink) }]);
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
                    {subjects.map((s, i) => subjectEditId === s.id ? (
                      /* Edição na própria linha (mesmo padrão do IncomeTable):
                         ocupa a largura toda porque no celular a coluna do nome
                         não cabe um input + salvar + cancelar. */
                      <tr key={s.id} className="border-t border-border bg-primary/[0.04]">
                        <td colSpan={4} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Input autoFocus value={subjectDraft} onChange={e => setSubjectDraft(e.target.value)}
                              placeholder="Conteúdo" className="h-9 text-xs flex-1"
                              onKeyDown={e => e.key === "Enter" && salvarSubject()} />
                            <button onClick={salvarSubject} aria-label="Salvar conteúdo"
                              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 active:scale-[0.98] transition-transform">
                              <Check className="w-3.5 h-3.5" /> Salvar
                            </button>
                            <button onClick={() => setSubjectEditId(null)} aria-label="Cancelar edição"
                              className="h-9 w-9 rounded-md border border-border flex items-center justify-center shrink-0">
                              <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-1">
                          {/* Sem isso, corrigir um erro de digitação era apagar
                              a linha (e perder os checks) e cadastrar de novo. */}
                          <button onClick={() => { setSubjectEditId(s.id); setSubjectDraft(s.name); }}
                            aria-label={`Editar ${s.name}`}
                            className="w-full min-h-[36px] flex items-center gap-1.5 text-left text-sm font-medium">
                            <span className="flex-1 break-words">{s.name}</span>
                            <Pencil className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                          </button>
                        </td>
                        {(["leitura", "resumo"] as const).map(field => (
                          <td key={field} className="text-center px-3 py-1">
                            <button onClick={() => { const u = [...subjects]; u[i] = { ...s, [field]: !s[field] }; setSubjects(u); }}
                              aria-label={`${field} de ${s.name}`} aria-pressed={s[field]}
                              className="h-9 w-9 mx-auto flex items-center justify-center">
                              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${s[field] ? "bg-blue-500 border-blue-500" : "border-muted-foreground/30"}`}>
                                {s[field] && <Check className="w-3 h-3 text-white" />}
                              </span>
                            </button>
                          </td>
                        ))}
                        <td className="px-1">
                          {/* Esta lixeira era invisível SEMPRE: tinha
                              `group-hover:` mas a linha nunca teve `group`. */}
                          <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))}
                            aria-label={`Excluir ${s.name}`}
                            className="h-9 w-9 flex items-center justify-center">
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
                    placeholder="Novo conteúdo..." className="h-9 text-xs rounded-lg"
                    onKeyDown={e => {
                      if (e.key === "Enter" && newSubject.trim()) {
                        setSubjects([...subjects, { id: Date.now().toString(), name: newSubject.trim(), leitura: false, resumo: false }]);
                        setNewSubject("");
                      }
                    }} />
                  <Button size="sm" className="h-9" aria-label="Adicionar conteúdo" onClick={() => {
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
                {/* `[...exams]` porque `.sort()` ordena NO LUGAR: o original
                    mutava o array que está no estado/persistência a cada render.
                    Sem data vai pro fim ("9999"), não pro topo. */}
                {[...exams].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).map(ex => examEditId === ex.id ? (
                  <div key={ex.id} className="rounded-lg border border-border bg-card px-3 py-3 space-y-2">
                    <Input autoFocus value={examDraft.title} onChange={e => setExamDraft({ ...examDraft, title: e.target.value })}
                      placeholder="Título" className="h-9 text-xs rounded-lg"
                      onKeyDown={e => e.key === "Enter" && salvarExam()} />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <CampoData rotulo="Data" value={examDraft.date} onChange={e => setExamDraft({ ...examDraft, date: e.target.value })} className="text-xs h-9 rounded-lg" />
                      </div>
                      <Input value={examDraft.time} onChange={e => setExamDraft({ ...examDraft, time: e.target.value })}
                        placeholder="Hora" className="text-xs h-9 w-20 rounded-lg" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={salvarExam}
                        className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                      <button onClick={() => setExamEditId(null)}
                        className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={ex.id} className={`rounded-lg px-3 py-2 ${ex.color}`}>
                    <div className="flex items-center gap-2">
                      {/* Prova adiada era caso de apagar e recadastrar. Agora o
                          card inteiro abre a edição — alvo grande, dá no dedo. */}
                      <button onClick={() => { setExamEditId(ex.id); setExamDraft({ title: ex.title, date: ex.date, time: ex.time }); }}
                        aria-label={`Editar ${ex.title}`}
                        className="flex-1 min-w-0 min-h-[36px] flex items-center gap-1.5 text-left">
                        <span className="flex-1 min-w-0">
                          <span className="text-sm font-bold">{ex.title}</span>
                          <span className="text-sm text-muted-foreground">
                            {" - "}
                            {/* parseLocalDay: `new Date("2026-08-10")` parseia como
                                UTC e no Brasil volta um dia ao formatar. */}
                            {ex.date ? parseLocalDay(ex.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "sem data"}
                            {ex.time && ` - ${ex.time}`}
                          </span>
                        </span>
                        <Pencil className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                      </button>
                      <button onClick={() => setExams(exams.filter(x => x.id !== ex.id))}
                        aria-label={`Excluir ${ex.title}`}
                        className="h-9 w-9 flex items-center justify-center shrink-0">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
                {exams.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma prova ou entrega registrada</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Input value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} placeholder="Título" className="text-xs h-9 flex-1 rounded-lg" />
                  <div className="relative w-32">
                    <CampoData rotulo="Data" value={newExamDate} onChange={e => setNewExamDate(e.target.value)} className="text-xs h-9 rounded-lg" />
                  </div>
                  <Input value={newExamTime} onChange={e => setNewExamTime(e.target.value)} placeholder="Hora" className="text-xs h-9 w-16 rounded-lg" />
                  <Button size="sm" className="h-9" aria-label="Adicionar prova ou entrega" onClick={() => {
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
          </div>}

          {activeTab === "grade" && <div className="space-y-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-amber-300 dark:bg-amber-700/60 px-4 py-3 text-center">
                <span className="text-3xl">🎓</span>
                <div className="mt-1">
                  <Input value={scheduleName} onChange={e => setScheduleName(e.target.value)}
                    className="text-center text-sm font-black uppercase tracking-wider bg-transparent border-none h-auto p-0 focus-visible:ring-0"
                    placeholder="NOME DA GRADE" />
                </div>
              </div>
              {/* Controles da grade. Antes disto a tabela era uma matriz FIXA de
                  8 horários × segunda-sexta: aula às 19h (noturno) simplesmente
                  não tinha onde ser cadastrada, e "mudar de horário" era apagar
                  e redigitar — que foi a reclamação da usuária. */}
              <div className="bg-amber-100/60 dark:bg-amber-900/20 px-3 py-2.5 border-b border-amber-200 dark:border-amber-800/30 space-y-2">
                <div className="flex gap-2">
                  <Input value={novoHorario}
                    onChange={e => { setNovoHorario(e.target.value); setErroHorario(""); }}
                    placeholder="Novo horário (ex: 19h30)" className="h-9 text-xs rounded-lg flex-1"
                    onKeyDown={e => e.key === "Enter" && adicionarHorario()} />
                  <Button size="sm" className="h-9 px-3" onClick={adicionarHorario}
                    aria-label="Adicionar horário na grade"><Plus className="w-3.5 h-3.5" /></Button>
                </div>
                {erroHorario && <p className="text-[10px] text-destructive">{erroHorario}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* O botão de esconder some quando já existe aula no sábado —
                      esconder a coluna ali seria esconder dado digitado. */}
                  {!temAulaNoSabado && (
                    <button onClick={() => setGradeSabado(!gradeSabado)}
                      className="h-9 px-3 rounded-lg border border-border bg-card text-[11px] font-semibold text-muted-foreground">
                      {gradeSabado ? "Ocultar sábado" : "+ Mostrar sábado"}
                    </button>
                  )}
                  <p className="text-[10px] text-muted-foreground flex-1 min-w-[140px]">
                    Toque numa célula para escrever, mover ou apagar a matéria.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-stone-300/50 dark:bg-stone-700/30">
                      <th className="text-left px-2 py-2 font-black uppercase text-[10px] tracking-wider w-[104px]">HORÁRIO</th>
                      {gradeDays.map(d => (
                        <th key={d} className="text-left px-2 py-2 font-black uppercase text-[10px] tracking-wider">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {horarios.map((hour, hIdx) => (
                      <tr key={hour} className="border-t border-amber-200 dark:border-amber-800/30">
                        <td className="px-2 py-1 align-top">
                          {horaEditando === hour ? (
                            <Input value={horaRascunho} onChange={e => setHoraRascunho(e.target.value)}
                              className="text-[10px] h-9 w-[72px] rounded" autoFocus
                              onKeyDown={e => e.key === "Enter" && renomearHorario(hour)}
                              onBlur={() => renomearHorario(hour)} />
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => { setHoraEditando(hour); setHoraRascunho(hour); setHoraParaApagar(null); }}
                                aria-label={`Renomear o horário ${hour}`}
                                className={`min-h-[36px] px-2 rounded text-[10px] font-bold ${hourBadgeColors[hIdx % hourBadgeColors.length]}`}>
                                {hour}
                              </button>
                              {/* Confirmação em DOIS toques em vez de window.confirm
                                  (que não é usado em lugar nenhum do app): apagar
                                  a linha leva junto as aulas dela. */}
                              {horaParaApagar === hour ? (
                                <button onClick={() => removerHorario(hour)}
                                  aria-label={`Confirmar remoção do horário ${hour}`}
                                  className="h-9 px-1.5 rounded text-[9px] font-bold text-destructive border border-destructive/40">
                                  apagar?
                                </button>
                              ) : (
                                <button onClick={() => setHoraParaApagar(hour)}
                                  aria-label={`Remover o horário ${hour}`}
                                  className="h-9 w-7 flex items-center justify-center">
                                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        {gradeDays.map(day => {
                          const val = schedule[hour]?.[day] || "";
                          return (
                            <td key={day} className="px-1 py-1">
                              <button onClick={() => abrirCelula(hour, day)}
                                aria-label={val ? `Editar ${val} — ${day}, ${hour}` : `Adicionar aula em ${day}, ${hour}`}
                                className={`w-full text-left rounded px-1.5 py-1 text-[10px] min-h-[36px] min-w-[72px] hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors dark:bg-amber-500/10 ${val ? "font-medium" : "text-muted-foreground/30"}`}>
                                {val || "+"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {horarios.length === 0 && (
                      <tr>
                        <td colSpan={gradeDays.length + 1} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                          Nenhum horário na grade — adicione o primeiro aí em cima (ex: 7h30).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editor da célula em bottom sheet (mesmo desenho do DailyNudge).
                Fica FORA da tabela de propósito: dentro de um `overflow-x-auto`
                o input some pro lado, e é ali que o usuário precisa enxergar os
                seletores de dia e horário. */}
            {celula && (
              <>
                {/* z acima do header do módulo, que é `sticky z-50` — senão o
                    cabeçalho fica por cima do escurecido e parece clicável. */}
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onClick={() => setCelula(null)} />
                <div role="dialog" aria-label="Editar aula da grade"
                  className="fixed bottom-0 left-0 right-0 z-[61] bg-card border-t border-border rounded-t-3xl shadow-2xl">
                  <div className="max-w-lg mx-auto px-5 pt-3 pb-6 space-y-3">
                    <div className="w-10 h-1 bg-border rounded-full mx-auto" />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold capitalize">{celula.day.toLowerCase()} · {celula.hour}</p>
                      <button onClick={() => setCelula(null)} aria-label="Fechar"
                        className="h-9 w-9 flex items-center justify-center rounded-lg">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    <Input autoFocus value={celula.texto}
                      onChange={e => setCelula({ ...celula, texto: e.target.value })}
                      placeholder="Matéria (ex: Cálculo I)" className="h-10 text-sm rounded-lg"
                      onKeyDown={e => e.key === "Enter" && salvarCelula()} />

                    {/* MOVER = escolher outro destino. Dois <select> nativos, o
                        jeito mais simples que funciona em WebView velho; arrastar
                        dentro de uma tabela que rola na horizontal é aposta ruim
                        no celular. */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Dia
                        <select value={celula.paraDia} onChange={e => setCelula({ ...celula, paraDia: e.target.value })}
                          className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm font-normal normal-case tracking-normal">
                          {gradeDays.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </label>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Horário
                        <select value={celula.paraHora} onChange={e => setCelula({ ...celula, paraHora: e.target.value })}
                          className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-2 text-sm font-normal normal-case tracking-normal">
                          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </label>
                    </div>

                    {(celula.paraDia !== celula.day || celula.paraHora !== celula.hour) && (
                      <p className="text-[10px] text-muted-foreground">
                        Vai para {celula.paraDia.toLowerCase()} · {celula.paraHora}
                        {(schedule[celula.paraHora]?.[celula.paraDia] || "").trim()
                          ? ` — como já tem aula lá, as duas trocam de lugar ("${schedule[celula.paraHora][celula.paraDia]}" vem pra cá).`
                          : "."}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <button onClick={salvarCelula}
                        className="h-10 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                        <Check className="w-4 h-4" /> Salvar
                      </button>
                      <button onClick={limparCelula} aria-label="Apagar a aula desta célula"
                        className="h-10 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Apagar
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>}

          {activeTab === "tarefas" && <div className="space-y-4">
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
                        {/* Mesma regra do resto do módulo: no celular não existe
                            hover, então excluir não pode depender dele. */}
                        <button onClick={() => {
                          const u = { ...weekTasks }; u[day] = tasks.filter((_, j) => j !== ti); setWeekTasks(u);
                        }} aria-label={`Excluir tarefa ${task.text}`}
                          className="h-9 w-9 flex items-center justify-center shrink-0">
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
          </div>}

          {activeTab === "caderno" && <div className="space-y-4">
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
          </div>}

          {activeTab === "pomodoro" && <div className="space-y-4">
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
          </div>}
      </main>
    </div>
  );
};

export default Estudos;
