import { useState } from "react";
import { mesAtualExtenso } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Sparkles, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyMirror } from "@/components/beleza/DailyMirror";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { ProductShelf } from "@/components/beleza/ProductShelf";
import { SkinDiary } from "@/components/beleza/SkinDiary";
import { useSkincare } from "@/components/beleza/use-skincare";
import type { PerfilDaPele } from "@/lib/beleza-rotina";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";

// 28/09: CAIXA ALTA como as abas do Treino e da Rotina (cara de planner); os ids ficam (medição por aba)
const tabs = [
  { id: "routine", label: "ROTINA", icon: "✨" },
  { id: "shelf", label: "BANCADA", icon: "🧪" },
  { id: "diary", label: "DIÁRIO", icon: "📷" },
];

const Beleza = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("routine");
  useScrollActiveTabIntoView(activeTab);
  const reportTab = useTabReporter();
  const currentMonth = mesAtualExtenso();
  /* ROTINA VAZIA VAI PRO TOPO (28/09, protótipo): quem ainda não tem rotina vê as
     3 perguntas antes das dicas e do Espelho — é a ação da tela. Depois de montar,
     a Rotina volta pro lugar de sempre (abaixo do Espelho); o "rotina pronta"
     mora aqui em cima pra não se perder na troca de lugar. */
  const { vazia } = useSkincare();
  const [recemGerada, setRecemGerada] = useState<PerfilDaPele | null>(null);
  const rotinaNoTopo = activeTab === "routine" && vazia;
  const rotina = <SkincareRoutine recemGerada={recemGerada} onGerada={setRecemGerada} />;

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    reportTab?.(tabId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <SpotlightOverlay
        moduleKey="beleza"
        steps={[
          
          { selector: '[data-spotlight="tab-shelf"]', label: "Cadastre os produtos da sua bancada.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-diary"]', label: "Diário pra acompanhar a evolução da pele.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Droplets className="w-5 h-5 text-pink-600" />
          <h1 className="text-base font-bold tracking-tight">BELEZA</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs">{currentMonth}</span>
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

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {rotinaNoTopo && rotina}
        <ModuleTip
          moduleId="beleza"
          tips={[
            "3 perguntas e a sua rotina sai pronta, de manhã e de noite",
            "Toque num passo pra escolher o produto e os dias da semana",
            "Ligue o lembrete da manhã e da noite — ele diz o passo do dia",
            "Cadastre seus produtos para rastrear validade e custo por dose",
          ]}
        />

        <DailyMirror />

        {activeTab === "routine" && !rotinaNoTopo && rotina}
        {activeTab === "shelf" && <ProductShelf />}
        {activeTab === "diary" && <SkinDiary />}
      </main>
    </div>
  );
};

export default Beleza;
