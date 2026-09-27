import { useEffect, useState } from "react";
import { localDayKey } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";
import { avisarApagado } from "@/lib/desfazer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Plus, X, AlertTriangle, ShieldCheck } from "lucide-react";
import { getStepIcon, conflitosDaRotina, faseDoCiclo, inserirEm, marcadosAposInserir, marcadosAposRemover } from "./utils";
import { useChaveDaBeleza } from "./estado-compartilhado";

const getDateKey = () => localDayKey();

interface RoutineStep {
  name: string;
  isSunscreen?: boolean;
  isAcid?: boolean;
}

const DEFAULT_MORNING: RoutineStep[] = [];
const DEFAULT_NIGHT: RoutineStep[] = [];

const SKIN_CYCLE_PHASES = [
  { label: "Esfoliação", emoji: "✨", desc: "Ácido Glicólico ou Lático", color: "text-emerald-600 dark:text-emerald-400" },
  { label: "Retinol", emoji: "💎", desc: "Anti-idade e renovação", color: "text-purple-600 dark:text-purple-400" },
  { label: "Recuperação", emoji: "🧊", desc: "Só hidratação e calmantes", color: "text-muted-foreground" },
  { label: "Recuperação", emoji: "🧊", desc: "Só hidratação e calmantes", color: "text-muted-foreground" },
];

