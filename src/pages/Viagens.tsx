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
import { Outings } from "@/components/travel/Outings";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useUserData } from "@/hooks/use-user-data";
import { ResumoDoModulo, comoLista, diasAte, rotuloEmDias } from "@/components/ui/resumo-do-modulo";

// "Passeios" fica em SEGUNDO, colado em Destinos: é a aba do uso mais comum
// (cinema no sábado, jantar fora) e a barra rola na horizontal — quem entra
// no módulo tem que ver a opção leve sem precisar arrastar atrás dela.
const tabs = [
  { id: "destinos", label: "Destinos", icon: "🧭" },
  { id: "passeios", label: "Passeios", icon: "🎟️" },
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

  /* RESUMO DO MÓDULO (07/09, avaliação 5★ da Play: "Cada aba poderia ser
     igual a de finanças, você entrar e ja ter um resumo do que tem para
     fazer"). Só conta o que esta página JÁ lê — nenhuma chave nova, nenhum
     formato mudado. Ver src/components/ui/resumo-do-modulo.tsx. */
  // Próxima viagem = carteira do Budget (travel-trips-v2) ou um Timer
  // (travel-countdowns); passeios e destinos vêm das próprias abas.
  const { get: lerDado } = useUserData();
  const carteira = lerDado<{ trips?: { destination?: string; startDate?: string }[] }>("travel-trips-v2", { trips: [] });
  const proximaViagem = [
    ...comoLista<{ destination?: string; startDate?: string }>(carteira?.trips).map(t => ({ nome: t?.destination ?? "", dias: diasAte(t?.startDate ?? "") })),
    ...comoLista<{ tripName?: string; departureDate?: string }>(lerDado("travel-countdowns", [])).map(c => ({ nome: c?.tripName ?? "", dias: diasAte(c?.departureDate ?? "") })),
  ].filter(v => Number.isFinite(v.dias) && v.dias >= 0).sort((a, b) => a.dias - b.dias)[0];
  const proximosPasseios = comoLista<{ name?: string; date?: string }>(lerDado("travel-outings", []))
    .map(p => ({ nome: p?.name ?? "", dias: diasAte(p?.date ?? "") }))
    .filter(p => Number.isFinite(p.dias) && p.dias >= 0)
    .sort((a, b) => a.dias - b.dias);
  const destinosPendentes = comoLista<{ visited?: boolean; priority?: string }>(lerDado("travel-bucket", [])).filter(d => !d?.visited);
  const destinosProximos = destinosPendentes.filter(d => d?.priority === "próximo").length;
  const itensDoResumo = [
    { rotulo: "Próx. viagem", valor: proximaViagem ? rotuloEmDias(proximaViagem.dias) : null, sub: proximaViagem?.nome, tom: "ok" as const, onClick: () => handleTabChange("budget") },
    { rotulo: "Passeios", valor: proximosPasseios.length, sub: proximosPasseios[0] ? `${proximosPasseios[0].nome} · ${rotuloEmDias(proximosPasseios[0].dias)}` : undefined, tom: "neutro" as const, onClick: () => handleTabChange("passeios") },
    { rotulo: "Destinos", valor: destinosPendentes.length, sub: destinosProximos ? `${destinosProximos} marcados como próximo` : "na lista", tom: "neutro" as const, onClick: () => handleTabChange("destinos") },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <SpotlightOverlay
        moduleKey="viagens"
        steps={[
          
          { selector: '[data-spotlight="tab-mala"]', label: "Checklist da mala pra não esquecer nada.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-budget"]', label: "Controle o orçamento da viagem.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Plane className="w-5 h-5 text-teal-600" />
          <h1 className="text-base font-bold tracking-tight">VIAGENS</h1>
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
        <ResumoDoModulo itens={itensDoResumo} vazio="Adicione o primeiro destino" />
        <ModuleTip
          moduleId="viagens"
          tips={[
            "Passeios: registre o rolê simples (cinema, jantar, parque) com data e custo",
            "Adicione destinos dos seus sonhos na bucket list",
            "Monte roteiros dia a dia com horários e custos",
            "Divida contas com amigos no Rachar Conta",
            "Salve lugares do Instagram no quadro de Lugares",
            "Defina taxas de câmbio e converta offline"
          ]}
        />

        {activeTab === "destinos" && <BucketList />}
        {activeTab === "passeios" && <Outings />}
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
