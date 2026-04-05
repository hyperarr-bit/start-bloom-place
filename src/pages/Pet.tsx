import { useNavigate } from "react-router-dom";
import { useTabReporter } from "@/hooks/use-module-tracker";
import { ArrowLeft, PawPrint } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PetList } from "@/components/pet/PetList";
import { PetHealth } from "@/components/pet/PetHealth";
import { PetRoutine } from "@/components/pet/PetRoutine";
import { PetExpenses } from "@/components/pet/PetExpenses";
import { PetDiary } from "@/components/pet/PetDiary";

const Pet = () => {
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
              <PawPrint className="w-5 h-5 text-amber-400" />
            </motion.div>
            <h1 className="text-lg font-bold tracking-tight">PET</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Tabs defaultValue="pets" className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="pets" className="text-[10px]">🐾 PETS</TabsTrigger>
              <TabsTrigger value="saude" className="text-[10px]">💉 SAÚDE</TabsTrigger>
              <TabsTrigger value="rotina" className="text-[10px]">📋 ROTINA</TabsTrigger>
              <TabsTrigger value="gastos" className="text-[10px]">💸 GASTOS</TabsTrigger>
              <TabsTrigger value="diario" className="text-[10px]">📸 DIÁRIO</TabsTrigger>
            </TabsList>
            <TabsContent value="pets"><PetList /></TabsContent>
            <TabsContent value="saude"><PetHealth /></TabsContent>
            <TabsContent value="rotina"><PetRoutine /></TabsContent>
            <TabsContent value="gastos"><PetExpenses /></TabsContent>
            <TabsContent value="diario"><PetDiary /></TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Pet;
