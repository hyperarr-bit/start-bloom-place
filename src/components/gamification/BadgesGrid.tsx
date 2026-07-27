import { motion } from "framer-motion";
import { Badge, CATEGORIAS, fracaoDe } from "./types";
import { BadgeMedallion, tierOf, TIER_META } from "./BadgeMedallion";

interface BadgesGridProps {
  badges: Badge[];
  onSelect: (badge: Badge) => void;
}

/**
 * Grade de insígnias — medalhões grandes, raridade visível, tap abre o detalhe
 * (com compartilhar).
 *
 * AGRUPADA POR MÓDULO desde 27/07. Com 24 insígnias uma grade única já era
 * longa; com as de rotina, leitura, treino e dieta viraria uma parede de 37
 * medalhões sem hierarquia, onde a que a pessoa acabou de ganhar some. O
 * cabeçalho de cada seção diz quantas faltam ali — que é a pergunta que
 * alguém olhando conquistas realmente tem.
 *
 * Dentro da seção a ordem é: abertas primeiro (as épicas na frente, porque
 * são as de exibir), depois as trancadas ordenadas por quão perto estão.
 */
export const BadgesGrid = ({ badges, onSelect }: BadgesGridProps) => {
  const secoes = CATEGORIAS
    .map((c) => ({ ...c, itens: badges.filter((b) => b.category === c.id) }))
    .filter((s) => s.itens.length > 0);

  return (
    <div className="space-y-5">
      {secoes.map((secao) => {
        const abertas = secao.itens.filter((b) => b.unlocked).length;
        const ordenadas = [...secao.itens].sort((a, b) => {
          if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
          if (a.unlocked) return b.xp - a.xp;
          return fracaoDe(b) - fracaoDe(a);
        });

        return (
          <section key={secao.id}>
            <div className="flex items-baseline gap-2 mb-2.5 px-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {secao.emoji} {secao.label}
              </h3>
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground ml-auto">
                {abertas}/{secao.itens.length}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {ordenadas.map((badge, i) => {
                const meta = TIER_META[tierOf(badge.xp)];
                const f = fracaoDe(badge);
                return (
                  <motion.button
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
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
                    {/* Trancada e já começada mostra o quanto falta em vez da
                        raridade: quem está a 80% precisa saber disso, não que
                        a medalha é "Comum". */}
                    {!badge.unlocked && f > 0 ? (
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-foreground/30" style={{ width: `${Math.round(f * 100)}%` }} />
                      </div>
                    ) : (
                      <p className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${badge.unlocked ? meta.text : "text-muted-foreground/50"}`}>
                        {meta.label}
                      </p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
