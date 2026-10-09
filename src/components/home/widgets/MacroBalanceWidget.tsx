import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useConsumoDeHoje } from "@/hooks/use-consumo-de-hoje";

export const MacroBalanceWidget = () => {
  const navigate = useNavigate();
  // 09/10: a mesma conta do widget Calorias e do hub — log do dia + refeições do
  // diário da Dieta marcadas como seguidas (gramas do cardápio), sem somar em dobro.
  const consumo = useConsumoDeHoje();
  const protein = consumo.macros.p, carbs = consumo.macros.c, fat = consumo.macros.g;

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
        /* 18/09: o widget existia, mas nada escrevia protein/carbs/fat — ficava
           em branco pra sempre. Agora diz ONDE anotar e leva lá. */
        <button type="button" onClick={() => navigate("/dieta")} className="text-left text-xs text-muted-foreground" data-testid="macros-vazio">
          Anote P · C · G no cardápio da Dieta e marque o que comeu — <span className="font-medium text-foreground">abrir Dieta</span>
        </button>
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
