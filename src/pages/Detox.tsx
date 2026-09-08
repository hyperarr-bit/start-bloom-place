import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Leaf } from "lucide-react";
import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { DetoxDiary } from "@/components/detox/DetoxDiary";
import { DetoxAchievements } from "@/components/detox/DetoxAchievements";
import { DetoxStats } from "@/components/detox/DetoxStats";
import { useUserData } from "@/hooks/use-user-data";
import { ProximoPasso } from "@/components/modules/ProximoPasso";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { localDayKey } from "@/lib/utils";
import { ResumoDoModulo, comoLista, diasAte, emDias } from "@/components/ui/resumo-do-modulo";

const tabs = [
  { id: "rastreador", label: "RASTREADOR", icon: "🌿" },
  { id: "diario", label: "DIÁRIO", icon: "📓" },
  { id: "conquistas", label: "CONQUISTAS", icon: "🏆" },
  { id: "stats", label: "STATS", icon: "📊" },
];

const Detox = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  // módulo sem nenhum registro → mostra o próximo passo no lugar do branco
  const vazio = (get<unknown[]>("detox-habits", []) ?? []).length === 0;
  /* RESUMO DO MÓDULO (07/09, avaliação 5★ da Play: "Cada aba poderia ser
     igual a de finanças, você entrar e ja ter um resumo do que tem para
     fazer"). Só conta o que esta página JÁ lê — nenhuma chave nova, nenhum
     formato mudado. Ver src/components/ui/resumo-do-modulo.tsx. */
  // "Dias limpo" = dias desde o startDate (que a recaída reinicia), como o
  // DetoxTracker mostra; o recorde é o campo gravado no hábito.
  const habitosDetox = comoLista<{ name?: string; startDate?: string; record?: number; checkins?: string[] }>(get("detox-habits", []));
  const hojeChave = localDayKey();
  const checkinsHoje = habitosDetox.filter(h => comoLista<string>(h?.checkins).includes(hojeChave)).length;
  const maisLimpo = habitosDetox
    .map(h => { const d = diasAte(h?.startDate ?? ""); return { nome: h?.name ?? "", dias: Number.isFinite(d) ? -d : 0 }; })
    .sort((a, b) => b.dias - a.dias)[0];
  const recorde = habitosDetox.reduce((m, h) => Math.max(m, Number(h?.record) || 0), 0);
  const itensDoResumo = [
    { rotulo: "Check-in hoje", valor: habitosDetox.length ? `${checkinsHoje}/${habitosDetox.length}` : null, tom: checkinsHoje >= habitosDetox.length ? "ok" as const : "atencao" as const, onClick: () => handleTabChange("rastreador") },
    { rotulo: "Dias limpo", valor: maisLimpo && maisLimpo.dias > 0 ? emDias(maisLimpo.dias) : null, sub: maisLimpo?.nome, tom: "ok" as const, onClick: () => handleTabChange("stats") },
    { rotulo: "Recorde", valor: recorde ? emDias(recorde) : null, tom: "ok" as const, onClick: () => handleTabChange("conquistas") },
  ];
  const [activeTab, setActiveTab] = useState("rastreador");
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
        moduleKey="detox"
        steps={[
          
          { selector: '[data-spotlight="tab-diario"]', label: "Registre suas reflexões aqui.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-stats"]', label: "Veja seu progresso e streak.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Leaf className="w-5 h-5 text-lime-600" />
          <h1 className="text-base font-bold tracking-tight">DETOX</h1>
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
        <ResumoDoModulo itens={itensDoResumo} vazio="Escolha o que quer reduzir" />
        <ModuleTip
          moduleId="detox"
          tips={[
            "Adicione hábitos que quer largar",
            "Use o check-in diário para reforçar sua determinação",
            "Acompanhe seu streak no calendário",
            "Registre reflexões no diário",
          ]}
        />
        {activeTab === "rastreador" && <DetoxTracker />}
        {activeTab === "diario" && <DetoxDiary />}
        {activeTab === "conquistas" && <DetoxAchievements />}
        {activeTab === "stats" && <DetoxStats />}
        {vazio && (
          <ProximoPasso
            emoji="📵"
            titulo="Escolha o que quer reduzir"
            passos={[
              "Crie um hábito de detox — redes, açúcar, o que for",
              "Marque os dias em que você conseguiu",
              "A sequência aparece aqui e vira conquista",
            ]}
          />
        )}
      </main>
    </div>
  );
};

export default Detox;
