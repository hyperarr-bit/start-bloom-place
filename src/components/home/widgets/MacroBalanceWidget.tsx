import { motion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";

export const MacroBalanceWidget = () => {
  const { get } = useUserData();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = get<any>("core-dieta-log", {});
  const meals = todayLog[todayStr] || {};

  let protein = 0, carbs = 0, fat = 0;
  Object.values(meals).forEach((m: any) => {
    protein += Number(m?.protein) || 0;
    carbs += Number(m?.carbs) || 0;
    fat += Number(m?.fat) || 0;
  });

  const total = protein + carbs + fat;
  const pctP = total > 0 ? (protein / total) * 100 : 33;
  const pctC = total > 0 ? (carbs / total) * 100 : 33;
  const pctF = total > 0 ? (fat / total) * 100 : 34;

  const macros = [
    { label: "Proteína", value: protein, pct: pctP, color: "bg-blue-500" },
    { label: "Carbos", value: carbs, pct: pctC, color: "bg-amber-500" },
    { label: "Gordura", value: fat, pct: pctF, color: "bg-red-400" },
  ];

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">🥩 Macros do Dia</h4>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">Registre refeições para ver os macros</p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {macros.map(m => (
              <motion.div key={m.label} className={m.color} initial={{ width: 0 }} animate={{ width: `${m.pct}%` }} transition={{ duration: 0.6 }} />
            ))}
          </div>
          <div className="flex justify-between">
            {macros.map(m => (
              <div key={m.label} className="text-center">
                <div className={`w-2 h-2 rounded-full ${m.color} mx-auto mb-0.5`} />
                <p className="text-[10px] font-medium">{m.value}g</p>
                <p className="text-[8px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
