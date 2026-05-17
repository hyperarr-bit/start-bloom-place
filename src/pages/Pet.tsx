import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, PawPrint } from "lucide-react";
import { PetList } from "@/components/pet/PetList";
import { PetHealth } from "@/components/pet/PetHealth";
import { PetRoutine } from "@/components/pet/PetRoutine";
import { PetExpenses } from "@/components/pet/PetExpenses";
import { PetDiary } from "@/components/pet/PetDiary";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";

const tabs = [
  { id: "pets", label: "PETS", icon: "🐾" },
  { id: "saude", label: "SAÚDE", icon: "💉" },
  { id: "rotina", label: "ROTINA", icon: "📋" },
  { id: "gastos", label: "GASTOS", icon: "💸" },
  { id: "diario", label: "DIÁRIO", icon: "📸" },
];

const Pet = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pets");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PawPrint className="w-5 h-5 text-amber-500" />
          <h1 className="text-base font-bold tracking-tight">PET</h1>
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

      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 space-y-4">
        <ModuleTip
          moduleId="pet"
          tips={[
            "Cadastre seus pets com foto e dados",
            "Registre vacinas e consultas na aba Saúde",
            "Monte a rotina diária do seu pet",
            "Fotografe momentos no diário",
          ]}
        />
        {activeTab === "pets" && <PetList />}
        {activeTab === "saude" && <PetHealth />}
        {activeTab === "rotina" && <PetRoutine />}
        {activeTab === "gastos" && <PetExpenses />}
        {activeTab === "diario" && <PetDiary />}
      </main>
    </div>
  );
};

export default Pet;
