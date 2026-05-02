import { useState } from "react";
import { useSetTrackedTab } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, Activity, Moon, Droplet, Phone, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HydrationTracker } from "@/components/saude/HydrationTracker";
import { PharmacyChecklist } from "@/components/saude/PharmacyChecklist";
import { BodyEvolution } from "@/components/saude/BodyEvolution";
import { MedicalLog } from "@/components/saude/MedicalLog";

const todayStr = () => new Date().toISOString().slice(0, 10);

const tabs = [
  { id: "hoje", label: "HOJE", icon: "💊" },
  { id: "evolucao", label: "EVOLUÇÃO", icon: "⚖️" },
  { id: "log", label: "LOG MÉDICO", icon: "🏥" },
];

const Saude = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("hoje");
  useScrollActiveTabIntoView(activeTab);
  useSetTrackedTab(activeTab);
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Heart className="w-5 h-5 text-red-600" />
          <h1 className="text-base font-bold tracking-tight">SAÚDE</h1>
          <span className="ml-auto text-xs text-muted-foreground capitalize">{currentMonth}</span>
          <ThemeToggle />
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id} data-active={activeTab === tab.id}
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
        <ModuleTip
          moduleId="saude"
          tips={[
            "Acompanhe sua hidratação diária e marque seus copos de água",
            "Cadastre seus suplementos e marque conforme tomar cada um",
            "Registre suas medidas corporais na aba ⚖️ Evolução",
            "Use o Log Médico para salvar consultas e exames importantes",
          ]}
        />

        {activeTab === "hoje" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <HydrationTracker />
            <PharmacyChecklist />
            <BMICalculator />
            <SleepCard />
            <SOSCard />
          </motion.div>
        )}

        {activeTab === "evolucao" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <BodyEvolution />
          </motion.div>
        )}

        {activeTab === "log" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <MedicalLog />
          </motion.div>
        )}
      </main>
    </div>
  );
};

/* ---------- Sleep Card ---------- */
const SleepCard = () => {
  const today = todayStr();
  const [sleepLog, setSleepLog] = usePersistedState<Record<string, number>>("core-saude-sleep", {});
  const [sleepGoal] = usePersistedState<number>("core-saude-sleep-goal", 8);
  const [val, setVal] = useState(String(sleepLog[today] || ""));

  const sleepToday = sleepLog[today] || 0;
  const debtHours = Math.max(0, sleepGoal - sleepToday);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Moon className="w-4 h-4 text-[hsl(var(--saude-blue))]" />
        <span className="text-xs font-bold uppercase tracking-wider">Sono</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Horas dormidas:</span>
          <Input
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="Horas"
            value={val}
            onChange={e => {
              setVal(e.target.value);
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n >= 0 && n <= 24) {
                setSleepLog(prev => ({ ...prev, [today]: n }));
              }
            }}
            className="text-xs h-8 w-20"
          />
        </div>
        <div className={`text-xs font-bold ${debtHours > 0 ? "text-[hsl(var(--saude-red))]" : "text-[hsl(var(--saude-green))]"}`}>
          {sleepToday > 0 ? (debtHours > 0 ? `Faltam ${debtHours}h para a meta` : "Meta atingida ✓") : ""}
        </div>
      </div>
    </div>
  );
};

/* ---------- SOS Card ---------- */
const SOSCard = () => {
  const [sosInfo, setSosInfo] = usePersistedState<{ bloodType: string; allergies: string; emergencyContact: string; emergencyPhone: string }>("core-saude-sos", {
    bloodType: "", allergies: "", emergencyContact: "", emergencyPhone: "",
  });
  const [showSOS, setShowSOS] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-border" id="saude-sos-section">
      <button
        onClick={() => setShowSOS(!showSOS)}
        className="w-full p-4 bg-destructive/10 hover:bg-destructive/15 transition-colors flex items-center justify-center gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <span className="text-sm font-black text-destructive uppercase tracking-wider">Ficha SOS - Emergência</span>
      </button>

      {showSOS && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="bg-destructive/5 p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
                <Droplet className="w-3 h-3" /> Tipo Sanguíneo
              </label>
              <Input value={sosInfo.bloodType} onChange={e => setSosInfo(prev => ({ ...prev, bloodType: e.target.value }))} placeholder="A+, O-, AB+..." className="text-xs h-9" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
                <Phone className="w-3 h-3" /> Contato Emergência
              </label>
              <Input value={sosInfo.emergencyPhone} onChange={e => setSosInfo(prev => ({ ...prev, emergencyPhone: e.target.value }))} placeholder="(11) 99999-9999" className="text-xs h-9" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
              <Heart className="w-3 h-3" /> Nome do contato
            </label>
            <Input value={sosInfo.emergencyContact} onChange={e => setSosInfo(prev => ({ ...prev, emergencyContact: e.target.value }))} placeholder="Mãe, Pai, Esposa..." className="text-xs h-9" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3" /> Alergias a Medicamentos
            </label>
            <Input value={sosInfo.allergies} onChange={e => setSosInfo(prev => ({ ...prev, allergies: e.target.value }))} placeholder="Dipirona, Penicilina..." className="text-xs h-9" />
          </div>
        </motion.div>
      )}
    </div>
  );
};

/* ---------- BMI Calculator ---------- */
const BMICalculator = () => {
  const [bmiHeight, setBmiHeight] = usePersistedState("saude-bmi-height", "");
  const [bmiWeight, setBmiWeight] = usePersistedState("saude-bmi-weight", "");

  const parseNum = (v: string) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const heightRaw = parseNum(bmiHeight);
  const weightRaw = parseNum(bmiWeight);
  // Aceita altura em cm (ex: 176) ou metros (ex: 1.76 / 1,76). Se < 3, assume metros.
  const heightM = heightRaw > 3 ? heightRaw / 100 : heightRaw;
  const valid =
    Number.isFinite(heightM) && heightM > 0.5 && heightM < 2.7 &&
    Number.isFinite(weightRaw) && weightRaw > 0 && weightRaw < 500;
  const bmi = valid ? (weightRaw / (heightM * heightM)).toFixed(1) : null;
  const bmiCategory = bmi ? (Number(bmi) < 18.5 ? "Abaixo" : Number(bmi) < 25 ? "Normal ✅" : Number(bmi) < 30 ? "Sobrepeso" : "Obesidade") : "";
  const bmiColor = bmi ? (Number(bmi) < 18.5 ? "text-[hsl(var(--saude-blue))]" : Number(bmi) < 25 ? "text-[hsl(var(--saude-green))]" : Number(bmi) < 30 ? "text-[hsl(var(--saude-yellow))]" : "text-[hsl(var(--saude-red))]") : "";

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-xs font-bold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-[hsl(var(--saude-blue))]" /> CALCULADORA IMC</h3>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <Input type="number" value={bmiHeight} onChange={e => setBmiHeight(e.target.value)} placeholder="Altura" className="text-xs h-8 w-20" />
          <span className="text-xs text-muted-foreground">cm</span>
        </div>
        <div className="flex items-center gap-1">
          <Input type="number" value={bmiWeight} onChange={e => setBmiWeight(e.target.value)} placeholder="Peso" className="text-xs h-8 w-20" />
          <span className="text-xs text-muted-foreground">kg</span>
        </div>
      </div>
      {bmi && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-2xl font-bold">{bmi}</span>
          <span className={`text-sm font-bold ${bmiColor}`}>{bmiCategory}</span>
        </div>
      )}
    </div>
  );
};

export default Saude;
