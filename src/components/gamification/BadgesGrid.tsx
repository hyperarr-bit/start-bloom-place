import { Lock } from "lucide-react";
import { Badge } from "./types";
import { motion } from "framer-motion";

interface BadgesGridProps {
  badges: Badge[];
}

const categoryLabels: Record<string, string> = {
  finance: "💰 Finanças",
  health: "🩺 Saúde",
  habits: "🔥 Hábitos",
  general: "⭐ Geral",
};

const categoryIcons: Record<string, { icon: string; bg: string; border: string }> = {
  finance: { icon: "💰", bg: "from-green-500/10 to-emerald-500/5", border: "border-green-500/30" },
  health: { icon: "🩺", bg: "from-blue-500/10 to-cyan-500/5", border: "border-blue-500/30" },
  habits: { icon: "🔥", bg: "from-orange-500/10 to-red-500/5", border: "border-orange-500/30" },
  general: { icon: "⭐", bg: "from-yellow-500/10 to-amber-500/5", border: "border-yellow-500/30" },
};

export const BadgesGrid = ({ badges }: BadgesGridProps) => {
  const categories = ["finance", "health", "habits", "general"] as const;

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const catBadges = badges.filter((b) => b.category === cat);
        if (catBadges.length === 0) return null;
        const unlockedCount = catBadges.filter((b) => b.unlocked).length;
        const style = categoryIcons[cat];

        return (
          <div key={cat} className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-bold mb-3 flex items-center justify-between">
              <span>{categoryLabels[cat]}</span>
              <span className="text-muted-foreground font-normal">
                {unlockedCount}/{catBadges.length}
              </span>
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {catBadges.map((badge, i) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-lg p-3 text-center transition-all ${
                    badge.unlocked
                      ? `bg-gradient-to-br ${style.bg} border ${style.border}`
                      : "bg-muted/30 border border-border opacity-50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center text-lg ${
                      badge.unlocked ? "bg-background/50" : "bg-muted"
                    }`}
                  >
                    {badge.unlocked ? badge.icon : <Lock className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <p className={`text-[11px] font-bold ${badge.unlocked ? "" : "text-muted-foreground"}`}>
                    {badge.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{badge.description}</p>
                  {badge.unlocked && (
                    <span className="inline-block mt-1 text-[9px] font-bold text-yellow-400">+{badge.xp} XP</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
