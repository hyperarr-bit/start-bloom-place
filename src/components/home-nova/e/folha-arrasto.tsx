import { animate, useMotionValue, type MotionValue } from "framer-motion";
import { useCallback, useRef, type PointerEvent as PointerEventReact, type ReactNode } from "react";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";

/**
 * FECHAR ARRASTANDO PARA BAIXO (rodada 3, 26/10 — dono: "como no iOS, com acompanhamento do dedo e mola"). Toda folha de
 * baixo da Home nova (score, sequência, "+", formulários, personalizar, widgets, pendências, organizar) usa isto além
 * do X.
 *
 * Sem o `drag` do framer-motion: ele põe `touch-action: pan-x` na folha, e aí o conteúdo (listas, formulários, a
 * fileira dos personagens) deixaria de rolar com o dedo. A conta é na mão, com Pointer Events:
 *  · na ALÇA (a pilulinha + o respiro em volta, `touch-action: none`) o arrasto começa sempre;
 *  · no resto da folha só quando ela está no TOPO da rolagem (scrollTop 0) e o dedo desce — subindo, ou já rolada,
 *    quem manda é a rolagem nativa de sempre; toque em campo/botão/seletor não vira arrasto (o toque continua um toque);
 *  · a folha acompanha o dedo (motion value `y`); soltar além de 100 px ou com velocidade (> 0,5 px/ms) fecha (a saída
 *    do AnimatePresence parte de onde o dedo largou); senão volta com mola.
 */
export const LIMITE_FECHAR_PX = 100;

/**
 * RODADA 4 (vídeo do dono: "as folhas sobem passando do ponto e voltam, e descem em degraus"): a subida/descida da folha
 * é UMA mola CRITICAMENTE amortecida (sem overshoot: damping = 2·√stiffness), ~300 ms, só transform — e em PIXELS, a
 * mesma unidade do `y` do arrasto (misturar "100%" com px fazia o framer medir no meio da saída → os degraus). O fundo
 * escurecido não tem mais backdrop-blur (o desfoque sobre a página inteira derrubava quadros no iPhone).
 */
export const MOLA_FOLHA = { type: "spring" as const, stiffness: 300, damping: 35, mass: 1, restDelta: 0.5, restSpeed: 10 };
/** A descida: tween com aceleração (easeIn), 260 ms — contínua, sempre igual, e a folha desmonta assim que sai (a mola
 *  crítica demorava ~0,8 s pra "assentar" fora da tela: a folha ficava montada invisível e o teste de reabrir oscilava). */
export const SAIDA_FOLHA = { type: "tween" as const, ease: "easeIn" as const, duration: 0.26 };
/** 1.0.22 (dono 27/10, vídeo): "fechar a folha e ir pra outro lugar" esperava 180 ms — a descida leva 260 ms com
 *  aceleração, então a tela seguinte entrava com a folha ainda na metade. Quem fecha e navega/abre outra camada espera
 *  a descida INTEIRA (+20 ms de folga) — o mesmo ritmo, sem uma coisa por cima da outra. */
export const DEPOIS_DA_SAIDA_MS = Math.round(SAIDA_FOLHA.duration * 1000) + 20;
export const alturaDaSaida = (): number => (typeof window !== "undefined" ? Math.max(window.innerHeight, 600) : 1000);
export const propsDaFolha = (semMovimento: boolean) => ({
  initial: { y: alturaDaSaida() }, animate: { y: 0 },
  exit: { y: alturaDaSaida(), transition: semMovimento ? { duration: 0 } : SAIDA_FOLHA },
  transition: semMovimento ? { duration: 0 } : MOLA_FOLHA,
});
export const CLASSE_FUNDO_FOLHA = "fixed inset-0 z-[70] bg-black/40";
/**
 * Varredura 26/10: a faixa do relógio (.app-safe-top-guard, z-index máximo, clara e desfocada na E) ficava POR CIMA do
 * escurecido de toda folha — uma faixa clara no topo. Montado junto do fundo (dentro do `aberta && …` do
 * AnimatePresence), deixa a faixa transparente e sem desfoque enquanto a folha está aberta, inclusive durante a saída:
 * o escurecido cobre até o topo. Pilha: várias folhas juntas não se atropelam (faixaDoRelogio.ts).
 */
export const FaixaDoRelogioSobFolha = () => {
  useFaixaDoRelogioTransparente(true);
  return null;
};
export const propsDoFundo = (semMovimento: boolean) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: semMovimento ? 0 : 0.2 } });
export const LIMITE_FECHAR_VEL = 0.5; // px/ms

export const deveFechar = (deslocamento: number, velocidade: number): boolean =>
  deslocamento > LIMITE_FECHAR_PX || (deslocamento > 24 && velocidade > LIMITE_FECHAR_VEL);

const NAO_ARRASTA = "input, textarea, select, [contenteditable], [data-sem-arrasto]";

