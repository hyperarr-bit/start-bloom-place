import { useState } from "react";
import { Plus, Trash2, Gift, Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";

interface GiftItem {
  id: string;
  person: string;
  idea: string;
  status: "idea" | "bought" | "delivered";
}

const statusLabels: Record<string, { label: string; color: string }> = {
  idea: { label: "Ideia", color: "bg-muted text-muted-foreground" },
  bought: { label: "Comprado", color: "bg-amber-500/20 text-amber-400" },
  delivered: { label: "Entregue", color: "bg-green-500/20 text-green-400" },
};

export const GiftIdeas = () => {
  const { get, set } = useUserData();
  const gifts = get<GiftItem[]>("rel-gifts", []);
  const people = get<any[]>("rel-people", []);
  const [showForm, setShowForm] = useState(false);
  const [person, setPerson] = useState("");
  const [idea, setIdea] = useState("");

  const addGift = () => {
    if (!idea.trim()) return;
    const updated = [...gifts, { id: Date.now().toString(), person: person.trim(), idea: idea.trim(), status: "idea" as const }];
    set("rel-gifts", updated);
    setIdea(""); setPerson("");
    setShowForm(false);
  };

  const cycleStatus = (id: string) => {
    const order: GiftItem["status"][] = ["idea", "bought", "delivered"];
    const updated = gifts.map(g => {
      if (g.id !== id) return g;
      const idx = order.indexOf(g.status);
      return { ...g, status: order[(idx + 1) % order.length] };
    });
    set("rel-gifts", updated);
  };

  const removeGift = (id: string) => {
    set("rel-gifts", gifts.filter(g => g.id !== id));
  };

  const grouped = people.reduce<Record<string, GiftItem[]>>((acc, p: any) => {
    const personGifts = gifts.filter(g => g.person.toLowerCase() === p.name.toLowerCase());
    if (personGifts.length > 0) acc[p.name] = personGifts;
    return acc;
  }, {});

  const ungrouped = gifts.filter(g => !people.some((p: any) => p.name.toLowerCase() === g.person.toLowerCase()));
  if (ungrouped.length > 0) grouped["Outros"] = ungrouped;

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{gifts.length} ideia{gifts.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs text-primary font-bold">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <Input placeholder="Para quem?" value={person} onChange={e => setPerson(e.target.value)} className="h-8 text-sm" list="people-gift-list" />
          <datalist id="people-gift-list">
            {people.map((p: any) => <option key={p.id} value={p.name} />)}
          </datalist>
          <Input placeholder="Ideia de presente" value={idea} onChange={e => setIdea(e.target.value)} className="h-8 text-sm" />
          <button onClick={addGift} className="w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-bold">Salvar</button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Anote ideias de presentes para pessoas especiais 🎁
        </div>
      )}

      {Object.entries(grouped).map(([name, items]) => (
        <div key={name}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <Gift className="w-3 h-3" /> {name}
          </p>
          <div className="space-y-1.5">
            {items.map(g => {
              const st = statusLabels[g.status];
              return (
                <div key={g.id} className="bg-card rounded-lg border border-border p-2.5 flex items-center gap-2">
                  <button onClick={() => cycleStatus(g.id)} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                    {st.label}
                  </button>
                  <span className={`text-xs flex-1 ${g.status === "delivered" ? "line-through text-muted-foreground" : ""}`}>{g.idea}</span>
                  <button onClick={() => removeGift(g.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