export const SkincareRoutine = () => {
  const today = getDateKey();
  const { loaded, set: gravarChave } = useUserData();
  // Todas pela mesma fonte do Espelho do dia (useChaveDaBeleza): marcar
  // "Sensível" lá ou um passo aqui aparece nos dois na hora (26/09, varredura).
  const [morningSteps, setMorningSteps] = useChaveDaBeleza<RoutineStep[]>("skincare-am-steps", DEFAULT_MORNING);
  const [nightSteps, setNightSteps] = useChaveDaBeleza<RoutineStep[]>("skincare-pm-steps", DEFAULT_NIGHT);
  const [morningChecked, setMorningChecked] = useChaveDaBeleza<Record<string, number[]>>("skincare-morning-checked", {});
  const [nightChecked, setNightChecked] = useChaveDaBeleza<Record<string, number[]>>("skincare-night-checked", {});
  const [cycleStart] = useChaveDaBeleza<string>("skincare-cycle-start", "");
  const [checkins] = useChaveDaBeleza<Record<string, string>>("skincare-daily-checkin", {});
  const [triggers] = useChaveDaBeleza<string[]>("skincare-triggers", []);
  const [showGuide, setShowGuide] = useState(false);
  const [newStepAm, setNewStepAm] = useState("");
  const [newStepPm, setNewStepPm] = useState("");
  const [newStepSunscreen, setNewStepSunscreen] = useState(false);
  const [newStepAcid, setNewStepAcid] = useState(false);

  const todaySkin = checkins[today] || "";
  const isSensitive = todaySkin === "sensivel";

  /* SKIN CYCLING PARADO NO DIA 1 (26/09, varredura): o início do ciclo nunca
     era gravado — o padrão era "hoje", então todo dia virava "Esfoliação ·
     Dia 1/4". Grava na 1ª vez que a rotina abre, só depois de carregar (senão
     um aparelho novo gravaria "hoje" por cima do início que está no servidor),
     e como escrita de SISTEMA (não é gesto da pessoa, não conta ativação). */
  useEffect(() => {
    if (!loaded || cycleStart) return;
    gravarChave("skincare-cycle-start", today, { system: true });
  }, [loaded, cycleStart, today, gravarChave]);

  const cyclePhase = faseDoCiclo(cycleStart || today, today);
  const currentPhase = SKIN_CYCLE_PHASES[cyclePhase];

  const todayMorning = Array.isArray(morningChecked[today]) ? morningChecked[today] : [];
  const todayNight = Array.isArray(nightChecked[today]) ? nightChecked[today] : [];

  const toggleStep = (period: "am" | "pm", index: number) => {
    const setChecked = period === "am" ? setMorningChecked : setNightChecked;
    setChecked(prev => {
      const arr = Array.isArray(prev[today]) ? [...prev[today]] : [];
      arr.includes(index) ? arr.splice(arr.indexOf(index), 1) : arr.push(index);
      return { ...prev, [today]: arr };
    });
  };

  /* APAGAR NO MODO SENSÍVEL APAGAVA OUTRO PASSO (26/09, varredura): a lista
     da noite era FILTRADA (sem os ácidos) e o índice da lista filtrada ia
     pro array completo — X no "Hidratante noturno" apagava o Retinol. Os
     checks tinham o mesmo desvio. Agora cada linha leva o índice ORIGINAL. */
  const noiteVisivel = nightSteps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => !(isSensitive && step.isAcid));
  const feitosManha = morningSteps.filter((_, i) => todayMorning.includes(i)).length;
  const feitosNoite = noiteVisivel.filter(({ i }) => todayNight.includes(i)).length;

  // Só cobra protetor quando EXISTE passo de protetor e o resto já foi feito
  // (antes aparecia pra rotina sem protetor nenhum).
  const sunscreenIdx = morningSteps.findIndex(s => s.isSunscreen);
  const sunscreenDone = sunscreenIdx >= 0 && todayMorning.includes(sunscreenIdx);
  const morningMissingSunscreen = sunscreenIdx >= 0 && !sunscreenDone && morningSteps.length > 1
    && morningSteps.every((_, i) => i === sunscreenIdx || todayMorning.includes(i));

  const morningPct = morningSteps.length > 0 ? Math.round((feitosManha / morningSteps.length) * 100) : 0;
  const nightPct = noiteVisivel.length > 0 ? Math.round((feitosNoite / noiteVisivel.length) * 100) : 0;

  const allStepNames = [...morningSteps.map(s => s.name), ...nightSteps.map(s => s.name)];
  const conflicts = conflitosDaRotina(morningSteps.map(s => s.name), nightSteps.map(s => s.name));

  const addStep = (period: "am" | "pm") => {
    const text = period === "am" ? newStepAm : newStepPm;
    if (!text.trim()) return;
    const step: RoutineStep = {
      name: text.trim(),
      isSunscreen: period === "am" ? newStepSunscreen : false,
      isAcid: period === "pm" ? newStepAcid : false,
    };
    if (period === "am") {
      setMorningSteps(prev => [...prev, step]);
      setNewStepAm("");
      setNewStepSunscreen(false);
    } else {
      setNightSteps(prev => [...prev, step]);
      setNewStepPm("");
      setNewStepAcid(false);
    }
  };

  // Apaga já e oferece Desfazer (26/09, varredura: o X apagava sem volta).
  // Os checks de hoje andam junto com os índices; o Desfazer devolve o passo
  // na mesma posição, com o check que ele tinha.
  const removeStep = (period: "am" | "pm", idx: number) => {
    const setSteps = period === "am" ? setMorningSteps : setNightSteps;
    const setChecked = period === "am" ? setMorningChecked : setNightChecked;
    const passo = (period === "am" ? morningSteps : nightSteps)[idx];
    if (!passo) return;
    const dia = today;
    const estavaMarcado = (period === "am" ? todayMorning : todayNight).includes(idx);
    setSteps(prev => prev.filter((_, i) => i !== idx));
    setChecked(prev => ({ ...prev, [dia]: marcadosAposRemover(Array.isArray(prev[dia]) ? prev[dia] : [], idx) }));
    avisarApagado(`"${passo.name}" saiu da rotina`, () => {
      let pos = idx;
      setSteps(prev => { pos = Math.min(idx, prev.length); return inserirEm(prev, pos, passo); });
      setChecked(prev => ({ ...prev, [dia]: marcadosAposInserir(Array.isArray(prev[dia]) ? prev[dia] : [], pos, estavaMarcado) }));
    });
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
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50">{feitosManha}/{morningSteps.length}</Badge>
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
                <button onClick={() => removeStep("am", i)} aria-label={`Tirar ${step.name} da rotina`} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {morningSteps.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-2 px-1">Adicione seus passos de skincare matinal abaixo</p>
          )}

          {morningMissingSunscreen && (
            <div className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
              <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">☀️ Aplique o Protetor Solar para concluir a rotina!</p>
            </div>
          )}

          {/* Always-visible inline input */}
          <div className="flex gap-2 items-center pt-1">
            <Input
              placeholder="Ex: Gel de limpeza, Tônico, Vitamina C..."
              value={newStepAm}
              onChange={e => setNewStepAm(e.target.value)}
              className="h-8 text-xs border-dashed border-border/60 bg-background/50 flex-1"
              onKeyDown={e => { if (e.key === "Enter") addStep("am"); }}
            />
            <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={() => addStep("am")}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <Checkbox checked={newStepSunscreen} onCheckedChange={v => setNewStepSunscreen(!!v)} className="w-3 h-3" />
              ☀️ Protetor solar
            </label>
          </div>
        </div>
      </div>

      {/* ====== NIGHT ====== */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-purple-200 dark:bg-purple-800/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">🌙 ROTINA DA NOITE</span>
          </div>
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-background/50">{feitosNoite}/{noiteVisivel.length}</Badge>
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
            {/* `i` é o índice no array COMPLETO (ver noiteVisivel); `pos` é a
                posição na tela. O passo ácido mostra o NOME dele — antes virava
                "✨ Esfoliação (Ácido Glicólico ou Lático)" e a pessoa não sabia
                qual produto era; a fase da noite já está no card do ciclo. */}
            {noiteVisivel.map(({ step, i }, pos) => (
              <div key={i} className="flex items-center gap-2.5 group py-1.5 px-1 rounded-lg hover:bg-background/50 transition-colors">
                <Checkbox
                  checked={todayNight.includes(i)}
                  onCheckedChange={() => toggleStep("pm", i)}
                />
                <span className="text-base">{getStepIcon(step.name)}</span>
                <span className={`text-xs flex-1 ${todayNight.includes(i) ? "line-through text-muted-foreground" : ""}`}>
                  {step.name}
                </span>
                {step.isAcid && (
                  <span className="text-[8px] text-muted-foreground">ativo</span>
                )}
                {pos === 0 && !todayNight.includes(i) && (
                  <span className="text-[8px] text-muted-foreground">Remova o protetor!</span>
                )}
                <button onClick={() => removeStep("pm", i)} aria-label={`Tirar ${step.name} da rotina`} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {nightSteps.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic py-2 px-1">Adicione seus passos de skincare noturno abaixo</p>
          )}

          {/* Always-visible inline input */}
          <div className="flex gap-2 items-center pt-1">
            <Input
              placeholder="Ex: Demaquilante, Sérum, Hidratante..."
              value={newStepPm}
              onChange={e => setNewStepPm(e.target.value)}
              className="h-8 text-xs border-dashed border-border/60 bg-background/50 flex-1"
              onKeyDown={e => { if (e.key === "Enter") addStep("pm"); }}
            />
            <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={() => addStep("pm")}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <Checkbox checked={newStepAcid} onCheckedChange={v => setNewStepAcid(!!v)} className="w-3 h-3" />
              💎 Ácido / Tratamento ativo
            </label>
          </div>
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
