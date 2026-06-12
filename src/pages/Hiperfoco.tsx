import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Brain } from "lucide-react";
import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { ThoughtSearch } from "@/components/hiperfoco/ThoughtSearch";
import { GoalsPanel } from "@/components/hiperfoco/GoalsPanel";
import { StrategyPanel } from "@/components/hiperfoco/StrategyPanel";
import { TimelinePanel } from "@/components/hiperfoco/TimelinePanel";
import { DreamJournal } from "@/components/hiperfoco/DreamJournal";
import { IdeasPanel } from "@/components/hiperfoco/IdeasPanel";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";

const tabs = [
  { id: "dia", label: "DIA", icon: "💭" },
  { id: "busca", label: "BUSCA", icon: "🔍" },
  { id: "metas", label: "METAS", icon: "🎯" },
  { id: "estrategia", label: "ESTRATÉGIA", icon: "♟️" },
  { id: "timeline", label: "TIMELINE", icon: "📅" },
  { id: "ideias", label: "IDEIAS", icon: "💡" },
  { id: "sonhos", label: "SONHOS", icon: "🌙" },
];

const Hiperfoco = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dia");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SpotlightOverlay
        moduleKey="hiperfoco"
        steps={[
          { selector: '[data-spotlight="tab-dia"]', label: "Capture pensamentos rápidos do seu dia.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-metas"]', label: "Defina metas pra manter o foco.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-ideias"]', label: "Salve ideias pra não esquecer depois.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Brain className="w-5 h-5 text-violet-600" />
          <h1 className="text-base font-bold tracking-tight">MENTE</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              data-spotlight={`tab-${tab.id}`}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 space-y-4">
        <ModuleTip
          moduleId="hiperfoco"
          tips={[
            "Capture pensamentos rápidos na aba Dia",
            "Use a busca para encontrar ideias antigas",
            "Defina metas e estratégias para manter o foco",
            "Registre sonhos no diário noturno",
          ]}
        />
        {activeTab === "dia" && <ThoughtCapture />}
        {activeTab === "busca" && <ThoughtSearch />}
        {activeTab === "metas" && <GoalsPanel />}
        {activeTab === "estrategia" && <StrategyPanel />}
        {activeTab === "timeline" && <TimelinePanel />}
        {activeTab === "ideias" && <IdeasPanel />}
        {activeTab === "sonhos" && <DreamJournal />}
      </main>
    </div>
  );
};

export default Hiperfoco;
