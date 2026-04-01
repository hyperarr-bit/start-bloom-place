import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft, Home, Droplets, ShoppingCart, UtensilsCrossed, Wrench, Leaf, Users, ShieldCheck, Settings, DoorOpen, Apple, SprayCan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedState } from "@/hooks/use-persisted-state";
import CleaningRadar from "@/components/casa/CleaningRadar";
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
  { v: "comodos", l: "Cômodos", icon: DoorOpen },
  { v: "mercado", l: "Mercado", icon: Apple },
  { v: "rotina", l: "Rotina", icon: SprayCan },
  { v: "radar", l: "Limpeza", icon: Droplets },
  { v: "despensa", l: "Despensa", icon: ShoppingCart },
  { v: "cardapio", l: "Cardápio", icon: UtensilsCrossed },
  { v: "manutencao", l: "Manutenção", icon: Wrench },
  { v: "plantas", l: "Vida", icon: Leaf },
  { v: "coop", l: "Co-Op", icon: Users },
  { v: "seguranca", l: "Segurança", icon: ShieldCheck },
  { v: "utilidades", l: "Utilidades", icon: Settings },
];

const Casa = () => {
  const navigate = useNavigate();
  const [cleaningTasks] = usePersistedState<{id: string; lastDone: string; frequencyDays: number}[]>("casa-cleaning", []);
  const [pantryItems] = usePersistedState<{id: string; status: string}[]>("casa-pantry", []);
  const [plants] = usePersistedState<{id: string}[]>("casa-plants", []);
  const [shoppingList] = usePersistedState<{id: string}[]>("casa-shopping", []);

  // Calculate stats
  const urgentTasks = cleaningTasks.filter(t => {
    const days = (Date.now() - new Date(t.lastDone).getTime()) / (1000 * 60 * 60 * 24);
    return days >= t.frequencyDays;
  }).length;
  const lowStock = pantryItems.filter(p => p.status === "acabando" || p.status === "acabou").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Home className="w-5 h-5 text-cyan-600" /> MINHA CASA
            </h1>
            <p className="text-[11px] text-muted-foreground">Limpeza, despensa, cardápio e manutenção</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <ModuleTip
          moduleId="casa"
          tips={[
            "O Radar de Limpeza mostra a 'saúde' de cada tarefa — quanto mais vermelha a barra, mais urgente!",
            "Na Despensa, mude um produto para 'Acabou' e ele vai direto pra Lista de Compras",
            "Use o Cardápio para planejar as refeições da semana",
            "Cadastre plantas e pets para nunca esquecer de regar ou dar remédio",
          ]}
        />

        {/* Stat Cards - Home themed colors */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-xl p-3 text-center">
            <div className="text-lg">🧹</div>
            <div className="text-xl font-bold text-foreground">{cleaningTasks.length}</div>
            <div className="text-[10px] text-muted-foreground">Tarefas</div>
          </div>
          <div className={`${urgentTasks > 0 ? "bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20" : "bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"} border rounded-xl p-3 text-center`}>
            <div className="text-lg">{urgentTasks > 0 ? "⚠️" : "✅"}</div>
            <div className="text-xl font-bold text-foreground">{urgentTasks}</div>
            <div className="text-[10px] text-muted-foreground">Urgentes</div>
          </div>
          <div className={`${lowStock > 0 ? "bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" : "bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"} border rounded-xl p-3 text-center`}>
            <div className="text-lg">🛒</div>
            <div className="text-xl font-bold text-foreground">{shoppingList.length}</div>
            <div className="text-[10px] text-muted-foreground">Comprar</div>
          </div>
          <div className="bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-3 text-center">
            <div className="text-lg">🌱</div>
            <div className="text-xl font-bold text-foreground">{plants.length}</div>
            <div className="text-[10px] text-muted-foreground">Vida</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3 text-amber-500" /> {pantryItems.length} na despensa</span>
            {lowStock > 0 && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">⚠️ {lowStock} acabando</span>}
          </div>
        </div>

          <Tabs defaultValue="comodos" className="w-full">
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full">
              {tabs.map(t => (
                <TabsTrigger key={t.v} value={t.v} className="text-[10px] gap-0.5 px-2">
                  <t.icon className="w-3 h-3" />
                  {t.l}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="comodos"><RoomManager /></TabsContent>
          <TabsContent value="mercado"><GroceryList /></TabsContent>
          <TabsContent value="rotina"><CleaningRoutine /></TabsContent>
          <TabsContent value="radar"><CleaningRadar /></TabsContent>
          <TabsContent value="despensa"><SmartPantry /></TabsContent>
          <TabsContent value="cardapio"><MealPlanner /></TabsContent>
          <TabsContent value="manutencao"><MaintenanceLog /></TabsContent>
          <TabsContent value="plantas"><PlantsAndPets /></TabsContent>
          <TabsContent value="coop"><ChoreRotation /></TabsContent>
          <TabsContent value="seguranca"><SafetyChecks /></TabsContent>
          <TabsContent value="utilidades"><HomeUtilities /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Casa;
