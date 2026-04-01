import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Plus, X, AlertTriangle, ShieldCheck, Settings2 } from "lucide-react";
import { getStepIcon, checkConflicts } from "./utils";

const getDateKey = () => new Date().toISOString().slice(0, 10);

interface RoutineStep {
  name: string;
  isSunscreen?: boolean;
  isAcid?: boolean;
}

const DEFAULT_MORNING: RoutineStep[] = [
  { name: "Gel de Limpeza" },
  { name: "Tônico / Essência" },
  { name: "Vitamina C (Tratamento)" },
  { name: "Hidratante Leve" },
  { name: "Protetor Solar FPS 60", isSunscreen: true },
];

const DEFAULT_NIGHT: RoutineStep[] = [
  { name: "Cleansing Oil (Limpeza Dupla)" },
  { name: "Sabonete Facial" },
  { name: "Tratamento do Dia", isAcid: true },
  { name: "Hidratação Profunda" },
];

const SKIN_CYCLE_PHASES = [
  { label: "Esfoliação", emoji: "✨", desc: "Ácido Glicólico ou Lático", color: "text-emerald-600 dark:text-emerald-400" },
  { label: "Retinol", emoji: "💎", desc: "Anti-idade e renovação", color: "text-purple-600 dark:text-purple-400" },
  { label: "Recuperação", emoji: "🧊", desc: "Só hidratação e calmantes", color: "text-muted-foreground" },
  { label: "Recuperação", emoji: "🧊", desc: "Só hidratação e calmantes", color: "text-muted-foreground" },
];

