import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, CloudSun, Sunset, Pencil, ChevronDown } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { LifeHubData } from "@/hooks/use-life-hub-data";
import { NameEditDialog } from "./NameEditDialog";
import { AccountDrawer } from "./AccountDrawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface GreetingHeaderProps {
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
  if (h >= 6 && h < 9) {
    if (data.todayWorkoutGroup && !data.workoutDone) return `Hora de começar! Treino de ${data.todayWorkoutGroup} te espera 💪`;
    if (data.tasksTotal > 0 && data.tasksCompleted === 0) return `${data.tasksTotal} hábito${data.tasksTotal > 1 ? "s" : ""} para conquistar hoje 🎯`;
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
      const faltam = data.mealsTotal - data.mealsLogged;
      return `Hora do almoço! ${faltam} refei${faltam > 1 ? "ções restantes" : "ção restante"} 🍽️`;
    }
    return "Hora do almoço, recarregue as energias 🍽️";
  }
  if (h >= 14 && h < 18) {
    if (data.waterGlasses < data.waterGoal) {
      const copos = data.waterGoal - data.waterGlasses;
      return `Hidrate-se! Falta${copos > 1 ? "m" : ""} ${copos} copo${copos > 1 ? "s" : ""} de água 💧`;
    }
    if (data.todayWorkoutGroup && !data.workoutDone) return `Ainda dá tempo do treino de ${data.todayWorkoutGroup} 🏋️`;
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
  if (data.dayScore >= 80) return "Dia completo! Descanse com orgulho 🌟";
  if (data.dayScore >= 50) return "Bom dia! Amanhã será ainda melhor 💫";
  return "Hora de descansar. Amanhã é uma nova chance ✨";
};

export const GreetingHeader = ({ data, onNameChange, onReplayTutorial }: GreetingHeaderProps) => {
  const { user } = useAuth();
  const { get, set: setUserData } = useUserData();
  const { text: greeting, Icon: GreetingIcon } = getGreeting();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const contextMessage = getContextualMessage(data);
  const nomeCompleto = data.userName || user?.email?.split("@")[0] || "";
  /* Só o PRIMEIRO nome na saudação (29/07). "Boa tarde, João Victor 👋" não
     cabe em 360px e virava "Boa tarde, João Vic…" — nome cortado no meio é
     pior que nome curto. As iniciais do avatar continuam usando o nome
     inteiro, que é onde as duas letras fazem sentido. */
  const displayName = nomeCompleto.trim().split(/\s+/)[0] || "";
  const hasSetName = !!get<string>("core-user-name", "");

  const initials = nomeCompleto
    ? nomeCompleto.slice(0, 2).toUpperCase()
    : "?";

  const handleNameSave = (name: string) => {
    setUserData("core-user-name", name);
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
            {/* text-base em tela pequena (320px): a 18px "Boa tarde, João 👋"
                  ainda cortava. O nome é a parte que importa — encolhe a fonte
                  em vez de comer a palavra. */}
            <h1 className="text-base sm:text-lg font-bold truncate">
              {greeting}{displayName ? `, ${displayName}` : ""} 👋
            </h1>
            {!hasSetName && (
              <button
                onClick={() => setShowNameDialog(true)}
                className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Editar nome"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{contextMessage}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Avatar-badge (22/07, escolha do dono após ▾ e ☰): o próprio
              avatar É o menu — anel degradê + mini-badge ⌄ no canto, padrão
              Google/Instagram. Um elemento só, nada solto do lado.
              account_drawer_open segue medindo a descoberta real. */}
          <motion.button
            onClick={() => { trackEvent("account_drawer_open", { via: "avatar" }); setShowAccount(true); }}
            className="relative rounded-full"
            whileTap={{ scale: 0.9 }}
            aria-label="Minha conta"
          >
            <span className="block rounded-full p-[2px] bg-gradient-to-br from-primary/70 to-primary/20">
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background border border-border shadow-sm flex items-center justify-center">
              <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" strokeWidth={3} />
            </span>
          </motion.button>
          <ThemeToggle showPalette />
        </div>
      </motion.div>

      {!hasSetName && (
        <NameEditDialog
          open={showNameDialog}
          onOpenChange={setShowNameDialog}
          currentName={nomeCompleto}
          onSave={handleNameSave}
        />
      )}

      {/* nomeCompleto, não displayName (17/08): displayName é SÓ o primeiro
          nome (corte visual da saudação). Passar ele pro drawer/dialog fazia
          "alterar nome" abrir com "João" pra quem é "João Victor" — e salvar
          dali comia o sobrenome em silêncio. */}
      <AccountDrawer
        open={showAccount}
        onOpenChange={setShowAccount}
        displayName={nomeCompleto}
        onNameChange={onNameChange}
        onReplayTutorial={onReplayTutorial}
      />
    </>
  );
};
