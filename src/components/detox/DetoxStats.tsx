import { useUserData } from "@/hooks/use-user-data";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { differenceInDays, format, subDays } from "date-fns";
import { TrendingUp, Calendar, Target, Flame } from "lucide-react";
import { normalizeDetoxHabits, type DetoxHabit } from "./utils";

export const DetoxStats = () => {
  const { get } = useUserData();
  const habits = normalizeDetoxHabits(get<DetoxHabit[]>("detox-habits", []));

  if (habits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm mt-3">
        Adicione hábitos no Rastreador para ver estatísticas 📊
      </div>
    );
  }

  const getStreak = (h: DetoxHabit) => {
    const lastRelapse = h.relapses.length > 0 ? h.relapses[h.relapses.length - 1] : null;
    const from = lastRelapse || h.startDate;
    return differenceInDays(new Date(), new Date(from));
  };

  // Weekly data for last 4 weeks
  const getWeeklyData = (h: DetoxHabit) => {
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      const weekEnd = subDays(new Date(), w * 7);
      const weekStart = subDays(weekEnd, 6);
      const relapseCount = h.relapses.filter(r => {
        const d = new Date(r);
        return d >= weekStart && d <= weekEnd;
      }).length;
      const pureDays = 7 - relapseCount;
      weeks.push({ name: `S${4 - w}`, pure: pureDays, relapse: relapseCount });
    }
    return weeks;
  };

  return (
    <div className="space-y-4 mt-3">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <Flame className="w-4 h-4 mx-auto mb-1 text-orange-400" />
          <p className="text-lg font-bold">{habits.reduce((max, h) => Math.max(max, getStreak(h)), 0)}</p>
          <p className="text-[10px] text-muted-foreground">Maior streak ativo</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <Target className="w-4 h-4 mx-auto mb-1 text-green-400" />
          <p className="text-lg font-bold">{habits.reduce((max, h) => Math.max(max, Math.max(h.record, getStreak(h))), 0)}</p>
          <p className="text-[10px] text-muted-foreground">Recorde geral</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{habits.reduce((s, h) => s + getStreak(h), 0)}</p>
          <p className="text-[10px] text-muted-foreground">Dias puros (total)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1 text-destructive" />
          <p className="text-lg font-bold">{habits.reduce((s, h) => s + h.relapses.length, 0)}</p>
          <p className="text-[10px] text-muted-foreground">Total recaídas</p>
        </div>
      </div>

      {/* Per-habit charts */}
      {habits.map(h => {
        const streak = getStreak(h);
        const best = Math.max(h.record, streak);
        const totalDays = differenceInDays(new Date(), new Date(h.startDate)) || 1;
        const successRate = Math.round(((totalDays - h.relapses.length) / totalDays) * 100);
        const weekData = getWeeklyData(h);

        return (
          <div key={h.id} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold flex items-center gap-2">
                <span>{h.icon}</span> {h.name}
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                successRate >= 80 ? "bg-green-500/20 text-green-400" :
                successRate >= 50 ? "bg-amber-500/20 text-amber-400" :
                "bg-destructive/20 text-destructive"
              }`}>
                {successRate}% sucesso
              </span>
            </div>

            <div className="flex gap-4 text-center mb-3">
              <div className="flex-1">
                <p className="text-xs font-bold">{streak}</p>
                <p className="text-[9px] text-muted-foreground">Streak atual</p>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold">{best}</p>
                <p className="text-[9px] text-muted-foreground">Recorde</p>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold">{h.relapses.length}</p>
                <p className="text-[9px] text-muted-foreground">Recaídas</p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mb-1">Últimas 4 semanas</p>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 7]} />
                  <Bar dataKey="pure" radius={[4, 4, 0, 0]}>
                    {weekData.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--primary))" opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
};
