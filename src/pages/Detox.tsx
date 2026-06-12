import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Leaf } from "lucide-react";
import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { DetoxDiary } from "@/components/detox/DetoxDiary";
import { DetoxAchievements } from "@/components/detox/DetoxAchievements";
import { DetoxStats } from "@/components/detox/DetoxStats";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";

const tabs = [
  { id: "rastreador", label: "RASTREADOR", icon: "🌿" },
  { id: "diario", label: "DIÁRIO", icon: "📓" },
  { id: "conquistas", label: "CONQUISTAS", icon: "🏆" },
  { id: "stats", label: "STATS", icon: "📊" },
];

const Detox = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("rastreador");
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
        moduleKey="detox"
        steps={[
          { selector: '[data-spotlight="tab-rastreador"]', label: "Esta é a aba Rastreador — adicione hábitos pra largar. Toque pra continuar.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-diario"]', label: "Registre suas reflexões aqui.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-stats"]', label: "Veja seu progresso e streak.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Leaf className="w-5 h-5 text-lime-600" />
          <h1 className="text-base font-bold tracking-tight">DETOX</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-spotlight={`tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
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
          moduleId="detox"
          tips={[
            "Adicione hábitos que quer largar",
            "Use o check-in diário para reforçar sua determinação",
            "Acompanhe seu streak no calendário",
            "Registre reflexões no diário",
          ]}
        />
        {activeTab === "rastreador" && <DetoxTracker />}
        {activeTab === "diario" && <DetoxDiary />}
        {activeTab === "conquistas" && <DetoxAchievements />}
        {activeTab === "stats" && <DetoxStats />}
      </main>
    </div>
  );
};

export default Detox;
