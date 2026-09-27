import { useId } from "react";
import { Insignia } from "./Insignia";
import type { Insignia as DadosInsignia } from "./insignias";

/**
 * FAIXA DE ESCOTEIRO (27/09): feltro magenta com pespontos, atravessada pelas
 * insígnias bordadas. É a composição da arte dos Stories "Minha vida, com
 * insígnias" (B2 do protótipo). O tecido é SVG (polígono + linhas
 * tracejadas), não clip-path: a foto do html-to-image no WebKit não garante
 * clip-path, e um retângulo reto no lugar do trapézio estragaria a arte.
 */
interface Props {
  comprimento: number;
  largura: number;
  patches: DadosInsignia[];
  tamPatch: number;
  passo: number;
  inicio: number;
  /** Contragiro dos patches (a faixa gira, as insígnias ficam em pé). */
  giroPatch?: number;
  cor1?: string;
  cor2?: string;
}

export const Faixa = ({ comprimento, largura, patches, tamPatch, passo, inicio, giroPatch = 0, cor1 = "#b3236c", cor2 = "#8e1a55" }: Props) => {
  const uid = `fx${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const recuo = largura * 0.18;
  return (
    <div style={{ position: "relative", width: comprimento, height: largura }} data-faixa="">
      <svg viewBox={`0 0 ${comprimento} ${largura}`} width={comprimento} height={largura} style={{ position: "absolute", inset: 0, overflow: "visible", display: "block" }} aria-hidden>
        <defs>
          <linearGradient id={`${uid}-t`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cor1} />
            <stop offset="1" stopColor={cor2} />
          </linearGradient>
          <filter id={`${uid}-s`} x="-10%" y="-40%" width="120%" height="200%">
            <feDropShadow dx="0" dy={largura * 0.13} stdDeviation={largura * 0.12} floodColor="#000" floodOpacity=".45" />
          </filter>
        </defs>
        <g filter={`url(#${uid}-s)`}>
          <polygon points={`0,0 ${comprimento},0 ${comprimento - recuo},${largura} ${recuo},${largura}`} fill={`url(#${uid}-t)`} />
        </g>
        {/* brilho em cima, sombra embaixo (o "inset" do feltro) */}
        <polygon points={`0,0 ${comprimento},0 ${comprimento - recuo * 0.03},3 ${recuo * 0.03},3`} fill="rgba(255,255,255,.16)" />
        <polygon points={`${recuo + 1},${largura - 3} ${comprimento - recuo - 1},${largura - 3} ${comprimento - recuo},${largura} ${recuo},${largura}`} fill="rgba(0,0,0,.28)" />
        {/* pespontos */}
        <line x1={largura * 0.2} y1={7} x2={comprimento - largura * 0.2} y2={7} stroke="rgba(255,255,255,.45)" strokeWidth="1.5" strokeDasharray="6 4" />
        <line x1={largura * 0.2} y1={largura - 7} x2={comprimento - largura * 0.2} y2={largura - 7} stroke="rgba(255,255,255,.45)" strokeWidth="1.5" strokeDasharray="6 4" />
      </svg>
      {patches.map((p, i) => (
        <span key={p.id} style={{ position: "absolute", left: inicio + i * passo, top: (largura - tamPatch) / 2, transform: giroPatch ? `rotate(${giroPatch}deg)` : undefined, lineHeight: 0 }}>
          <Insignia ins={p} tamanho={tamPatch} />
        </span>
      ))}
    </div>
  );
};