export const SkincareRoutine = () => {
  const today = getDateKey();
  const [morningSteps, setMorningSteps] = usePersistedState<RoutineStep[]>("skincare-am-steps", DEFAULT_MORNING);
  const [nightSteps, setNightSteps] = usePersistedState<RoutineStep[]>("skincare-pm-steps", DEFAULT_NIGHT);
  const [morningChecked, setMorningChecked] = usePersistedState<Record<string, number[]>>("skincare-morning-checked", {});
  const [nightChecked, setNightChecked] = usePersistedState<Record<string, number[]>>("skincare-night-checked", {});
  const [cycleStart] = usePersistedState<string>("skincare-cycle-start", today);
  const [checkins] = usePersistedState<Record<string, string>>("skincare-daily-checkin", {});
  const [triggers] = usePersistedState<string[]>("skincare-triggers", []);
  const [showGuide, setShowGuide] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [editingPeriod, setEditingPeriod] = useState<"am" | "pm" | null>(null);

  const todaySkin = checkins[today] || "";
  const isSensitive = todaySkin === "sensivel";

  const daysSinceStart = Math.floor((new Date(today + "T12:00:00").getTime() - new Date(cycleStart + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24));
  const cyclePhase = ((daysSinceStart % 4) + 4) % 4;
  const currentPhase = SKIN_CYCLE_PHASES[cyclePhase];

  const todayMorning = morningChecked[today] || [];
  const todayNight = nightChecked[today] || [];

  const toggleStep = (period: "am" | "pm", index: number) => {
    if (period === "am") {
      const arr = [...todayMorning];
      arr.includes(index) ? arr.splice(arr.indexOf(index), 1) : arr.push(index);
      setMorningChecked(prev => ({ ...prev, [today]: arr }));
    } else {
      const arr = [...todayNight];
      arr.includes(index) ? arr.splice(arr.indexOf(index), 1) : arr.push(index);
      setNightChecked(prev => ({ ...prev, [today]: arr }));
    }
  };

  const effectiveNightSteps = isSensitive ? nightSteps.filter(s => !s.isAcid) : nightSteps;

  const sunscreenIdx = morningSteps.findIndex(s => s.isSunscreen);
  const sunscreenDone = sunscreenIdx >= 0 && todayMorning.includes(sunscreenIdx);
  const morningMissingSunscreen = todayMorning.length === morningSteps.length - 1 && !sunscreenDone;

  const morningPct = morningSteps.length > 0 ? Math.round((todayMorning.length / morningSteps.length) * 100) : 0;
  const nightPct = effectiveNightSteps.length > 0 ? Math.round((todayNight.length / effectiveNightSteps.length) * 100) : 0;

  const allStepNames = [...morningSteps.map(s => s.name), ...nightSteps.map(s => s.name)];
  const conflicts = checkConflicts(allStepNames);

  const addStep = (period: "am" | "pm") => {
    if (!newStep.trim()) return;
    const step: RoutineStep = { name: newStep.trim() };
    if (period === "am") setMorningSteps(prev => [...prev, step]);
    else setNightSteps(prev => [...prev, step]);
    setNewStep("");
  };

  const removeStep = (period: "am" | "pm", idx: number) => {
    if (period === "am") setMorningSteps(prev => prev.filter((_, i) => i !== idx));
    else setNightSteps(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Conflict alerts */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800/30 overflow-hidden">
          <div className="bg-red-200 dark:bg-red-800/50 px-3 py-1.5 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">⚠️ CONFLITOS DETECTADOS</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 p-3 space-y-1">
            {conflicts.map((c, i) => (
              <div key={i}>
                <p className="text-[10px] text-red-700 dark:text-red-300">{c.message}</p>
                <p className="text-[9px] text-muted-foreground">💡 {c.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length === 0 && allStepNames.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Nenhum conflito de ativos ✅</p>
        </div>
      )}

      {/* ====== MORNING ====== */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-green-200 dark:bg-green-800/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">☀️ ROTINA DA MANHÃ</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50">{todayMorning.length}/{morningSteps.length}</Badge>
            <button onClick={() => setEditingPeriod(editingPeriod === "am" ? null : "am")} className="text-foreground/70 hover:text-foreground">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 p-4 space-y-2">
          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${morningPct}%` }} />
          </div>

          {/* Steps */}
          <div className="space-y-0.5">
            {morningSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 group py-1.5 px-1 rounded-lg hover:bg-background/50 transition-colors">
                <Checkbox
                  checked={todayMorning.includes(i)}
                  onCheckedChange={() => toggleStep("am", i)}
                />
                <span className="text-base">{getStepIcon(step.name)}</span>
                <span className={`text-xs flex-1 ${todayMorning.includes(i) ? "line-through text-muted-foreground" : ""}`}>
                  {step.name}
                </span>
                {step.isSunscreen && !todayMorning.includes(i) && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">
                    OBRIGATÓRIO
                  </span>
                )}
                {editingPeriod === "am" && (
                  <button onClick={() => removeStep("am", i)} className="text-red-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {morningMissingSunscreen && (
            <div className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">☀️ Aplique o Protetor Solar para concluir a rotina!</p>
            </div>
          )}

          {editingPeriod === "am" && (
            <div className="flex gap-2">
              <Input placeholder="Novo passo..." value={newStep} onChange={e => setNewStep(e.target.value)}
                className="h-8 text-xs" onKeyDown={e => { if (e.key === "Enter") addStep("am"); }} />
              <Button size="sm" className="h-8" onClick={() => addStep("am")}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ====== NIGHT ====== */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-purple-200 dark:bg-purple-800/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">🌙 ROTINA DA NOITE</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50">{todayNight.length}/{effectiveNightSteps.length}</Badge>
            <button onClick={() => setEditingPeriod(editingPeriod === "pm" ? null : "pm")} className="text-foreground/70 hover:text-foreground">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/20 p-4 space-y-2">
          {/* Skin Cycling Phase */}
          {!isSensitive && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/30">
              <span className="text-lg">{currentPhase.emoji}</span>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Skin Cycling: {currentPhase.label}</p>
                <p className="text-[9px] text-muted-foreground">{currentPhase.desc}</p>
              </div>
              <span className="text-[8px] text-muted-foreground">Dia {(cyclePhase + 1)}/4</span>
            </div>
          )}

          {isSensitive && (
            <div className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">🍅 Modo sensível — apenas hidratação e calmantes</p>
            </div>
          )}

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${nightPct}%` }} />
          </div>

          {/* Steps */}
          <div className="space-y-0.5">
            {effectiveNightSteps.map((step, i) => {
              const displayName = step.isAcid && !isSensitive ? `${currentPhase.emoji} ${currentPhase.label} (${currentPhase.desc})` : step.name;
              return (
                <div key={i} className="flex items-center gap-2.5 group py-1.5 px-1 rounded-lg hover:bg-background/50 transition-colors">
                  <Checkbox
                    checked={todayNight.includes(i)}
                    onCheckedChange={() => toggleStep("pm", i)}
                  />
                  <span className="text-base">{step.isAcid ? currentPhase.emoji : getStepIcon(step.name)}</span>
                  <span className={`text-xs flex-1 ${todayNight.includes(i) ? "line-through text-muted-foreground" : ""}`}>
                    {displayName}
                  </span>
                  {i === 0 && !todayNight.includes(0) && (
                    <span className="text-[8px] text-muted-foreground">Remova o protetor!</span>
                  )}
                  {editingPeriod === "pm" && (
                    <button onClick={() => removeStep("pm", i)} className="text-red-400 hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {editingPeriod === "pm" && (
            <div className="flex gap-2">
              <Input placeholder="Novo passo..." value={newStep} onChange={e => setNewStep(e.target.value)}
                className="h-8 text-xs" onKeyDown={e => { if (e.key === "Enter") addStep("pm"); }} />
              <Button size="sm" className="h-8" onClick={() => addStep("pm")}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Skin Cycling Config — Notion-style */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-indigo-200 dark:bg-indigo-800/50 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wider">🔄 CICLO DE 4 DIAS</span>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-muted-foreground">Esfoliação → Retinol → Recuperação × 2</p>
            <div className="flex gap-1">
              {SKIN_CYCLE_PHASES.map((p, i) => (
                <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-all ${
                  i === cyclePhase ? "border-indigo-400 bg-indigo-100 dark:bg-indigo-800/30 scale-110" : "border-border"
                }`}>
                  {p.emoji}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conflict guide */}
      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowGuide(!showGuide)}>
        <AlertTriangle className="w-3 h-3 mr-1.5" /> Guia: Pode vs. Não Pode
      </Button>
      {showGuide && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-amber-200 dark:bg-amber-800/50 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">📋 COMBINAÇÕES A EVITAR</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            {[
              { bad: "Retinol + AHA/BHA", tip: "Alterne os dias" },
              { bad: "Retinol + Vitamina C", tip: "Vit C de manhã, Retinol à noite" },
              { bad: "Peróxido de Benzoíla + Vitamina C", tip: "Nunca juntos" },
              { bad: "AHA + BHA juntos", tip: "Alterne os dias" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-red-500 font-bold">✗</span>
                <div><span className="font-medium">{item.bad}</span> <span className="text-muted-foreground">— {item.tip}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triggers banner */}
      {triggers.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800/30 overflow-hidden">
          <div className="bg-red-200 dark:bg-red-800/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">🚫 INGREDIENTES A EVITAR</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 px-3 py-2">
            <p className="text-[9px] text-red-700 dark:text-red-300">{triggers.join(", ")}</p>
          </div>
        </div>
      )}
    </div>
  );
};
