import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { Badge, getLevel } from "./types";
import { BadgeMedallion } from "./BadgeMedallion";
import { shareProfile } from "./profile-share";

interface Props {
  badges: Badge[];
  totalXP: number;
}

/**
 * "Cartão do membro" — o hero da página de Conquistas: nome, nível, streak e
 * as 3 melhores insígnias num cartão premium que dá vontade de compartilhar.
 */
export const ProfileCard = ({ badges, totalXP }: Props) => {
  const { user } = useAuth();
  const { get } = useUserData();
  const [sharing, setSharing] = useState(false);

  const name =
    get<string>("core-user-name", "") ||
    get<string>("user-name", "") ||
    user?.email?.split("@")[0] ||
    "Você";
  const streak = get<number>("finance-streak", 0);
  const level = getLevel(totalXP);
  const unlocked = badges.filter((b) => b.unlocked);
  const top3 = [...unlocked].sort((a, b) => b.xp - a.xp).slice(0, 3);

  const handleShare = async () => {
    setSharing(true);
    trackEvent("profile_share", { level: level.name, badges: unlocked.length });
    const result = await shareProfile(name, totalXP, badges, streak);
    if (result === "downloaded") toast.success("Imagem salva! Agora é só postar 🎉");
    setSharing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="relative rounded-2xl p-5 text-white overflow-hidden border border-amber-300/25 shadow-[0_16px_44px_-16px_rgba(0,0,0,0.6)]"
        style={{ background: "linear-gradient(135deg, #2b2724 0%, #1b1815 100%)" }}
      >
        {/* brilho diagonal */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.08) 0%, transparent 45%)" }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.24em] text-white/45">
              CORE · Cartão do membro
            </p>
            <p className="text-xl font-extrabold tracking-tight mt-2 truncate">{name}</p>
            <p className="text-amber-300 font-bold text-sm mt-1">
              {level.icon} Nível {level.name}
            </p>
            <div className="flex items-center gap-3.5 mt-4 text-[12px] text-white/75 font-semibold">
              <span>🔥 {streak} dias</span>
              <span>🏅 {unlocked.length}/{badges.length}</span>
            </div>
          </div>

          {/* 3 melhores insígnias */}
          {top3.length > 0 && (
            <div className="flex flex-col gap-1 shrink-0">
              {top3.map((b) => (
                <BadgeMedallion key={b.id} emoji={b.icon} xp={b.xp} unlocked size={42} />
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleShare}
          disabled={sharing}
          className="relative mt-5 w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
        >
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Compartilhar meu perfil
        </button>
      </div>
    </motion.div>
  );
};
