import { useState } from "react";
import { motion } from "framer-motion";
import { Moon, Minus, Plus } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";

export const SleepLogWidget = () => {
  const { get, set: setData } = useUserData();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [sleepLog, setSleepLog] = useState(() => get<Record<string, number>>("core-saude-sleep", {}));
  const hours = sleepLog[todayStr] || 0;

  const update = (val: number) => {
    const clamped = Math.max(0, Math.min(14, val));
    const next = { ...sleepLog, [todayStr]: clamped };
    setSleepLog(next);
    setData("core-saude-sleep", next);
  };

  const quality = hours >= 7 ? "Ótimo 😊" : hours >= 5 ? "Regular 😐" : hours > 0 ? "Pouco 😴" : "Não registrado";

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">😴 Sono de Hoje</h4>
      <div className="flex items-center gap-4">
        <Moon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
        <div className="flex items-center gap-3">
          <button onClick={() => update(hours - 0.5)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80">
            <Minus className="w-3 h-3" />
          </button>
          <div className="text-center min-w-[3rem]">
            <span className="text-lg font-bold">{hours}</span>
            <span className="text-[10px] text-muted-foreground ml-0.5">h</span>
          </div>
          <button onClick={() => update(hours + 0.5)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">{quality}</span>
      </div>
    </div>
  );
};
