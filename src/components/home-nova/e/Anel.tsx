import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * O ANEL (opção E, 25/10) — o mesmo desenho do anel do score de hoje (DayScoreRing), agora em qualquer
 * tamanho: o do card principal (108) e os dos cards pequenos (62). Trilho discreto, traço redondo na
 * cor pedida, enche em 1 s (ou na hora, com "reduzir movimento"). O que vai no meio é dos filhos.
 * Em 0 o traço nem é desenhado: com a ponta redonda, um traço "vazio" deixava um pontinho no topo.
 */
interface Props {
  tamanho: number;
  espessura: number;
  valor: number;
  max: number;
  cor: string;
  atraso?: number;
  children?: ReactNode;
  className?: string;
  testid?: string;
}

export const Anel = ({ tamanho, espessura, valor, max, cor, atraso = 0.2, children, className, testid }: Props) => {
  const semMovimento = useReducedMotion();
  const r = (tamanho - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const fracao = max > 0 ? Math.max(0, Math.min(1, valor / max)) : 0;
  return (
    <div className={`relative shrink-0 ${className ?? ""}`} style={{ width: tamanho, height: tamanho }} data-testid={testid} data-fracao={fracao.toFixed(2)}>
      <svg className="w-full h-full -rotate-90 block" viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="var(--he-trilho, hsl(var(--muted)))" strokeWidth={espessura} />
        {fracao > 0 && (
          <motion.circle
            cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - fracao * circ }}
            transition={{ duration: semMovimento ? 0 : 1, ease: "easeOut", delay: atraso }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
};
