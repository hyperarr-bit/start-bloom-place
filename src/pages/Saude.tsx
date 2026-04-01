import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Scale, Stethoscope, Wrench, AlertTriangle, Droplets, Pill, Moon, Activity, Timer, Smile, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";
import { FastingTimer } from "@/components/saude/FastingTimer";
import { BodyEvolution } from "@/components/saude/BodyEvolution";
import { MedicalLog } from "@/components/saude/MedicalLog";
import { ToolsEmergency } from "@/components/saude/ToolsEmergency";

const todayStr = () => new Date().toISOString().slice(0, 10);

const tabs = [
  { id: "agora", label: "AGORA", icon: "⚡" },
  { id: "evolucao", label: "EVOLUÇÃO", icon: "⚖️" },
  { id: "log", label: "LOG MÉDICO", icon: "🏥" },
  { id: "tools", label: "FERRAMENTAS", icon: "🛠️" },
];

const Saude = () => {
  const navigate = useNavigate();
  const today = todayStr();
  const [activeTab, setActiveTab] = useState("agora");

  // Compute health score from all signals
  const [waterLog] = usePersistedState<Record<string, number>>("core-saude-water", {});
  const [waterGoal] = usePersistedState<number>("core-saude-water-goal", 8);
  const [sleepLog] = usePersistedState<Record<string, number>>("core-saude-sleep", {});
  const [sleepGoal] = usePersistedState<number>("core-saude-sleep-goal", 8);
  const [supplements] = usePersistedState<{ id: string; name: string; stock: number }[]>("core-saude-supplements", []);
  const [supplementLog] = usePersistedState<Record<string, string[]>>("core-saude-supplement-log", {});

  const waterToday = waterLog[today] || 0;
  const waterPct = waterGoal > 0 ? (waterToday / waterGoal) * 100 : 0;
  const mlCurrent = waterToday * 250;
  const mlGoal = waterGoal * 250;
  const sleepToday = sleepLog[today] || 0;
  const sleepOk = sleepToday >= sleepGoal - 1;
  const takenToday = supplementLog[today] || [];
  const medsCount = takenToday.length;
  const medsTotal = supplements.length;
  const debtHours = Math.max(0, sleepGoal - sleepToday);

  // Score: water 30%, sleep 30%, meds 40%
  let score = 0;
  score += Math.min(30, (waterPct / 100) * 30);
  score += sleepOk ? 30 : sleepToday > 0 ? (sleepToday / sleepGoal) * 30 : 0;
  score += medsTotal > 0 ? (medsCount / medsTotal) * 40 : 40;
  score = Math.round(Math.min(100, score));

  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header — Notion style */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lg">≡</span>
          <h1 className="text-base font-bold tracking-tight">CORE — SAÚDE</h1>
          <span className="ml-auto text-xs text-muted-foreground capitalize">{currentMonth}</span>
          <ThemeToggle />
          <button
            onClick={() => {
              setActiveTab("tools");
              setTimeout(() => {
                const el = document.getElementById("saude-sos-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            className="w-8 h-8 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </button>
        </div>
        {/* Tabs row */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Tips card */}
        <ModuleTip
          moduleId="saude"
          tips={[
            "Acompanhe sua hidratação diária e marque seus copos de água",
            "Cadastre seus suplementos e marque conforme tomar cada um",
            "Registre suas medidas corporais na aba ⚖️ Evolução",
            "Use o Log Médico para salvar consultas e exames importantes",
          ]}
        />

        {/* === AGORA TAB === */}
        {activeTab === "agora" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Hydration Card */}
              <div className="rounded-xl p-4 border bg-[hsl(var(--saude-blue)/0.12)] border-[hsl(var(--saude-blue)/0.25)]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--saude-blue))]">Hidratação</p>
                  <Droplets className="w-5 h-5 text-[hsl(var(--saude-blue)/0.5)]" />
                </div>
                <p className="text-sm text-[hsl(var(--saude-blue))]">{(mlCurrent / 1000).toFixed(1)}L / {(mlGoal / 1000).toFixed(1)}L</p>
              </div>

              {/* Supplements Card */}
              <div className="rounded-xl p-4 border bg-[hsl(var(--saude-green)/0.12)] border-[hsl(var(--saude-green)/0.25)]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--saude-green))]">Suplementos</p>
                  <Pill className="w-5 h-5 text-[hsl(var(--saude-green)/0.5)]" />
                </div>
                <p className="text-sm text-[hsl(var(--saude-green))]">{medsCount}/{medsTotal} tomados</p>
              </div>

              {/* Sleep Debt Card */}
              <div className={`rounded-xl p-4 border ${debtHours > 0 ? "bg-[hsl(var(--saude-red)/0.12)] border-[hsl(var(--saude-red)/0.25)]" : "bg-[hsl(var(--saude-green)/0.12)] border-[hsl(var(--saude-green)/0.25)]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-xs font-bold uppercase tracking-wider ${debtHours > 0 ? "text-[hsl(var(--saude-red))]" : "text-[hsl(var(--saude-green))]"}`}>Dívida de Sono</p>
                  <Moon className={`w-5 h-5 ${debtHours > 0 ? "text-[hsl(var(--saude-red)/0.5)]" : "text-[hsl(var(--saude-green)/0.5)]"}`} />
                </div>
                <p className={`text-sm ${debtHours > 0 ? "text-[hsl(var(--saude-red))]" : "text-[hsl(var(--saude-green))]"}`}>
                  {debtHours > 0 ? `-${debtHours} Horas` : "OK ✓"}
                </p>
              </div>

              {/* Health Score Card */}
              <div className="rounded-xl p-4 border bg-muted border-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Score de Hoje</p>
                  <Activity className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-bold text-foreground">Health Score: {score}%</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Ações Rápidas</h2>
              <div className="grid grid-cols-3 gap-2">
                <QuickActionCard icon="⏱️" label="Iniciar Jejum" onClick={() => setActiveTab("agora")} />
                <QuickActionCard icon="🧍" label="Postura/Dor" onClick={() => {}} />
                <QuickActionCard icon="🥱" label="Humor/Sono" onClick={() => setActiveTab("tools")} />
              </div>
            </div>

            {/* Trackers */}
            <HydrationTracker />
            <PharmacyChecklist />
            <FastingTimer />
          </motion.div>
        )}

        {/* === EVOLUÇÃO TAB === */}
        {activeTab === "evolucao" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <BodyEvolution />
          </motion.div>
        )}

        {/* === LOG MÉDICO TAB === */}
        {activeTab === "log" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <MedicalLog />
          </motion.div>
        )}

        {/* === FERRAMENTAS TAB === */}
        {activeTab === "tools" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} id="saude-sos-section">
            <ToolsEmergency />
          </motion.div>
        )}
      </main>
    </div>
  );
};

const QuickActionCard = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
  >
    <span className="text-lg">{icon}</span>
    <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
  </button>
);

export default Saude;
