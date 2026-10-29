import { useState } from "react";
import { useAbasOcultas } from "@/hooks/use-abas-ocultas";
import { AbasOcultaveis } from "@/components/ui/abas-ocultaveis";
import { IconeDoModulo } from "@/components/modules/IconeDoModulo";
import { useVoltarDoModulo } from "@/lib/volta-da-demo";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { BoasVindasDoModulo } from "@/components/cartoes-modulo/BoasVindasDoModulo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MesDoCabecalho } from "@/components/MesDoCabecalho";
import { ArrowLeft, Home } from "lucide-react";
import SmartPantry from "@/components/casa/SmartPantry";
import MealPlanner from "@/components/casa/MealPlanner";
import MaintenanceLog from "@/components/casa/MaintenanceLog";
import ChoreRotation from "@/components/casa/ChoreRotation";
import SafetyChecks from "@/components/casa/SafetyChecks";
import HomeUtilities from "@/components/casa/HomeUtilities";
import RoomManager from "@/components/casa/RoomManager";
import GroceryList from "@/components/casa/GroceryList";
import CleaningRoutine from "@/components/casa/CleaningRoutine";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";

const tabs = [
  { id: "comodos", label: "CÔMODOS", icon: "🚪" },
  { id: "mercado", label: "MERCADO", icon: "🍎" },
  { id: "rotina", label: "ROTINA", icon: "🧴" },
  { id: "despensa", label: "DESPENSA", icon: "🛒" },
  { id: "cardapio", label: "CARDÁPIO", icon: "🍽️" },
  { id: "manutencao", label: "MANUTENÇÃO", icon: "🔧" },
  
  { id: "coop", label: "CO-OP", icon: "👥" },
  { id: "seguranca", label: "SEGURANÇA", icon: "🛡️" },
  { id: "utilidades", label: "UTILIDADES", icon: "⚙️" },
];

const Casa = () => {
  // seta ←: no app, o hub; na demo, o destino do botão de baixo dela (P5, 30/09 — antes, /auth)
  const voltarDoModulo = useVoltarDoModulo();
  // `?aba=` (28/10, sem repetição): "Ver" da lista de compras gerada na Dieta abre direto no Mercado
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const a = new URLSearchParams(window.location.search).get("aba");
      return a && tabs.some((t) => t.id === a) ? a : "comodos";
    } catch { return "comodos"; }
  });
  const abasDoModulo = useAbasOcultas("casa", tabs);
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background">
      <SpotlightOverlay
        moduleKey="casa"
        steps={[
          
          { selector: '[data-spotlight="tab-rotina"]', label: "Aqui você monta a rotina de limpeza.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-mercado"]', label: "Lista de compras pronta pra usar.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={voltarDoModulo} aria-label="Voltar" className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <IconeDoModulo id="casa" antes={<Home className="w-5 h-5 text-cyan-600" />} />
          <h1 className="text-base font-bold tracking-tight">CASA</h1>
          <div className="flex items-center gap-2 ml-auto pl-3 shrink-0">
            <MesDoCabecalho />
            <ThemeToggle />
          </div>
        </div>
        {/* 1.0.22: ocultar/organizar abas (components/ui/abas-ocultaveis) */}
        <AbasOcultaveis abas={abasDoModulo} ativa={activeTab} onTrocar={handleTabChange} className="max-w-5xl mx-auto px-4 pb-2" />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        <BoasVindasDoModulo
          moduleId="casa"
          tips={[
            "Na Despensa, mude um produto para 'Acabou' e ele vai direto pra lista do Mercado",
            "Use o Cardápio para planejar as refeições da semana",
            // 28/10 (auditoria das dicas): era "Cadastre plantas e pets…" — a Casa não tem planta nem pet (pet virou o módulo Pet)
            "Em Cômodos, liste os afazeres de cada cômodo e marque conforme fizer",
          ]}
        />

        {activeTab === "comodos" && <RoomManager />}
        {activeTab === "mercado" && <GroceryList />}
        {activeTab === "rotina" && <CleaningRoutine />}
        {/* "Acabou" na Despensa vai pro Mercado; o toast tem "Ver" que troca de aba (26/09, varredura) */}
        {activeTab === "despensa" && <SmartPantry onAbrirMercado={() => handleTabChange("mercado")} />}
        {activeTab === "cardapio" && <MealPlanner />}
        {activeTab === "manutencao" && <MaintenanceLog />}
        
        {activeTab === "coop" && <ChoreRotation />}
        {activeTab === "seguranca" && <SafetyChecks />}
        {activeTab === "utilidades" && <HomeUtilities />}
      </main>
    </div>
  );
};

export default Casa;
