import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Leaf } from "lucide-react";
import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { DetoxDiary } from "@/components/detox/DetoxDiary";
import { DetoxAchievements } from "@/components/detox/DetoxAchievements";
import { DetoxStats } from "@/components/detox/DetoxStats";

const tabs = [
  { id: "rastreador", label: "RASTREADOR", icon: "🌿" },
  { id: "diario", label: "DIÁRIO", icon: "📓" },
  { id: "conquistas", label: "CONQUISTAS", icon: "🏆" },
  { id: "stats", label: "STATS", icon: "📊" },
];

const Detox = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("rastreador");
  const reportTab = useTabReporter();

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lime-600 text-lg">🌿</span>
          <h1 className="text-base font-bold tracking-tight">DETOX</h1>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24 space-y-4">
        {activeTab === "rastreador" && <DetoxTracker />}
        {activeTab === "diario" && <DetoxDiary />}
        {activeTab === "conquistas" && <DetoxAchievements />}
        {activeTab === "stats" && <DetoxStats />}
      </main>
    </div>
  );
};

export default Detox;
