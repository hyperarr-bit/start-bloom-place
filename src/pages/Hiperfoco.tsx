import { useNavigate } from "react-router-dom";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { ThoughtSearch } from "@/components/hiperfoco/ThoughtSearch";
import { GoalsPanel } from "@/components/hiperfoco/GoalsPanel";
import { StrategyPanel } from "@/components/hiperfoco/StrategyPanel";
import { TimelinePanel } from "@/components/hiperfoco/TimelinePanel";
import { DreamJournal } from "@/components/hiperfoco/DreamJournal";

const Hiperfoco = () => {
  const navigate = useNavigate();
  const reportTab = useTabReporter();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
            >
              <Brain className="w-5 h-5 text-violet-400" />
            </motion.div>
            <h1 className="text-lg font-bold tracking-tight">MENTE</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Tabs defaultValue="dia" className="w-full" onValueChange={v => reportTab?.(v)}>
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="dia" className="text-[10px]">DIA</TabsTrigger>
              <TabsTrigger value="busca" className="text-[10px]">BUSCA</TabsTrigger>
              <TabsTrigger value="metas" className="text-[10px]">METAS</TabsTrigger>
              <TabsTrigger value="estrategia" className="text-[10px]">ESTRATÉGIA</TabsTrigger>
              <TabsTrigger value="timeline" className="text-[10px]">TIMELINE</TabsTrigger>
              <TabsTrigger value="sonhos" className="text-[10px]">🌙 SONHOS</TabsTrigger>
            </TabsList>
            <TabsContent value="dia"><ThoughtCapture /></TabsContent>
            <TabsContent value="busca"><ThoughtSearch /></TabsContent>
            <TabsContent value="metas"><GoalsPanel /></TabsContent>
            <TabsContent value="estrategia"><StrategyPanel /></TabsContent>
            <TabsContent value="timeline"><TimelinePanel /></TabsContent>
            <TabsContent value="sonhos"><DreamJournal /></TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Hiperfoco;
