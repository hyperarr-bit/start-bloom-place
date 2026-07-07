import { motion } from "framer-motion";
import { Badge } from "./types";
import { BadgeMedallion, tierOf, TIER_META } from "./BadgeMedallion";

interface BadgesGridProps {
  badges: Badge[];
  onSelect: (badge: Badge) => void;
}

/**
 * Grid de insígnias — medalhões grandes, raridade visível, tap abre o detalhe
 * (com compartilhar). Desbloqueadas primeiro, épicas antes das comuns.
 */
export const BadgesGrid = ({ badges, onSelect }: BadgesGridProps) => {
  const sorted = [...badges].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return b.xp - a.xp;
  });

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {sorted.map((badge, i) => {
        const meta = TIER_META[tierOf(badge.xp)];
        return (
          <motion.button
            key={badge.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.25 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(badge)}
            className={`rounded-2xl border p-3 pt-4 text-center transition-colors ${
              badge.unlocked
                ? "bg-card border-border hover:border-foreground/20"
                : "bg-muted/30 border-border/60"
            }`}
          >
            <BadgeMedallion
              emoji={badge.icon}
              xp={badge.xp}
              unlocked={badge.unlocked}
              size={64}
              className="mx-auto mb-2"
            />
            <p className={`text-[11px] font-bold leading-tight ${badge.unlocked ? "" : "text-muted-foreground"}`}>
              {badge.name}
            </p>
            <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${badge.unlocked ? meta.text : "text-muted-foreground/50"}`}>
              {meta.label}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
};
