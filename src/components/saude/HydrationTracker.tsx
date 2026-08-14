import { useState } from "react";
import { motion } from "framer-motion";
import { localDayKey } from "@/lib/utils";
import { Droplets, Minus, Pencil, Plus } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

const todayStr = () => localDayKey(); // dia LOCAL — toISOString virava amanhã depois das 21h (fix 16/07)

export const HydrationTracker = () => {
  const today = todayStr();
  const [waterLog, setWaterLog] = usePersistedState<Record<string, number>>("core-saude-water", {});
  const [waterGoalRaw, setWaterGoal] = usePersistedState<number>("core-saude-water-goal", 8);
  const waterGoal = Math.min(20, Math.max(1, Math.round(Number(waterGoalRaw) || 8)));
  const [editandoMeta, setEditandoMeta] = useState(false);
  /*
   * TAMANHO DO COPO (14/08) — veio de avaliação de 3 estrelas na Play:
   * "não consigo configurar ml do copo da água". O copo era 250ml CRAVADO no
   * código, e o lápis ao lado de "1000ml / 2000ml" prometia editar justamente
   * o que não dava: só mudava a QUANTIDADE de copos. Quem bebe em garrafa de
   * 500ml ou 600ml tinha que fazer conta de cabeça — daí o "confuso".
   *
   * A unidade guardada continua sendo PORÇÕES, não ml, porque a Rotina
   * compartilha a mesma chave `water-log` contando copos. Mudar o tamanho
   * reinterpreta o histórico (8 copos viram 4L em vez de 2L) — aceitável:
   * o número de porções do dia continua verdadeiro, e ninguém troca o
   * tamanho do próprio copo toda semana.
   */
  const [copoMlRaw, setCopoMl] = usePersistedState<number>("core-saude-copo-ml", 250);
  const copoMl = Math.min(2000, Math.max(50, Math.round(Number(copoMlRaw) || 250)));
  // FIX 16/07: a ROTINA conta água em water-log — espelha os dois mundos
  // (lê o maior do dia, escreve nos dois) pra nenhuma tela mostrar zero
  const [waterLogRotina, setWaterLogRotina] = usePersistedState<Record<string, number>>("water-log", {});

  const current = Math.max(waterLog[today] || 0, waterLogRotina[today] || 0);
  const pct = Math.min(100, (current / waterGoal) * 100);
  const mlCurrent = current * copoMl;
  const mlGoal = waterGoal * copoMl;

  const addWater = () => {
    const n = Math.min(current + 1, 20);
    setWaterLog(prev => ({ ...prev, [today]: n }));
    setWaterLogRotina(prev => ({ ...prev, [today]: n }));
  };
  const ajustaMeta = (delta: number) => setWaterGoal(Math.min(20, Math.max(1, waterGoal + delta)));

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-[hsl(var(--saude-blue))]" />
          <span className="text-xs font-bold uppercase tracking-wider">Hidratação</span>
        </div>
        <button
          onClick={() => setEditandoMeta(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Editar meta de hidratação"
        >
          {mlCurrent}ml / {mlGoal}ml
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {editandoMeta && (
        <div className="mb-3 rounded-lg bg-[hsl(var(--saude-blue)/0.08)] border border-[hsl(var(--saude-blue)/0.2)] divide-y divide-[hsl(var(--saude-blue)/0.15)]">
          {/* Tamanho do copo PRIMEIRO: é o que a pessoa vem procurar aqui, e
              define o ml de tudo que aparece embaixo. */}
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold">Meu copo / garrafa</span>
              <span className="text-xs font-black tabular-nums">{copoMl}ml</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[200, 250, 300, 500, 600, 750, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => setCopoMl(v)}
                  className={`min-h-9 px-2.5 rounded-lg text-[11px] font-bold tabular-nums border transition-colors ${
                    copoMl === v
                      ? "bg-[hsl(var(--saude-blue))] text-white border-transparent"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {v}ml
                </button>
              ))}
            </div>
            {/* Ajuste fino pra quem tem copo fora dos presets (ex.: 350ml). */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setCopoMl(Math.max(50, copoMl - 50))}
                disabled={copoMl <= 50}
                className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center disabled:opacity-30"
                aria-label="Diminuir 50ml do copo"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-muted-foreground">ajuste de 50 em 50</span>
              <button
                onClick={() => setCopoMl(Math.min(2000, copoMl + 50))}
                disabled={copoMl >= 2000}
                className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center disabled:opacity-30"
                aria-label="Aumentar 50ml do copo"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-xs font-bold">Meta diária</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => ajustaMeta(-1)}
                disabled={waterGoal <= 1}
                className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center disabled:opacity-30"
                aria-label="Diminuir meta"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-black w-24 text-center tabular-nums">
                {waterGoal}× · {mlGoal >= 1000 ? `${(mlGoal / 1000).toFixed(1).replace(".", ",")}L` : `${mlGoal}ml`}
              </span>
              <button
                onClick={() => ajustaMeta(1)}
                disabled={waterGoal >= 20}
                className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center disabled:opacity-30"
                aria-label="Aumentar meta"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Visual cup */}
        <div className="relative w-14 h-20 rounded-b-2xl rounded-t-lg border-2 border-[hsl(var(--saude-blue)/0.3)] overflow-hidden flex-shrink-0">
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            style={{ background: "hsl(var(--saude-blue) / 0.35)" }}
            initial={{ height: 0 }}
            animate={{ height: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-foreground">{current}</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "hsl(var(--saude-blue))" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {/* Dot indicators */}
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: waterGoal }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i < current ? "bg-[hsl(var(--saude-blue))]" : "bg-muted"}`}
              />
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={addWater}
            data-spotlight="add-water"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--saude-blue)/0.12)] hover:bg-[hsl(var(--saude-blue)/0.2)] text-[hsl(var(--saude-blue))] text-xs font-bold transition-colors w-full justify-center border border-[hsl(var(--saude-blue)/0.2)]"
          >
            <Plus className="w-3.5 h-3.5" /> +{copoMl}ml
          </button>

        </div>
      </div>
    </div>
  );
};
