import { useUserData } from "@/hooks/use-user-data";
import { Trophy } from "lucide-react";
import { differenceInDays } from "date-fns";

interface DetoxHabit {
  id: string;
  name: string;
  icon: string;
  startDate: string;
  relapses: string[];
  record: number;
}

const milestones = [
  { days: 1, title: "Primeiro Dia", msg: "Toda jornada começa com um passo." },
  { days: 3, title: "3 Dias Limpos", msg: "O mais difícil já passou!" },
  { days: 7, title: "1 Semana", msg: "Uma semana inteira. Você é forte." },
  { days: 14, title: "2 Semanas", msg: "Seu corpo já sente a diferença." },
  { days: 30, title: "1 Mês", msg: "Um mês! Novo hábito em formação." },
  { days: 60, title: "2 Meses", msg: "Consistência é superpoder." },
  { days: 90, title: "3 Meses", msg: "Você transformou sua vida." },
  { days: 180, title: "6 Meses", msg: "Meio ano de liberdade!" },
  { days: 365, title: "1 Ano", msg: "Lendário. Você venceu. 👑" },
];

export const DetoxAchievements = () => {
  const { get } = useUserData();
  const habits = get<DetoxHabit[]>("detox-habits", []);

  const getStreak = (h: DetoxHabit) => {
    const lastRelapse = h.relapses.length > 0 ? h.relapses[h.relapses.length - 1] : null;
    const from = lastRelapse || h.startDate;
    return differenceInDays(new Date(), new Date(from));
  };

  if (habits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm mt-3">
        Adicione hábitos no Rastreador para desbloquear conquistas 🏆
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      {habits.map(h => {
        const streak = getStreak(h);
        const best = Math.max(h.record, streak);

        return (
          <div key={h.id} className="bg-card rounded-xl border border-border p-3">
            <p className="text-sm font-bold mb-2 flex items-center gap-2">
              <span>{h.icon}</span> {h.name}
            </p>
            <div className="space-y-1.5">
              {milestones.map(m => {
                const unlocked = best >= m.days;
                return (
                  <div key={m.days} className={`flex items-center gap-2 p-2 rounded-lg ${unlocked ? "bg-green-500/10" : "bg-muted/20 opacity-50"}`}>
                    <Trophy className={`w-3.5 h-3.5 ${unlocked ? "text-yellow-400" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${unlocked ? "" : "text-muted-foreground"}`}>{m.title}</p>
                      <p className="text-[10px] text-muted-foreground">{m.msg}</p>
                    </div>
                    {unlocked && <span className="text-[10px] text-green-400 font-bold">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
