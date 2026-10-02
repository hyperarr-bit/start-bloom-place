import { useId, type CSSProperties } from "react";
import { faixaDoFogo, type Faixa } from "@/lib/fogo-sequencia";
import "./conquistas.css";

/**
 * O FOGO DA SEQUÊNCIA (02/10): a chama de sempre (a do card), agora com a
 * COR DA FAIXA — borda escura, corpo no tom do meio, miolo claro e um brilho
 * atrás. Mora na etiqueta da capa, no cabeçalho do card SEQUÊNCIA e na
 * linha da Home. `dias = 0` = apagado (cinza, sem brilho).
 *
 * É SVG com degradê (sai igual na foto do WebKit) e o brilho é um
 * drop-shadow no próprio SVG — nada de mix-blend-mode (iPhone engasga).
 */
export const CHAMA = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

interface Props {
  /** A faixa (ou os dias — a faixa sai da conta). */
  faixa?: Faixa;
  dias?: number;
  tamanho: number;
  /** Sem o brilho atrás (dentro de texto pequeno). */
  semBrilho?: boolean;
  /** Chama viva (balança de leve; só transform). */
  viva?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const Fogo = ({ faixa, dias, tamanho, semBrilho, viva, className, style }: Props) => {
  const uid = `fogo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const f = faixa ?? faixaDoFogo(dias ?? 0);
  const apagado = faixa === undefined && (dias ?? 0) <= 0;
  const brilho = !apagado && !semBrilho ? `drop-shadow(0 0 ${Math.max(2, tamanho / 7)}px ${f.brilho})` : undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      className={`fogo${viva && !apagado ? " fogo-viva" : ""}${f.id === "dourado" && !apagado ? " fogo-dourado" : ""}${className ? ` ${className}` : ""}`}
      data-fogo={apagado ? "apagado" : f.id}
      style={{ overflow: "visible", flexShrink: 0, filter: brilho, ...style }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={apagado ? "#b8b4ad" : f.meio} />
          <stop offset="1" stopColor={apagado ? "#8a867f" : f.escuro} />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={apagado ? "#e7e3dc" : f.claro} />
          <stop offset="1" stopColor={apagado ? "#b8b4ad" : f.meio} />
        </linearGradient>
      </defs>
      <path d={CHAMA} fill={`url(#${uid}-a)`} stroke={apagado ? "#8a867f" : f.escuro} strokeWidth="1" strokeLinejoin="round" />
      {/* a chama de dentro: a mesma forma, menor, presa na base */}
      <path d={CHAMA} fill={`url(#${uid}-b)`} transform="translate(12 21.5) scale(.52) translate(-12 -21.5)" />
    </svg>
  );
};
