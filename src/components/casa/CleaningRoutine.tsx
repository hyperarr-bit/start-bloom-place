import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface CleaningItem {
  id: string;
  text: string;
  done: boolean;
}

interface CleaningSection {
  id: string;
  name: string;
  color: string;
  items: CleaningItem[];
}

interface Reminder {
  id: string;
  text: string;
}

const DEFAULT_SECTIONS: CleaningSection[] = [
  { id: "1", name: "LIMPEZA DIÁRIA", color: "bg-yellow-200 dark:bg-yellow-800/50", items: [
    { id: "d1", text: "Arrumar as camas", done: false },
    { id: "d2", text: "Retirar os lixos", done: false },
    { id: "d3", text: "Lavar a louça", done: false },
    { id: "d4", text: "Limpar bancadas da cozinha", done: false },
  ]},
  { id: "2", name: "LIMPEZA SEMANAL", color: "bg-purple-200 dark:bg-purple-800/50", items: [
    { id: "s1", text: "Trocar roupa de cama", done: false },
    { id: "s2", text: "Limpar o chão da casa", done: false },
    { id: "s3", text: "Tirar o pó", done: false },
    { id: "s4", text: "Lavar roupas", done: false },
  ]},
  { id: "3", name: "LIMPEZA MENSAL", color: "bg-green-200 dark:bg-green-800/50", items: [
    { id: "m1", text: "Limpar vidros e janelas", done: false },
    { id: "m2", text: "Lavar cortinas ou limpar persianas", done: false },
    { id: "m3", text: "Limpar armários por dentro", done: false },
    { id: "m4", text: "Limpar eletrodomésticos por dentro", done: false },
  ]},
];

const BODY_COLORS: Record<string, string> = {
  "bg-yellow-200 dark:bg-yellow-800/50": "bg-yellow-50 dark:bg-yellow-950/20",
  "bg-purple-200 dark:bg-purple-800/50": "bg-purple-50 dark:bg-purple-950/20",
  "bg-green-200 dark:bg-green-800/50": "bg-green-50 dark:bg-green-950/20",
  "bg-blue-200 dark:bg-blue-800/50": "bg-blue-50 dark:bg-blue-950/20",
  "bg-pink-200 dark:bg-pink-800/50": "bg-pink-50 dark:bg-pink-950/20",
  "bg-orange-200 dark:bg-orange-800/50": "bg-orange-50 dark:bg-orange-950/20",
  "bg-cyan-200 dark:bg-cyan-800/50": "bg-cyan-50 dark:bg-cyan-950/20",
};

const SECTION_COLORS = [
  { label: "Amarelo", value: "bg-yellow-200 dark:bg-yellow-800/50" },
  { label: "Lilás", value: "bg-purple-200 dark:bg-purple-800/50" },
  { label: "Verde", value: "bg-green-200 dark:bg-green-800/50" },
  { label: "Azul", value: "bg-blue-200 dark:bg-blue-800/50" },
  { label: "Rosa", value: "bg-pink-200 dark:bg-pink-800/50" },
  { label: "Laranja", value: "bg-orange-200 dark:bg-orange-800/50" },
  { label: "Ciano", value: "bg-cyan-200 dark:bg-cyan-800/50" },
];

