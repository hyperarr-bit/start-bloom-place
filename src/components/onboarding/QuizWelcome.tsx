import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { getQuizAnswers, GASTO_ANCHOR, VICTORY_PHRASE } from "@/lib/funnel";

/**
 * Primeira sessão de quem veio pelo funil: o app abre repetindo a meta e o
 * R$ que a PESSOA declarou no quiz, em vez de um painel genérico vazio.
 * Fica no topo do MEU FINANCEIRO só enquanto o tutorial não termina —
 * depois disso o painel real (com os números dela) assume a narrativa.
 */
export const QuizWelcome = () => {
  const quiz = getQuizAnswers();
  const victory = VICTORY_PHRASE[quiz.vitoria ?? ""];
  const anchor = GASTO_ANCHOR[quiz.gasto ?? ""] ?? null;
  const answeredGasto = Boolean(quiz.gasto);

  // Sem quiz (conta criada fora do funil): não inventa contexto.
  if (!victory && !answeredGasto) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-accent/25 bg-accent/[0.05] p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-accent text-accent-foreground shrink-0">
          <Target className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-snug">
            Seu plano: {victory ?? "ver pra onde seu dinheiro vai"}
          </p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1">
            {anchor ? (
              <>
                Você estimou que <strong className="text-foreground">{anchor.month}/mês</strong> somem
                sem explicação — {anchor.year} num ano. Os primeiros lançamentos abaixo montam o
                radar que encontra esse dinheiro.
              </>
            ) : answeredGasto ? (
              <>
                Você disse que <strong className="text-foreground">não faz ideia</strong> de quanto
                some por mês. Três lançamentos abaixo e o painel começa a te contar.
              </>
            ) : (
              <>Os primeiros lançamentos abaixo montam seu painel de verdade.</>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
