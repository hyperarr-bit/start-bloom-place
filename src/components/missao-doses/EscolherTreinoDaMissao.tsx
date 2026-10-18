import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EscolherTreino, type ResultadoDaEscolha } from "@/components/intro-modulo/EscolherTreino";

export type { ResultadoDaEscolha };

/**
 * A 1ª DOSE DE QUEM ESCOLHEU "CORPO" (1.0.16, regra do dono 17/10): o EscolherTreino da introdução dos módulos
 * ("Onde você treina?" + "Quantos dias por semana?" → um modelo pronto aplicado na semana) POR CIMA do módulo
 * Treino, logo abaixo da faixa da missão — um cartão com uma sombra leve atrás (o módulo continua lá embaixo, e
 * o bloco "Comece com um modelo pronto" dele some enquanto o cartão está na tela: intro-modulo.css).
 * Só a missão abre (o módulo, por curiosidade, nunca mostra quiz). Enquanto está na tela, o próprio
 * EscolherTreino marca `<html data-escolher-treino>`.
 */
export const ATRIBUTO_ESCOLHER_TREINO = "data-escolher-treino";

const temPlanoDeTreino = (get: <T>(k: string, f: T) => T): boolean => {
  try {
    const plano = (get<Record<string, { exercises?: unknown[] }> | null>("saude-workouts-v2", {}) ?? {}) as Record<string, { exercises?: unknown[] }>;
    return Object.values(plano).some((d) => Array.isArray(d?.exercises) && d.exercises.length > 0);
  } catch { return false; }
};

/** Mostra as 2 perguntas? Só com o Treino SEM plano (quem já tem treino montado não ganha um 2º modelo por cima). */
export const deveMostrarEscolherTreino = ({ get, isGuest }: { criadoEm?: string | null; get: <T>(k: string, f: T) => T; isGuest: boolean }): boolean =>
  !isGuest && !temPlanoDeTreino(get);

export function EscolherTreinoDaMissao({ onPronto, onPular }: { origem: "missao"; onPronto: (r?: unknown) => void; onPular: () => void }) {
  const reduzir = !!useReducedMotion();
  return createPortal(
    <>
      <div aria-hidden className="fixed inset-0 z-[199]" style={{ background: "rgba(15,12,20,.38)" }} data-testid="missao-escolher-treino-fundo" />
      <motion.div
        className="fixed inset-x-0 z-[200] px-4"
        style={{ top: "calc(var(--missao-doses-faixa-h, 44px) + var(--app-safe-top, 0px) + 12px)" }}
        initial={reduzir ? false : { y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
        data-testid="missao-escolher-treino" data-camada-guia="missao-escolher-treino"
      >
        <div className="mx-auto w-full max-w-[440px] rounded-[18px] shadow-[0_24px_48px_-20px_rgba(0,0,0,.65)] [&>section]:!mb-0">
          <EscolherTreino onPronto={(r) => onPronto(r)} onPular={onPular} />
        </div>
      </motion.div>
    </>,
    document.body,
  );
}
