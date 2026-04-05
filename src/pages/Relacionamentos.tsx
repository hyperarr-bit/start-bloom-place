import { useNavigate } from "react-router-dom";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeoplePanel } from "@/components/relacionamentos/PeoplePanel";
import { DateCalendar } from "@/components/relacionamentos/DateCalendar";
import { MomentsTimeline } from "@/components/relacionamentos/MomentsTimeline";
import { GiftIdeas } from "@/components/relacionamentos/GiftIdeas";
import { EventLog } from "@/components/relacionamentos/EventLog";

const Relacionamentos = () => {
  const navigate = useNavigate();

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
              <Users className="w-5 h-5 text-rose-400" />
            </motion.div>
            <h1 className="text-lg font-bold tracking-tight">RELAÇÕES</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Tabs defaultValue="pessoas" className="w-full" onValueChange={v => reportTab?.(v)}>
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="pessoas" className="text-[10px]">💜 PESSOAS</TabsTrigger>
              <TabsTrigger value="agenda" className="text-[10px]">📅 AGENDA</TabsTrigger>
              <TabsTrigger value="momentos" className="text-[10px]">✨ MOMENTOS</TabsTrigger>
              <TabsTrigger value="presentes" className="text-[10px]">🎁 PRESENTES</TabsTrigger>
              <TabsTrigger value="eventos" className="text-[10px]">📋 EVENTOS</TabsTrigger>
            </TabsList>
            <TabsContent value="pessoas"><PeoplePanel /></TabsContent>
            <TabsContent value="agenda"><DateCalendar /></TabsContent>
            <TabsContent value="momentos"><MomentsTimeline /></TabsContent>
            <TabsContent value="presentes"><GiftIdeas /></TabsContent>
            <TabsContent value="eventos"><EventLog /></TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Relacionamentos;
