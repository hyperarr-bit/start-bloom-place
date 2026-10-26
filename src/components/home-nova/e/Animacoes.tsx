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
  const semMovimento = useReducedMotion() || emTeste() || !useContext(ContextoDaEntrada);
  const [mostrado, setMostrado] = useState(semMovimento ? valor : 0);
  const anterior = useRef(semMovimento ? valor : 0);
  useEffect(() => {
    if (semMovimento) { setMostrado(valor); anterior.current = valor; return; }
    const de = anterior.current;
    const controle = animate(de, valor, {
      duration: Math.abs(valor - de) < 5 ? 0.3 : duracao,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setMostrado(Math.round(v)),
      onComplete: () => { anterior.current = valor; setMostrado(valor); },
    });
    return () => controle.stop();
  }, [valor, semMovimento, duracao]);
  return <span className={className} data-testid={testid} data-valor={valor}>{mostrado}</span>;
};

export const Entrada = ({ children, atraso = 0, className, testid }: { children: ReactNode; atraso?: number; className?: string; testid?: string }) => {
  const semMovimento = useReducedMotion() || emTeste() || !useContext(ContextoDaEntrada);
  if (semMovimento) return <div className={className} data-testid={testid}>{children}</div>;
  return (
    <motion.div
      className={className} data-testid={testid}
      initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1], delay: atraso }}
    >
      {children}
    </motion.div>
  );
};
