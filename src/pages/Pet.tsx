import { useNavigate } from "react-router-dom";
import { ArrowLeft, PawPrint } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PetList } from "@/components/pet/PetList";
import { PetHealth } from "@/components/pet/PetHealth";
import { PetRoutine } from "@/components/pet/PetRoutine";
import { PetExpenses } from "@/components/pet/PetExpenses";

const Pet = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <PawPrint className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold tracking-tight">PET</h1>
          </div>
        </div>

        <Tabs defaultValue="pets" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="pets" className="text-[10px]">MEUS PETS</TabsTrigger>
            <TabsTrigger value="saude" className="text-[10px]">SAÚDE</TabsTrigger>
            <TabsTrigger value="rotina" className="text-[10px]">ROTINA</TabsTrigger>
            <TabsTrigger value="gastos" className="text-[10px]">GASTOS</TabsTrigger>
          </TabsList>
          <TabsContent value="pets"><PetList /></TabsContent>
          <TabsContent value="saude"><PetHealth /></TabsContent>
          <TabsContent value="rotina"><PetRoutine /></TabsContent>
          <TabsContent value="gastos"><PetExpenses /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Pet;
