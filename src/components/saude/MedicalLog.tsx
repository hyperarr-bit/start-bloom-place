import { useState } from "react";
import { localDayKey } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, MapPin, HelpCircle, ChevronDown } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Input } from "@/components/ui/input";
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

  const toggleExamDone = (id: string) => {
    setExams(prev => prev.map(e => e.id === id ? { ...e, done: !e.done } : e));
  };

  const addBiomarker = () => {
    if (!newBio.name.trim()) return;
    setBiomarkers(prev => [...prev, { id: Date.now().toString(), name: newBio.name, unit: newBio.unit, entries: [], refMin: Number(newBio.refMin) || 0, refMax: Number(newBio.refMax) || 100 }]);
    setNewBio({ name: "", unit: "ng/dL", refMin: "", refMax: "" });
    setShowBioForm(false);
  };

  const addBioEntry = (bioId: string, value: string) => {
    const num = Number(value);
    if (isNaN(num)) return;
    setBiomarkers(prev => prev.map(b =>
      b.id === bioId ? { ...b, entries: [...b.entries, { date: localDayKey(), value: num }] } : b
    ));
  };

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
                      <Input type="date" value={newAppt.date} onChange={e => setNewAppt({ ...newAppt, date: e.target.value })} className="text-xs h-9 appearance-none [&::-webkit-date-and-time-value]:text-left" />
                      {!newAppt.date && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Data</span>}
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
          <span className="text-3xl">🩺</span>
        </div>
        {allAppts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Especialidade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Horário</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {allAppts.map(a => (
                  <tr key={a.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${getSpecialtyColor(a.specialty)}`}>
                        {a.specialty || a.doctor}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.date ? new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.time || "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        {a.address && (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(a.address)}`} target="_blank" rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-[hsl(var(--saude-blue))]" />
                          </a>
                        )}
                        {a.questions && (
                          <button onClick={() => setExpandedAppt(expandedAppt === a.id ? null : a.id)}
                            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                            <HelpCircle className="w-3.5 h-3.5 text-[hsl(var(--saude-yellow))]" />
                          </button>
                        )}
                        <button onClick={() => setAppointments(prev => prev.filter(x => x.id !== a.id))}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
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
          <span className="text-3xl">🩸</span>
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
                      <Input type="date" value={newExam.date} onChange={e => setNewExam({ ...newExam, date: e.target.value })} className="text-xs h-9 appearance-none [&::-webkit-date-and-time-value]:text-left" />
                      {!newExam.date && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Data</span>}
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
                {[...exams].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                  <tr key={e.id} className={`border-t border-border/50 hover:bg-muted/30 transition-colors ${e.done ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${getExamColor(e.name)}`}>
                        {e.done ? "✓ " : ""}{e.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.time || "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => toggleExamDone(e.id)}
                          className={`text-[10px] px-2 py-1 rounded-md font-bold transition-colors ${e.done ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                          {e.done ? "Desfazer" : "Feito"}
                        </button>
                        {e.location && (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(e.location)}`} target="_blank" rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <MapPin className="w-3.5 h-3.5 text-[hsl(var(--saude-blue))]" />
                          </a>
                        )}
                        {e.notes && (
                          <button onClick={() => setExpandedExam(expandedExam === e.id ? null : e.id)}
                            className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedExam === e.id ? "rotate-180" : ""}`} />
                          </button>
                        )}
                        <button onClick={() => setExams(prev => prev.filter(x => x.id !== e.id))}>
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
            const lastEntry = bio.entries[bio.entries.length - 1];
            const inRange = lastEntry ? lastEntry.value >= bio.refMin && lastEntry.value <= bio.refMax : true;
            return (
              <div key={bio.id} className="mb-3 p-3 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold text-foreground">{bio.name}</p>
                    <p className="text-[10px] text-muted-foreground">Ref: {bio.refMin} – {bio.refMax} {bio.unit}</p>
                  </div>
                  {lastEntry && (
                    <span className={`text-sm font-black ${inRange ? "text-[hsl(var(--saude-green))]" : "text-destructive"}`}>
                      {lastEntry.value} {bio.unit}
                    </span>
                  )}
                </div>
                {bio.entries.length > 0 && (
                  <div className="flex items-end gap-1 h-12 mb-2">
                    {bio.entries.slice(-10).map((e, i) => {
                      const range = bio.refMax - bio.refMin || 1;
                      const pct = Math.min(100, Math.max(10, ((e.value - bio.refMin * 0.5) / (range * 1.5)) * 100));
                      const color = e.value >= bio.refMin && e.value <= bio.refMax ? "bg-[hsl(var(--saude-green))]" : "bg-destructive";
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[7px] text-muted-foreground">{e.value}</span>
                          <div className={`w-full ${color} rounded-t`} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input type="number" placeholder={`Novo valor (${bio.unit})`} className="text-xs h-8 flex-1"
                    onKeyDown={e => { if (e.key === "Enter") { addBioEntry(bio.id, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
                  <button onClick={() => setBiomarkers(prev => prev.filter(b => b.id !== bio.id))}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
