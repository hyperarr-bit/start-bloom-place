import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Plus, Trash2, Scissors, Droplets, FlaskConical } from "lucide-react";
import { calculatePorosity, getPorosityRecommendation, HAIR_RESULT_TAGS, WASH_STEPS, type PorosityResult, type HairEvent, type WashLog } from "./utils";

const genId = () => crypto.randomUUID();
const getDateKey = () => new Date().toISOString().slice(0, 10);
const getDayOfWeek = () => new Date().getDay();

const typeLabels: Record<string, { label: string; emoji: string; bg: string }> = {
  hidratacao: { label: "Hidratação", emoji: "💧", bg: "bg-blue-500/15 border-blue-300" },
  nutricao: { label: "Nutrição", emoji: "🥑", bg: "bg-green-500/15 border-green-300" },
  reconstrucao: { label: "Reconstrução", emoji: "🔧", bg: "bg-amber-500/15 border-amber-300" },
};
const types = ["hidratacao", "nutricao", "reconstrucao"] as const;
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const POROSITY_QUESTIONS = [
  { q: "Seu cabelo demora para molhar completamente?", options: ["Sim, muito (1)", "Mais ou menos (2)", "Não, molha rápido (3)"] },
  { q: "Produtos parecem 'não absorver' e ficam na superfície?", options: ["Sim, sempre (1)", "Às vezes (2)", "Não, absorve rápido (3)"] },
  { q: "Seu cabelo seca rápido ao ar livre?", options: ["Não, demora (1)", "Tempo normal (2)", "Sim, muito rápido (3)"] },
];

const HAIR_EVENT_TYPES = [
  { value: "corte", label: "✂️ Corte", reminder: "cortar as pontas" },
  { value: "coloracao", label: "🎨 Coloração", reminder: "retocar a cor" },
  { value: "progressiva", label: "💆 Progressiva/Alisamento", reminder: "refazer o tratamento" },
  { value: "cauterizacao", label: "🔥 Cauterização", reminder: "refazer a cauterização" },
  { value: "botox", label: "💎 Botox capilar", reminder: "refazer o botox" },
];

