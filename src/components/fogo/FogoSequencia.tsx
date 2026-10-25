import type { CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { Fogo } from "@/components/conquistas/Fogo";
import { fogoDoCaderno } from "@/components/conquistas/nova/fogo-caderno";
import "./fogo-sequencia.css";

/**
 * O FOGO UNIFICADO (26/10, dono: "igual à da sequência") — UM componente pra pílula da Home nova, a folha "Um dia de
 * cada vez" e o cartão da sequência das Conquistas do Codex. O DESENHO é o `Fogo` compartilhado (a chama com o miolo,
 * degradê suave) e as CORES são a paleta suave da chama do caderno (`fogoDoCaderno`: laranja · laranja vivo (3+) ·
 * amarelo dourado (7+) · petróleo (14+) · violeta (30+) · ouro (100+)). Nas Conquistas ele rende exatamente o que o
 * Codex entregou (a classe `cn-fogo`, a faísca ✦ do ouro, a animação de subida de faixa).
 *
 * Estados: `aceso` (hoje garantido) · `apagado` (sequência viva, hoje ainda não — a mesma chama, desbotada, parada) ·
 * `neutro` (0 dias — o cinza do caderno). Animação: a chama VIVA (tremulação lenta e sutil, 2,6 s, no corpo e na gota de
 * dentro) só no aceso; `acender` toca o pulso + brilho rápido uma vez (quem chama decide quando — a pílula, 1x por dia);
 * `prefers-reduced-motion` desliga tudo (fogo-sequencia.css + o gate daqui).
 */
export type EstadoDoFogo = "aceso" | "apagado" | "neutro";

/** neutro = sem sequência · apagado = sequência viva mas HOJE ainda não garantido · aceso = garantido hoje. */
export const estadoDoFogo = (s: { dias: number; hojeFeito: boolean }): EstadoDoFogo => (s.dias <= 0 ? "neutro" : s.hojeFeito ? "aceso" : "apagado");

interface Props {
  dias: number;
  /** sem `estado`: aceso com dias > 0, neutro com 0 */
  estado?: EstadoDoFogo;
  tamanho?: number;
  /** o brilho atrás (drop-shadow) — as Conquistas só usam no ouro */
  brilho?: boolean;
  /** a chama viva (tremulação); padrão ligada, e só vale no aceso */
  viva?: boolean;
  /** o pulso de acender (quem chama liga por ~0,7 s) */
  acender?: boolean;
  /** a subida de faixa do caderno (Conquistas) */
  subiu?: boolean;
  /** a faísca ✦ do ouro (Conquistas) */
  faisca?: boolean;
  className?: string;
  style?: CSSProperties;
  testid?: string;
}

export const FogoSequencia = ({ dias, estado, tamanho = 42, brilho = false, viva = true, acender = false, subiu = false, faisca = false, className, style, testid = "fg-seq" }: Props) => {
  const reduzir = useReducedMotion();
  const est: EstadoDoFogo = estado ?? (dias > 0 ? "aceso" : "neutro");
  const faixa = fogoDoCaderno(dias);
  const neutro = est === "neutro" || dias <= 0;
  return (
    <span
      className={`fg-seq${className ? ` ${className}` : ""}`}
      data-testid={testid}
      data-fogo={est}
      data-faixa={neutro ? "apagado" : faixa.id}
      data-viva={viva && est === "aceso" && !reduzir ? "" : undefined}
      data-acende={acender && !reduzir ? "" : undefined}
      data-subiu={subiu && !reduzir ? "" : undefined}
      data-ouro={dias >= 100 ? "" : undefined}
      style={{ "--fg-t": `${tamanho}px`, ...style } as CSSProperties}
      aria-hidden
    >
      <Fogo dias={neutro ? 0 : dias} faixa={neutro ? undefined : faixa} tamanho={tamanho} semBrilho={!brilho} />
      {faisca && <span className="cn-fogo-faisca">✦</span>}
    </span>
  );
};
