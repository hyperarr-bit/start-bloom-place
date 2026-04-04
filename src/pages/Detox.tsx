import { useNavigate } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { DetoxDiary } from "@/components/detox/DetoxDiary";
import { DetoxAchievements } from "@/components/detox/DetoxAchievements";
import { DetoxStats } from "@/components/detox/DetoxStats";

const Detox = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-lime-400" />
            <h1 className="text-lg font-bold tracking-tight">DETOX</h1>
          </div>
        </div>

        <Tabs defaultValue="rastreador" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="rastreador" className="text-[10px]">RASTREADOR</TabsTrigger>
            <TabsTrigger value="diario" className="text-[10px]">DIÁRIO</TabsTrigger>
            <TabsTrigger value="conquistas" className="text-[10px]">CONQUISTAS</TabsTrigger>
            <TabsTrigger value="stats" className="text-[10px]">STATS</TabsTrigger>
          </TabsList>
          <TabsContent value="rastreador"><DetoxTracker /></TabsContent>
          <TabsContent value="diario"><DetoxDiary /></TabsContent>
          <TabsContent value="conquistas"><DetoxAchievements /></TabsContent>
          <TabsContent value="stats"><DetoxStats /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Detox;
