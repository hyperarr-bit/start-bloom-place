import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Destination, genId } from "./types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Star, Pencil, Check, X } from "lucide-react";

const continents = ["América do Sul", "América do Norte", "Europa", "Ásia", "África", "Oceania"];
const continentEmoji: Record<string, string> = { "América do Sul": "🌎", "América do Norte": "🌎", "Europa": "🌍", "Ásia": "🌏", "África": "🌍", "Oceania": "🌏" };

const PRIORITY_SECTIONS = [
  { key: "sonho" as const, emoji: "💭", label: "SONHO", header: "bg-purple-200 dark:bg-purple-800/50", body: "bg-purple-50 dark:bg-purple-950/20", sub: "bg-purple-100 dark:bg-purple-900/20" },
  { key: "planejando" as const, emoji: "📋", label: "PLANEJANDO", header: "bg-yellow-200 dark:bg-yellow-800/50", body: "bg-yellow-50 dark:bg-yellow-950/20", sub: "bg-yellow-100 dark:bg-yellow-900/20" },
  { key: "próximo" as const, emoji: "🔜", label: "PRÓXIMO", header: "bg-green-200 dark:bg-green-800/50", body: "bg-green-50 dark:bg-green-950/20", sub: "bg-green-100 dark:bg-green-900/20" },
];

