import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Share2, Loader2, Lock, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { parseLocalDay } from "@/lib/utils";
import { rotuloProgresso, textoFalta } from "@/lib/conquistas-registro";
import { Adesivo } from "@/components/conquistas/adesivos-arte";
import { Roseta } from "@/components/conquistas/Roseta";
import { compartilharAdesivo, compartilharRoseta } from "@/components/conquistas/compartilhar-conquistas";
import { Badge, fracaoDe, tierOf, TIER_LABEL } from "./types";

interface Props {
  badge: Badge | null;
  onClose: () => void;
  /** Dia em que foi colado ("AAAA-MM-DD"). */
  desbloqueadoEm?: string;
  /** Sequência viva (pro "falta" dos adesivos de sequência). */
  diasDeSequencia?: number;
  perfil: { nome: string; membroDesde: string; nivel: string };
}

/**
 * Detalhe do adesivo (novo visual, 26/09): o adesivo grande colando de novo,
 * quando foi conquistado e o compartilhar nos Stories. O que falta mostra o
 * progresso e o "falta" em palavras. Os de sequência compartilham a ROSETA
 * (com a opção de fundo transparente, pra colar na foto).
 */
export const BadgeDetailSheet = ({ badge, onClose, desbloqueadoEm, diasDeSequencia = 0, perfil }: Props) => {
  const [enviando, setEnviando] = useState<"cor" | "transparente" | null>(null);
  const reduzir = useReducedMotion();
  if (!badge) return null;

  const ehSequencia = badge.category === "sequencia";
  const alvoSequencia = badge.progresso?.alvo ?? 7;
  const f = fracaoDe(badge);
  const rotulo = rotuloProgresso(badge);

  const compartilhar = async (transparente = false) => {
    setEnviando(transparente ? "transparente" : "cor");
    try {
      if (ehSequencia) await compartilharRoseta({ dias: alvoSequencia, nome: perfil.nome, membroDesde: perfil.membroDesde, nivel: perfil.nivel, transparente });
      else await compartilharAdesivo({ id: badge.id, titulo: badge.name, descricao: badge.description, nome: perfil.nome, membroDesde: perfil.membroDesde });
    } finally {
      setEnviando(null);
    }
  };

  const colado = desbloqueadoEm
    ? parseLocalDay(desbloqueadoEm).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <Sheet open={!!badge} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="max-w-sm mx-auto text-center pt-3">
          {badge.unlocked ? (
            <motion.div
              className="flex justify-center"
              initial={reduzir ? { opacity: 0 } : { y: -60, rotate: -16, scale: 0.8, opacity: 0 }}
              animate={reduzir ? { opacity: 1 } : { y: 0, rotate: -4, scale: 1, opacity: 1 }}
              transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 240, damping: 14 }}
            >
              {ehSequencia ? (
                <Roseta dias={alvoSequencia} nivel={perfil.nivel} membroDesde={perfil.membroDesde} largura={128} />
              ) : (
                <Adesivo id={badge.id} tamanho={144} bordaGrossa titulo={badge.name} />
              )}
            </motion.div>
          ) : (
            <div className="flex justify-center">
              <div className="w-[128px] h-[128px] my-2 rounded-full border-[3px] border-dashed border-foreground/15 bg-muted/50 grid place-items-center text-muted-foreground">
                {rotulo ? <span className="text-2xl font-extrabold tabular-nums">{rotulo}</span> : <Lock className="w-8 h-8" />}
              </div>
            </div>
          )}

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-4 text-muted-foreground">
            {badge.unlocked ? `Adesivo ${TIER_LABEL[tierOf(badge.xp)].toLowerCase()} · +${badge.xp} XP` : `A caminho · +${badge.xp} XP`}
          </p>
          <SheetTitle className="text-2xl font-bold tracking-tight mt-1">{badge.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground mt-1">{badge.description}</SheetDescription>

          {badge.unlocked ? (
            <>
              {colado && <p className="text-xs text-muted-foreground mt-2">Colado no seu planner em {colado}</p>}
              <Button onClick={() => compartilhar(false)} disabled={!!enviando} size="lg" className="w-full h-12 mt-6 gap-2 font-bold">
                {enviando === "cor" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                Compartilhar nos Stories
              </Button>
              {ehSequencia && (
                <button
                  type="button"
                  onClick={() => compartilhar(true)}
                  disabled={!!enviando}
                  className="mt-2 w-full h-11 rounded-xl border border-border text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {enviando === "transparente" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Fundo transparente <span className="font-normal text-muted-foreground">· pra colar na sua foto</span>
                </button>
              )}
            </>
          ) : (
            <div className="mt-6 rounded-xl bg-muted/50 border border-border px-4 py-3 text-left">
              {badge.progresso && f > 0 && (
                <div className="mb-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-foreground/40" style={{ width: `${Math.round(f * 100)}%` }} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Falta: <span className="font-semibold text-foreground">{textoFalta(badge, diasDeSequencia)}</span>
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
