import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft, Briefcase, Award, Users, Plus, Trash2, ExternalLink, Edit2, X, Star, CheckCircle, Clock, XCircle, Send, Trophy, Link2, Target, TrendingUp, BookOpen, Zap, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const genId = () => crypto.randomUUID();

// ============= TYPES =============
type JobApp = { id: string; company: string; role: string; link: string; status: "aplicado" | "entrevista" | "teste" | "oferta" | "rejeitado" | "desistiu"; date: string; salary: string; notes: string; favorite: boolean };
type PortfolioItem = { id: string; title: string; description: string; link: string; category: string; date: string; highlight: boolean };
type Contact = { id: string; name: string; company: string; role: string; linkedin: string; email: string; phone: string; notes: string; lastContact: string; category: string };
type Skill = { id: string; name: string; category: string; level: number; targetLevel: number; notes: string };

const statusConfig: Record<string, { label: string; emoji: string; color: string }> = {
  aplicado: { label: "Aplicado", emoji: "📤", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200" },
  entrevista: { label: "Entrevista", emoji: "🎤", color: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200" },
  teste: { label: "Teste Técnico", emoji: "💻", color: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200" },
  oferta: { label: "Oferta!", emoji: "🎉", color: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200" },
  rejeitado: { label: "Rejeitado", emoji: "❌", color: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200" },
  desistiu: { label: "Desistiu", emoji: "🚪", color: "bg-muted text-muted-foreground border-border" },
};

const DEFAULT_JOBS: JobApp[] = [
  { id: "ex-1", company: "Tech Corp", role: "Dev Frontend", link: "", status: "aplicado", date: new Date().toISOString().slice(0, 10), salary: "R$ 8.000 - 12.000", notes: "Vaga remota, React + TypeScript", favorite: false },
  { id: "ex-2", company: "StartupXYZ", role: "Fullstack Engineer", link: "", status: "entrevista", date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), salary: "R$ 10.000 - 15.000", notes: "Entrevista técnica na próxima semana", favorite: true },
];

const DEFAULT_PORTFOLIO: PortfolioItem[] = [
  { id: "ex-p1", title: "Landing Page E-commerce", description: "Redesign completo com React e Tailwind", link: "", category: "projeto", date: new Date().toISOString().slice(0, 10), highlight: true },
];

const DEFAULT_CONTACTS: Contact[] = [
  { id: "ex-c1", name: "Maria Silva", company: "Tech Corp", role: "Head of Engineering", linkedin: "", email: "", phone: "", notes: "Conheci no meetup de React", lastContact: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), category: "profissional" },
];

const DEFAULT_SKILLS: Skill[] = [
  { id: "ex-s1", name: "React", category: "técnica", level: 4, targetLevel: 5, notes: "" },
  { id: "ex-s2", name: "TypeScript", category: "técnica", level: 3, targetLevel: 5, notes: "" },
  { id: "ex-s3", name: "Inglês", category: "idioma", level: 3, targetLevel: 5, notes: "B2 - estudando para C1" },
];

// ============= JOB TRACKER =============
const JobTracker = () => {
  const [jobs, setJobs] = usePersistedState<JobApp[]>("career-jobs", DEFAULT_JOBS);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<JobApp>>({ status: "aplicado", favorite: false });
  const [filterStatus, setFilterStatus] = useState("all");

  const save = () => {
    if (!form.company || !form.role) return;
    if (editId) { setJobs(prev => prev.map(j => j.id === editId ? { ...j, ...form } as JobApp : j)); }
    else { setJobs(prev => [...prev, { id: genId(), ...form, date: form.date || new Date().toISOString().slice(0, 10) } as JobApp]); }
    setForm({ status: "aplicado", favorite: false }); setEditId(null); setShowForm(false);
  };

  const filtered = filterStatus === "all" ? jobs : jobs.filter(j => j.status === filterStatus);
  const stats = { total: jobs.length, active: jobs.filter(j => !["rejeitado", "desistiu"].includes(j.status)).length, interviews: jobs.filter(j => j.status === "entrevista").length, offers: jobs.filter(j => j.status === "oferta").length };

  return (
    <div className="space-y-4">
      {/* Pipeline Visual — Notion-style */}
      {jobs.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-indigo-200 dark:bg-indigo-800/50 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">📊 PIPELINE DE CANDIDATURAS</span>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 space-y-2">
            <div className="flex gap-1 h-3.5 rounded-full overflow-hidden bg-muted">
              {Object.entries(statusConfig).map(([key]) => {
                const count = jobs.filter(j => j.status === key).length; if (count === 0) return null;
                const pct = (count / jobs.length) * 100;
                const bgClass = key === "aplicado" ? "bg-blue-500" : key === "entrevista" ? "bg-purple-500" : key === "teste" ? "bg-amber-500" : key === "oferta" ? "bg-green-500" : key === "rejeitado" ? "bg-red-400" : "bg-muted-foreground/30";
                return <div key={key} className={`${bgClass} transition-all`} style={{ width: `${pct}%` }} />;
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusConfig).map(([key, cfg]) => {
                const count = jobs.filter(j => j.status === key).length;
                if (count === 0) return null;
                return <span key={key} className="text-[9px] text-muted-foreground">{cfg.emoji} {cfg.label}: {count}</span>;
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="flex-1 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={() => { setShowForm(true); setEditId(null); setForm({ status: "aplicado", favorite: false }); }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex justify-between items-center"><span className="font-semibold text-sm">{editId ? "Editar" : "Nova"} Candidatura</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button></div>
          <div className="grid grid-cols-2 gap-2"><Input placeholder="Empresa" value={form.company || ""} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="h-9 text-sm" /><Input placeholder="Cargo" value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="h-9 text-sm" /></div>
          <Input placeholder="Link da vaga" value={form.link || ""} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2"><Input placeholder="Faixa salarial" value={form.salary || ""} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} className="h-9 text-sm" /><Select value={form.status || "aplicado"} onValueChange={v => setForm(p => ({ ...p, status: v as JobApp["status"] }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>)}</SelectContent></Select></div>
          <Input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-9 text-sm" />
          <Textarea placeholder="Notas..." value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[50px]" />
          <Button size="sm" className="w-full" onClick={save}>Salvar</Button>
        </div>
      )}

      {/* Jobs table — Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-indigo-100 dark:bg-indigo-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-3">Empresa</span>
          <span className="col-span-3">Cargo</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Data</span>
          <span className="col-span-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {filtered.sort((a, b) => b.date.localeCompare(a.date)).map(job => (
            <div key={job.id} className="px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-muted/30 transition-colors group">
              <div className="col-span-3 min-w-0">
                <p className="text-xs font-medium truncate">{job.company}</p>
                {job.salary && <p className="text-[9px] text-muted-foreground">💰 {job.salary}</p>}
              </div>
              <span className="col-span-3 text-xs truncate">{job.role}</span>
              <div className="col-span-2">
                <Badge className={`text-[8px] px-1.5 py-0 ${statusConfig[job.status]?.color}`}>{statusConfig[job.status]?.emoji} {statusConfig[job.status]?.label}</Badge>
              </div>
              <span className="col-span-2 text-[10px] text-muted-foreground">{job.date}</span>
              <div className="col-span-2 flex justify-end gap-1 shrink-0">
                {job.link && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => window.open(job.link, "_blank")}><ExternalLink className="w-3 h-3" /></Button>}
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setForm(job); setEditId(job.id); setShowForm(true); }}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setJobs(prev => prev.filter(j => j.id !== job.id))}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============= PORTFOLIO =============
const Portfolio = () => {
  const [items, setItems] = usePersistedState<PortfolioItem[]>("career-portfolio", DEFAULT_PORTFOLIO);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<PortfolioItem>>({ category: "projeto", highlight: false });
  const categories = ["projeto", "conquista", "certificado", "artigo", "link"];
  const catEmoji: Record<string, string> = { projeto: "🚀", conquista: "🏆", certificado: "📜", artigo: "📝", link: "🔗" };

  const save = () => {
    if (!form.title) return;
    setItems(prev => [...prev, { id: genId(), title: form.title || "", description: form.description || "", link: form.link || "", category: form.category || "projeto", date: form.date || new Date().toISOString().slice(0, 10), highlight: form.highlight || false }]);
    setForm({ category: "projeto", highlight: false }); setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Nova Conquista
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Título" value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-9 text-sm" />
          <Textarea placeholder="Descrição..." value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="text-sm min-h-[50px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.category || "projeto"} onValueChange={v => setForm(p => ({ ...p, category: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-9 text-sm" />
          </div>
          <Input placeholder="Link (opcional)" value={form.link || ""} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className="h-9 text-sm" />
          <Button size="sm" className="w-full" onClick={save}>Salvar</Button>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">🏆 CONQUISTAS & PORTFOLIO</span>
        </div>
        <div className="bg-amber-100 dark:bg-amber-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-1"></span>
          <span className="col-span-4">Título</span>
          <span className="col-span-3">Tipo</span>
          <span className="col-span-2">Data</span>
          <span className="col-span-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {items.sort((a, b) => b.date.localeCompare(a.date)).map(item => (
            <div key={item.id} className="px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-muted/30 transition-colors group">
              <span className="col-span-1 text-sm">{catEmoji[item.category]}</span>
              <div className="col-span-4 min-w-0">
                <p className="text-xs font-medium truncate">{item.title}</p>
                {item.description && <p className="text-[9px] text-muted-foreground truncate">{item.description}</p>}
              </div>
              <div className="col-span-3"><Badge variant="outline" className="text-[8px] px-1 py-0">{item.category}</Badge></div>
              <span className="col-span-2 text-[10px] text-muted-foreground">{item.date}</span>
              <div className="col-span-2 flex justify-end gap-1">
                {item.link && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => window.open(item.link, "_blank")}><ExternalLink className="w-3 h-3" /></Button>}
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============= NETWORKING =============
const Networking = () => {
  const [contacts, setContacts] = usePersistedState<Contact[]>("career-contacts", DEFAULT_CONTACTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({ category: "profissional" });
  const categories = ["profissional", "mentor", "recrutador", "colega", "cliente"];
  const catEmoji: Record<string, string> = { profissional: "👔", mentor: "🧠", recrutador: "🎯", colega: "🤝", cliente: "💼" };

  const save = () => {
    if (!form.name) return;
    setContacts(prev => [...prev, { id: genId(), name: form.name || "", company: form.company || "", role: form.role || "", linkedin: form.linkedin || "", email: form.email || "", phone: form.phone || "", notes: form.notes || "", lastContact: form.lastContact || "", category: form.category || "profissional" }]);
    setForm({ category: "profissional" }); setShowForm(false);
  };
  const needsFollowUp = contacts.filter(c => { if (!c.lastContact) return true; return (Date.now() - new Date(c.lastContact).getTime()) / (1000 * 60 * 60 * 24) > 30; });

  return (
    <div className="space-y-4">
      {needsFollowUp.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-amber-200 dark:bg-amber-800/50 px-3 py-1.5 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">⏰ FOLLOW-UP PENDENTE</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50 ml-auto">{needsFollowUp.length}</Badge>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
            {needsFollowUp.slice(0, 3).map(c => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="text-xs">{catEmoji[c.category]} {c.name}</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setContacts(prev => prev.map(x => x.id === c.id ? { ...x, lastContact: new Date().toISOString().slice(0, 10) } : x))}>Contatei ✓</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Novo Contato
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Nome" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2"><Input placeholder="Empresa" value={form.company || ""} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="h-9 text-sm" /><Input placeholder="Cargo" value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="h-9 text-sm" /></div>
          <Select value={form.category || "profissional"} onValueChange={v => setForm(p => ({ ...p, category: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="LinkedIn URL" value={form.linkedin || ""} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={form.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="h-9 text-sm" /><Input placeholder="Telefone" value={form.phone || ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="h-9 text-sm" /></div>
          <Textarea placeholder="Notas..." value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[50px]" />
          <Button size="sm" className="w-full" onClick={save}>Salvar</Button>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-purple-200 dark:bg-purple-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">🤝 REDE DE CONTATOS</span>
        </div>
        <div className="bg-purple-100 dark:bg-purple-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-1"></span>
          <span className="col-span-3">Nome</span>
          <span className="col-span-3">Empresa / Cargo</span>
          <span className="col-span-3">Último Contato</span>
          <span className="col-span-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {contacts.map(c => (
            <div key={c.id} className="px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-muted/30 transition-colors group">
              <span className="col-span-1 text-sm">{catEmoji[c.category]}</span>
              <span className="col-span-3 text-xs font-medium truncate">{c.name}</span>
              <div className="col-span-3 min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{c.role}{c.company ? ` @ ${c.company}` : ""}</p>
              </div>
              <span className="col-span-3 text-[10px] text-muted-foreground">{c.lastContact || "—"}</span>
              <div className="col-span-2 flex justify-end gap-1">
                {c.linkedin && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => window.open(c.linkedin, "_blank")}><Link2 className="w-3 h-3" /></Button>}
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setContacts(prev => prev.filter(x => x.id !== c.id))}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============= SKILLS TRACKER =============
const SkillsTracker = () => {
  const [skills, setSkills] = usePersistedState<Skill[]>("career-skills", DEFAULT_SKILLS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Skill>>({ category: "técnica", level: 1, targetLevel: 5 });
  const categories = ["técnica", "soft skill", "idioma", "ferramenta", "certificação"];
  const catEmoji: Record<string, string> = { "técnica": "💻", "soft skill": "🗣️", "idioma": "🌍", "ferramenta": "🔧", "certificação": "📜" };
  const levels = ["Iniciante", "Básico", "Intermediário", "Avançado", "Expert"];
  const levelColors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-blue-400", "bg-green-400"];

  const save = () => {
    if (!form.name) return;
    setSkills(prev => [...prev, { id: genId(), name: form.name || "", category: form.category || "técnica", level: form.level || 1, targetLevel: form.targetLevel || 5, notes: form.notes || "" }]);
    setForm({ category: "técnica", level: 1, targetLevel: 5 }); setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" className="w-full rounded-xl h-9 text-xs border-dashed" onClick={() => setShowForm(!showForm)}>
        <Plus className="w-3 h-3 mr-1" /> Nova Skill
      </Button>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Nome da skill" value={form.name || ""} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.category || "técnica"} onValueChange={v => setForm(p => ({...p, category: v}))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent></Select>
            <Select value={String(form.level || 1)} onValueChange={v => setForm(p => ({...p, level: Number(v)}))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map(l => <SelectItem key={l} value={String(l)}>{l} - {levels[l-1]}</SelectItem>)}</SelectContent></Select>
          </div>
          <Textarea placeholder="Notas..." value={form.notes || ""} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="text-sm min-h-[40px]" />
          <Button size="sm" className="w-full" onClick={save}>Salvar</Button>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-green-200 dark:bg-green-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">💻 SKILLS & COMPETÊNCIAS</span>
        </div>
        <div className="bg-green-100 dark:bg-green-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-1"></span>
          <span className="col-span-3">Skill</span>
          <span className="col-span-2">Tipo</span>
          <span className="col-span-4">Nível</span>
          <span className="col-span-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {skills.map(skill => (
            <div key={skill.id} className="px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-muted/30 transition-colors group">
              <span className="col-span-1 text-sm">{catEmoji[skill.category]}</span>
              <div className="col-span-3 min-w-0">
                <p className="text-xs font-medium truncate">{skill.name}</p>
                {skill.notes && <p className="text-[8px] text-muted-foreground truncate">{skill.notes}</p>}
              </div>
              <span className="col-span-2 text-[10px] text-muted-foreground">{skill.category}</span>
              <div className="col-span-4 flex items-center gap-2">
                <div className="flex gap-0.5 flex-1">
                  {[1,2,3,4,5].map(l => (
                    <div key={l} className={`h-2 flex-1 rounded-full transition-all ${l <= skill.level ? levelColors[skill.level - 1] : "bg-muted"}`} />
                  ))}
                </div>
                <Badge className={`text-[7px] px-1 py-0 text-white ${levelColors[skill.level - 1]}`}>{levels[skill.level - 1]}</Badge>
              </div>
              <div className="col-span-2 flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSkills(prev => prev.map(s => s.id === skill.id ? {...s, level: Math.min(s.level + 1, 5)} : s))}><TrendingUp className="w-3 h-3 text-green-500" /></Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setSkills(prev => prev.filter(s => s.id !== skill.id))}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============= INTERVIEW PREP =============
const InterviewPrep = () => {
  const [questions, setQuestions] = usePersistedState<{id: string; question: string; answer: string; category: string; practiced: boolean}[]>("career-interview-prep", [
    { id: "1", question: "Fale sobre você", answer: "", category: "geral", practiced: false },
    { id: "2", question: "Por que você quer trabalhar aqui?", answer: "", category: "geral", practiced: false },
    { id: "3", question: "Qual seu maior defeito?", answer: "", category: "comportamental", practiced: false },
    { id: "4", question: "Conte sobre um desafio que superou", answer: "", category: "comportamental", practiced: false },
    { id: "5", question: "Onde você se vê em 5 anos?", answer: "", category: "geral", practiced: false },
  ]);
  const [newQuestion, setNewQuestion] = useState("");
  const practiced = questions.filter(q => q.practiced).length;
  const pct = Math.round((practiced / Math.max(questions.length, 1)) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-sky-200 dark:bg-sky-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">📝 PREPARAÇÃO PARA ENTREVISTA</span>
          <span className="text-xs font-bold">{pct}%</span>
        </div>
        <div className="bg-sky-50 dark:bg-sky-950/20 p-3">
          <Progress value={pct} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-1">{practiced} de {questions.length} perguntas praticadas</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="Nova pergunta..." className="h-8 text-xs" />
        <Button size="sm" className="h-8" onClick={() => {
          if (newQuestion.trim()) { setQuestions(prev => [...prev, { id: genId(), question: newQuestion.trim(), answer: "", category: "geral", practiced: false }]); setNewQuestion(""); }
        }}><Plus className="w-3 h-3" /></Button>
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className={`rounded-xl border overflow-hidden ${q.practiced ? "border-green-200 dark:border-green-800/30" : "border-border"}`}>
            <div className={`px-3 py-2 flex items-start gap-2 ${q.practiced ? "bg-green-50 dark:bg-green-950/20" : "bg-card"}`}>
              <Checkbox checked={q.practiced} onCheckedChange={() => setQuestions(prev => prev.map(x => x.id === q.id ? {...x, practiced: !x.practiced} : x))} className="mt-0.5" />
              <div className="flex-1">
                <p className={`text-xs font-medium ${q.practiced ? "line-through text-muted-foreground" : ""}`}>{q.question}</p>
                <Textarea value={q.answer} onChange={e => { const u = [...questions]; u[i] = {...q, answer: e.target.value}; setQuestions(u); }}
                  placeholder="Sua resposta preparada..." className="text-xs min-h-[40px] mt-2" />
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive shrink-0" onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============= MAIN =============
const Carreira = () => {
  const navigate = useNavigate();
  const [jobs] = usePersistedState<JobApp[]>("career-jobs", DEFAULT_JOBS);
  const [skills] = usePersistedState<Skill[]>("career-skills", DEFAULT_SKILLS);
  const [contacts] = usePersistedState<Contact[]>("career-contacts", DEFAULT_CONTACTS);
  const [portfolio] = usePersistedState<PortfolioItem[]>("career-portfolio", DEFAULT_PORTFOLIO);

  const activeJobs = jobs.filter(j => !["rejeitado", "desistiu"].includes(j.status)).length;
  const interviews = jobs.filter(j => j.status === "entrevista").length;
  const offers = jobs.filter(j => j.status === "oferta").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-600" /> MINHA CARREIRA
            </h1>
            <p className="text-[11px] text-muted-foreground">Vagas, portfolio, networking e skills</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <ModuleTip
          moduleId="carreira"
          tips={[
            "Registre vagas de emprego e acompanhe o status de cada candidatura",
            "Monte seu portfolio com projetos e conquistas",
            "Gerencie contatos de networking importantes",
            "Adicione habilidades e acompanhe seu aprendizado"
          ]}
        />

        {/* Stat Cards — Notion-style */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "TOTAL", value: jobs.length, emoji: "📊", headerColor: "bg-indigo-200 dark:bg-indigo-800/50", bodyColor: "bg-indigo-50 dark:bg-indigo-950/20" },
            { label: "ATIVAS", value: activeJobs, emoji: "🎯", headerColor: "bg-purple-200 dark:bg-purple-800/50", bodyColor: "bg-purple-50 dark:bg-purple-950/20" },
            { label: "ENTREVISTAS", value: interviews, emoji: "🎤", headerColor: "bg-amber-200 dark:bg-amber-800/50", bodyColor: "bg-amber-50 dark:bg-amber-950/20" },
            { label: "OFERTAS", value: offers, emoji: "🎉", headerColor: "bg-green-200 dark:bg-green-800/50", bodyColor: "bg-green-50 dark:bg-green-950/20" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border overflow-hidden">
              <div className={`${s.headerColor} px-2 py-1 text-center`}>
                <span className="text-[8px] font-bold uppercase tracking-wider">{s.emoji} {s.label}</span>
              </div>
              <div className={`${s.bodyColor} p-2 text-center`}>
                <p className="text-xl font-black">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-gray-200 dark:bg-gray-800/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">📋 RESUMO</span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-950/20 px-4 py-2 flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> {skills.length} skills</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3 text-indigo-500" /> {contacts.length} contatos</span>
            <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-purple-500" /> {portfolio.length} conquistas</span>
          </div>
        </div>

        <Tabs defaultValue="jobs">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="jobs" className="text-[10px] gap-0.5"><Briefcase className="w-3 h-3" />Vagas</TabsTrigger>
            <TabsTrigger value="portfolio" className="text-[10px] gap-0.5"><Award className="w-3 h-3" />Portfolio</TabsTrigger>
            <TabsTrigger value="network" className="text-[10px] gap-0.5"><Users className="w-3 h-3" />Rede</TabsTrigger>
            <TabsTrigger value="skills" className="text-[10px] gap-0.5"><Zap className="w-3 h-3" />Skills</TabsTrigger>
            <TabsTrigger value="interview" className="text-[10px] gap-0.5"><BookOpen className="w-3 h-3" />Prep</TabsTrigger>
          </TabsList>
          <TabsContent value="jobs"><JobTracker /></TabsContent>
          <TabsContent value="portfolio"><Portfolio /></TabsContent>
          <TabsContent value="network"><Networking /></TabsContent>
          <TabsContent value="skills"><SkillsTracker /></TabsContent>
          <TabsContent value="interview"><InterviewPrep /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Carreira;