const CleaningRoutine = () => {
  const [sections, setSections] = usePersistedState<CleaningSection[]>("casa-cleaning-routine", DEFAULT_SECTIONS);
  const [reminders, setReminders] = usePersistedState<Reminder[]>("casa-cleaning-reminders", []);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [newReminder, setNewReminder] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLORS[0].value);

  const addItem = (sectionId: string) => {
    const text = inputs[sectionId]?.trim();
    if (!text) return;
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: [...s.items, { id: Date.now().toString(), text, done: false }] } : s
    ));
    setInputs(prev => ({ ...prev, [sectionId]: "" }));
  };

  const toggleItem = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) } : s
    ));
  };

  const removeItem = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s
    ));
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    setSections(prev => [...prev, {
      id: Date.now().toString(),
      name: newSectionName.trim().toUpperCase(),
      color: newSectionColor,
      items: [],
    }]);
    setNewSectionName("");
    setShowAddSection(false);
  };

  const removeSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id));

  const addReminderItem = () => {
    if (!newReminder.trim()) return;
    setReminders(prev => [...prev, { id: Date.now().toString(), text: newReminder.trim() }]);
    setNewReminder("");
  };

  const removeReminder = (id: string) => setReminders(prev => prev.filter(r => r.id !== id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wide">Rotina de Limpeza</h3>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAddSection(!showAddSection)}>
          <Plus className="w-3 h-3" /> Seção
        </Button>
      </div>

      {/* Add Section Form */}
      {showAddSection && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-bold">Nova Seção de Limpeza</p>
          <Input
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Ex: Limpeza Quinzenal"
            className="text-sm h-9"
            onKeyDown={e => e.key === "Enter" && addSection()}
          />
          <div className="flex gap-2 flex-wrap">
            {SECTION_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setNewSectionColor(c.value)}
                className={`w-8 h-8 rounded-lg ${c.value.split(" ")[0]} border-2 transition-all ${newSectionColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 flex-1" onClick={addSection}>Adicionar</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAddSection(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Reminders Card (Lembretes para a Diarista) */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="bg-pink-100 dark:bg-pink-900/30 px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📌</span>
            <h4 className="text-base font-black uppercase tracking-wide text-foreground">Lembretes para a Diarista</h4>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {reminders.map(r => (
            <div key={r.id} className="flex items-start gap-2 bg-pink-50 dark:bg-pink-950/20 rounded-lg px-3 py-2.5 group border-l-4 border-orange-400">
              <span className="text-sm flex-1 text-foreground">{r.text}</span>
              <button onClick={() => removeReminder(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
          {reminders.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-1">Adicione lembretes importantes para a diarista</p>
          )}
          <div className="flex gap-2 pt-1">
            <Input
              value={newReminder}
              onChange={e => setNewReminder(e.target.value)}
              placeholder="Novo lembrete..."
              className="text-sm h-9 flex-1"
              onKeyDown={e => e.key === "Enter" && addReminderItem()}
            />
            <Button size="sm" className="h-9" onClick={addReminderItem}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Cleaning Sections */}
      {sections.map(section => {
        const bodyColor = BODY_COLORS[section.color] || "bg-card";
        const doneCount = section.items.filter(i => i.done).length;
        return (
          <div key={section.id} className={`rounded-2xl border border-border overflow-hidden ${bodyColor}`}>
            {/* Colored Header */}
            <div className={`${section.color} px-5 py-4 flex items-center justify-between`}>
              <h4 className="text-base font-black uppercase tracking-wide text-foreground">{section.name}</h4>
              <div className="flex items-center gap-2">
                {section.items.length > 0 && (
                  <span className="text-xs font-bold text-foreground/70">{doneCount}/{section.items.length}</span>
                )}
                <button onClick={() => removeSection(section.id)} className="opacity-60 hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>

            {/* Tasks */}
            <div className="p-4 space-y-1">
              {section.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 group">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => toggleItem(section.id, item.id)}
                    className="w-5 h-5"
                  />
                  <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.text}
                  </span>
                  <button onClick={() => removeItem(section.id, item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}

              {section.items.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 italic">Nenhuma tarefa ainda</p>
              )}

              {/* Inline add */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Checkbox disabled className="w-5 h-5 opacity-30" />
                <Input
                  value={inputs[section.id] || ""}
                  onChange={e => setInputs(prev => ({ ...prev, [section.id]: e.target.value }))}
                  placeholder="Adicionar tarefa..."
                  className="text-sm h-8 border-0 bg-transparent shadow-none px-0 focus-visible:ring-0"
                  onKeyDown={e => e.key === "Enter" && addItem(section.id)}
                />
                {(inputs[section.id] || "").trim() && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => addItem(section.id)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CleaningRoutine;
