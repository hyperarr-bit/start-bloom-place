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
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { ResumoDoModulo, comoLista } from "@/components/ui/resumo-do-modulo";

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

  /* RESUMO DO MÓDULO (07/09, avaliação 5★ da Play: "Cada aba poderia ser
     igual a de finanças, você entrar e ja ter um resumo do que tem para
     fazer"). Só conta o que esta página JÁ lê — nenhuma chave nova, nenhum
     formato mudado. Ver src/components/ui/resumo-do-modulo.tsx. */
  // Passos e checks moram na SkincareRoutine; o check-in de pele, no
  // DailyMirror. Mesmas chaves, lidas do store.
  const { get: lerDado } = useUserData();
  const hoje = localDayKey();
  const passosManha = comoLista(lerDado("skincare-am-steps", [])).length;
  const passosNoite = comoLista(lerDado("skincare-pm-steps", [])).length;
  const feitosManha = comoLista(lerDado<Record<string, number[]>>("skincare-morning-checked", {})?.[hoje]).length;
  const feitosNoite = comoLista(lerDado<Record<string, number[]>>("skincare-night-checked", {})?.[hoje]).length;
  const peleHoje = lerDado<Record<string, string>>("skincare-daily-checkin", {})?.[hoje] ?? "";
  const nomeDaPele: Record<string, string> = { seca: "Seca 🌵", oleosa: "Oleosa 🛢️", acne: "Acne 🔴", boa: "Boa ✨", sensivel: "Sensível 🍅" };
  const itensDoResumo = [
    { rotulo: "Manhã", valor: passosManha ? `${feitosManha}/${passosManha}` : null, sub: "passos", tom: feitosManha >= passosManha ? "ok" as const : "atencao" as const, onClick: () => handleTabChange("routine") },
    { rotulo: "Noite", valor: passosNoite ? `${feitosNoite}/${passosNoite}` : null, sub: "passos", tom: feitosNoite >= passosNoite ? "ok" as const : "atencao" as const, onClick: () => handleTabChange("routine") },
    { rotulo: "Pele hoje", valor: peleHoje ? (nomeDaPele[peleHoje] ?? peleHoje) : null, tom: "neutro" as const, onClick: () => handleTabChange("routine") },
  ];

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

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <ResumoDoModulo itens={itensDoResumo} vazio="Monte sua rotina de skincare" />
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
