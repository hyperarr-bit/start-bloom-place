import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft } from "lucide-react";
import SmartPantry from "@/components/casa/SmartPantry";
import MealPlanner from "@/components/casa/MealPlanner";
import MaintenanceLog from "@/components/casa/MaintenanceLog";
import PlantsAndPets from "@/components/casa/PlantsAndPets";
import ChoreRotation from "@/components/casa/ChoreRotation";
import SafetyChecks from "@/components/casa/SafetyChecks";
import HomeUtilities from "@/components/casa/HomeUtilities";
import RoomManager from "@/components/casa/RoomManager";
import GroceryList from "@/components/casa/GroceryList";
import CleaningRoutine from "@/components/casa/CleaningRoutine";

const tabs = [
  { id: "comodos", label: "CÔMODOS", icon: "🚪" },
  { id: "mercado", label: "MERCADO", icon: "🍎" },
  { id: "rotina", label: "ROTINA", icon: "🧴" },
  { id: "despensa", label: "DESPENSA", icon: "🛒" },
  { id: "cardapio", label: "CARDÁPIO", icon: "🍽️" },
  { id: "manutencao", label: "MANUTENÇÃO", icon: "🔧" },
  { id: "plantas", label: "VIDA", icon: "🌱" },
  { id: "coop", label: "CO-OP", icon: "👥" },
  { id: "seguranca", label: "SEGURANÇA", icon: "🛡️" },
  { id: "utilidades", label: "UTILIDADES", icon: "⚙️" },
];

const Casa = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("comodos");
  const reportTab = useTabReporter();

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lg">≡</span>
          <span className="text-cyan-600 text-lg">🏠</span>
          <h1 className="text-base font-bold tracking-tight">CASA</h1>
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

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        <ModuleTip
          moduleId="casa"
          tips={[
            "Na Despensa, mude um produto para 'Acabou' e ele vai direto pra Lista de Compras",
            "Use o Cardápio para planejar as refeições da semana",
            "Cadastre plantas e pets para nunca esquecer de regar ou dar remédio",
          ]}
        />

        {activeTab === "comodos" && <RoomManager />}
        {activeTab === "mercado" && <GroceryList />}
        {activeTab === "rotina" && <CleaningRoutine />}
        {activeTab === "despensa" && <SmartPantry />}
        {activeTab === "cardapio" && <MealPlanner />}
        {activeTab === "manutencao" && <MaintenanceLog />}
        {activeTab === "plantas" && <PlantsAndPets />}
        {activeTab === "coop" && <ChoreRotation />}
        {activeTab === "seguranca" && <SafetyChecks />}
        {activeTab === "utilidades" && <HomeUtilities />}
      </main>
    </div>
  );
};

export default Casa;
