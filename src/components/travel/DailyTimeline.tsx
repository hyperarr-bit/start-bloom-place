import { useState } from "react";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ItineraryDay, TimelineItem, genId, formatCurrency } from "./types";
import { Input } from "@/components/ui/input";
import { CampoData } from "@/components/ui/campo-data";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MapPin, ExternalLink, Pin, Plane, Hotel, Utensils, Target, Car, ShoppingBag, Check, Pencil, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_CONFIG = {
  voo: { icon: Plane, label: "Voo", color: "bg-blue-200 dark:bg-blue-800/50", bodyColor: "bg-blue-50 dark:bg-blue-950/20" },
  hotel: { icon: Hotel, label: "Hotel", color: "bg-purple-200 dark:bg-purple-800/50", bodyColor: "bg-purple-50 dark:bg-purple-950/20" },
  restaurante: { icon: Utensils, label: "Restaurante", color: "bg-orange-200 dark:bg-orange-800/50", bodyColor: "bg-orange-50 dark:bg-orange-950/20" },
  atividade: { icon: Target, label: "Atividade", color: "bg-green-200 dark:bg-green-800/50", bodyColor: "bg-green-50 dark:bg-green-950/20" },
  transporte: { icon: Car, label: "Transporte", color: "bg-yellow-200 dark:bg-yellow-800/50", bodyColor: "bg-yellow-50 dark:bg-yellow-950/20" },
  compras: { icon: ShoppingBag, label: "Compras", color: "bg-pink-200 dark:bg-pink-800/50", bodyColor: "bg-pink-50 dark:bg-pink-950/20" },
};

/** Campos de uma atividade — os MESMOS no adicionar e no editar (senão a
 *  edição vira um segundo formulário, com outro jeito de errar). Fica no topo
 *  do módulo pra não remontar a cada tecla e roubar o foco do input. */
const CamposItem = ({
  valor,
  aoMudar,
}: {
  valor: Partial<TimelineItem>;
  aoMudar: (patch: Partial<TimelineItem>) => void;
}) => (
  <>
    <div className="grid grid-cols-2 gap-2">
      <Input placeholder="Título" value={valor.title || ""} onChange={e => aoMudar({ title: e.target.value })} className="h-9 rounded-lg text-xs" />
      {/* A HORA é editável: item de roteiro que atrasou meia hora não pode
          exigir apagar e redigitar tudo. */}
      <Input type="time" value={valor.time || ""} onChange={e => aoMudar({ time: e.target.value })} className="h-9 rounded-lg text-xs" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Input placeholder="Local" value={valor.location || ""} onChange={e => aoMudar({ location: e.target.value })} className="h-9 rounded-lg text-xs" />
      <Select value={valor.type || "atividade"} onValueChange={v => aoMudar({ type: v as TimelineItem["type"] })}>
        <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(TYPE_CONFIG).map(([k, c]) => (<SelectItem key={k} value={k}>{c.label}</SelectItem>))}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Input placeholder="Link Maps (opcional)" value={valor.mapsLink || ""} onChange={e => aoMudar({ mapsLink: e.target.value })} className="h-9 rounded-lg text-xs" />
      <Input type="number" inputMode="decimal" placeholder="Custo R$" value={valor.estimatedCost || ""} onChange={e => aoMudar({ estimatedCost: Number(e.target.value) })} className="h-9 rounded-lg text-xs" />
    </div>
  </>
);

