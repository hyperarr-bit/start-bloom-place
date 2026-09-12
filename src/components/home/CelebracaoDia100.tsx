import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Flame } from "lucide-react";
import { CHAVE_DIA_100_VISTO, MENSAGEM_DIA_100 } from "./DayScoreRing";
import { localDayKey } from "@/lib/utils";

/**
 * TELA de comemoração do dia em 100 (11/09, pedido do dono: "o app não tem
 * nenhuma tela de comemoração do 100"). Antes era só um toast de 3,5 s no pé
 * da Home — quem estava olhando o anel nem via.
 *
 * Segunda versão no mesmo dia: a primeira era um painel verde inteiro e o
 * dono achou feia ("estilo BitePal"). Agora é a linguagem dos apps de
 * onboarding que ele usa de referência: fundo do tema, o anel do dia grande
 * se fechando em verde com um selo de check, confete colorido caindo uma
 * vez, e um botão cheio no pé.
 *
 * UMA vez por dia, guardada em `core-dia-100-visto` (data local): a Home
 * remonta a cada volta de módulo e a festa três vezes na mesma noite vira
 * ruído. Amanhã é outro dia e pode comemorar de novo.
 */
const dia100JaVisto = () => {
  try { return localStorage.getItem(CHAVE_DIA_100_VISTO) === localDayKey(); } catch { return false; }
};
const marcarDia100Visto = () => {
  try { localStorage.setItem(CHAVE_DIA_100_VISTO, localDayKey()); } catch { /* sem storage: no máximo repete */ }
};

// Confete: 22 pedaços nas cores do app (verde do anel, âmbar da sequência,
// rosa das ações, azul do treino), caem uma vez e somem. Sem loop.
const CORES = ["hsl(142 55% 42%)", "#F5B301", "#F0628C", "#4F8BFF", "#8B5CF6"];
const PEDACOS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: 3 + ((i * 47) % 94),
  atraso: (i % 7) * 0.09,
  dur: 2.4 + (i % 4) * 0.3,
  giro: (i % 2 ? 1 : -1) * (160 + (i * 41) % 200),
  cor: CORES[i % CORES.length],
  w: 7 + (i % 3) * 3,
  redondo: i % 3 === 0,
}));

export const CelebracaoDia100 = ({ score, streak }: { score: number; streak: number }) => {
  const [aberta, setAberta] = useState(false);
  const semMovimento = useReducedMotion();
  const completo = score >= 100;

  useEffect(() => {
    if (!completo || dia100JaVisto()) return;
    marcarDia100Visto();
    setAberta(true);
  }, [completo]);

  const raio = 84;
  const circ = 2 * Math.PI * raio;
  const fechar = () => setAberta(false);

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Dia completo"
          data-testid="celebracao-100"
          className="fixed inset-0 z-[400] flex flex-col bg-background text-foreground overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {!semMovimento && PEDACOS.map((p) => (
            <motion.span
              key={p.id}
              aria-hidden="true"
              className="pointer-events-none absolute top-0"
              style={{
                left: `${p.x}%`, width: p.w, height: p.redondo ? p.w : p.w * 1.7,
                background: p.cor, borderRadius: p.redondo ? "50%" : 2, opacity: 0.95,
              }}
              initial={{ y: -30, rotate: 0, opacity: 0 }}
              animate={{ y: "105vh", rotate: p.giro, opacity: [0, 1, 1, 0.5] }}
              transition={{ delay: 0.25 + p.atraso, duration: p.dur, ease: "easeIn" }}
            />
          ))}

          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="relative w-[220px] h-[220px]">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220" aria-hidden="true">
                <circle cx="110" cy="110" r={raio} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
                <motion.circle
                  cx="110" cy="110" r={raio} fill="none" stroke="hsl(var(--success))" strokeWidth="16" strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: semMovimento ? 0 : circ }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-[64px] font-black tracking-tight leading-none text-success tabular-nums"
                  initial={{ scale: semMovimento ? 1 : 0.7, opacity: semMovimento ? 1 : 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.9, type: "spring", stiffness: 240, damping: 16 }}
                >
                  100
                </motion.span>
                <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-muted-foreground mt-1">pontos</span>
              </div>
              <motion.div
                aria-hidden="true"
                className="absolute right-1 top-1 w-14 h-14 rounded-full bg-success text-success-foreground flex items-center justify-center shadow-lg ring-4 ring-background"
                initial={{ scale: semMovimento ? 1 : 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.35, type: "spring", stiffness: 300, damping: 14 }}
              >
                <Check className="w-7 h-7" strokeWidth={3.2} />
              </motion.div>
            </div>

            <motion.h2
              className="mt-9 text-[34px] font-black tracking-tight leading-none"
              initial={{ y: semMovimento ? 0 : 10, opacity: semMovimento ? 1 : 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.15 }}
            >
              Dia completo
            </motion.h2>
            <motion.p
              className="mt-3 text-base text-muted-foreground max-w-xs leading-relaxed"
              initial={{ opacity: semMovimento ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              {MENSAGEM_DIA_100}
            </motion.p>

            {streak > 0 && (
              <motion.div
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200"
                initial={{ opacity: semMovimento ? 1 : 0, scale: semMovimento ? 1 : 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5 }}
              >
                <Flame className="w-4 h-4 text-orange-500" aria-hidden="true" />
                {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
              </motion.div>
            )}
          </div>

          <motion.div
            className="px-6 pb-[max(28px,env(safe-area-inset-bottom))]"
            initial={{ opacity: semMovimento ? 1 : 0, y: semMovimento ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7 }}
          >
            <button
              type="button"
              onClick={fechar}
              className="w-full rounded-full bg-primary text-primary-foreground text-base font-bold py-4 shadow-lg active:scale-[0.98] transition-transform"
            >
              Bom descanso
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
