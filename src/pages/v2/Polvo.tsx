// Mascote do funil v2: o polvo — um braço pra cada área da vida.
// Humores: neutro · serio (T2 "não controlo") · feliz · arregalado (T6, o
// número doendo) · festa (pacto fechado / plano pronto).

export type PolvoMood = "neutro" | "serio" | "feliz" | "arregalado" | "festa";

const ROSA = "#EC5FA2";
const ROSA_ESCURO = "#D84A8F";
const TINTA = "#33202B";

export function Polvo({ mood = "neutro", size = 150 }: { mood?: PolvoMood; size?: number }) {
  const olhoEsq = { cx: 96, cy: 78 };
  const olhoDir = { cx: 148, cy: 78 };
  const pupila = mood === "arregalado" ? 8.5 : 6;
  const branco = mood === "arregalado" ? 17 : 14;

  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 240 206" role="img" aria-label="Polvo do CORE">
      {/* tentáculos: 6 curvas de traço grosso, pontas viradas pra fora */}
      <g stroke={ROSA} strokeWidth="17" strokeLinecap="round" fill="none">
        <path d="M78 138 C60 168 40 172 24 160" />
        <path d="M96 146 C88 176 72 190 56 190" />
        <path d="M116 150 C114 180 106 194 94 198" />
        <path d="M136 150 C140 180 150 194 162 196" />
        <path d="M156 146 C166 174 182 186 198 184" />
        <path d="M172 136 C190 162 208 166 222 152" />
      </g>
      {/* pontas mais escuras (profundidade) */}
      <g stroke={ROSA_ESCURO} strokeWidth="17" strokeLinecap="round" fill="none" opacity="0.55">
        <path d="M32 164 L24 160" />
        <path d="M62 190 L56 190" />
        <path d="M99 197 L94 198" />
        <path d="M157 195 L162 196" />
        <path d="M192 185 L198 184" />
        <path d="M215 157 L222 152" />
      </g>
      {/* cabeça */}
      <ellipse cx="121" cy="88" rx="66" ry="62" fill={ROSA} />
      {/* olhos */}
      <circle {...olhoEsq} r={branco} fill="#fff" />
      <circle {...olhoDir} r={branco} fill="#fff" />
      {mood === "serio" ? (
        <>
          {/* pálpebras caídas + pupila baixa */}
          <circle cx={olhoEsq.cx} cy={olhoEsq.cy + 3} r={pupila} fill={TINTA} />
          <circle cx={olhoDir.cx} cy={olhoDir.cy + 3} r={pupila} fill={TINTA} />
          <path d={`M${olhoEsq.cx - 14} ${olhoEsq.cy - 8} h28`} stroke={ROSA} strokeWidth="10" strokeLinecap="round" />
          <path d={`M${olhoDir.cx - 14} ${olhoDir.cy - 8} h28`} stroke={ROSA} strokeWidth="10" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={olhoEsq.cx + 2} cy={olhoEsq.cy} r={pupila} fill={TINTA} />
          <circle cx={olhoDir.cx + 2} cy={olhoDir.cy} r={pupila} fill={TINTA} />
          <circle cx={olhoEsq.cx + 4.5} cy={olhoEsq.cy - 3} r={2.2} fill="#fff" />
          <circle cx={olhoDir.cx + 4.5} cy={olhoDir.cy - 3} r={2.2} fill="#fff" />
        </>
      )}
      {/* bochechas */}
      <circle cx="78" cy="100" r="8" fill="#F9A8CB" />
      <circle cx="164" cy="100" r="8" fill="#F9A8CB" />
      {/* boca por humor */}
      {mood === "arregalado" ? (
        <ellipse cx="121" cy="116" rx="8" ry="10" fill={TINTA} />
      ) : mood === "serio" ? (
        <path d="M110 118 h22" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
      ) : mood === "festa" ? (
        <path d="M104 112 C112 126 130 126 138 112 Z" fill={TINTA} />
      ) : (
        <path d="M108 114 C114 122 128 122 134 114" stroke={TINTA} strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
      {/* festa: faíscas */}
      {mood === "festa" && (
        <g fill="#F5C048">
          <circle cx="40" cy="30" r="5" />
          <circle cx="196" cy="24" r="6" />
          <circle cx="222" cy="92" r="4" />
          <circle cx="20" cy="96" r="4" />
        </g>
      )}
      {/* feliz: olhos de arco */}
      {mood === "feliz" && (
        <>
          <circle {...olhoEsq} r={branco} fill={ROSA} />
          <circle {...olhoDir} r={branco} fill={ROSA} />
          <path d={`M${olhoEsq.cx - 10} ${olhoEsq.cy + 3} Q${olhoEsq.cx} ${olhoEsq.cy - 9} ${olhoEsq.cx + 10} ${olhoEsq.cy + 3}`} stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
          <path d={`M${olhoDir.cx - 10} ${olhoDir.cy + 3} Q${olhoDir.cx} ${olhoDir.cy - 9} ${olhoDir.cx + 10} ${olhoDir.cy + 3}`} stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** Avatar redondo pro cabeçalho/balões. */
export function PolvoAvatar({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#FBE3EA" />
      <ellipse cx="50" cy="48" rx="32" ry="30" fill={ROSA} />
      <g stroke={ROSA} strokeWidth="9" strokeLinecap="round" fill="none">
        <path d="M30 72 C26 82 18 86 12 82" />
        <path d="M50 76 C50 86 46 92 40 94" />
        <path d="M70 72 C74 82 82 86 88 82" />
      </g>
      <circle cx="40" cy="44" r="7.5" fill="#fff" />
      <circle cx="61" cy="44" r="7.5" fill="#fff" />
      <circle cx="41.5" cy="44" r="3.4" fill={TINTA} />
      <circle cx="62.5" cy="44" r="3.4" fill={TINTA} />
      <path d="M44 58 C47 62 54 62 57 58" stroke={TINTA} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
