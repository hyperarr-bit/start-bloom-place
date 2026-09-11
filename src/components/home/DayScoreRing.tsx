import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { localDayKey } from "@/lib/utils";

interface DayScoreRingProps {
  score: number;
  streak: number;
}

/* Comemoração dos 100 (10/09). Até aqui não existia NADA em 100: a cor mudava
 * em 80, a saudação dizia "completo" em 80, e o teto real era 95 pra quem não
 * cadastrava suplemento (cliente: "fiz tudo mas só vai até os 95%"). Agora
 * que o score fecha de verdade, o fechamento tem que ser visto — discreto:
 * um pulso no anel, o número no tom de sucesso e UM toast de uma linha, uma
 * vez por dia. Sem tela, sem confete, sem som. */
export const CHAVE_DIA_100_VISTO = "core-dia-100-visto";
export const MENSAGEM_DIA_100 = "Dia 100%. Fecha o app em paz. 🌟";

const dia100JaVisto = () => {
  try { return localStorage.getItem(CHAVE_DIA_100_VISTO) === localDayKey(); } catch { return false; }
};
const marcarDia100Visto = () => {
  try { localStorage.setItem(CHAVE_DIA_100_VISTO, localDayKey()); } catch { /* sem storage, sem memória — no máximo repete o toast */ }
};

export const DayScoreRing = ({ score, streak }: DayScoreRingProps) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const completo = score >= 100;
  const semMovimento = useReducedMotion();

  // Toast uma vez por DIA, não por montagem: a Home remonta a cada volta de
  // módulo, e "Dia 100%" três vezes na mesma noite vira ruído. A chave guarda
  // a data local (localDayKey) — amanhã é outro dia e pode comemorar de novo.
  useEffect(() => {
    if (!completo || dia100JaVisto()) return;
    marcarDia100Visto();
    toast(MENSAGEM_DIA_100, { duration: 3500 });
  }, [completo]);

  const getScoreColor = () => {
    if (score >= 80) return "hsl(var(--success))";
    if (score >= 50) return "hsl(var(--warning))";
    return "hsl(var(--warning))";
  };

  return (
    <div className="flex items-center gap-5">
      {/* Em 100 o anel dá UM pulso curto (600ms) depois que o traço termina de
          preencher (0,3s + 1,2s). Keyframe do framer, sem loop; com
          prefers-reduced-motion fica parado — o número em verde já conta. */}
      <motion.div
        className="relative w-[130px] h-[130px] flex-shrink-0"
        data-testid="anel-score"
        data-completo={completo ? "true" : undefined}
        animate={completo && !semMovimento ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={completo && !semMovimento ? { duration: 0.6, delay: 1.5, ease: "easeInOut" } : { duration: 0 }}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={getScoreColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* text-success só em 100: mesmo token do anel, nada de cor nova. */}
          <motion.span
            className={`text-3xl font-bold${completo ? " text-success" : ""}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">pontos</span>
        </div>
      </motion.div>

      <div className="flex-1 min-w-0">
        <motion.p
          className="text-lg font-bold mb-0.5"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {/* 11/09: dizia "Vamos lá!" até com 100 pontos — ao lado do anel
              verde e da saudação "Dia completo", virava contradição. O rótulo
              acompanha o número; a comemoração de 100 já mora no anel. */}
          {score >= 100 ? "Dia completo!" : score >= 70 ? "Quase lá!" : score >= 30 ? "Bom ritmo!" : "Vamos lá!"}
        </motion.p>
        <p className="text-[11px] text-muted-foreground mb-3">Score do dia baseado em suas atividades</p>

        {streak > 0 && (
          <motion.div
            /* Selo é unidade — ou cabe inteiro, ou não é selo.
             *
             * 29/07: a 360px ele partia em "19 dias" / "consecutivos", duas
             * alturas no meio do card. Pus `whitespace-nowrap` e resolveu ali.
             *
             * 30/07: a 320px o nowrap virou TRANSBORDO — "consecutivos" saía
             * do fundo arredondado e do cartão. Trocar quebra por vazamento
             * não é conserto. A palavra "consecutivos" é a parte dispensável:
             * 🔥 + "20 dias" já diz sequência sozinho. Então ela só entra
             * quando há largura pra ela. */
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 whitespace-nowrap max-w-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring" }}
          >
            <Flame className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-bold text-warning">{streak} dia{streak > 1 ? "s" : ""}</span>
            <span className="hidden min-[350px]:inline text-[10px] text-muted-foreground">consecutivo{streak > 1 ? "s" : ""}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
