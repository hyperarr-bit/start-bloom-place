import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { ThoughtSearch } from "@/components/hiperfoco/ThoughtSearch";
import { GoalsPanel } from "@/components/hiperfoco/GoalsPanel";
import { StrategyPanel } from "@/components/hiperfoco/StrategyPanel";
import { TimelinePanel } from "@/components/hiperfoco/TimelinePanel";

const Hiperfoco = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            <h1 className="text-lg font-bold tracking-tight">MENTE</h1>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dia" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="dia" className="text-[10px]">DIA</TabsTrigger>
            <TabsTrigger value="busca" className="text-[10px]">BUSCA</TabsTrigger>
            <TabsTrigger value="metas" className="text-[10px]">METAS</TabsTrigger>
            <TabsTrigger value="estrategia" className="text-[10px]">ESTRATÉGIA</TabsTrigger>
            <TabsTrigger value="timeline" className="text-[10px]">TIMELINE</TabsTrigger>
          </TabsList>
          <TabsContent value="dia">
            <ThoughtCapture />
          </TabsContent>
          <TabsContent value="busca">
            <ThoughtSearch />
          </TabsContent>
          <TabsContent value="metas">
            <GoalsPanel />
          </TabsContent>
          <TabsContent value="estrategia">
            <StrategyPanel />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelinePanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Hiperfoco;