export const BucketList = () => {
  const [destinations, setDestinations] = usePersistedState<Destination[]>("travel-bucket", []);
  const [inlineInputs, setInlineInputs] = useState<Record<string, { name: string; country: string; continent: string }>>({
    sonho: { name: "", country: "", continent: "Europa" },
    planejando: { name: "", country: "", continent: "Europa" },
    "próximo": { name: "", country: "", continent: "Europa" },
  });

  const addInline = (priority: string) => {
    const inp = inlineInputs[priority];
    if (!inp?.name) return;
    setDestinations(prev => [...prev, {
      id: genId(), name: inp.name, country: inp.country, continent: inp.continent,
      notes: "", visited: false, rating: 0, photoUrl: "", priority: priority as Destination["priority"],
    }]);
    setInlineInputs(prev => ({ ...prev, [priority]: { name: "", country: "", continent: "Europa" } }));
  };

  const toggleVisited = (id: string) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, visited: !d.visited } : d));
  const setRating = (id: string, rating: number) => setDestinations(prev => prev.map(d => d.id === id ? { ...d, rating } : d));
  const remove = (id: string) => {
    setDestinations(prev => prev.filter(d => d.id !== id));
    setEditandoId(prev => (prev === id ? null : prev));
  };

  /** Edição na própria linha (mesmo padrão da IncomeTable). Até aqui, errar o
   *  nome do destino ou colocá-lo na prioridade errada só tinha uma saída:
   *  apagar e digitar tudo de novo — inclusive a nota e o "já fui". Editar
   *  também muda a PRIORIDADE, que é como o destino anda de "sonho" pra
   *  "próximo" sem perder o histórico. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ name: "", country: "", continent: "Europa", priority: "sonho" as Destination["priority"] });

  const comecarEdicao = (d: Destination) => {
    setEditandoId(d.id);
    setRascunho({ name: d.name, country: d.country, continent: d.continent || "Europa", priority: d.priority });
  };

  const salvarEdicao = () => {
    if (!rascunho.name.trim()) return;
    setDestinations(prev => prev.map(d => d.id !== editandoId ? d : {
      ...d,
      name: rascunho.name.trim(),
      country: rascunho.country.trim(),
      continent: rascunho.continent,
      priority: rascunho.priority,
    }));
    setEditandoId(null);
  };

  const stats = { total: destinations.length, visited: destinations.filter(d => d.visited).length, countries: new Set(destinations.map(d => d.country).filter(Boolean)).size };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "DESTINOS", value: stats.total, emoji: "📍", color: "bg-teal-200 dark:bg-teal-800/50", body: "bg-teal-50 dark:bg-teal-950/20" },
          { label: "VISITADOS", value: stats.visited, emoji: "✅", color: "bg-emerald-200 dark:bg-emerald-800/50", body: "bg-emerald-50 dark:bg-emerald-950/20" },
          { label: "PAÍSES", value: stats.countries, emoji: "🌍", color: "bg-sky-200 dark:bg-sky-800/50", body: "bg-sky-50 dark:bg-sky-950/20" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border overflow-hidden">
            <div className={`${s.color} px-2 py-1 text-center`}>
              <span className="text-[9px] font-bold uppercase tracking-wider">{s.emoji} {s.label}</span>
            </div>
            <div className={`${s.body} p-2.5 text-center`}>
              <p className="text-xl font-black">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Priority sections */}
      {PRIORITY_SECTIONS.map(section => {
        const items = destinations.filter(d => d.priority === section.key);
        const inp = inlineInputs[section.key];
        return (
          <div key={section.key} className="rounded-xl border border-border overflow-hidden">
            <div className={`${section.header} px-4 py-2 flex items-center justify-between`}>
              <span className="text-[10px] font-bold uppercase tracking-wider">{section.emoji} {section.label}</span>
              <span className="text-[10px] font-bold bg-background/40 rounded-full px-2 py-0.5">{items.length}</span>
            </div>
            {/* Sub-header — país e continente viraram subtítulo da linha (e
                saíram daqui) pra sobrar largura pros botões de 36px: no
                celular, coluna de 2/12 não cabe nem um alvo de toque. */}
            <div className={`${section.sub} px-3 py-1.5 flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider`}>
              <span className="w-5">✓</span>
              <span className="flex-1">Destino</span>
              <span>Nota • Ações</span>
            </div>
            <div className={`${section.body} divide-y divide-border`}>
              {items.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] text-muted-foreground">Nenhum destino ainda</p>
                </div>
              )}
              {items.map(d => editandoId === d.id ? (
                <div key={d.id} className="px-3 py-3 bg-background/40 space-y-2">
                  <Input
                    autoFocus
                    placeholder="Destino"
                    value={rascunho.name}
                    onChange={e => setRascunho(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && salvarEdicao()}
                    className="h-9 text-xs bg-background/60"
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="País"
                      value={rascunho.country}
                      onChange={e => setRascunho(p => ({ ...p, country: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && salvarEdicao()}
                      className="h-9 text-xs flex-1 bg-background/60"
                    />
                    <div className="w-32 shrink-0">
                      <Select value={rascunho.continent} onValueChange={v => setRascunho(p => ({ ...p, continent: v }))}>
                        <SelectTrigger className="h-9 text-[10px] bg-background/60"><SelectValue /></SelectTrigger>
                        <SelectContent>{continents.map(c => <SelectItem key={c} value={c}>{continentEmoji[c]} {c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {PRIORITY_SECTIONS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setRascunho(p => ({ ...p, priority: s.key }))}
                        aria-pressed={rascunho.priority === s.key}
                        className={`h-9 flex-1 rounded-lg border text-[10px] font-medium transition-all ${
                          rascunho.priority === s.key ? "border-foreground bg-foreground text-background" : "border-border bg-background/50"
                        }`}
                      >
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={salvarEdicao} className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditandoId(null)} className="h-9 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div key={d.id} className={`px-3 py-2 flex items-center gap-2 hover:bg-background/30 transition-colors ${d.visited ? "opacity-60" : ""}`}>
                  <div className="w-5 shrink-0">
                    <Checkbox checked={d.visited} onCheckedChange={() => toggleVisited(d.id)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${d.visited ? "line-through text-muted-foreground" : ""}`}>{d.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {[d.country, d.continent ? `${continentEmoji[d.continent] || ""} ${d.continent}` : ""].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  {d.visited && (
                    <div className="flex gap-0.5 shrink-0">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setRating(d.id, s)} aria-label={`Nota ${s} para ${d.name}`} className="py-2">
                          <Star className={`w-3 h-3 ${s <= d.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Ações sempre visíveis: hover não existe no celular. */}
                  <button onClick={() => comecarEdicao(d)} aria-label={`Editar ${d.name}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(d.id)} aria-label={`Apagar ${d.name}`} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-background/60 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {/* Inline add row */}
              <div className="px-3 py-2 grid grid-cols-12 gap-1 items-center border-t border-dashed border-border/50">
                <div className="col-span-1" />
                <div className="col-span-4">
                  <Input
                    placeholder="Destino..."
                    value={inp?.name || ""}
                    onChange={e => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], name: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && addInline(section.key)}
                    className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="País"
                    value={inp?.country || ""}
                    onChange={e => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], country: e.target.value } }))}
                    onKeyDown={e => e.key === "Enter" && addInline(section.key)}
                    className="h-7 text-[10px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="col-span-2">
                  <Select value={inp?.continent || "Europa"} onValueChange={v => setInlineInputs(prev => ({ ...prev, [section.key]: { ...prev[section.key], continent: v } }))}>
                    <SelectTrigger className="h-7 text-[9px] border border-dashed border-border/60 bg-background/50 rounded-md px-2 focus-visible:ring-0"><SelectValue /></SelectTrigger>
                    <SelectContent>{continents.map(c => <SelectItem key={c} value={c}>{continentEmoji[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 text-right">
                  <button onClick={() => addInline(section.key)} className="text-[9px] font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Add</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