export interface FolhaArrastavel {
  /** o `style.y` da folha (motion value) */
  y: MotionValue<number>;
  /** props da própria folha (o motion.div `fixed bottom-0`) */
  folha: {
    onPointerDown: (e: PointerEventReact<HTMLElement>) => void;
    onPointerMove: (e: PointerEventReact<HTMLElement>) => void;
    onPointerUp: (e: PointerEventReact<HTMLElement>) => void;
    onPointerCancel: (e: PointerEventReact<HTMLElement>) => void;
    "data-arrastavel": "1";
  };
  /** props da alça (começa o arrasto sempre, mesmo com a folha rolada) */
  alca: { onPointerDown: (e: PointerEventReact<HTMLElement>) => void; style: { touchAction: "none" } };
}

export function useFolhaArrastavel(onFechar: () => void, semMovimento = false): FolhaArrastavel {
  const y = useMotionValue(0);
  const gesto = useRef<{ x0: number; y0: number; t0: number; yUlt: number; tUlt: number; vel: number; arrastando: boolean; valido: boolean; id: number } | null>(null);

  const comecar = useCallback((e: PointerEventReact<HTMLElement>, valido: boolean) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesto.current = { x0: e.clientX, y0: e.clientY, t0: e.timeStamp, yUlt: e.clientY, tUlt: e.timeStamp, vel: 0, arrastando: false, valido, id: e.pointerId };
  }, []);

  const onPointerDown = useCallback((e: PointerEventReact<HTMLElement>) => {
    const alvo = e.target as HTMLElement | null;
    if (alvo?.closest?.(NAO_ARRASTA)) { gesto.current = null; return; }
    // dentro de um rolador interno (a fileira dos personagens, uma lista): só se ele também está no topo
    const rolador = alvo?.closest?.<HTMLElement>("[data-rola], .fs-evolucao");
    const noTopo = e.currentTarget.scrollTop <= 0 && (!rolador || rolador === e.currentTarget || rolador.scrollTop <= 0);
    comecar(e, noTopo);
  }, [comecar]);

  const onPointerDownAlca = useCallback((e: PointerEventReact<HTMLElement>) => {
    comecar(e, true);
    e.stopPropagation();
  }, [comecar]);

  const onPointerMove = useCallback((e: PointerEventReact<HTMLElement>) => {
    const g = gesto.current;
    if (!g || !g.valido || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y0;
    const dx = e.clientX - g.x0;
    const dt = Math.max(1, e.timeStamp - g.tUlt);
    g.vel = (e.clientY - g.yUlt) / dt; g.yUlt = e.clientY; g.tUlt = e.timeStamp;
    if (!g.arrastando) {
      // 26/10 (revisor b48): deslizar os personagens pro lado com o dedo descendo um pouco fechava a folha — só arrasta
      // quando a descida vence o movimento lateral; lateral primeiro = rolagem horizontal, o gesto deixa de valer
      if (Math.abs(dx) > 6 && Math.abs(dx) >= dy) { g.valido = false; return; }
      if (dy > 6 && dy > Math.abs(dx)) { g.arrastando = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura, segue */ } }
      else if (dy < -6) { g.valido = false; return; } // subiu: é rolagem
      else return;
    }
    y.set(dy > 0 ? dy : 0);
  }, [y]);

  const soltar = useCallback((e: PointerEventReact<HTMLElement>, cancelado = false) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || !g.arrastando || g.id !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    // pointercancel = o WebKit tomou o gesto pra rolagem nativa no meio do arrasto (Simulador, rodada 3: começando
    // sobre a fileira dos personagens); se a folha já desceu um tanto, a intenção era fechar — fecha
    if (deveFechar(y.get(), g.vel) || (cancelado && (y.get() > 36 || (y.get() > 12 && g.vel > LIMITE_FECHAR_VEL)))) { onFechar(); return; }
    if (semMovimento) y.set(0);
    else animate(y, 0, { type: "spring", stiffness: 520, damping: 46 }); // crítico (2·√520 ≈ 45,6): volta sem tremer
  }, [y, onFechar, semMovimento]);
  const cancelar = useCallback((e: PointerEventReact<HTMLElement>) => soltar(e, true), [soltar]);

  return {
    y,
    folha: { onPointerDown, onPointerMove, onPointerUp: soltar, onPointerCancel: cancelar, "data-arrastavel": "1" },
    alca: { onPointerDown: onPointerDownAlca, style: { touchAction: "none" } },
  };
}

/** A pilulinha de cima com a área de toque em volta — a alça do arrasto. `className` = o respiro embaixo. */
export const Alca = ({ arrasto, className = "", children }: { arrasto: FolhaArrastavel; className?: string; children?: ReactNode }) => (
  <div {...arrasto.alca} data-testid="he-alca" className={`flex flex-col items-center pt-2.5 pb-2.5 -mt-2.5 cursor-grab active:cursor-grabbing ${className}`}>
    <span className="block w-9 h-1 rounded-full bg-muted-foreground/30" aria-hidden />
    {children}
  </div>
);
