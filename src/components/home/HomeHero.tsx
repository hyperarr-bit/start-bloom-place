import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, CloudSun, Sunset, Pencil, Flame, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { LifeHubData } from "@/hooks/use-life-hub-data";
import { NameEditDialog } from "./NameEditDialog";
import { AccountDrawer } from "./AccountDrawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HomeHeroProps {
  data: LifeHubData;
  onNameChange?: (name: string) => void;
  onReplayTutorial?: () => void;
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
  if (h < 6) return "Descanse bem, amanhã é um novo dia ✨";
  if (h < 9) {
    if (data.todayWorkoutGroup && !data.workoutDone) return `Treino de ${data.todayWorkoutGroup} te espera 💪`;
    return isWeekend ? "Bom fim de semana! Cuide de você 🌿" : "Comece o dia com energia ⚡";
  }
  if (h < 12) {
    if (data.tasksTotal > 0) {
      const pct = Math.round((data.tasksCompleted / data.tasksTotal) * 100);
      if (pct >= 50) return `${pct}% dos hábitos feitos — quase lá 🔥`;
    }
    return "Manhã produtiva te espera ☀️";
  }
  if (h < 14) return "Hora do almoço, recarregue as energias 🍽️";
  if (h < 18) {
    if (data.waterGlasses < data.waterGoal) return `Hidrate-se! Faltam ${data.waterGoal - data.waterGlasses} copos 💧`;
    return "Tarde produtiva! Mantenha o ritmo 🌟";
  }
  if (h < 21) {
    if (data.dayScore >= 80) return "Dia incrível! Você está arrasando 🏆";
    return "Hora de desacelerar 🌙";
  }
  return "Hora de descansar. Amanhã é uma nova chance ✨";
};

export const HomeHero = ({ data, onNameChange, onReplayTutorial }: HomeHeroProps) => {
  const { user } = useAuth();
  const { get, set: setUserData } = useUserData();
  const { text: greeting, Icon: GreetingIcon } = getGreeting();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const contextMessage = getContextualMessage(data);
  const displayName = data.userName || user?.email?.split("@")[0] || "";
  const hasSetName = !!get<string>("core-user-name", "");
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "?";

  const score = data.dayScore;
  const streak = data.streak;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const scoreColor = score >= 80 ? "hsl(var(--success))" : score >= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))";

  const handleNameSave = (name: string) => {
    setUserData("core-user-name", name);
    onNameChange?.(name);
  };

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm"
      >
        {/* Decorative blur orb */}
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />

        <div className="relative p-5 md:p-6">
          {/* Top row: greeting label + actions */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
                <GreetingIcon className="w-4 h-4 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{greeting}</p>
                <h1 className="text-xl md:text-2xl font-bold leading-tight truncate flex items-center gap-1.5">
                  {displayName || "Bem-vindo"} 👋
                  {!hasSetName && (
                    <button
                      onClick={() => setShowNameDialog(true)}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      aria-label="Editar nome"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <motion.button
                onClick={() => setShowAccount(true)}
                className="rounded-xl overflow-hidden"
                whileTap={{ scale: 0.92 }}
                aria-label="Minha conta"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold rounded-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </motion.button>
              <ThemeToggle showPalette />
            </div>
          </div>

          {/* Main row: score ring + insight */}
          <div className="flex items-center gap-4 md:gap-5">
            <div className="relative w-[112px] h-[112px] flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeOpacity="0.4" strokeWidth="9" />
                <motion.circle
                  cx="60" cy="60" r={radius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: circumference - progress }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-3xl font-bold leading-none"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.5 }}
                >
                  {score}
                </motion.span>
                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">score</span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <p className="text-sm md:text-base font-medium leading-snug">{contextMessage}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 border border-warning/25">
                    <Flame className="w-3 h-3 text-warning" />
                    <span className="text-[11px] font-bold text-warning">{streak} dia{streak > 1 ? "s" : ""}</span>
                  </span>
                )}
                {data.tasksTotal > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 border border-border/40">
                    <span className="text-[11px] font-semibold">{data.tasksCompleted}/{data.tasksTotal}</span>
                    <span className="text-[10px] text-muted-foreground">hábitos</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Progresso do dia</span>
              <span className="text-[10px] font-bold" style={{ color: scoreColor }}>{score}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreColor }}
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </motion.section>

      {!hasSetName && (
        <NameEditDialog
          open={showNameDialog}
          onOpenChange={setShowNameDialog}
          currentName={displayName}
          onSave={handleNameSave}
        />
      )}

      <AccountDrawer
        open={showAccount}
        onOpenChange={setShowAccount}
        displayName={displayName}
        onNameChange={onNameChange}
        onReplayTutorial={onReplayTutorial}
      />
    </>
  );
};
