import { useNavigate } from "react-router-dom";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetoxTracker } from "@/components/detox/DetoxTracker";
import { DetoxDiary } from "@/components/detox/DetoxDiary";
import { DetoxAchievements } from "@/components/detox/DetoxAchievements";
import { DetoxStats } from "@/components/detox/DetoxStats";

const Detox = () => {
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
              <Leaf className="w-5 h-5 text-lime-400" />
            </motion.div>
            <h1 className="text-lg font-bold tracking-tight">DETOX</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Tabs defaultValue="rastreador" className="w-full" onValueChange={v => reportTab?.(v)}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="rastreador" className="text-[10px]">🌿 RASTREADOR</TabsTrigger>
              <TabsTrigger value="diario" className="text-[10px]">📓 DIÁRIO</TabsTrigger>
              <TabsTrigger value="conquistas" className="text-[10px]">🏆 CONQUISTAS</TabsTrigger>
              <TabsTrigger value="stats" className="text-[10px]">📊 STATS</TabsTrigger>
            </TabsList>
            <TabsContent value="rastreador"><DetoxTracker /></TabsContent>
            <TabsContent value="diario"><DetoxDiary /></TabsContent>
            <TabsContent value="conquistas"><DetoxAchievements /></TabsContent>
            <TabsContent value="stats"><DetoxStats /></TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Detox;