export const DailyTimeline = () => {
  const [days, setDays] = usePersistedState<ItineraryDay[]>("travel-timeline-v2", []);
  const [inlineDay, setInlineDay] = useState({ tripId: "", date: "", dayNumber: days.length + 1 });
  const [activeDay, setActiveDay] = useState<string | null>(days.length > 0 ? days[0].id : null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState<Partial<TimelineItem>>({ type: "atividade", done: false, pinned: false });

  const addDay = () => {
    if (!inlineDay.date) return;
    const day: ItineraryDay = { id: genId(), tripId: inlineDay.tripId, dayNumber: inlineDay.dayNumber, date: inlineDay.date, items: [] };
    setDays(prev => [...prev, day]);
    setActiveDay(day.id);
    setInlineDay(p => ({ ...p, dayNumber: p.dayNumber + 1, date: "" }));
  };

  const addItem = (dayId: string) => {
    if (!itemForm.title) return;
    const item: TimelineItem = {
      id: genId(), time: itemForm.time || "", title: itemForm.title || "", location: itemForm.location || "",
      mapsLink: itemForm.mapsLink || "", estimatedCost: itemForm.estimatedCost || 0,
      type: itemForm.type || "atividade", done: false, pinned: false,
    };
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, items: [...d.items, item] } : d));
    setItemForm({ type: "atividade", done: false, pinned: false });
    setShowAddItem(false);
  };

  const toggleDone = (dayId: string, itemId: string) => {
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, items: d.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : d));
  };

  const togglePin = (dayId: string, itemId: string) => {
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, items: d.items.map(i => i.id === itemId ? { ...i, pinned: !i.pinned } : i) } : d));
  };

  const removeItem = (dayId: string, itemId: string) => {
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, items: d.items.filter(i => i.id !== itemId) } : d));
    setEditandoItem(prev => (prev === itemId ? null : prev));
  };

  const removeDay = (dayId: string) => {
    setDays(prev => prev.filter(d => d.id !== dayId));
    if (activeDay === dayId) setActiveDay(null);
  };

  /** === EDIÇÃO (padrão da IncomeTable: rascunho + salvar/cancelar) ===
   *  O roteiro é o campo que MAIS muda: o voo atrasa, o restaurante troca, o
   *  custo estimado vira outro. Sem editar, cada ajuste desses obrigava a
   *  apagar o item e digitar as 6 informações de novo. */
  const [editandoItem, setEditandoItem] = useState<string | null>(null);
  const [rascunhoItem, setRascunhoItem] = useState<Partial<TimelineItem>>({});

  const comecarEdicaoItem = (item: TimelineItem) => {
    setEditandoItem(item.id);
    setRascunhoItem({ ...item });
  };

  const salvarEdicaoItem = (dayId: string) => {
    if (!rascunhoItem.title?.trim()) return;
    setDays(prev => prev.map(d => d.id !== dayId ? d : {
      ...d,
      items: d.items.map(i => i.id !== editandoItem ? i : {
        ...i,
        title: rascunhoItem.title?.trim() || i.title,
        time: rascunhoItem.time || "",
        location: rascunhoItem.location || "",
        mapsLink: rascunhoItem.mapsLink || "",
        estimatedCost: rascunhoItem.estimatedCost || 0,
        type: rascunhoItem.type || i.type,
      }),
    }));
    setEditandoItem(null);
  };

  /** Editar o DIA (número e data) — errar a data do dia 3 desalinhava o
   *  roteiro inteiro e a única saída era excluir o dia com tudo dentro. */
  const [editandoDia, setEditandoDia] = useState(false);
  const [rascunhoDia, setRascunhoDia] = useState({ dayNumber: 1, date: "", tripId: "" });

  const comecarEdicaoDia = (d: ItineraryDay) => {
    setEditandoDia(true);
    setRascunhoDia({ dayNumber: d.dayNumber, date: d.date, tripId: d.tripId });
  };

  const salvarEdicaoDia = (dayId: string) => {
    if (!rascunhoDia.date) return;
    setDays(prev => prev.map(d => d.id !== dayId ? d : {
      ...d, dayNumber: rascunhoDia.dayNumber, date: rascunhoDia.date, tripId: rascunhoDia.tripId,
    }));
    setEditandoDia(false);
  };

  const currentDay = days.find(d => d.id === activeDay);
  const sortedItems = currentDay
    ? [...currentDay.items].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.time.localeCompare(b.time);
      })
    : [];
  const dayTotal = currentDay?.items.reduce((s, i) => s + i.estimatedCost, 0) || 0;
  const todayStr = localDayKey();
  const todayDay = days.find(d => d.date === todayStr);

  return (
    <div className="space-y-4">
      {todayDay && (
        <button onClick={() => setActiveDay(todayDay.id)}
          className="w-full rounded-xl border border-border overflow-hidden text-left transition-all hover:shadow-md">
          <div className="bg-teal-200 dark:bg-teal-800/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">📍 HOJE</span>
          </div>
          <div className="bg-teal-50 dark:bg-teal-950/20 p-3">
            <p className="text-xs font-medium">Dia {todayDay.dayNumber} • {todayDay.items.length} atividades</p>
          </div>
        </button>
      )}

      {/* Roteiro card with inline form */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-sky-200 dark:bg-sky-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">🗓️ ROTEIRO</span>
        </div>
        <div className="bg-sky-50 dark:bg-sky-950/20">
          {days.length > 0 && (
            <div className="p-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {days.sort((a, b) => a.date.localeCompare(b.date)).map(d => (
                <button key={d.id} onClick={() => setActiveDay(d.id)}
                  className={`shrink-0 rounded-xl px-4 py-2 border transition-all text-center min-w-[80px] ${
                    activeDay === d.id ? "border-foreground bg-foreground text-background shadow-sm"
                      : d.date === todayStr ? "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/20"
                      : "border-border bg-card hover:border-foreground/30"
                  }`}>
                  <p className="text-xs font-bold">Dia {d.dayNumber}</p>
                  <p className="text-[9px] opacity-70">{parseLocalDay(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
                </button>
              ))}
            </div>
          )}
          {days.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground">Nenhum dia planejado ainda</p>
            </div>
          )}
          {/* Inline add day */}
          <div className="px-3 py-2 flex items-center gap-2 border-t border-dashed border-border/50">
            <Input placeholder="Viagem" value={inlineDay.tripId} onChange={e => setInlineDay(p => ({ ...p, tripId: e.target.value }))}
              className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 flex-1" />
            <Input type="number" placeholder="Dia nº" value={inlineDay.dayNumber} onChange={e => setInlineDay(p => ({ ...p, dayNumber: Number(e.target.value) }))}
              className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60 w-16" />
            <div className="relative w-28">
              <CampoData rotulo="Data" value={inlineDay.date} onChange={e => setInlineDay(p => ({ ...p, date: e.target.value }))}
 onKeyDown={e => e.key === "Enter" && addDay()}
 className="h-7 text-[10px] border-none bg-transparent px-0 focus-visible:ring-0" />
            </div>
            <button onClick={addDay} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">+ Dia</button>
          </div>
        </div>
      </div>

      {/* Activity type legend when no day selected */}
      {!currentDay && days.length === 0 && (
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className="rounded-xl border border-border overflow-hidden">
                <div className={`${cfg.color} px-2 py-1.5 flex items-center gap-1 justify-center`}>
                  <Icon className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{cfg.label}</span>
                </div>
                <div className={`${cfg.bodyColor} p-2 text-center`}>
                  <p className="text-[9px] text-muted-foreground">0 itens</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day detail */}
      {currentDay && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-sky-200 dark:bg-sky-800/50 px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider flex-1 min-w-0 truncate">
                🗓️ DIA {currentDay.dayNumber} — {parseLocalDay(currentDay.date).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <button
                onClick={() => editandoDia ? setEditandoDia(false) : comecarEdicaoDia(currentDay)}
                aria-label={`Editar dia ${currentDay.dayNumber}`}
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/40 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <Button variant="ghost" size="sm" className="text-destructive text-[10px] h-9 px-2" onClick={() => removeDay(currentDay.id)}>Excluir</Button>
            </div>
            {editandoDia && (
              <div className="bg-sky-50 dark:bg-sky-950/20 p-3 space-y-2 border-b border-border">
                <div className="flex gap-2">
                  <Input placeholder="Viagem" value={rascunhoDia.tripId} onChange={e => setRascunhoDia(p => ({ ...p, tripId: e.target.value }))} className="h-9 text-xs flex-1" />
                  <Input type="number" placeholder="Dia nº" value={rascunhoDia.dayNumber} onChange={e => setRascunhoDia(p => ({ ...p, dayNumber: Number(e.target.value) }))} className="h-9 text-xs w-20" />
                </div>
                <CampoData rotulo="Data" value={rascunhoDia.date} onChange={e => setRascunhoDia(p => ({ ...p, date: e.target.value }))} className="h-9 text-xs" />
                <div className="flex items-center gap-2">
                  <button onClick={() => salvarEdicaoDia(currentDay.id)} className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Salvar dia
                  </button>
                  <button onClick={() => setEditandoDia(false)} className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            )}
            {dayTotal > 0 && (
              <div className="bg-sky-50 dark:bg-sky-950/20 px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground">💰 Custo estimado: <span className="font-bold text-foreground">{formatCurrency(dayTotal)}</span></p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {sortedItems.map(item => {
              const config = TYPE_CONFIG[item.type];
              const Icon = config.icon;
              if (editandoItem === item.id) {
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">✏️ Editando atividade</p>
                    <CamposItem valor={rascunhoItem} aoMudar={patch => setRascunhoItem(p => ({ ...p, ...patch }))} />
                    <div className="flex items-center gap-2">
                      <button onClick={() => salvarEdicaoItem(currentDay.id)} className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                      <button onClick={() => setEditandoItem(null)} className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} className={`rounded-xl border border-border overflow-hidden transition-all group ${item.done ? "opacity-60" : "hover:shadow-md"}`}>
                  <div className={`${config.color} px-3 py-1 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">{config.label}</span>
                    </div>
                    {item.time && <span className="text-[10px] font-mono font-bold">{item.time}</span>}
                  </div>
                  <div className={`${config.bodyColor} p-3`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-semibold ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.title}</h4>
                        {item.location && (
                          <p className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {item.location}
                            {item.mapsLink && <a href={item.mapsLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><ExternalLink className="w-2.5 h-2.5 ml-1 text-foreground" /></a>}
                          </p>
                        )}
                        {item.estimatedCost > 0 && <p className="text-[9px] text-muted-foreground mt-0.5">💰 {formatCurrency(item.estimatedCost)}</p>}
                      </div>
                      {/* Alvos de 36px e SEM opacity-0/group-hover: no celular
                          o hover nunca acontece — a lixeira ficava invisível. */}
                      <div className="flex items-center shrink-0">
                        <button onClick={() => togglePin(currentDay.id, item.id)} aria-label={`Fixar ${item.title}`} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors"><Pin className={`w-3.5 h-3.5 ${item.pinned ? "text-foreground fill-foreground" : "text-muted-foreground"}`} /></button>
                        <button onClick={() => toggleDone(currentDay.id, item.id)} aria-label={`Concluir ${item.title}`} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors"><Check className={`w-3.5 h-3.5 ${item.done ? "text-emerald-500" : "text-muted-foreground"}`} /></button>
                        <button onClick={() => comecarEdicaoItem(item)} aria-label={`Editar ${item.title}`} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors"><Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                        <button onClick={() => removeItem(currentDay.id, item.id)} aria-label={`Apagar ${item.title}`} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors"><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="outline" className="w-full rounded-xl h-8 text-xs border-dashed" onClick={() => setShowAddItem(!showAddItem)}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar Atividade
          </Button>

          {showAddItem && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <CamposItem valor={itemForm} aoMudar={patch => setItemForm(p => ({ ...p, ...patch }))} />
              <Button onClick={() => addItem(currentDay.id)} className="w-full rounded-lg h-9 text-xs">Adicionar</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
