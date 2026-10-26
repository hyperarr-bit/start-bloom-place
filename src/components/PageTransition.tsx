import { animate, motion, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { ReactNode, useLayoutEffect, useRef, useState, type PointerEvent as PointerEventReact } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { rotaComFoto, rotaMontou } from "@/lib/troca-de-rota";
import { PUSH_IOS, modoDeEntrada, voltar, type EstadoPush, type ModoDeEntrada } from "@/lib/navegacao-ios";

// Sem animação de exit de propósito: animar a saída de uma página grande
// (Finanças tem milhares de nós) segura o AnimatePresence mode="wait" por
// 300ms desmontando uma árvore pesada — era a "travada" ao navegar pelo menu.
// Entrada só com opacidade, curta: barata de compor na GPU.
// 1.0.17 QA (lib/troca-de-rota): no app, a tela de antes fica numa foto por cima durante a troca — a página nova entra
// já inteira embaixo (sem o fade a partir do fundo, que era o quadro em branco) e a foto some quando ela pinta.
// RODADA 3 (26/10, o menu do Cal AI): a página aberta EMPILHANDO (state.push = "ios", lib/navegacao-ios) entra
// deslizando da direita enquanto a foto da tela de antes recua pra esquerda; voltar (← ou o gesto da borda esquerda)
// faz a de cima sair pra direita e a de baixo voltar de -28 %. Só nas rotas que pedem; o resto segue como antes.

/** A borda esquerda (22 px) das páginas empilhadas: arrastar pra direita volta, acompanhando o dedo. Com "reduzir
 *  movimento" (varredura 26/10: a borda sumia junto com a animação) o GESTO continua — só não há o acompanhar nem a saída
 *  animada: soltar além de 100 px (ou rápido) volta na hora. */
const BordaDeVoltar = ({ x, onVoltar, semMovimento = false }: { x: MotionValue<number>; onVoltar: () => void; semMovimento?: boolean }) => {
  const g = useRef<{ x0: number; arrastando: boolean; xUlt: number; tUlt: number; vel: number } | null>(null);
  const soltar = (e: PointerEventReact<HTMLDivElement>) => {
    const s = g.current;
    g.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!s?.arrastando) return;
    const dx = semMovimento ? s.xUlt - s.x0 : x.get();
    if (semMovimento) { if (dx > 100 || (dx > 24 && s.vel > 0.5)) onVoltar(); return; }
    if (dx > 100 || (dx > 24 && s.vel > 0.5)) {
      const largura = typeof window !== "undefined" ? window.innerWidth : 400;
      animate(x, largura, { duration: 0.22, ease: "easeOut", onComplete: onVoltar });
    } else animate(x, 0, { type: "spring", stiffness: 520, damping: 42 });
  };
  return (
    <div
      data-testid="pt-borda-voltar" aria-hidden
      className="fixed left-0 bottom-0 w-[16px] z-[60]"
      // revisor b48: a faixa cobria o terço esquerdo do botão ← do cabeçalho — começa abaixo dele
      style={{ touchAction: "none", top: "calc(var(--app-safe-top, 0px) + 76px)" }}
      onPointerDown={(e) => { g.current = { x0: e.clientX, arrastando: false, xUlt: e.clientX, tUlt: e.timeStamp, vel: 0 }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ } }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s) return;
        const dx = e.clientX - s.x0;
        const dt = Math.max(1, e.timeStamp - s.tUlt);
        s.vel = (e.clientX - s.xUlt) / dt; s.xUlt = e.clientX; s.tUlt = e.timeStamp;
        if (!s.arrastando) { if (dx > 6) s.arrastando = true; else return; }
        if (!semMovimento) x.set(Math.max(0, dx));
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    />
  );
};

export const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const tipo = useNavigationType();
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const [modo] = useState<ModoDeEntrada>(() => modoDeEntrada(location.key, (location.state as EstadoPush | null)?.push === PUSH_IOS, tipo));
  const [comFoto] = useState(rotaComFoto);
  const x = useMotionValue(0);
  useLayoutEffect(() => { rotaMontou(modo ?? undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (modo && !semMovimento) {
    return (
      <motion.div
        data-transicao={modo}
        style={{ x }}
        initial={{ x: modo === "push" ? "100%" : "-28%", opacity: modo === "pop" ? 0.6 : 1 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "tween", duration: modo === "push" ? 0.34 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
        {modo === "push" && <BordaDeVoltar x={x} onVoltar={() => voltar(navigate, "/voce")} />}
      </motion.div>
    );
  }
  return (
    <motion.div
      data-transicao={modo ?? undefined}
      initial={comFoto ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
      {modo === "push" && <BordaDeVoltar x={x} semMovimento onVoltar={() => voltar(navigate, "/voce")} />}
    </motion.div>
  );
};

export const StaggerContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: 0.06 } },
    }}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 16, scale: 0.97 },
      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
    }}
  >
    {children}
  </motion.div>
);

export const FadeIn = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);
