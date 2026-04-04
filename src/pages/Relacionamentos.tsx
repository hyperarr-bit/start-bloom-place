import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeoplePanel } from "@/components/relacionamentos/PeoplePanel";
import { MomentsTimeline } from "@/components/relacionamentos/MomentsTimeline";
import { GiftIdeas } from "@/components/relacionamentos/GiftIdeas";

const Relacionamentos = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-400" />
            <h1 className="text-lg font-bold tracking-tight">RELAÇÕES</h1>
          </div>
        </div>

        <Tabs defaultValue="pessoas" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="pessoas" className="text-[10px]">PESSOAS</TabsTrigger>
            <TabsTrigger value="momentos" className="text-[10px]">MOMENTOS</TabsTrigger>
            <TabsTrigger value="presentes" className="text-[10px]">PRESENTES</TabsTrigger>
          </TabsList>
          <TabsContent value="pessoas"><PeoplePanel /></TabsContent>
          <TabsContent value="momentos"><MomentsTimeline /></TabsContent>
          <TabsContent value="presentes"><GiftIdeas /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Relacionamentos;
