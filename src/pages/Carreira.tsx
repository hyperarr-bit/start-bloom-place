import { useState } from "react";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft, Plus, Trash2, ExternalLink, Edit2, X, Star, Clock, TrendingUp, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

// ============= JOB TRACKER =============
const JobTracker = () => {
  const [jobs, setJobs] = usePersistedState<JobApp[]>("career-jobs", []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<JobApp>>({ status: "aplicado", favorite: false });
  const [filterStatus, setFilterStatus] = useState("all");
  const [inlineForm, setInlineForm] = useState({ company: "", role: "", status: "aplicado" as JobApp["status"] });

  const save = () => {
    if (!form.company || !form.role) return;
    if (editId) { setJobs(prev => prev.map(j => j.id === editId ? { ...j, ...form } as JobApp : j)); }
    else { setJobs(prev => [...prev, { id: genId(), ...form, date: form.date || new Date().toISOString().slice(0, 10) } as JobApp]); }
    setForm({ status: "aplicado", favorite: false }); setEditId(null); setShowForm(false);
  };

  const addInline = () => {
    if (!inlineForm.company || !inlineForm.role) return;
    setJobs(prev => [...prev, { id: genId(), company: inlineForm.company, role: inlineForm.role, link: "", status: inlineForm.status, date: new Date().toISOString().slice(0, 10), salary: "", notes: "", favorite: false }]);
    setInlineForm({ company: "", role: "", status: "aplicado" });
  };

  const filtered = filterStatus === "all" ? jobs : jobs.filter(j => j.status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Pipeline */}
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

      {/* Jobs table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-indigo-200 dark:bg-indigo-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">📋 CANDIDATURAS</span>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ status: "aplicado", favorite: false }); }}
            className="rounded-lg bg-background/50 px-2 py-0.5 text-[10px] font-medium hover:bg-background/80 transition-colors">
            <Plus className="w-3 h-3 inline mr-0.5" />Detalhada
          </button>
        </div>
        <div className="bg-indigo-100 dark:bg-indigo-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-3">Empresa</span>
          <span className="col-span-3">Cargo</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Data</span>
          <span className="col-span-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhuma candidatura ainda</p>
            </div>
          )}
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
          {/* Inline quick-add */}
          <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
            <div className="col-span-3">
              <Input placeholder="Empresa..." value={inlineForm.company} onChange={e => setInlineForm(p => ({ ...p, company: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addInline()}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
            </div>
            <div className="col-span-3">
              <Input placeholder="Cargo..." value={inlineForm.role} onChange={e => setInlineForm(p => ({ ...p, role: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addInline()}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
            </div>
            <div className="col-span-2">
              <Select value={inlineForm.status} onValueChange={v => setInlineForm(p => ({ ...p, status: v as JobApp["status"] }))}>
                <SelectTrigger className="h-7 text-[9px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.emoji}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <span className="col-span-2 text-[9px] text-muted-foreground">Hoje</span>
            <div className="col-span-2 text-right">
              <button onClick={addInline} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= PORTFOLIO =============
const Portfolio = () => {
  const [items, setItems] = usePersistedState<PortfolioItem[]>("career-portfolio", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<PortfolioItem>>({ category: "projeto", highlight: false });
  const categories = ["projeto", "conquista", "certificado", "artigo", "link"];
  const catEmoji: Record<string, string> = { projeto: "🚀", conquista: "🏆", certificado: "📜", artigo: "📝", link: "🔗" };
  const catColors: Record<string, { header: string; body: string; sub: string }> = {
    projeto: { header: "bg-blue-200 dark:bg-blue-800/50", body: "bg-blue-50 dark:bg-blue-950/20", sub: "bg-blue-100 dark:bg-blue-900/20" },
    conquista: { header: "bg-amber-200 dark:bg-amber-800/50", body: "bg-amber-50 dark:bg-amber-950/20", sub: "bg-amber-100 dark:bg-amber-900/20" },
    certificado: { header: "bg-green-200 dark:bg-green-800/50", body: "bg-green-50 dark:bg-green-950/20", sub: "bg-green-100 dark:bg-green-900/20" },
    artigo: { header: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20", sub: "bg-purple-100 dark:bg-purple-900/20" },
    link: { header: "bg-teal-200 dark:bg-teal-800/50", body: "bg-teal-50 dark:bg-teal-950/20", sub: "bg-teal-100 dark:bg-teal-900/20" },
  };
  const [inlineInputs, setInlineInputs] = useState<Record<string, { title: string; link: string }>>({
    projeto: { title: "", link: "" }, conquista: { title: "", link: "" }, certificado: { title: "", link: "" },
    artigo: { title: "", link: "" }, link: { title: "", link: "" },
  });

  const save = () => {
    if (!form.title) return;
    setItems(prev => [...prev, { id: genId(), title: form.title || "", description: form.description || "", link: form.link || "", category: form.category || "projeto", date: form.date || new Date().toISOString().slice(0, 10), highlight: form.highlight || false }]);
    setForm({ category: "projeto", highlight: false }); setShowForm(false);
  };

  const addInline = (cat: string) => {
    const inp = inlineInputs[cat];
    if (!inp?.title) return;
    setItems(prev => [...prev, { id: genId(), title: inp.title, description: "", link: inp.link, category: cat, date: new Date().toISOString().slice(0, 10), highlight: false }]);
    setInlineInputs(prev => ({ ...prev, [cat]: { title: "", link: "" } }));
  };

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Título" value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-9 text-sm" />
          <Textarea placeholder="Descrição..." value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="text-sm min-h-[50px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.category || "projeto"} onValueChange={v => setForm(p => ({ ...p, category: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={form.date || ""} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-9 text-sm" />
          </div>
          <Input placeholder="Link (opcional)" value={form.link || ""} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className="h-9 text-sm" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={save}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat);
        const colors = catColors[cat];
        const inp = inlineInputs[cat];
        return (
          <div key={cat} className="rounded-xl border border-border overflow-hidden">
            <div className={`${colors.header} px-4 py-2 flex items-center justify-between`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{catEmoji[cat]} {cat.toUpperCase()}</span>
              <span className="text-[10px] font-bold bg-background/40 rounded-full px-2 py-0.5">{catItems.length}</span>
            </div>
            <div className={`${colors.sub} px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider`}>
              <span className="col-span-5">Título</span>
              <span className="col-span-3">Data</span>
              <span className="col-span-4 text-right">Ações</span>
            </div>
            <div className={`${colors.body} divide-y divide-border`}>
              {catItems.length === 0 && (
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Nenhum item ainda</p>
                </div>
              )}
              {catItems.sort((a, b) => b.date.localeCompare(a.date)).map(item => (
                <div key={item.id} className="px-3 py-2 grid grid-cols-12 gap-1 items-center hover:bg-background/30 transition-colors group">
                  <div className="col-span-5 min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    {item.description && <p className="text-[9px] text-muted-foreground truncate">{item.description}</p>}
                  </div>
                  <span className="col-span-3 text-[10px] text-muted-foreground">{item.date}</span>
                  <div className="col-span-4 flex justify-end gap-1">
                    {item.link && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => window.open(item.link, "_blank")}><ExternalLink className="w-3 h-3" /></Button>}
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
              {/* Inline add */}
              <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
                <div className="col-span-5">
                  <Input placeholder="Título..." value={inp?.title || ""} onChange={e => setInlineInputs(prev => ({ ...prev, [cat]: { ...prev[cat], title: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && addInline(cat)}
                    className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
                </div>
                <div className="col-span-3">
                  <Input placeholder="Link" value={inp?.link || ""} onChange={e => setInlineInputs(prev => ({ ...prev, [cat]: { ...prev[cat], link: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && addInline(cat)}
                    className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
                </div>
                <div className="col-span-4 text-right">
                  <button onClick={() => addInline(cat)} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Add</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============= NETWORKING =============
const Networking = () => {
  const [contacts, setContacts] = usePersistedState<Contact[]>("career-contacts", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({ category: "profissional" });
  const categories = ["profissional", "mentor", "recrutador", "colega", "cliente"];
  const catEmoji: Record<string, string> = { profissional: "👔", mentor: "🧠", recrutador: "🎯", colega: "🤝", cliente: "💼" };
  const [inlineForm, setInlineForm] = useState({ name: "", company: "" });

  const save = () => {
    if (!form.name) return;
    setContacts(prev => [...prev, { id: genId(), name: form.name || "", company: form.company || "", role: form.role || "", linkedin: form.linkedin || "", email: form.email || "", phone: form.phone || "", notes: form.notes || "", lastContact: form.lastContact || "", category: form.category || "profissional" }]);
    setForm({ category: "profissional" }); setShowForm(false);
  };

  const addInline = () => {
    if (!inlineForm.name) return;
    setContacts(prev => [...prev, { id: genId(), name: inlineForm.name, company: inlineForm.company, role: "", linkedin: "", email: "", phone: "", notes: "", lastContact: new Date().toISOString().slice(0, 10), category: "profissional" }]);
    setInlineForm({ name: "", company: "" });
  };

  const needsFollowUp = contacts.filter(c => { if (!c.lastContact) return true; return (Date.now() - new Date(c.lastContact).getTime()) / (1000 * 60 * 60 * 24) > 30; });

  return (
    <div className="space-y-4">
      {/* Follow-up always visible */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-800/50 px-3 py-2 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">⏰ FOLLOW-UP PENDENTE</span>
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50 ml-auto">{needsFollowUp.length}</Badge>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 p-3">
          {needsFollowUp.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-1">Nenhum follow-up pendente 🎉</p>
          )}
          {needsFollowUp.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className="text-xs">{catEmoji[c.category]} {c.name}</span>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setContacts(prev => prev.map(x => x.id === c.id ? { ...x, lastContact: new Date().toISOString().slice(0, 10) } : x))}>Contatei ✓</Button>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Nome" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2"><Input placeholder="Empresa" value={form.company || ""} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="h-9 text-sm" /><Input placeholder="Cargo" value={form.role || ""} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="h-9 text-sm" /></div>
          <Select value={form.category || "profissional"} onValueChange={v => setForm(p => ({ ...p, category: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="LinkedIn URL" value={form.linkedin || ""} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2"><Input placeholder="Email" value={form.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="h-9 text-sm" /><Input placeholder="Telefone" value={form.phone || ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="h-9 text-sm" /></div>
          <Textarea placeholder="Notas..." value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[50px]" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={save}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-purple-200 dark:bg-purple-800/50 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider">🤝 REDE DE CONTATOS</span>
          <button onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-background/50 px-2 py-0.5 text-[10px] font-medium hover:bg-background/80 transition-colors">
            <Plus className="w-3 h-3 inline mr-0.5" />Detalhado
          </button>
        </div>
        <div className="bg-purple-100 dark:bg-purple-900/20 px-3 py-1.5 grid grid-cols-12 gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="col-span-1"></span>
          <span className="col-span-3">Nome</span>
          <span className="col-span-3">Empresa / Cargo</span>
          <span className="col-span-3">Último Contato</span>
          <span className="col-span-2 text-right">Ações</span>
        </div>
        <div className="divide-y divide-border bg-card">
          {contacts.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhum contato ainda</p>
            </div>
          )}
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
          {/* Inline quick-add */}
          <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
            <div className="col-span-1">👔</div>
            <div className="col-span-3">
              <Input placeholder="Nome..." value={inlineForm.name} onChange={e => setInlineForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addInline()}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
            </div>
            <div className="col-span-3">
              <Input placeholder="Empresa..." value={inlineForm.company} onChange={e => setInlineForm(p => ({ ...p, company: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addInline()}
                className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60" />
            </div>
            <span className="col-span-3 text-[9px] text-muted-foreground">Hoje</span>
            <div className="col-span-2 text-right">
              <button onClick={addInline} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= SKILLS TRACKER =============
const SkillsTracker = () => {
  const [skills, setSkills] = usePersistedState<Skill[]>("career-skills", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Skill>>({ category: "técnica", level: 1, targetLevel: 5 });
  const SKILL_CATS = [
    { key: "técnica", emoji: "💻", label: "TÉCNICA", header: "bg-blue-200 dark:bg-blue-800/50", body: "bg-blue-50 dark:bg-blue-950/20" },
    { key: "soft skill", emoji: "🗣️", label: "SOFT SKILL", header: "bg-pink-200 dark:bg-pink-800/50", body: "bg-pink-50 dark:bg-pink-950/20" },
    { key: "idioma", emoji: "🌍", label: "IDIOMA", header: "bg-green-200 dark:bg-green-800/50", body: "bg-green-50 dark:bg-green-950/20" },
    { key: "ferramenta", emoji: "🔧", label: "FERRAMENTA", header: "bg-yellow-200 dark:bg-yellow-800/50", body: "bg-yellow-50 dark:bg-yellow-950/20" },
    { key: "certificação", emoji: "📜", label: "CERTIFICAÇÃO", header: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20" },
  ];
  const levels = ["Iniciante", "Básico", "Intermediário", "Avançado", "Expert"];
  const levelColors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-blue-400", "bg-green-400"];
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({
    "técnica": "", "soft skill": "", "idioma": "", "ferramenta": "", "certificação": "",
  });

  const save = () => {
    if (!form.name) return;
    setSkills(prev => [...prev, { id: genId(), name: form.name || "", category: form.category || "técnica", level: form.level || 1, targetLevel: form.targetLevel || 5, notes: form.notes || "" }]);
    setForm({ category: "técnica", level: 1, targetLevel: 5 }); setShowForm(false);
  };

  const addInline = (cat: string) => {
    const name = inlineInputs[cat];
    if (!name) return;
    setSkills(prev => [...prev, { id: genId(), name, category: cat, level: 1, targetLevel: 5, notes: "" }]);
    setInlineInputs(prev => ({ ...prev, [cat]: "" }));
  };

  return (
    <div className="space-y-4">
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Input placeholder="Nome da skill" value={form.name || ""} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="h-9 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.category || "técnica"} onValueChange={v => setForm(p => ({...p, category: v}))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{SKILL_CATS.map(c => <SelectItem key={c.key} value={c.key}>{c.emoji} {c.key}</SelectItem>)}</SelectContent></Select>
            <Select value={String(form.level || 1)} onValueChange={v => setForm(p => ({...p, level: Number(v)}))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map(l => <SelectItem key={l} value={String(l)}>{l} - {levels[l-1]}</SelectItem>)}</SelectContent></Select>
          </div>
          <Textarea placeholder="Notas..." value={form.notes || ""} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="text-sm min-h-[40px]" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={save}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {SKILL_CATS.map(cat => {
        const catSkills = skills.filter(s => s.category === cat.key);
        return (
          <div key={cat.key} className="rounded-xl border border-border overflow-hidden">
            <div className={`${cat.header} px-4 py-2 flex items-center justify-between`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{cat.emoji} {cat.label}</span>
              <span className="text-[10px] font-bold bg-background/40 rounded-full px-2 py-0.5">{catSkills.length}</span>
            </div>
            <div className={`${cat.body} divide-y divide-border`}>
              {catSkills.length === 0 && (
                <div className="px-3 py-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Nenhuma skill ainda</p>
                </div>
              )}
              {catSkills.map(skill => (
                <div key={skill.id} className="px-3 py-2 flex items-center gap-2 hover:bg-background/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{skill.name}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {[1,2,3,4,5].map(l => (
                      <div key={l} className={`h-2 w-4 rounded-full transition-all ${l <= skill.level ? levelColors[skill.level - 1] : "bg-muted"}`} />
                    ))}
                  </div>
                  <Badge className={`text-[7px] px-1 py-0 text-white shrink-0 ${levelColors[skill.level - 1]}`}>{levels[skill.level - 1]}</Badge>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setSkills(prev => prev.map(s => s.id === skill.id ? {...s, level: Math.min(s.level + 1, 5)} : s))}><TrendingUp className="w-3 h-3 text-green-500" /></Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100 shrink-0" onClick={() => setSkills(prev => prev.filter(s => s.id !== skill.id))}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              {/* Inline add */}
              <div className="px-3 py-2 flex items-center gap-2 border-t border-dashed border-border/50">
                <Input placeholder="Adicionar skill..." value={inlineInputs[cat.key] || ""} onChange={e => setInlineInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addInline(cat.key)}
                  className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 flex-1" />
                <button onClick={() => addInline(cat.key)} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">+ Add</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============= INTERVIEW PREP =============
const InterviewPrep = () => {
  const [questions, setQuestions] = usePersistedState<{id: string; question: string; answer: string; category: string; practiced: boolean}[]>("career-interview-prep", []);
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
        <div className="bg-sky-50 dark:bg-sky-950/20 p-3 space-y-2">
          <Progress value={pct} className="h-2" />
          <p className="text-[10px] text-muted-foreground">{practiced} de {questions.length} perguntas praticadas</p>
          {/* Inline add inside the card */}
          <div className="flex gap-2 pt-1 border-t border-dashed border-border/50">
            <Input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="Nova pergunta..."
              onKeyDown={e => { if (e.key === "Enter" && newQuestion.trim()) { setQuestions(prev => [...prev, { id: genId(), question: newQuestion.trim(), answer: "", category: "geral", practiced: false }]); setNewQuestion(""); } }}
              className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 flex-1" />
            <button onClick={() => {
              if (newQuestion.trim()) { setQuestions(prev => [...prev, { id: genId(), question: newQuestion.trim(), answer: "", category: "geral", practiced: false }]); setNewQuestion(""); }
            }} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">+ Add</button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {questions.length === 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-card px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhuma pergunta ainda</p>
            </div>
          </div>
        )}
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
  const reportTab = useTabReporter();

  const [activeTab, setActiveTab] = useState("jobs");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  const careerTabs = [
    { id: "jobs", label: "Vagas", icon: "💼" },
    { id: "portfolio", label: "Portfolio", icon: "🏆" },
    { id: "network", label: "Rede", icon: "👥" },
    { id: "skills", label: "Skills", icon: "⚡" },
    { id: "interview", label: "Prep", icon: "📖" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-slate-600 text-lg">💼</span>
          <div>
            <h1 className="text-base font-bold tracking-tight">CARREIRA</h1>
            <p className="text-[11px] text-muted-foreground">Vagas, portfolio, networking e skills</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {careerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
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

        {activeTab === "jobs" && <JobTracker />}
        {activeTab === "portfolio" && <Portfolio />}
        {activeTab === "network" && <Networking />}
        {activeTab === "skills" && <SkillsTracker />}
        {activeTab === "interview" && <InterviewPrep />}
      </main>
    </div>
  );
};

export default Carreira;
