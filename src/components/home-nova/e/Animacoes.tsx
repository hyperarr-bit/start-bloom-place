import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";

/**
 * AS ANIMAÇÕES DA HOME NOVA (rodada 2, 26/10 — "como no Cal AI, nada exagerado"):
 *  · NumeroQueConta — o número do score sobe contando até o valor (0,9 s, desacelerando), como o "2816" do Cal AI;
 *  · Entrada — o card entra com um deslize curto e um desvanecimento (0,35 s), escalonado pela posição.
 * Os anéis já enchem sozinhos (Anel.tsx), as folhas sobem em mola (framer) e os toques têm a leve escala (CSS).
 * `prefers-reduced-motion` desliga tudo (o valor aparece pronto, o card já no lugar); nos testes idem.
 */
const emTeste = (): boolean => { try { return import.meta.env.MODE === "test"; } catch { return false; } };

/* RODADA 3 (26/10): a entrada escalonada e a contagem do número tocam na 1ª montagem da Home por sessão; voltar
   pra Início pela barra (remontagem) mostra tudo já no lugar — nada "pisca" ao trocar de aba. */
let entradaJaTocou = false;
export const marcarEntradaDaHome = (): boolean => { const primeira = !entradaJaTocou; entradaJaTocou = true; return primeira; };
/** só pros testes */
export const _zerarEntradaDaHome = (): void => { entradaJaTocou = false; };
/** A Home provê `false` nas montagens seguintes: Entrada e NumeroQueConta mostram tudo pronto. */
export const ContextoDaEntrada = createContext(true);

export const NumeroQueConta = ({ valor, className, testid, duracao = 0.9 }: { valor: number; className?: string; testid?: string; duracao?: number }) => {
  const reduzido = useReducedMotion(); const entrada = useContext(ContextoDaEntrada); // hooks sempre na mesma ordem
  const semMovimento = reduzido || emTeste() || !entrada;
  const [mostrado, setMostrado] = useState(semMovimento ? valor : 0);
  const anterior = useRef(semMovimento ? valor : 0);
  useEffect(() => {
    if (semMovimento) { setMostrado(valor); anterior.current = valor; return; }
    const de = anterior.current;
    /* 26/10 (dono no vídeo da welcome: "fica 41 e depois vai pra 42 com um glitch"): o expo-out espremia um salto
       pequeno (37 → 42, o 1º registro do dia) no começo da curva — 38-39-40-41 em 0,16 s, o 41 parado e o 42 aos
       0,3 s, e o resto da animação sem mexer em nada. Salto de até 10 conta com passo quase uniforme (quadrática,
       freia de leve no fim); a contagem grande da abertura (0 → 37) segue no expo-out. */
    const salto = Math.abs(valor - de);
    const controle = animate(de, valor, {
      duration: salto < 5 ? 0.45 : duracao,
      ease: salto <= 10 ? (t: number) => 1 - (1 - t) * (1 - t) : [0.16, 1, 0.3, 1],
      onUpdate: (v) => setMostrado(Math.round(v)),
      onComplete: () => { anterior.current = valor; setMostrado(valor); },
    });
    return () => controle.stop();
  }, [valor, semMovimento, duracao]);
  return <span className={className} data-testid={testid} data-valor={valor}>{mostrado}</span>;
};

/**
 * RODADA 4 (vídeo do dono na b48: "a animação de subida PULA — o score aparece sozinho e os cards entram um a um"):
 * a Entrada não desloca nem escalona mais NADA. Cada card já nasce no lugar, com o espaço reservado; o que dá vida é o
 * número contando e os anéis enchendo. `Entrada` virou um invólucro parado (fica pelos pontos de uso); o conjunto
 * inteiro ganha UM fade suave (FadeDoConjunto, opacity 0→1 em 200 ms, sem transform) na 1ª montagem da sessão.
 */
export const Entrada = ({ children, className, testid }: { children: ReactNode; atraso?: number; className?: string; testid?: string }) => (
  <div className={className} data-testid={testid}>{children}</div>
);

export const FadeDoConjunto = ({ children, className, testid }: { children: ReactNode; className?: string; testid?: string }) => {
  const reduzido = useReducedMotion(); const entrada = useContext(ContextoDaEntrada);
  const semMovimento = reduzido || emTeste() || !entrada;
  if (semMovimento) return <div className={className} data-testid={testid}>{children}</div>;
  return (
    <motion.div className={className} data-testid={testid} data-fade-conjunto="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
};
