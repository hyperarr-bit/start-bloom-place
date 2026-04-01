import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, FlaskConical, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyMirror } from "@/components/beleza/DailyMirror";
import { SkincareRoutine } from "@/components/beleza/SkincareRoutine";
import { ProductShelf } from "@/components/beleza/ProductShelf";
import { SkinDiary } from "@/components/beleza/SkinDiary";
import { ModuleTip } from "@/components/ModuleTip";

const Beleza = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-30 bg-card">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-600" /> MINHA BELEZA
            </h1>
            <p className="text-[11px] text-muted-foreground">Seu ritual de beleza inteligente</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <ModuleTip
          moduleId="beleza"
          tips={[
            "Registre o estado da sua pele diariamente para acompanhar padrões",
            "O Skin Cycling alterna tratamentos noturnos automaticamente",
            "Cadastre seus produtos para rastrear validade e custo por dose",
            "Tire fotos semanais para acompanhar a evolução da pele"
          ]}
        />

        {/* Daily Mirror — always visible */}
        <DailyMirror />

        {/* Tabs */}
        <Tabs defaultValue="routine">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="routine" className="text-xs gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Rotina
            </TabsTrigger>
            <TabsTrigger value="shelf" className="text-xs gap-1">
              <FlaskConical className="w-3.5 h-3.5" /> Bancada
            </TabsTrigger>
            <TabsTrigger value="diary" className="text-xs gap-1">
              <Camera className="w-3.5 h-3.5" /> Diário
            </TabsTrigger>
          </TabsList>
          <TabsContent value="routine"><SkincareRoutine /></TabsContent>
          <TabsContent value="shelf"><ProductShelf /></TabsContent>
          <TabsContent value="diary"><SkinDiary /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Beleza;
