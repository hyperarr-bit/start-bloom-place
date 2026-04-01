import { usePersistedState } from "@/hooks/use-persisted-state";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon } from "lucide-react";
import type { SkinEntry } from "./utils";

const getDateKey = () => new Date().toISOString().slice(0, 10);

export const StatusHeader = () => {
  const [entries] = usePersistedState<SkinEntry[]>("beauty-skin-diary", []);
  const [morningChecked] = usePersistedState<Record<string, number[]>>("skincare-morning-checked", {});
  const [nightChecked] = usePersistedState<Record<string, number[]>>("skincare-night-checked", {});

  const today = getDateKey();
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 17;
  const lastEntry = entries[0];

  const skinEmoji: Record<string, string> = { oleosa: "💦", seca: "🏜️", normal: "✨", mista: "🔄", sensível: "🌸", acneica: "🔴" };

  // Streak
  const streak = (() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const key = d.toISOString().slice(0, 10);
      const m = morningChecked[key];
      const n = nightChecked[key];
      if ((m && m.length > 0) || (n && n.length > 0)) count++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isMorning ? "bg-amber-500/15" : "bg-indigo-500/15"}`}>
            {isMorning ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </div>
          <div>
            <p className="text-xs font-semibold">
              {isMorning ? "☀️ Hora da rotina matinal" : "🌙 Hora da rotina noturna"}
            </p>
            {lastEntry && (
              <p className="text-[10px] text-muted-foreground">
                Última pele: {skinEmoji[lastEntry.skin] || "✨"} {lastEntry.skin} • {lastEntry.mood}
              </p>
            )}
            {!lastEntry && (
              <p className="text-[10px] text-muted-foreground">Faça seu primeiro check-in no Diário</p>
            )}
          </div>
        </div>
        {streak > 0 && <Badge variant="secondary" className="text-xs">🔥 {streak} dias</Badge>}
      </div>
    </div>
  );
};
