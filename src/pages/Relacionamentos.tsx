import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Users } from "lucide-react";
import { PeoplePanel } from "@/components/relacionamentos/PeoplePanel";
import { DateCalendar } from "@/components/relacionamentos/DateCalendar";
import { MomentsTimeline } from "@/components/relacionamentos/MomentsTimeline";
import { GiftIdeas } from "@/components/relacionamentos/GiftIdeas";
import { EventLog } from "@/components/relacionamentos/EventLog";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";

const tabs = [
  { id: "pessoas", label: "PESSOAS", icon: "💜" },
  { id: "agenda", label: "AGENDA", icon: "📅" },
  { id: "momentos", label: "MOMENTOS", icon: "✨" },
  { id: "presentes", label: "PRESENTES", icon: "🎁" },
  { id: "eventos", label: "EVENTOS", icon: "📋" },
];

const Relacionamentos = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pessoas");
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
        moduleKey="relacionamentos"
        steps={[
          
          { selector: '[data-spotlight="tab-agenda"]', label: "Agenda de aniversários e datas.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-presentes"]', label: "Salve ideias de presente pra cada pessoa.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5 text-rose-600" />
          <h1 className="text-base font-bold tracking-tight">RELAÇÕES</h1>
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
          moduleId="relacionamentos"
          tips={[
            "Cadastre pessoas importantes e seus aniversários",
            "Use a agenda para nunca esquecer datas",
            "Registre momentos especiais na timeline",
            "Salve ideias de presentes para cada pessoa",
          ]}
        />
        {activeTab === "pessoas" && <PeoplePanel />}
        {activeTab === "agenda" && <DateCalendar />}
        {activeTab === "momentos" && <MomentsTimeline />}
        {activeTab === "presentes" && <GiftIdeas />}
        {activeTab === "eventos" && <EventLog />}
      </main>
    </div>
  );
};

export default Relacionamentos;
