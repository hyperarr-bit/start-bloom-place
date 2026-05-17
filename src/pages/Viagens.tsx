import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TripCountdown } from "@/components/travel/TripCountdown";
import { DailyTimeline } from "@/components/travel/DailyTimeline";
import { PackingChecklist } from "@/components/travel/PackingChecklist";
import { BillSplitter } from "@/components/travel/BillSplitter";
import { PlacesBoard } from "@/components/travel/PlacesBoard";
import { SafetyCard } from "@/components/travel/SafetyCard";
import { CurrencyConverter } from "@/components/travel/CurrencyConverter";
import { TravelDiary } from "@/components/travel/TravelDiary";
import { TravelBudget } from "@/components/travel/TravelBudget";
import { BucketList } from "@/components/travel/BucketList";

const tabs = [
  { id: "destinos", label: "Destinos", icon: "🧭" },
  { id: "cronograma", label: "Roteiro", icon: "🗺️" },
  { id: "mala", label: "Mala", icon: "🎒" },
  { id: "budget", label: "Budget", icon: "💰" },
  { id: "divisor", label: "Rachar", icon: "👥" },
  { id: "lugares", label: "Lugares", icon: "📍" },
  { id: "diario", label: "Diário", icon: "📖" },
  { id: "moeda", label: "Câmbio", icon: "🔄" },
  { id: "seguranca", label: "SOS", icon: "🛡️" },
  { id: "countdown", label: "Timer", icon: "⏱️" },
];

const Viagens = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("destinos");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Plane className="w-5 h-5 text-teal-600" />
          <div>
            <h1 className="text-base font-bold tracking-tight">VIAGENS</h1>
            <p className="text-[11px] text-muted-foreground">Planeje, viva e eternize suas viagens</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
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

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <ModuleTip
          moduleId="viagens"
          tips={[
            "Adicione destinos dos seus sonhos na bucket list",
            "Monte roteiros dia a dia com horários e custos",
            "Divida contas com amigos no Rachar Conta",
            "Salve lugares do Instagram no quadro de Lugares",
            "Defina taxas de câmbio e converta offline"
          ]}
        />

        {activeTab === "destinos" && <BucketList />}
        {activeTab === "cronograma" && <DailyTimeline />}
        {activeTab === "mala" && <PackingChecklist />}
        {activeTab === "budget" && <TravelBudget />}
        {activeTab === "divisor" && <BillSplitter />}
        {activeTab === "lugares" && <PlacesBoard />}
        {activeTab === "diario" && <TravelDiary />}
        {activeTab === "moeda" && <CurrencyConverter />}
        {activeTab === "seguranca" && <SafetyCard />}
        {activeTab === "countdown" && <TripCountdown />}
      </main>
    </div>
  );
};

export default Viagens;
