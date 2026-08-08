import { useState } from "react";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, MapPin, HelpCircle, ChevronDown, CalendarPlus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { isNativeShell } from "@/lib/native-shell";
import { adicionarAoCalendario, type EventoDeCalendario } from "@/lib/calendario";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Textarea } from "@/components/ui/textarea";

interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  address: string;
  questions: string;
}

interface Exam {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  done: boolean;
}

interface Biomarker {
  id: string;
  name: string;
  unit: string;
  entries: { date: string; value: number }[];
  refMin: number;
  refMax: number;
}

const specialtyColors: Record<string, string> = {
  "Nutricionista": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Dentista": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Dermatologista": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Endócrino": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "Vascular": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Pediatra": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Tricologista": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "Cardiologista": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Ortopedista": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

const examColors: Record<string, string> = {
  "Hemograma Completo": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "Colesterol": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Glicemia": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Vitamina D": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Testosterona": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const getSpecialtyColor = (specialty: string) => {
  return specialtyColors[specialty] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
};

const getExamColor = (name: string) => {
  for (const [key, val] of Object.entries(examColors)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
};

/**
 * Toda data de dia desta tela passa por aqui. `new Date("2026-07-18")` parseia
 * como UTC e no Brasil (UTC-3) volta um dia — foi assim que o diário da Dieta
 * exibiu 17/07 no registro do dia 18. `parseLocalDay` é o inverso exato do
 * `localDayKey` que grava a chave.
 */
const mostrarDia = (
  key: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
) => (key ? parseLocalDay(key).toLocaleDateString("pt-BR", opts) : "—");

/** Campo numérico vazio (ou lixo digitado) preserva o que já estava gravado —
 *  virar 0 calado é pior do que não aceitar a edição. */
const numeroOu = (texto: string, atual: number) => {
  const n = Number(texto.replace(",", "."));
  return texto.trim() && Number.isFinite(n) ? n : atual;
};

export const MedicalLog = () => {
  const [appointments, setAppointments] = usePersistedState<Appointment[]>("core-saude-appointments", []);
  const [exams, setExams] = usePersistedState<Exam[]>("core-saude-exams-v2", []);
  const [biomarkers, setBiomarkers] = usePersistedState<Biomarker[]>("core-saude-biomarkers", []);
  const [showApptForm, setShowApptForm] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);
  const [showBioForm, setShowBioForm] = useState(false);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  const [newAppt, setNewAppt] = useState<Omit<Appointment, "id">>({ doctor: "", specialty: "", date: "", time: "", address: "", questions: "" });
  const [newExam, setNewExam] = useState<Omit<Exam, "id" | "done">>({ name: "", date: "", time: "", location: "", notes: "" });
  const [newBio, setNewBio] = useState({ name: "", unit: "ng/dL", refMin: "", refMax: "" });

  const addAppointment = () => {
    if (!newAppt.doctor.trim()) return;
    setAppointments(prev => [...prev, { ...newAppt, id: Date.now().toString() }]);
    setNewAppt({ doctor: "", specialty: "", date: "", time: "", address: "", questions: "" });
    setShowApptForm(false);
  };

  const addExam = () => {
    if (!newExam.name.trim()) return;
    setExams(prev => [...prev, { ...newExam, id: Date.now().toString(), done: false }]);
    setNewExam({ name: "", date: "", time: "", location: "", notes: "" });
    setShowExamForm(false);
  };

  /**
   * EDIÇÃO (pedido de cliente: "se mudar o dia e hora precisa excluir e
   * refazer"). Remarcar consulta é a regra, não a exceção — e apagar pra
   * relançar levava junto o endereço e a lista de perguntas, que é justamente
   * a parte que dá trabalho digitar.
   *
   * A edição abre NA PRÓPRIA LINHA (mesmo motivo do ExpenseTable): o
   * formulário de cadastro fica no topo, e mandar a correção acontecer fora do
   * campo de visão faz a tela parecer travada.
   */
  const [editandoApptId, setEditandoApptId] = useState<string | null>(null);
  const [rascunhoAppt, setRascunhoAppt] = useState<Omit<Appointment, "id">>({ doctor: "", specialty: "", date: "", time: "", address: "", questions: "" });

  const comecarEdicaoAppt = (a: Appointment) => {
    setEditandoApptId(a.id);
    setRascunhoAppt({ doctor: a.doctor, specialty: a.specialty, date: a.date, time: a.time, address: a.address, questions: a.questions });
  };

  const salvarEdicaoAppt = () => {
    // médico vazio não salva: é o único campo obrigatório no cadastro
    if (!rascunhoAppt.doctor.trim()) return;
    setAppointments(prev => prev.map(a => a.id !== editandoApptId ? a : { ...a, ...rascunhoAppt, doctor: rascunhoAppt.doctor.trim() }));
    setEditandoApptId(null);
  };

  const [editandoExamId, setEditandoExamId] = useState<string | null>(null);
  const [rascunhoExam, setRascunhoExam] = useState<Omit<Exam, "id" | "done">>({ name: "", date: "", time: "", location: "", notes: "" });

  const comecarEdicaoExam = (e: Exam) => {
    setEditandoExamId(e.id);
    setRascunhoExam({ name: e.name, date: e.date, time: e.time, location: e.location, notes: e.notes });
  };

  const salvarEdicaoExam = () => {
    if (!rascunhoExam.name.trim()) return;
    // `done` fica de fora do rascunho de propósito: marcar como feito é um
    // toque na lista, não uma decisão da tela de edição.
    setExams(prev => prev.map(e => e.id !== editandoExamId ? e : { ...e, ...rascunhoExam, name: rascunhoExam.name.trim() }));
    setEditandoExamId(null);
  };

  const toggleExamDone = (id: string) => {
    setExams(prev => prev.map(e => e.id === id ? { ...e, done: !e.done } : e));
  };

  /**
   * "Adicionar ao calendário" (27/07, pedido de cliente).
   *
   * Abre a tela de novo evento do calendário que a pessoa já usa, preenchida
   * com médico, data, hora, endereço e as perguntas anotadas. Quem grava é o
   * app de calendário, depois que ela confirma — por isso não pedimos nenhuma
   * permissão (o porquê completo está em CalendarioPlugin.java).
   *
   * Só no app da loja: no navegador não existe calendário do telefone pra
   * abrir, então o botão nem aparece.
   */
  const naLoja = isNativeShell();

  const mandarPraAgenda = async (evento: EventoDeCalendario) => {
    const r = await adicionarAoCalendario(evento);
    if (r === "sem-app") toast.error("Não achei um app de calendário neste aparelho");
    else if (r === "erro") toast.error("Não consegui abrir o calendário");
  };

  const addBiomarker = () => {
    if (!newBio.name.trim()) return;
    setBiomarkers(prev => [...prev, { id: Date.now().toString(), name: newBio.name, unit: newBio.unit, entries: [], refMin: Number(newBio.refMin) || 0, refMax: Number(newBio.refMax) || 100 }]);
    setNewBio({ name: "", unit: "ng/dL", refMin: "", refMax: "" });
    setShowBioForm(false);
  };

  const [editandoBioId, setEditandoBioId] = useState<string | null>(null);
  const [rascunhoBio, setRascunhoBio] = useState({ name: "", unit: "", refMin: "", refMax: "" });

  const comecarEdicaoBio = (b: Biomarker) => {
    setEditandoBioId(b.id);
    setRascunhoBio({ name: b.name, unit: b.unit, refMin: String(b.refMin), refMax: String(b.refMax) });
  };

  const salvarEdicaoBio = () => {
    if (!rascunhoBio.name.trim()) return;
    setBiomarkers(prev => prev.map(b => b.id !== editandoBioId ? b : {
      ...b,
      name: rascunhoBio.name.trim(),
      unit: rascunhoBio.unit.trim() || b.unit,
      // a faixa de referência colore TODO o histórico (dentro/fora); zerá-la
      // por um campo apagado sem querer pintaria o gráfico inteiro de vermelho
      refMin: numeroOu(rascunhoBio.refMin, b.refMin),
      refMax: numeroOu(rascunhoBio.refMax, b.refMax),
    }));
    setEditandoBioId(null);
  };

  /**
   * DATA NA MEDIÇÃO (pedido de cliente: "no biomarcador colocar a data que foi
   * medido, pra comparar com o próximo exame").
   *
   * Antes o valor era carimbado com `localDayKey()` no instante do toque, o
   * que assumia que exame e digitação acontecem no mesmo dia. Na vida real o
   * resultado chega dias depois, e quem tem exame antigo em papel não
   * conseguia montar o histórico de jeito nenhum: tudo caía em "hoje" e o
   * gráfico virava uma coluna só. Agora a data vem do rascunho, com hoje só
   * como padrão.
   */
  const [novaMedicao, setNovaMedicao] = useState<Record<string, { valor: string; data: string }>>({});
  const medicaoDe = (bioId: string) => novaMedicao[bioId] ?? { valor: "", data: localDayKey() };

  const addBioEntry = (bioId: string) => {
    const { valor, data } = medicaoDe(bioId);
    const num = Number(valor.replace(",", "."));
    // campo vazio vira 0 no Number() — sem o teste de string, um Enter sem
    // digitar nada gravaria uma medição fantasma de zero no gráfico
    if (!valor.trim() || !Number.isFinite(num)) return;
    setBiomarkers(prev => prev.map(b =>
      b.id === bioId ? { ...b, entries: [...b.entries, { date: data || localDayKey(), value: num }] } : b
    ));
    setNovaMedicao(prev => ({ ...prev, [bioId]: { valor: "", data: localDayKey() } }));
  };

  /**
   * Apagar/corrigir UMA medição. Antes só existia excluir o biomarcador
   * inteiro, então um valor digitado errado ficava no gráfico pra sempre — ou
   * a pessoa perdia todo o histórico pra tirar um número.
   *
   * A medição é identificada pelo ÍNDICE no array original (`entries` não tem
   * id e inventar um agora quebraria os dados já gravados de quem usa). Por
   * isso o índice viaja junto na hora de ordenar por data pra exibir.
   */
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [editandoMedicao, setEditandoMedicao] = useState<{ bioId: string; idx: number } | null>(null);
  const [rascunhoMedicao, setRascunhoMedicao] = useState({ valor: "", data: "" });

  const comecarEdicaoMedicao = (bioId: string, idx: number, entry: { date: string; value: number }) => {
    setEditandoMedicao({ bioId, idx });
    setRascunhoMedicao({ valor: String(entry.value), data: entry.date || localDayKey() });
  };

  const salvarEdicaoMedicao = () => {
    if (!editandoMedicao) return;
    const num = Number(rascunhoMedicao.valor.replace(",", "."));
    if (!rascunhoMedicao.valor.trim() || !Number.isFinite(num)) return;
    const { bioId, idx } = editandoMedicao;
    setBiomarkers(prev => prev.map(b => b.id !== bioId ? b : {
      ...b,
      entries: b.entries.map((e, i) => i !== idx ? e : { date: rascunhoMedicao.data || e.date, value: num }),
    }));
    setEditandoMedicao(null);
  };

  const removerMedicao = (bioId: string, idx: number) => {
    setBiomarkers(prev => prev.map(b => b.id !== bioId ? b : { ...b, entries: b.entries.filter((_, i) => i !== idx) }));
    // apagar desloca os índices seguintes: manter um editor aberto apontando
    // pro índice antigo faria a próxima gravação cair na medição errada
    setEditandoMedicao(null);
  };

  /**
   * Ordem de exibição é por DATA MEDIDA, não pela ordem de digitação: quem
   * lança hoje o resultado de um exame de março espera vê-lo antes do de
   * junho. O índice original vai junto (`idx`) porque é ele que identifica a
   * medição na hora de editar/apagar. Empate de data cai na ordem de
   * digitação, que mantém a lista estável.
   */
  const entradasEmOrdem = (b: Biomarker) =>
    b.entries
      .map((e, idx) => ({ ...e, idx }))
      .sort((x, y) => (x.date || "").localeCompare(y.date || "") || x.idx - y.idx);

  const allAppts = [...appointments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      {/* ── MARCAR CONSULTA ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-purple-200 dark:bg-purple-900/40 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wide text-foreground">Marcar Consulta</h3>
          <span className="text-3xl">👩‍⚕️</span>
        </div>
        <div className="p-4">
          <button
            onClick={() => setShowApptForm(!showApptForm)}
            className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> {showApptForm ? "Cancelar" : "Nova Consulta"}
          </button>

          <AnimatePresence>
            {showApptForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                <div className="grid gap-2 p-3 rounded-xl bg-muted">
                  <Input value={newAppt.doctor} onChange={e => setNewAppt({ ...newAppt, doctor: e.target.value })} placeholder="Nome do médico" className="text-xs h-9" />
                  <Input value={newAppt.specialty} onChange={e => setNewAppt({ ...newAppt, specialty: e.target.value })} placeholder="Especialidade (ex: Dermatologista)" className="text-xs h-9" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <CampoData rotulo="Data" value={newAppt.date} onChange={e => setNewAppt({ ...newAppt, date: e.target.value })} className="text-xs h-9" />
                    </div>
                    <Input type="time" value={newAppt.time} onChange={e => setNewAppt({ ...newAppt, time: e.target.value })} className="text-xs h-9" />
                  </div>
                  <Input value={newAppt.address} onChange={e => setNewAppt({ ...newAppt, address: e.target.value })} placeholder="Endereço" className="text-xs h-9" />
                  <Textarea value={newAppt.questions} onChange={e => setNewAppt({ ...newAppt, questions: e.target.value })} placeholder="O que preciso perguntar?" className="text-xs min-h-[60px]" />
                  <button onClick={addAppointment} className="py-2.5 rounded-xl bg-[hsl(var(--saude-green)/0.12)] text-[hsl(var(--saude-green))] text-xs font-bold hover:bg-[hsl(var(--saude-green)/0.2)] transition-colors">
                    Salvar Consulta
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── CONSULTAS TABLE ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-teal-200 dark:bg-teal-900/40 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wide text-foreground">Consultas</h3>
          <span className="text-3xl">🏥</span>
        </div>
        {allAppts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Médico</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {allAppts.map(a => editandoApptId === a.id ? (
                  <tr key={a.id} className="border-t border-border/50 bg-primary/[0.04]">
                    {/* linha inteira vira formulário: campo de consulta é
                        comprido demais pra caber dentro de uma célula */}
                    <td colSpan={4} className="px-4 py-3">
                      <div className="grid gap-2">
                        <Input autoFocus value={rascunhoAppt.doctor} onChange={e => setRascunhoAppt({ ...rascunhoAppt, doctor: e.target.value })} placeholder="Nome do médico" className="text-xs h-9" />
                        <Input value={rascunhoAppt.specialty} onChange={e => setRascunhoAppt({ ...rascunhoAppt, specialty: e.target.value })} placeholder="Especialidade (ex: Dermatologista)" className="text-xs h-9" />
                        <div className="grid grid-cols-2 gap-2">
                          <CampoData rotulo="Data" value={rascunhoAppt.date} onChange={e => setRascunhoAppt({ ...rascunhoAppt, date: e.target.value })} className="text-xs h-9" />
                          <Input type="time" value={rascunhoAppt.time} onChange={e => setRascunhoAppt({ ...rascunhoAppt, time: e.target.value })} className="text-xs h-9" />
                        </div>
                        <Input value={rascunhoAppt.address} onChange={e => setRascunhoAppt({ ...rascunhoAppt, address: e.target.value })} placeholder="Endereço" className="text-xs h-9" />
                        <Textarea value={rascunhoAppt.questions} onChange={e => setRascunhoAppt({ ...rascunhoAppt, questions: e.target.value })} placeholder="O que preciso perguntar?" className="text-xs min-h-[60px]" />
                        <div className="flex items-center gap-2">
                          <button onClick={salvarEdicaoAppt} className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                            <Check className="w-3.5 h-3.5" /> Salvar
                          </button>
                          <button onClick={() => setEditandoApptId(null)} className="h-9 px-4 rounded-xl border border-border text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                    {/* O nome do médico é o que a pessoa lembra ("a consulta da
                        Dra. Ana"), não a especialidade — ele vem em destaque e a
                        especialidade fica de sublinha (pedido de cliente). */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-foreground">{a.doctor || a.specialty || "—"}</p>
                      {a.specialty && a.doctor && (
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${getSpecialtyColor(a.specialty)}`}>
                          {a.specialty}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {mostrarDia(a.date)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.time || "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        {a.address && (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(a.address)}`} target="_blank" rel="noopener noreferrer"
                            aria-label={`Ver endereço da consulta com ${a.doctor}`}
                            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-[hsl(var(--saude-blue))]" />
                          </a>
                        )}
                        {a.questions && (
                          <button onClick={() => setExpandedAppt(expandedAppt === a.id ? null : a.id)}
                            aria-label={`Ver dúvidas anotadas para ${a.doctor}`}
                            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                            <HelpCircle className="w-3.5 h-3.5 text-[hsl(var(--saude-yellow))]" />
                          </button>
                        )}
                        {/* Só aparece com DATA: sem data não há evento a criar,
                            e um botão que não faz nada é pior que botão nenhum. */}
                        {naLoja && a.date && (
                          <button
                            onClick={() => mandarPraAgenda({
                              titulo: `${a.specialty || "Consulta"}${a.doctor ? ` — ${a.doctor}` : ""}`,
                              data: a.date, hora: a.time || undefined,
                              local: a.address || undefined,
                              descricao: a.questions ? `Perguntar: ${a.questions}` : "Consulta marcada pelo CORE",
                            })}
                            aria-label="Adicionar ao calendário do telefone"
                            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <CalendarPlus className="w-3.5 h-3.5 text-[hsl(var(--saude-blue))]" />
                          </button>
                        )}
                        <button onClick={() => comecarEdicaoAppt(a)}
                          aria-label={`Editar consulta com ${a.doctor || a.specialty}`}
                          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setAppointments(prev => prev.filter(x => x.id !== a.id))}
                          aria-label={`Apagar consulta com ${a.doctor || a.specialty}`}
                          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Empty rows for visual padding */}
                {allAppts.length < 4 && Array.from({ length: 4 - allAppts.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-t border-border/50">
                    <td className="px-4 py-3"><span className="inline-block px-2.5 py-1 rounded-md text-xs bg-transparent">&nbsp;</span></td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-2 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma consulta agendada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Use o botão acima para agendar</p>
          </div>
        )}
        {expandedAppt && (() => {
          const a = appointments.find(x => x.id === expandedAppt);
          if (!a?.questions) return null;
          return (
            <div className="px-4 pb-4">
              <div className="p-3 rounded-xl bg-muted text-xs text-muted-foreground">
                <p className="font-bold text-foreground mb-1">📝 Dúvidas para {a.doctor}:</p>
                {a.questions}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── MARCAR EXAME ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-rose-200 dark:bg-rose-900/40 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wide text-foreground">Exames</h3>
          <span className="text-3xl">💉</span>
        </div>
        <div className="p-4">
          <button
            onClick={() => setShowExamForm(!showExamForm)}
            className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> {showExamForm ? "Cancelar" : "Novo Exame"}
          </button>

          <AnimatePresence>
            {showExamForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                <div className="grid gap-2 p-3 rounded-xl bg-muted">
                  <Input value={newExam.name} onChange={e => setNewExam({ ...newExam, name: e.target.value })} placeholder="Nome do exame (ex: Hemograma)" className="text-xs h-9" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <CampoData rotulo="Data" value={newExam.date} onChange={e => setNewExam({ ...newExam, date: e.target.value })} className="text-xs h-9" />
                    </div>
                    <Input type="time" value={newExam.time} onChange={e => setNewExam({ ...newExam, time: e.target.value })} className="text-xs h-9" />
                  </div>
                  <Input value={newExam.location} onChange={e => setNewExam({ ...newExam, location: e.target.value })} placeholder="Local / Laboratório" className="text-xs h-9" />
                  <Textarea value={newExam.notes} onChange={e => setNewExam({ ...newExam, notes: e.target.value })} placeholder="Observações (jejum, preparo...)" className="text-xs min-h-[60px]" />
                  <button onClick={addExam} className="py-2.5 rounded-xl bg-[hsl(var(--saude-green)/0.12)] text-[hsl(var(--saude-green))] text-xs font-bold hover:bg-[hsl(var(--saude-green)/0.2)] transition-colors">
                    Salvar Exame
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {exams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Exame</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {[...exams].sort((a, b) => b.date.localeCompare(a.date)).map(e => editandoExamId === e.id ? (
                  <tr key={e.id} className="border-t border-border/50 bg-primary/[0.04]">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="grid gap-2">
                        <Input autoFocus value={rascunhoExam.name} onChange={ev => setRascunhoExam({ ...rascunhoExam, name: ev.target.value })} placeholder="Nome do exame (ex: Hemograma)" className="text-xs h-9" />
                        <div className="grid grid-cols-2 gap-2">
                          <CampoData rotulo="Data" value={rascunhoExam.date} onChange={ev => setRascunhoExam({ ...rascunhoExam, date: ev.target.value })} className="text-xs h-9" />
                          <Input type="time" value={rascunhoExam.time} onChange={ev => setRascunhoExam({ ...rascunhoExam, time: ev.target.value })} className="text-xs h-9" />
                        </div>
                        <Input value={rascunhoExam.location} onChange={ev => setRascunhoExam({ ...rascunhoExam, location: ev.target.value })} placeholder="Local / Laboratório" className="text-xs h-9" />
                        <Textarea value={rascunhoExam.notes} onChange={ev => setRascunhoExam({ ...rascunhoExam, notes: ev.target.value })} placeholder="Observações (jejum, preparo...)" className="text-xs min-h-[60px]" />
                        <div className="flex items-center gap-2">
                          <button onClick={salvarEdicaoExam} className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                            <Check className="w-3.5 h-3.5" /> Salvar
                          </button>
                          <button onClick={() => setEditandoExamId(null)} className="h-9 px-4 rounded-xl border border-border text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id} className={`border-t border-border/50 hover:bg-muted/30 transition-colors ${e.done ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${getExamColor(e.name)}`}>
                        {e.done ? "✓ " : ""}{e.name}
                      </span>
                      {/* Laboratório na listagem (pedido de cliente): quem faz
                          exame de rotina repete o mesmo exame em lugares
                          diferentes, e sem o local a lista fica ambígua. */}
                      {e.location && (
                        <p className="mt-1 text-[10px] text-muted-foreground max-w-[160px] truncate" title={e.location}>{e.location}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {mostrarDia(e.date)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.time || "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => toggleExamDone(e.id)}
                          className={`h-9 text-[10px] px-2.5 rounded-lg font-bold transition-colors ${e.done ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                          {e.done ? "Desfazer" : "Feito"}
                        </button>
                        {e.location && (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(e.location)}`} target="_blank" rel="noopener noreferrer"
                            aria-label={`Ver ${e.location} no mapa`}
                            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-[hsl(var(--saude-blue))]" />
                          </a>
                        )}
                        {e.notes && (
                          <button onClick={() => setExpandedExam(expandedExam === e.id ? null : e.id)}
                            aria-label={`Ver observações de ${e.name}`}
                            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedExam === e.id ? "rotate-180" : ""}`} />
                          </button>
                        )}
                        {/* Exame já feito não vai pra agenda — seria marcar
                            compromisso no passado. */}
                        {naLoja && e.date && !e.done && (
                          <button
                            onClick={() => mandarPraAgenda({
                              titulo: `Exame — ${e.name}`,
                              data: e.date, hora: e.time || undefined,
                              local: e.location || undefined,
                              descricao: e.notes || "Exame marcado pelo CORE",
                            })}
                            aria-label="Adicionar ao calendário do telefone"
                            className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <CalendarPlus className="w-3.5 h-3.5 text-[hsl(var(--saude-blue))]" />
                          </button>
                        )}
                        <button onClick={() => comecarEdicaoExam(e)}
                          aria-label={`Editar exame ${e.name}`}
                          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setExams(prev => prev.filter(x => x.id !== e.id))}
                          aria-label={`Apagar exame ${e.name}`}
                          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {exams.length < 4 && Array.from({ length: 4 - exams.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-t border-border/50">
                    <td className="px-4 py-3"><span className="inline-block px-2.5 py-1 rounded-md text-xs bg-transparent">&nbsp;</span></td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-2 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum exame agendado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Use o botão acima para agendar</p>
          </div>
        )}
        {expandedExam && (() => {
          const e = exams.find(x => x.id === expandedExam);
          if (!e?.notes) return null;
          return (
            <div className="px-4 pb-4">
              <div className="p-3 rounded-xl bg-muted text-xs text-muted-foreground">
                <p className="font-bold text-foreground mb-1">📝 Observações:</p>
                {e.notes}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── BIOMARCADORES ── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-green-200 dark:bg-green-900/40 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wide text-foreground">Biomarcadores</h3>
          <span className="text-3xl">📊</span>
        </div>
        <div className="p-4">
          <button onClick={() => setShowBioForm(!showBioForm)}
            className="w-full py-2.5 rounded-xl bg-[hsl(var(--saude-green)/0.1)] hover:bg-[hsl(var(--saude-green)/0.15)] text-[hsl(var(--saude-green))] text-xs font-bold transition-colors flex items-center justify-center gap-2 mb-3">
            <Plus className="w-3.5 h-3.5" /> {showBioForm ? "Cancelar" : "Novo Biomarcador"}
          </button>

          <AnimatePresence>
            {showBioForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted">
                  <Input value={newBio.name} onChange={e => setNewBio({ ...newBio, name: e.target.value })} placeholder="Ex: Testosterona" className="col-span-2 text-xs h-9" />
                  <Input value={newBio.unit} onChange={e => setNewBio({ ...newBio, unit: e.target.value })} placeholder="Unidade" className="text-xs h-9" />
                  <div className="flex gap-1">
                    <Input value={newBio.refMin} onChange={e => setNewBio({ ...newBio, refMin: e.target.value })} placeholder="Mín" className="text-xs h-9" />
                    <Input value={newBio.refMax} onChange={e => setNewBio({ ...newBio, refMax: e.target.value })} placeholder="Máx" className="text-xs h-9" />
                  </div>
                  <button onClick={addBiomarker} className="col-span-2 py-2.5 rounded-xl bg-[hsl(var(--saude-green)/0.12)] text-[hsl(var(--saude-green))] text-xs font-bold">Salvar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {biomarkers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum biomarcador cadastrado</p>
          )}

          {biomarkers.map(bio => {
            const entradas = entradasEmOrdem(bio);
            const ultima = entradas[entradas.length - 1];
            const inRange = ultima ? ultima.value >= bio.refMin && ultima.value <= bio.refMax : true;
            const naFaixa = (v: number) => v >= bio.refMin && v <= bio.refMax;
            const medicao = medicaoDe(bio.id);

            if (editandoBioId === bio.id) {
              return (
                <div key={bio.id} className="mb-3 p-3 rounded-xl bg-primary/[0.06] grid grid-cols-2 gap-2">
                  <Input autoFocus value={rascunhoBio.name} onChange={ev => setRascunhoBio({ ...rascunhoBio, name: ev.target.value })} placeholder="Ex: Testosterona" className="col-span-2 text-xs h-9" />
                  <Input value={rascunhoBio.unit} onChange={ev => setRascunhoBio({ ...rascunhoBio, unit: ev.target.value })} placeholder="Unidade" className="text-xs h-9" />
                  <div className="flex gap-1">
                    <Input value={rascunhoBio.refMin} onChange={ev => setRascunhoBio({ ...rascunhoBio, refMin: ev.target.value })} placeholder="Mín" className="text-xs h-9" />
                    <Input value={rascunhoBio.refMax} onChange={ev => setRascunhoBio({ ...rascunhoBio, refMax: ev.target.value })} placeholder="Máx" className="text-xs h-9" />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <button onClick={salvarEdicaoBio} className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditandoBioId(null)} className="h-9 px-4 rounded-xl border border-border text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={bio.id} className="mb-3 p-3 rounded-xl bg-muted/50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{bio.name}</p>
                    <p className="text-[10px] text-muted-foreground">Ref: {bio.refMin} – {bio.refMax} {bio.unit}</p>
                  </div>
                  {ultima && (
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-black ${inRange ? "text-[hsl(var(--saude-green))]" : "text-destructive"}`}>
                        {ultima.value} {bio.unit}
                      </span>
                      {/* Resultado sem data não serve pra comparar com o próximo
                          exame — era exatamente a queixa da cliente. */}
                      <p className="text-[10px] text-muted-foreground">medido em {mostrarDia(ultima.date, { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                    </div>
                  )}
                </div>
                {entradas.length > 0 && (
                  <div className="flex items-end gap-1 h-16 mb-2">
                    {entradas.slice(-10).map(m => {
                      const range = bio.refMax - bio.refMin || 1;
                      const pct = Math.min(100, Math.max(10, ((m.value - bio.refMin * 0.5) / (range * 1.5)) * 100));
                      const color = naFaixa(m.value) ? "bg-[hsl(var(--saude-green))]" : "bg-destructive";
                      return (
                        // h-full aqui é o que dá altura DEFINIDA pra coluna: sem
                        // isso o `height: %` da barra não tem contra o que
                        // resolver e ela some.
                        <div key={m.idx} className="flex-1 h-full flex flex-col items-center gap-0.5 min-w-0"
                          title={`${m.value} ${bio.unit} em ${mostrarDia(m.date)}`}>
                          <span className="text-[7px] leading-none text-muted-foreground">{m.value}</span>
                          <div className="w-full flex-1 flex items-end">
                            <div className={`w-full ${color} rounded-t`} style={{ height: `${pct}%` }} />
                          </div>
                          <span className="text-[7px] leading-none text-muted-foreground">{mostrarDia(m.date, { day: "2-digit", month: "2-digit" })}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* O campo de data já vem com hoje preenchido, então o rótulo
                    do CampoData (que só aparece vazio) nunca é visto — sem esta
                    linha ninguém descobre que dá pra lançar exame antigo. */}
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Novo resultado (valor + dia do exame)</p>
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                    <Input
                      type="number" inputMode="decimal" placeholder={`Valor (${bio.unit})`} className="text-xs h-9"
                      value={medicao.valor}
                      onChange={ev => setNovaMedicao(prev => ({ ...prev, [bio.id]: { ...medicao, valor: ev.target.value } }))}
                      onKeyDown={ev => { if (ev.key === "Enter") addBioEntry(bio.id); }}
                    />
                    <CampoData
                      rotulo="Medido em" className="text-xs h-9"
                      value={medicao.data}
                      onChange={ev => setNovaMedicao(prev => ({ ...prev, [bio.id]: { ...medicao, data: ev.target.value } }))}
                    />
                  </div>
                  <button onClick={() => addBioEntry(bio.id)} aria-label={`Lançar medição de ${bio.name}`}
                    className="w-9 h-9 flex-shrink-0 rounded-lg bg-[hsl(var(--saude-green)/0.12)] text-[hsl(var(--saude-green))] flex items-center justify-center hover:bg-[hsl(var(--saude-green)/0.2)] transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {entradas.length > 0 && (
                    <button onClick={() => setHistoricoAberto(historicoAberto === bio.id ? null : bio.id)}
                      className="h-9 px-2.5 rounded-lg bg-muted flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:bg-muted/80 transition-colors">
                      <ChevronDown className={`w-3 h-3 transition-transform ${historicoAberto === bio.id ? "rotate-180" : ""}`} />
                      {entradas.length} {entradas.length === 1 ? "medição" : "medições"}
                    </button>
                  )}
                  <div className="flex-1" />
                  <button onClick={() => comecarEdicaoBio(bio)} aria-label={`Editar biomarcador ${bio.name}`}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setBiomarkers(prev => prev.filter(b => b.id !== bio.id))} aria-label={`Apagar biomarcador ${bio.name}`}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                  </button>
                </div>

                {/* Histórico do mais recente pro mais antigo: o valor que a
                    pessoa acabou de digitar errado é o que ela vem corrigir. */}
                {historicoAberto === bio.id && entradas.length > 0 && (
                  <div className="mt-2 rounded-lg bg-background/60 divide-y divide-border/50">
                    {[...entradas].reverse().map(m => editandoMedicao?.bioId === bio.id && editandoMedicao.idx === m.idx ? (
                      <div key={m.idx} className="p-2 grid gap-2 bg-primary/[0.06]">
                        <div className="grid grid-cols-2 gap-2">
                          <Input autoFocus type="number" inputMode="decimal" placeholder={`Valor (${bio.unit})`} className="text-xs h-9"
                            value={rascunhoMedicao.valor}
                            onChange={ev => setRascunhoMedicao({ ...rascunhoMedicao, valor: ev.target.value })} />
                          <CampoData rotulo="Medido em" className="text-xs h-9"
                            value={rascunhoMedicao.data}
                            onChange={ev => setRascunhoMedicao({ ...rascunhoMedicao, data: ev.target.value })} />
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={salvarEdicaoMedicao} className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
                            <Check className="w-3.5 h-3.5" /> Salvar
                          </button>
                          <button onClick={() => setEditandoMedicao(null)} className="h-9 px-3 rounded-lg border border-border text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={m.idx} className="flex items-center gap-2 px-2 py-1">
                        <span className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">{mostrarDia(m.date)}</span>
                        <span className={`text-xs font-bold ${naFaixa(m.value) ? "text-[hsl(var(--saude-green))]" : "text-destructive"}`}>
                          {m.value} {bio.unit}
                        </span>
                        <button onClick={() => comecarEdicaoMedicao(bio.id, m.idx, m)} aria-label={`Editar medição de ${mostrarDia(m.date)}`}
                          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => removerMedicao(bio.id, m.idx)} aria-label={`Apagar medição de ${mostrarDia(m.date)}`}
                          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
