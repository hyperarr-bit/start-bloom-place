import { useState } from "react";
import { Trash2, Gift, Plus } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { Input } from "@/components/ui/input";

interface GiftItem {
  id: string;
  person: string;
  idea: string;
  link: string;
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
  const [person, setPerson] = useState("");
  const [idea, setIdea] = useState("");
  const [link, setLink] = useState("");

  const addGift = () => {
    if (!idea.trim()) return;
    const updated = [...gifts, { id: Date.now().toString(), person: person.trim(), idea: idea.trim(), link: link.trim(), status: "idea" as const }];
    set("rel-gifts", updated);
    setIdea(""); setPerson(""); setLink("");
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

  return (
    <div className="mt-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-amber-200 dark:bg-amber-900/60 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Presentes</span>
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-300">{gifts.length}</span>
        </div>

        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-1.5">
          <div className="grid grid-cols-12 gap-1 px-2 py-1">
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Pessoa</span>
            <span className="col-span-4 text-[9px] font-bold uppercase text-muted-foreground">Ideia</span>
            <span className="col-span-3 text-[9px] font-bold uppercase text-muted-foreground">Link</span>
            <span className="col-span-2 text-[9px] font-bold uppercase text-muted-foreground text-right">Status</span>
          </div>

          {gifts.map(g => {
            const st = statusLabels[g.status];
            return (
              <div key={g.id} className="grid grid-cols-12 gap-1 items-center bg-background/60 rounded-lg px-2 py-1.5 group">
                <span className="col-span-3 text-xs truncate">{g.person || "—"}</span>
                <span className={`col-span-4 text-xs truncate ${g.status === "delivered" ? "line-through text-muted-foreground" : ""}`}>{g.idea}</span>
                <div className="col-span-3">
                  {g.link ? (
                    <a href={g.link.startsWith("http") ? g.link : `https://${g.link}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary truncate block hover:underline">{g.link}</a>
                  ) : <span className="text-[10px] text-muted-foreground">—</span>}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button onClick={() => cycleStatus(g.id)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${st.color}`}>
                    {st.label}
                  </button>
                  <button onClick={() => removeGift(g.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {gifts.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-3 text-center">Nenhum presente ainda</p>
          )}

          <div className="border border-dashed border-border/60 bg-background/50 rounded-lg p-2 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <Input placeholder="Para quem?" value={person} onChange={e => setPerson(e.target.value)} className="h-7 text-[11px]" list="gift-people" />
              <Input placeholder="Ideia" value={idea} onChange={e => setIdea(e.target.value)} className="h-7 text-[11px]" />
              <Input placeholder="Link (opcional)" value={link} onChange={e => setLink(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <datalist id="gift-people">
              {people.map((p: any) => <option key={p.id} value={p.name} />)}
            </datalist>
            <button onClick={addGift} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md py-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar presente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
