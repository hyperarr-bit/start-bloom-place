import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Flame } from "lucide-react";
import { CHAVE_DIA_100_VISTO, MENSAGEM_DIA_100 } from "./DayScoreRing";
import { localDayKey } from "@/lib/utils";

/**
 * TELA de comemoração do dia em 100 (11/09, pedido do dono: "o app não tem
 * nenhuma tela de comemoração do 100"). Antes era só um toast de 3,5 s no pé
 * da Home — quem estava olhando o anel nem via. Agora, no instante em que o
 * score cruza 100, a tela inteira vira o fechamento do dia: o anel se desenha
 * até o fim, "Dia completo", a sequência, e um botão pra sair.
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

// Confete leve: 18 pedaços, cores do tema, caem uma vez e somem. Sem loop.
const PEDACOS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: 4 + ((i * 53) % 92),          // espalhados na largura
  atraso: (i % 6) * 0.12,
  dur: 2.2 + (i % 4) * 0.35,
  giro: (i % 2 ? 1 : -1) * (180 + (i * 37) % 180),
  cor: ["#FFFFFF", "#FFD84D", "#A9E5C2", "#FFB4C8"][i % 4],
  w: 8 + (i % 3) * 3,
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

  const raio = 76;
  const circ = 2 * Math.PI * raio;

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Dia completo"
          data-testid="celebracao-100"
          className="fixed inset-0 z-[400] flex flex-col items-center justify-center px-8 text-center text-white"
          style={{ background: "linear-gradient(180deg, hsl(142 55% 38%) 0%, hsl(150 50% 24%) 100%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => setAberta(false)}
        >
          {!semMovimento && PEDACOS.map((p) => (
            <motion.span
              key={p.id}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 rounded-sm"
              style={{ left: `${p.x}%`, width: p.w, height: p.w * 1.6, background: p.cor, opacity: 0.9 }}
              initial={{ y: -40, rotate: 0, opacity: 0 }}
              animate={{ y: "110vh", rotate: p.giro, opacity: [0, 1, 1, 0.6] }}
              transition={{ delay: 0.3 + p.atraso, duration: p.dur, ease: "easeIn" }}
            />
          ))}

          <div className="relative w-[200px] h-[200px]" onClick={(e) => e.stopPropagation()}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r={raio} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="14" />
              <motion.circle
                cx="100" cy="100" r={raio} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: semMovimento ? 0 : circ }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.3, ease: "easeOut", delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-6xl font-black tracking-tight leading-none"
                initial={{ scale: semMovimento ? 1 : 0.6, opacity: semMovimento ? 1 : 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 260, damping: 18 }}
              >
                100
              </motion.span>
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-80 mt-1">pontos</span>
            </div>
          </div>

          <motion.h2
            className="mt-8 text-4xl font-black tracking-tight"
            initial={{ y: semMovimento ? 0 : 12, opacity: semMovimento ? 1 : 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            Dia completo
          </motion.h2>
          <motion.p
            className="mt-3 text-base font-medium opacity-90 max-w-xs"
            initial={{ opacity: semMovimento ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
          >
            {MENSAGEM_DIA_100}
          </motion.p>

          {streak > 0 && (
            <motion.div
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold"
              initial={{ opacity: semMovimento ? 1 : 0, scale: semMovimento ? 1 : 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5 }}
            >
              <Flame className="w-4 h-4 text-amber-300" aria-hidden="true" />
              {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
            </motion.div>
          )}

          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAberta(false); }}
            className="mt-10 rounded-full bg-white px-8 py-3.5 text-base font-bold text-[hsl(150_50%_24%)] shadow-lg active:scale-[0.98] transition-transform"
            initial={{ opacity: semMovimento ? 1 : 0, y: semMovimento ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7 }}
          >
            Bom descanso
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
