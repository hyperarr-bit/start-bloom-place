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
import { useUserData } from "@/hooks/use-user-data";
import { ProximoPasso } from "@/components/modules/ProximoPasso";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { ResumoDoModulo, comoLista, diasAte, rotuloEmDias } from "@/components/ui/resumo-do-modulo";

const tabs = [
  { id: "pessoas", label: "PESSOAS", icon: "💜" },
  { id: "agenda", label: "AGENDA", icon: "📅" },
  { id: "momentos", label: "MOMENTOS", icon: "✨" },
  { id: "presentes", label: "PRESENTES", icon: "🎁" },
  { id: "eventos", label: "EVENTOS", icon: "📋" },
];

const Relacionamentos = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  // módulo sem nenhum registro → mostra o próximo passo no lugar do branco
  const vazio = (get<unknown[]>("rel-people", []) ?? []).length === 0;
  /* RESUMO DO MÓDULO (07/09, avaliação 5★ da Play: "Cada aba poderia ser
     igual a de finanças, você entrar e ja ter um resumo do que tem para
     fazer"). Só conta o que esta página JÁ lê — nenhuma chave nova, nenhum
     formato mudado. Ver src/components/ui/resumo-do-modulo.tsx. */
  // Aniversário é só mês-dia: conta pro próximo ano quando o deste já passou.
  const pessoas = comoLista<{ name?: string; birthday?: string }>(get("rel-people", []));
  const diasAteAniversario = (nascimento?: string) => {
    if (!nascimento || !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return Number.NaN;
    const ano = new Date().getFullYear();
    const esteAno = diasAte(`${ano}-${nascimento.slice(5)}`);
    return esteAno < 0 ? diasAte(`${ano + 1}-${nascimento.slice(5)}`) : esteAno;
  };
  const aniversariosNaSemana = pessoas
    .map(p => ({ nome: p?.name ?? "", dias: diasAteAniversario(p?.birthday) }))
    .filter(a => Number.isFinite(a.dias) && a.dias <= 7)
    .sort((a, b) => a.dias - b.dias);
  const proximaData = [
    ...comoLista<{ title?: string; date?: string }>(get("rel-dates", [])).map(d => ({ titulo: d?.title ?? "", dias: diasAte(d?.date ?? "") })),
    ...pessoas.map(p => ({ titulo: `Aniversário: ${p?.name ?? ""}`, dias: diasAteAniversario(p?.birthday) })),
  ].filter(d => Number.isFinite(d.dias) && d.dias >= 0).sort((a, b) => a.dias - b.dias)[0];
  const proximoEvento = comoLista<{ name?: string; date?: string }>(get("rel-events", []))
    .map(e => ({ nome: e?.name ?? "", dias: diasAte(e?.date ?? "") }))
    .filter(e => Number.isFinite(e.dias) && e.dias >= 0)
    .sort((a, b) => a.dias - b.dias)[0];
  const itensDoResumo = [
    { rotulo: "Aniversários", valor: aniversariosNaSemana.length, sub: aniversariosNaSemana[0] ? `${aniversariosNaSemana[0].nome} · ${rotuloEmDias(aniversariosNaSemana[0].dias)}` : undefined, tom: "atencao" as const, onClick: () => handleTabChange("agenda") },
    { rotulo: "Próx. data", valor: proximaData ? rotuloEmDias(proximaData.dias) : null, sub: proximaData?.titulo, tom: "neutro" as const, onClick: () => handleTabChange("agenda") },
    { rotulo: "Próx. evento", valor: proximoEvento ? rotuloEmDias(proximoEvento.dias) : null, sub: proximoEvento?.nome, tom: "neutro" as const, onClick: () => handleTabChange("eventos") },
  ];
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
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors">
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
        <ResumoDoModulo itens={itensDoResumo} vazio={vazio ? "Comece cadastrando quem importa" : "Nenhuma data nos próximos dias"} />
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
        {vazio && (
          <ProximoPasso
            emoji="❤️"
            titulo="Comece pelas pessoas"
            passos={[
              "Adicione quem importa e a data de aniversário",
              "Guarde momentos que você não quer esquecer",
              "O app te lembra das datas antes de passarem",
            ]}
          />
        )}
      </main>
    </div>
  );
};

export default Relacionamentos;
