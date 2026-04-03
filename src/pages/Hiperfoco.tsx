import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThoughtCapture } from "@/components/hiperfoco/ThoughtCapture";
import { GoalsPanel } from "@/components/hiperfoco/GoalsPanel";

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
            <h1 className="text-lg font-bold tracking-tight">HIPERFOCO</h1>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="captura" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="captura" className="text-xs">🧠 CAPTURA</TabsTrigger>
            <TabsTrigger value="metas" className="text-xs">🎯 METAS</TabsTrigger>
          </TabsList>
          <TabsContent value="captura">
            <ThoughtCapture />
          </TabsContent>
          <TabsContent value="metas">
            <GoalsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Hiperfoco;