export const CronogramaCapilar = () => {
  const today = getDateKey();
  const todayDow = getDayOfWeek();

  const [schedule, setSchedule] = usePersistedState<Record<string, string>>("capilar-schedule", { "1": "hidratacao", "3": "nutricao", "5": "reconstrucao" });
  const [history, setHistory] = usePersistedState<Record<string, string>>("capilar-history", {});
  const [washLogs, setWashLogs] = usePersistedState<WashLog[]>("capilar-wash-logs", []);
  const [hairEvents, setHairEvents] = usePersistedState<HairEvent[]>("capilar-events", []);
  const [porosityResult, setPorosityResult] = usePersistedState<PorosityResult | null>("capilar-porosity", null);
  const [showPorosity, setShowPorosity] = useState(false);
  const [porosityAnswers, setPorosityAnswers] = useState<[number, number, number]>([1, 1, 1]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [washChecklist, setWashChecklist] = useState<string[]>([]);
  const [washTags, setWashTags] = useState<string[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ type: "corte", date: today, notes: "" });

  const todayType = schedule[String(todayDow)];

  const markDone = (tags: string[] = []) => {
    if (!todayType) return;
    setHistory(prev => ({ ...prev, [today]: todayType }));
    if (washChecklist.length > 0 || tags.length > 0) {
      setWashLogs(prev => [...prev, { id: genId(), date: today, dayOfWeek: todayDow, type: todayType, stepsCompleted: washChecklist, productsUsed: {}, resultTags: tags, notes: "" }]);
    }
  };

  // Streak
  const streak = (() => {
    let count = 0; const d = new Date();
    for (let i = 0; i < 30; i++) {
      const key = d.toISOString().slice(0, 10); const dow = d.getDay();
      if (schedule[String(dow)] && history[key]) count++;
      else if (schedule[String(dow)] && !history[key] && i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  // Monthly tag summary
  const thisMonth = today.slice(0, 7);
  const monthLogs = washLogs.filter(l => l.date.startsWith(thisMonth));
  const tagCounts = monthLogs.flatMap(l => l.resultTags).reduce<Record<string, number>>((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});

  // Event reminders
  const eventReminders = hairEvents.map(e => {
    const daysSince = Math.floor((Date.now() - new Date(e.date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24));
    const meta = HAIR_EVENT_TYPES.find(t => t.value === e.type);
    return { ...e, daysSince, reminder: meta?.reminder || "", label: meta?.label || e.type };
  }).sort((a, b) => b.daysSince - a.daysSince);

  const saveEvent = () => {
    setHairEvents(prev => [...prev, { id: genId(), ...eventForm }]);
    setEventForm({ type: "corte", date: today, notes: "" });
    setShowEventForm(false);
  };

  const runPorosity = () => {
    const result = calculatePorosity(porosityAnswers);
    setPorosityResult(result);
    setShowPorosity(false);
  };

  const recommendation = porosityResult ? getPorosityRecommendation(porosityResult) : null;

  return (
    <div className="space-y-4">
      {/* Porosity test result or CTA */}
      {!porosityResult ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <FlaskConical className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-semibold mb-1">Teste de Porosidade</p>
            <p className="text-[10px] text-muted-foreground mb-3">Descubra o que seu cabelo precisa em 3 perguntas</p>
            <Button size="sm" onClick={() => setShowPorosity(true)}>Fazer Teste</Button>
          </CardContent>
        </Card>
      ) : recommendation && (
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">Porosidade: <span className="text-primary capitalize">{porosityResult}</span></p>
                <p className="text-[10px] text-muted-foreground">{recommendation.description}</p>
                <p className="text-[10px] font-medium mt-1">Ciclo sugerido: {recommendation.cycle}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => setShowPorosity(true)}>Refazer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Porosity test dialog */}
      <Dialog open={showPorosity} onOpenChange={setShowPorosity}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>🧪 Teste de Porosidade</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {POROSITY_QUESTIONS.map((pq, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium mb-2">{pq.q}</p>
                <div className="space-y-1.5">
                  {pq.options.map((opt, oi) => (
                    <button key={oi} onClick={() => { const a = [...porosityAnswers] as [number, number, number]; a[qi] = oi + 1; setPorosityAnswers(a); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${porosityAnswers[qi] === oi + 1 ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button className="w-full" onClick={runPorosity}>Ver Resultado</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Cronograma Capilar</h3>
          <p className="text-[10px] text-muted-foreground">Toque no dia para abrir checklist</p>
        </div>
        <Badge variant="secondary" className="text-xs">🔥 {streak}</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <div key={t} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${typeLabels[t].bg}`}>
            <span className="text-sm">{typeLabels[t].emoji}</span>
            <span className="text-[10px] font-medium">{typeLabels[t].label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day, i) => {
          const type = schedule[String(i)];
          const isToday = i === todayDow;
          const done = i === todayDow && history[today];
          return (
            <div key={i}
              onClick={() => type && setSelectedDay(i)}
              className={`text-center p-2 rounded-xl border transition-all cursor-pointer ${isToday ? "ring-2 ring-primary" : ""} ${type ? typeLabels[type]?.bg || "bg-muted/30" : "bg-muted/30 border-border"}`}>
              <span className={`text-[10px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
              <div className="text-lg mt-1">{type ? typeLabels[type]?.emoji : "—"}</div>
              {done && <Check className="w-3 h-3 mx-auto text-green-600 mt-0.5" />}
              <Select value={type || "none"} onValueChange={v => setSchedule(prev => ({ ...prev, [String(i)]: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-5 text-[8px] border-0 bg-transparent p-0 mt-1 justify-center shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{types.map(t => <SelectItem key={t} value={t}>{typeLabels[t].emoji}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {/* Today action */}
      {todayType && !history[today] && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Etapas de hoje ({typeLabels[todayType].label}):</p>
          <div className="space-y-1">
            {WASH_STEPS.map(s => (
              <label key={s.id} className="flex items-center gap-2 py-1">
                <Checkbox checked={washChecklist.includes(s.id)} onCheckedChange={v => setWashChecklist(prev => v ? [...prev, s.id] : prev.filter(x => x !== s.id))} />
                <span className="text-sm">{s.emoji} {s.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs font-medium mt-2">Como ficou?</p>
          <div className="flex gap-2 flex-wrap">
            {HAIR_RESULT_TAGS.map(tag => (
              <button key={tag.id} onClick={() => setWashTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${washTags.includes(tag.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                {tag.emoji} {tag.label}
              </button>
            ))}
          </div>
          <Button className="w-full" size="sm" onClick={() => { markDone(washTags); setWashChecklist([]); setWashTags([]); }}>
            <Check className="w-4 h-4 mr-1" /> Concluir {typeLabels[todayType].label}
          </Button>
        </div>
      )}
      {history[today] && <div className="text-center text-sm text-green-600 font-medium">✅ {typeLabels[history[today]]?.label} feita hoje!</div>}

      {/* Monthly result tags summary */}
      {Object.keys(tagCounts).length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-bold mb-2">📊 Resultados do Mês</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tagId, count]) => {
                const tag = HAIR_RESULT_TAGS.find(t => t.id === tagId);
                return tag ? (
                  <div key={tagId} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 text-[10px]">
                    <span>{tag.emoji}</span><span className="font-medium">{tag.label}</span><span className="text-muted-foreground">×{count}</span>
                  </div>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chemical/Cut timeline */}
      <Card>
        <CardHeader className="pb-2 p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Scissors className="w-4 h-4" /> Químicas & Cortes</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowEventForm(true)}><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          {showEventForm && (
            <div className="space-y-2 p-3 rounded-lg border border-border mb-2">
              <Select value={eventForm.type} onValueChange={v => setEventForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{HAIR_EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={eventForm.date} onChange={e => setEventForm(p => ({ ...p, date: e.target.value }))} className="h-8 text-xs" />
              <Input placeholder="Notas (opcional)" value={eventForm.notes} onChange={e => setEventForm(p => ({ ...p, notes: e.target.value }))} className="h-8 text-xs" />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={saveEvent}>Salvar</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowEventForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          {eventReminders.length === 0 && !showEventForm && <p className="text-[11px] text-muted-foreground text-center py-2">Nenhum evento registrado</p>}
          {eventReminders.map(e => (
            <div key={e.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
              <div className="flex-1">
                <p className="text-xs font-medium">{e.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")} • {e.daysSince} dias atrás
                </p>
                {e.daysSince > 90 && <p className="text-[10px] text-amber-600 font-medium">⏰ Faz {Math.floor(e.daysSince / 30)} meses. Hora de {e.reminder}?</p>}
                {e.notes && <p className="text-[9px] text-muted-foreground">{e.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setHairEvents(prev => prev.filter(x => x.id !== e.id))}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
