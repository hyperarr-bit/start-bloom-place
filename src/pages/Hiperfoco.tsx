import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Brain } from "lucide-react";
import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { ThoughtSearch } from "@/components/hiperfoco/ThoughtSearch";
import { GoalsPanel } from "@/components/hiperfoco/GoalsPanel";
import { StrategyPanel } from "@/components/hiperfoco/StrategyPanel";
import { TimelinePanel } from "@/components/hiperfoco/TimelinePanel";
import { DreamJournal } from "@/components/hiperfoco/DreamJournal";
import { IdeasPanel } from "@/components/hiperfoco/IdeasPanel";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey } from "@/lib/utils";
import { ResumoDoModulo, comoLista } from "@/components/ui/resumo-do-modulo";

const tabs = [
  { id: "dia", label: "DIA", icon: "💭" },
  { id: "busca", label: "BUSCA", icon: "🔍" },
  { id: "metas", label: "METAS", icon: "🎯" },
  { id: "estrategia", label: "ESTRATÉGIA", icon: "♟️" },
  { id: "timeline", label: "TIMELINE", icon: "📅" },
  { id: "ideias", label: "IDEIAS", icon: "💡" },
  { id: "sonhos", label: "SONHOS", icon: "🌙" },
];

const Hiperfoco = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dia");
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
  // hiperfoco-thoughts é dia → hora → pensamentos; "ideia" é a tag que o
  // IdeasPanel filtra. Metas do GoalsPanel: aberta = ainda tem objetivo por fazer.
  const { get: lerDado } = useUserData();
  const hoje = localDayKey();
  const pensamentos = lerDado<Record<string, Record<string, { tags?: string[] }[]>>>("hiperfoco-thoughts", {}) ?? {};
  const porHora = (dia: unknown) => Object.values((dia && typeof dia === "object" ? dia : {}) as Record<string, unknown>).flatMap(l => comoLista<{ tags?: string[] }>(l));
  const pensamentosHoje = porHora(pensamentos[hoje]).length;
  const ideias = Object.values(pensamentos).reduce((s, dia) => s + porHora(dia).filter(t => comoLista<string>(t?.tags).includes("ideia")).length, 0);
  const metas = comoLista<{ objectives?: { done?: boolean }[] }>(lerDado("hiperfoco-goals", []));
  const metasAbertas = metas.filter(m => { const o = comoLista<{ done?: boolean }>(m?.objectives); return o.length === 0 || o.some(x => !x?.done); }).length;
  const passosPendentes = metas.reduce((s, m) => s + comoLista<{ done?: boolean }>(m?.objectives).filter(o => !o?.done).length, 0);
  const itensDoResumo = [
    { rotulo: "Hoje", valor: pensamentosHoje, sub: "pensamentos", tom: "ok" as const, onClick: () => handleTabChange("dia") },
    { rotulo: "Ideias", valor: ideias, sub: "guardadas", tom: "neutro" as const, onClick: () => handleTabChange("ideias") },
    { rotulo: "Metas", valor: metasAbertas, sub: passosPendentes ? `${passosPendentes} passos pendentes` : "abertas", tom: "atencao" as const, onClick: () => handleTabChange("metas") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SpotlightOverlay
        moduleKey="hiperfoco"
        steps={[
          
          { selector: '[data-spotlight="tab-metas"]', label: "Defina metas pra manter o foco.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-ideias"]', label: "Salve ideias pra não esquecer depois.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Brain className="w-5 h-5 text-violet-600" />
          <h1 className="text-base font-bold tracking-tight">MENTE</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              data-spotlight={`tab-${tab.id}`}
              className={`notion-tab whitespace-nowrap text-[11px] flex items-center gap-1 ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 space-y-4">
        <ResumoDoModulo itens={itensDoResumo} vazio="Capture o primeiro pensamento do dia" />
        <ModuleTip
          moduleId="hiperfoco"
          tips={[
            "Capture pensamentos rápidos na aba Dia",
            "Use a busca para encontrar ideias antigas",
            "Defina metas e estratégias para manter o foco",
            "Registre sonhos no diário noturno",
          ]}
        />
        {activeTab === "dia" && <ThoughtCapture />}
        {activeTab === "busca" && <ThoughtSearch />}
        {activeTab === "metas" && <GoalsPanel />}
        {activeTab === "estrategia" && <StrategyPanel />}
        {activeTab === "timeline" && <TimelinePanel />}
        {activeTab === "ideias" && <IdeasPanel />}
        {activeTab === "sonhos" && <DreamJournal />}
      </main>
    </div>
  );
};

export default Hiperfoco;
