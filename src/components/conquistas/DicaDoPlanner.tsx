import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen } from "lucide-react";
import "./conquistas.css";

/**
 * A DICA DO PLANNER (27/09, dono: "vai ter gente que nunca vai tocar nele").
 * Nas 3 primeiras visitas às Conquistas, um toque pulsando na capa e um
 * cartãozinho de papel com fita washi ensinam a abrir o planner: "Abrir
 * agora" abre; "Entendi, não precisa mais" some pra sempre; tocar fora só
 * fecha desta vez. Some sozinha depois que a pessoa abriu o planner uma vez
 * (já aprendeu). Nunca bloqueia a tela — é inline, e a capa continua
 * tocável embaixo do toque animado.
 *
 * Gravado por conta em `conquistas-dica-planner` { vistas, fim }.
 */

export const CHAVE_DICA_PLANNER = "conquistas-dica-planner";
export const VISITAS_COM_DICA = 3;

export interface EstadoDica { vistas: number; fim: boolean }

export const lerDica = (v: unknown): EstadoDica => {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<EstadoDica>) : {};
  return { vistas: Number.isFinite(Number(o.vistas)) ? Math.max(0, Math.floor(Number(o.vistas))) : 0, fim: o.fim === true };
};

/** Mostra nesta visita? (nem depois de "Entendi", nem depois de abrir o planner, nem da 4ª visita em diante) */
export const deveMostrarDica = (v: unknown): boolean => {
  const d = lerDica(v);
  return !d.fim && d.vistas < VISITAS_COM_DICA;
};

/** O toque pulsando, posicionado sobre a capa (em % da caixa do planner). */
export const ToqueNaCapa = ({ left = "64%", top = "42%" }: { left?: string; top?: string }) => (
  <span className="dica-toque" style={{ left, top }} aria-hidden data-testid="dica-toque">
    <i /><i /><b />
  </span>
);

interface Props {
  aberta: boolean;
  onAbrir: () => void;
  onEntendi: () => void;
  /** Toque fora do cartão (e fora da capa): fecha só desta vez. */
  onFechar: () => void;
  /** O que NÃO conta como "fora" (a capa do planner, que abre por conta própria). */
  ignorar?: React.RefObject<HTMLElement>;
  children?: ReactNode;
}

export const DicaDoPlanner = ({ aberta, onAbrir, onEntendi, onFechar, ignorar }: Props) => {
  const reduzir = useReducedMotion();
  const cartao = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node | null;
      if (!alvo) return;
      if (cartao.current?.contains(alvo)) return;
      if (ignorar?.current?.contains(alvo)) return;
      onFechar();
    };
    // depois do quadro atual: o toque que abriu a tela não conta como "fora"
    const t = setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", fora, true); };
  }, [aberta, onFechar, ignorar]);

  return (
    <AnimatePresence initial={false}>
      {aberta && (
        <motion.div
          key="dica"
          initial={reduzir ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduzir ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduzir ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: reduzir ? 0.12 : 0.32, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
          data-testid="dica-planner"
        >
          <div ref={cartao} className="dica-cartao mt-4 mx-1" role="note" aria-label="Dica: toque no planner pra abrir">
            <span className="dica-washi" aria-hidden />
            <div className="dica-titulo">Toca no seu planner</div>
            <div className="dica-texto">pra abrir e ver suas insígnias do mês — o número de cada conquista, na sua letra.</div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button type="button" className="dica-abrir" onClick={onAbrir} data-testid="dica-abrir">
                <BookOpen className="w-4 h-4" aria-hidden /> Abrir agora
              </button>
              <button type="button" className="dica-entendi" onClick={onEntendi} data-testid="dica-entendi">
                Entendi, não precisa mais
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
