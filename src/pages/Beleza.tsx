import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Sparkles, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyMirror } from "@/components/beleza/DailyMirror";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { ProductShelf } from "@/components/beleza/ProductShelf";
import { SkinDiary } from "@/components/beleza/SkinDiary";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";

const tabs = [
  { id: "routine", label: "Rotina", icon: "✨" },
  { id: "shelf", label: "Bancada", icon: "🧪" },
  { id: "diary", label: "Diário", icon: "📷" },
];

const Beleza = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("routine");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Droplets className="w-5 h-5 text-pink-600" />
          <div>
            <h1 className="text-base font-bold tracking-tight">BELEZA</h1>
            <p className="text-[11px] text-muted-foreground">Seu ritual de beleza inteligente</p>
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
          moduleId="beleza"
          tips={[
            "Registre o estado da sua pele diariamente para acompanhar padrões",
            "O Skin Cycling alterna tratamentos noturnos automaticamente",
            "Cadastre seus produtos para rastrear validade e custo por dose",
            "Tire fotos semanais para acompanhar a evolução da pele"
          ]}
        />

        <DailyMirror />

        {activeTab === "routine" && <SkincareRoutine />}
        {activeTab === "shelf" && <ProductShelf />}
        {activeTab === "diary" && <SkinDiary />}
      </main>
    </div>
  );
};

export default Beleza;
