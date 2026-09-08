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
import { useUserData } from "@/hooks/use-user-data";
import { ProximoPasso } from "@/components/modules/ProximoPasso";
import { ModuleTip } from "@/components/ModuleTip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { localDayKey } from "@/lib/utils";
import { ResumoDoModulo, comoLista, diasAte, rotuloEmDias } from "@/components/ui/resumo-do-modulo";

const tabs = [
  { id: "pets", label: "PETS", icon: "🐾" },
  { id: "saude", label: "SAÚDE", icon: "💉" },
  { id: "rotina", label: "ROTINA", icon: "📋" },
  { id: "gastos", label: "GASTOS", icon: "💸" },
  { id: "diario", label: "DIÁRIO", icon: "📸" },
];

const Pet = () => {
  const navigate = useNavigate();
  const { get } = useUserData();
  // módulo sem nenhum registro → mostra o próximo passo no lugar do branco
  const vazio = (get<unknown[]>("pet-list", []) ?? []).length === 0;
  /* RESUMO DO MÓDULO (07/09, avaliação 5★ da Play: "Cada aba poderia ser
     igual a de finanças, você entrar e ja ter um resumo do que tem para
     fazer"). Só conta o que esta página JÁ lê — nenhuma chave nova, nenhum
     formato mudado. Ver src/components/ui/resumo-do-modulo.tsx. */
  // A rotina é gravada por dia (pet-routine-<dia>) e as tarefas por pet
  // (pet-routine-tasks-<id>); sem lista própria, o PetRoutine usa as 6 de
  // fábrica — o mesmo denominador aqui.
  const pets = comoLista<{ id: string; name?: string }>(get("pet-list", []));
  const hojeChave = localDayKey();
  const rotinaDeHoje = get<Record<string, Record<string, boolean>>>(`pet-routine-${hojeChave}`, {}) ?? {};
  const TAREFAS_DE_FABRICA = 6;
  const tarefasDosPets = pets.reduce((s, p) => { const proprias = get<unknown>(`pet-routine-tasks-${p?.id}`, null); return s + (Array.isArray(proprias) ? proprias.length : TAREFAS_DE_FABRICA); }, 0);
  const feitasHoje = pets.reduce((s, p) => s + Object.values(rotinaDeHoje[p?.id] ?? {}).filter(Boolean).length, 0);
  const proximaSaude = comoLista<{ name?: string; nextDate?: string }>(get("pet-health", []))
    .map(r => ({ nome: r?.name ?? "", dias: diasAte(r?.nextDate ?? "") }))
    .filter(r => Number.isFinite(r.dias) && r.dias >= 0)
    .sort((a, b) => a.dias - b.dias)[0];
  const mesAtual = hojeChave.slice(0, 7);
  const gastosDoMes = comoLista<{ value?: number; date?: string }>(get("pet-expenses", []))
    .filter(g => typeof g?.date === "string" && g.date.startsWith(mesAtual))
    .reduce((s, g) => s + (Number(g?.value) || 0), 0);
  const itensDoResumo = [
    { rotulo: "Rotina hoje", valor: tarefasDosPets ? `${feitasHoje}/${tarefasDosPets}` : null, tom: feitasHoje >= tarefasDosPets ? "ok" as const : "atencao" as const, onClick: () => handleTabChange("rotina") },
    { rotulo: "Próx. saúde", valor: proximaSaude ? rotuloEmDias(proximaSaude.dias) : null, sub: proximaSaude?.nome, tom: proximaSaude && proximaSaude.dias <= 7 ? "atencao" as const : "neutro" as const, onClick: () => handleTabChange("saude") },
    { rotulo: "Gastos do mês", valor: gastosDoMes ? `R$ ${gastosDoMes.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : null, tom: "neutro" as const, onClick: () => handleTabChange("gastos") },
  ];
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
      <SpotlightOverlay
        moduleKey="pet"
        steps={[
          
          { selector: '[data-spotlight="tab-saude"]', label: "Registre vacinas e consultas.", advanceOnClick: true },
          { selector: '[data-spotlight="tab-gastos"]', label: "Acompanhe os gastos com o pet.", advanceOnClick: true },
        ]}
      />
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PawPrint className="w-5 h-5 text-amber-500" />
          <h1 className="text-base font-bold tracking-tight">PET</h1>
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
        <ResumoDoModulo itens={itensDoResumo} vazio="Cadastre seu primeiro pet" />
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
        {vazio && (
          <ProximoPasso
            emoji="🐶"
            titulo="Cadastre seu primeiro pet"
            passos={[
              "Toque em Pets e adicione nome, foto e raça",
              "Registre vacinas e consultas na aba Saúde",
              "Monte a rotina diária e acompanhe os gastos",
            ]}
          />
        )}
      </main>
    </div>
  );
};

export default Pet;
