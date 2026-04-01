import { useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Sun, Moon, CloudSun, Sunset, Pencil } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { LifeHubData } from "@/hooks/use-life-hub-data";
import { NameEditDialog } from "./NameEditDialog";

interface GreetingHeaderProps {
  data: LifeHubData;
  onNameChange?: (name: string) => void;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", Icon: Moon };
  if (h < 12) return { text: "Bom dia", Icon: Sun };
  if (h < 18) return { text: "Boa tarde", Icon: CloudSun };
  return { text: "Boa noite", Icon: Sunset };
};

const getContextualMessage = (data: LifeHubData): string => {
  const h = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Time-based contextual messages
  if (h < 6) {
    return "Descanse bem, amanhã é um novo dia ✨";
  }

  if (h >= 6 && h < 9) {
    if (data.todayWorkoutGroup && !data.workoutDone) {
      return `Hora de começar! Treino de ${data.todayWorkoutGroup} te espera 💪`;
    }
    if (data.tasksTotal > 0 && data.tasksCompleted === 0) {
      return `${data.tasksTotal} hábito${data.tasksTotal > 1 ? "s" : ""} para conquistar hoje 🎯`;
    }
    return isWeekend ? "Bom fim de semana! Cuide de você 🌿" : "Comece o dia com energia! ⚡";
  }

  if (h >= 9 && h < 12) {
    if (data.tasksTotal > 0) {
      const pct = Math.round((data.tasksCompleted / data.tasksTotal) * 100);
      if (pct === 0) return "Vamos começar? Seus hábitos te esperam 🚀";
      if (pct < 50) return `Já fez ${data.tasksCompleted}/${data.tasksTotal} — continue assim! 💪`;
      return `${pct}% dos hábitos feitos! Quase lá 🔥`;
    }
    return "Manhã produtiva te espera ☀️";
  }

  if (h >= 12 && h < 14) {
    if (data.mealsTotal > 0 && data.mealsLogged < data.mealsTotal) {
      return `Hora do almoço! ${data.mealsTotal - data.mealsLogged} refeição restante 🍽️`;
    }
    return "Hora do almoço, recarregue as energias 🍽️";
  }

  if (h >= 14 && h < 18) {
    if (data.waterGlasses < data.waterGoal) {
      return `Hidrate-se! Faltam ${data.waterGoal - data.waterGlasses} copos de água 💧`;
    }
    if (data.todayWorkoutGroup && !data.workoutDone) {
      return `Ainda dá tempo do treino de ${data.todayWorkoutGroup} 🏋️`;
    }
    const remaining = data.tasksTotal - data.tasksCompleted;
    if (remaining > 0) return `${remaining} hábito${remaining > 1 ? "s" : ""} pendente${remaining > 1 ? "s" : ""} para fechar o dia ✅`;
    return "Tarde produtiva! Mantenha o ritmo 🌟";
  }

  if (h >= 18 && h < 21) {
    if (data.dayScore >= 80) return "Dia incrível! Você está arrasando 🏆";
    if (data.dayScore >= 50) return "Bom progresso hoje! Finalize o que falta 🌙";
    if (data.currentBook) return `Que tal ler um pouco de "${data.currentBook}"? 📖`;
    return isWeekend ? "Aproveite a noite de fim de semana 🌃" : "Boa noite! Hora de desacelerar 🌙";
  }

  // After 21h
  if (data.dayScore >= 80) return "Dia completo! Descanse com orgulho 🌟";
  if (data.dayScore >= 50) return "Bom dia! Amanhã será ainda melhor 💫";
  return "Hora de descansar. Amanhã é uma nova chance ✨";
};

export const GreetingHeader = ({ data, onNameChange }: GreetingHeaderProps) => {
  const { signOut, user } = useAuth();
  const { text: greeting, Icon: GreetingIcon } = getGreeting();
  const [showNameDialog, setShowNameDialog] = useState(false);

  const contextMessage = getContextualMessage(data);
  const displayName = data.userName || user?.email?.split("@")[0] || "";

  const handleNameSave = (name: string) => {
    // Will be persisted via useUserData in the parent
    try { localStorage.setItem("core-user-name", name); } catch {}
    onNameChange?.(name);
  };

  return (
    <>
      <motion.div
        className="flex items-start justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <GreetingIcon className="w-4 h-4 text-warning" />
            <h1 className="text-lg font-bold truncate">
              {greeting}{displayName ? `, ${displayName}` : ""} 👋
            </h1>
            <button
              onClick={() => setShowNameDialog(true)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Editar nome"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{contextMessage}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ThemeToggle showPalette />
          <motion.button
            onClick={signOut}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
            whileTap={{ scale: 0.9 }}
            aria-label="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </motion.div>

      <NameEditDialog
        open={showNameDialog}
        onOpenChange={setShowNameDialog}
        currentName={displayName}
        onSave={handleNameSave}
      />
    </>
  );
};
