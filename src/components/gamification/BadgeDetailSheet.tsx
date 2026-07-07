import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Loader2, Lock } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "./types";
import { BadgeMedallion, tierOf, TIER_META } from "./BadgeMedallion";
import { shareBadge } from "./badge-share";
import { trackEvent } from "@/lib/analytics";

interface Props {
  badge: Badge | null;
  onClose: () => void;
}

/** Detalhe da insígnia: medalhão grande + compartilhar (a parte "quero postar"). */
export const BadgeDetailSheet = ({ badge, onClose }: Props) => {
  const [sharing, setSharing] = useState(false);
  if (!badge) return null;

  const meta = TIER_META[tierOf(badge.xp)];

  const handleShare = async () => {
    setSharing(true);
    trackEvent("badge_share", { badge: badge.id });
    const result = await shareBadge(badge);
    if (result === "downloaded") toast.success("Imagem salva! Agora é só postar 🎉");
    setSharing(false);
  };

  return (
    <Sheet open={!!badge} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="max-w-sm mx-auto text-center pt-2">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 15 }}
          >
            <BadgeMedallion
              emoji={badge.icon}
              xp={badge.xp}
              unlocked={badge.unlocked}
              size={140}
              className="mx-auto"
            />
          </motion.div>

          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-4 ${badge.unlocked ? meta.text : "text-muted-foreground"}`}>
            Insígnia {meta.label} · +{badge.xp} XP
          </p>
          <h3 className="text-2xl font-bold tracking-tight mt-1">{badge.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>

          {badge.unlocked ? (
            <Button onClick={handleShare} disabled={sharing} size="lg" className="w-full h-12 mt-6 gap-2 font-bold">
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Compartilhar conquista
            </Button>
          ) : (
            <div className="mt-6 rounded-xl bg-muted/50 border border-border px-4 py-3 flex items-center gap-2.5 text-left">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Ainda bloqueada — <span className="font-semibold text-foreground">{badge.description.toLowerCase()}</span> pra desbloquear.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
