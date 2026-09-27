import { useId } from "react";
import { TextoEmAnel } from "./TextoEmAnel";

/**
 * ROSETA (C3, aprovada 26/09) — o adesivo dos marcos de sequência (7, 30 e 100
 * dias): disco dourado dentado, fitas magenta, o número no miolo e o anel com
 * nível e "membro desde". Recortada como adesivo (borda branca + sombra) pra
 * funcionar também no PNG de fundo transparente, colado em cima da foto.
 */

const ESTRELA = "0,-7 2.1,-2.2 7.1,-2.2 3,1 4.4,6 0,3.2 -4.4,6 -3,1 -7.1,-2.2 -2.1,-2.2";
const FITA = "M0,0 H46 V118 L23,102 L0,118 Z";
const SOMBRA_FITA = "M0,0 H8 V118 L0,112 Z";

interface Props {
  dias: number;
  nivel: string;
  /** "julho de 2026" */
  membroDesde: string;
  /** Largura em px (a altura segue a proporção 220×270). */
  largura: number;
  className?: string;
}

export const Roseta = ({ dias, nivel, membroDesde, largura, className }: Props) => {
  const uid = `ros${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const numero = String(dias);
  const tamNumero = numero.length >= 3 ? 40 : 46;
  return (
    <svg
      viewBox="0 0 220 270"
      width={largura}
      height={(largura * 270) / 220}
      style={{ overflow: "visible", display: "block" }}
      className={className}
      role="img"
      aria-label={`${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}`}
    >
      <defs>
        <filter id={`${uid}-dc`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="dil" />
          <feFlood floodColor="#ffffff" result="w" />
          <feComposite in="w" in2="dil" operator="in" result="borda" />
          <feGaussianBlur in="dil" stdDeviation="2.5" result="bl" />
          <feOffset in="bl" dx="0" dy="3" result="off" />
          <feFlood floodColor="#000" floodOpacity=".28" result="sc" />
          <feComposite in="sc" in2="off" operator="in" result="sombra" />
          <feMerge>
            <feMergeNode in="sombra" />
            <feMergeNode in="borda" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${uid}-d`} cx=".38" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset=".55" stopColor="#e5b53a" />
          <stop offset="1" stopColor="#b8860b" />
        </radialGradient>
        <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b3236c" />
          <stop offset=".5" stopColor="#e0438f" />
          <stop offset="1" stopColor="#b3236c" />
        </linearGradient>
      </defs>
      <g filter={`url(#${uid}-dc)`}>
        <g fill={`url(#${uid}-f)`}>
          <path d={FITA} transform="translate(64,128) rotate(16 23 0)" />
          <path d={FITA} transform="translate(110,128) rotate(-16 23 0)" />
        </g>
        <g fill="rgba(0,0,0,.18)">
          <path d={SOMBRA_FITA} transform="translate(64,128) rotate(16 23 0)" />
          <path d={SOMBRA_FITA} transform="translate(148,128) rotate(-16 23 0)" />
        </g>
        <g fill="#d9a72a">
          {Array.from({ length: 20 }, (_, i) => {
            const a = (i / 20) * Math.PI * 2;
            return <circle key={i} cx={(110 + Math.cos(a) * 82).toFixed(1)} cy={(110 + Math.sin(a) * 82).toFixed(1)} r="13" />;
          })}
        </g>
        <circle cx="110" cy="110" r="84" fill={`url(#${uid}-d)`} />
        <circle cx="110" cy="110" r="84" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="57" fill="#fff8e7" />
        <circle cx="110" cy="110" r="57" fill="none" stroke="#b8860b" strokeWidth="1.2" />
        <circle cx="110" cy="110" r="74" fill="none" stroke="rgba(120,80,10,.28)" strokeWidth="1" />
        <TextoEmAnel
          cx={110}
          cy={110}
          r={66}
          texto={`NÍVEL ${nivel.toUpperCase()} · MEMBRO DESDE ${membroDesde.toUpperCase()} · CORE · `}
          fontSize={10}
          fill="#6f4c07"
        />
        <text x="110" y="120" textAnchor="middle" fontFamily="Inter, -apple-system, sans-serif" fontSize={tamNumero} fontWeight={900} letterSpacing="-2" fill="#2b2b2f" style={{ fontVariantNumeric: "tabular-nums" }}>
          {numero}
        </text>
        <text x="110" y="140" textAnchor="middle" fontFamily="Inter, -apple-system, sans-serif" fontSize="9.5" fontWeight={800} letterSpacing="2" fill="#6f4c07">
          {dias === 1 ? "DIA SEGUIDO" : "DIAS SEGUIDOS"}
        </text>
        <polygon transform="translate(110,74) scale(.9)" points={ESTRELA} fill="#b8860b" />
      </g>
    </svg>
  );
};
