/**
 * Medalhão de conquista — a "moeda" visual da gamificação.
 * Raridade deriva do XP (50 comum · 100 rara · 200 épica) e define o metal:
 * aço, ouro, ou o gradiente magenta da marca com glow. Desenhado em SVG puro
 * pra escalar nítido em qualquer tamanho (grid, sheet de detalhe e canvas de
 * compartilhamento reproduzem o mesmo desenho).
 */

export type BadgeTier = "comum" | "rara" | "epica";

export const tierOf = (xp: number): BadgeTier =>
  xp >= 200 ? "epica" : xp >= 100 ? "rara" : "comum";

export const TIER_META: Record<BadgeTier, {
  label: string;
  ring: [string, string, string];
  disc: [string, string];
  glow: string;
  text: string;
}> = {
  comum: {
    label: "Comum",
    ring: ["#cbd5e1", "#f1f5f9", "#64748b"],
    disc: ["#f8fafc", "#cbd5e1"],
    glow: "none",
    text: "text-slate-400",
  },
  rara: {
    label: "Rara",
    ring: ["#fbbf24", "#fef3c7", "#b45309"],
    disc: ["#fffbeb", "#fcd34d"],
    glow: "drop-shadow(0 4px 14px rgba(245,158,11,0.45))",
    text: "text-amber-500",
  },
  epica: {
    label: "Épica",
    ring: ["#f0abfc", "#D22D80", "#7c3aed"],
    disc: ["#fdf4ff", "#f5d0fe"],
    glow: "drop-shadow(0 4px 18px rgba(210,45,128,0.55))",
    text: "text-fuchsia-500",
  },
};

interface Props {
  emoji: string;
  xp: number;
  unlocked: boolean;
  size?: number;
  className?: string;
}

export const BadgeMedallion = ({ emoji, xp, unlocked, size = 64, className = "" }: Props) => {
  const tier = tierOf(xp);
  const meta = TIER_META[tier];
  const uid = `${tier}-${unlocked ? "u" : "l"}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={{ filter: unlocked ? meta.glow : "none" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={unlocked ? meta.ring[0] : "#d6d3d1"} />
          <stop offset="50%" stopColor={unlocked ? meta.ring[1] : "#a8a29e"} />
          <stop offset="100%" stopColor={unlocked ? meta.ring[2] : "#78716c"} />
        </linearGradient>
        <radialGradient id={`disc-${uid}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor={unlocked ? meta.disc[0] : "#e7e5e4"} />
          <stop offset="100%" stopColor={unlocked ? meta.disc[1] : "#a8a29e"} />
        </radialGradient>
      </defs>

      {/* recorte serrilhado do medalhão */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={60 + Math.cos(a) * 52}
            cy={60 + Math.sin(a) * 52}
            r="4.5"
            fill={`url(#ring-${uid})`}
            opacity={unlocked ? 1 : 0.55}
          />
        );
      })}

      {/* anel externo + disco */}
      <circle cx="60" cy="60" r="52" fill={`url(#ring-${uid})`} opacity={unlocked ? 1 : 0.55} />
      <circle cx="60" cy="60" r="44" fill={`url(#disc-${uid})`} />
      <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />

      {/* brilho superior */}
      <ellipse cx="47" cy="41" rx="26" ry="16" fill="white" opacity={unlocked ? 0.35 : 0.15} />

      {/* conteúdo */}
      {unlocked ? (
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="42">
          {emoji}
        </text>
      ) : (
        <g transform="translate(60 62)" opacity="0.6">
          <rect x="-11" y="-4" width="22" height="17" rx="3.5" fill="#57534e" />
          <path d="M -6.5 -4 v -5 a 6.5 6.5 0 0 1 13 0 v 5" fill="none" stroke="#57534e" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="0" cy="4" r="2.6" fill="#d6d3d1" />
        </g>
      )}
    </svg>
  );
};
