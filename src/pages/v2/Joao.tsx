// Mascote do funil v2: joão-de-barro. Ele "constrói a casa" enquanto a pessoa
// responde o quiz — a Casinha é a metáfora de progresso do funil inteiro.

export type JoaoMood = "neutro" | "feliz" | "festa";

const BARRO = "#B4652F";
const BARRO_ESCURO = "#96521F";
const BARRIGA = "#EFDCC3";
const TINTA = "#26201A";

export function Joao({ mood = "neutro", size = 120 }: { mood?: JoaoMood; size?: number }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 200 180" role="img" aria-label="João-de-barro, seu construtor">
      {/* rabinho empinado */}
      <rect x="148" y="58" width="46" height="22" rx="11" fill={BARRO_ESCURO} transform="rotate(-38 148 58)" />
      {/* corpo + cabeça (blob único) */}
      <ellipse cx="96" cy="108" rx="62" ry="54" fill={BARRO} />
      <circle cx="82" cy="58" r="38" fill={BARRO} />
      {/* barriga */}
      <ellipse cx="88" cy="124" rx="40" ry="34" fill={BARRIGA} />
      {/* asa */}
      <ellipse
        cx="128" cy="106" rx="26" ry="36" fill={BARRO_ESCURO}
        transform={mood === "festa" ? "rotate(-46 128 106)" : "rotate(-18 128 106)"}
      />
      {/* bico */}
      <polygon points="40,54 18,62 40,70" fill="#E8A13C" />
      {/* olho conforme o humor */}
      {mood === "neutro" && (
        <>
          <circle cx="70" cy="52" r="9" fill={TINTA} />
          <circle cx="73" cy="49" r="3" fill="#fff" />
        </>
      )}
      {(mood === "feliz" || mood === "festa") && (
        <path d="M61 54 Q70 44 79 54" stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      )}
      {/* bochecha */}
      <circle cx="60" cy="70" r="7" fill="#E4572E" opacity="0.28" />
      {/* perninhas */}
      <path d="M78 160 L78 172 M104 160 L104 172" stroke="#7A4A22" strokeWidth="5" strokeLinecap="round" />
      {/* festa: faíscas */}
      {mood === "festa" && (
        <g fill="#F2C14E">
          <circle cx="30" cy="24" r="4" />
          <circle cx="164" cy="20" r="5" />
          <circle cx="182" cy="86" r="4" />
        </g>
      )}
    </svg>
  );
}

/** Avatar redondo pro balão de chat. */
export function JoaoAvatar({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#F8EFD2" />
      <circle cx="54" cy="56" r="34" fill={BARRO} />
      <ellipse cx="50" cy="74" rx="22" ry="16" fill={BARRIGA} />
      <polygon points="18,50 4,56 18,62" fill="#E8A13C" />
      <circle cx="42" cy="46" r="7" fill={TINTA} />
      <circle cx="44.5" cy="43.5" r="2.4" fill="#fff" />
    </svg>
  );
}

/**
 * Casinha de barro em construção. stage 0..4:
 * 0 terreno · 1 base · 2 paredes · 3 cúpula fechada · 4 pronta (porta + broto)
 * O clipPath sobe conforme o stage — a casa literalmente cresce.
 */
export function Casinha({ stage, size = 64 }: { stage: number; size?: number }) {
  const s = Math.max(0, Math.min(4, stage));
  // altura revelada da cúpula por estágio (y do clip, de baixo pra cima)
  const clipY = [104, 78, 56, 22, 22][s];
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 140 115" role="img" aria-label={`Casinha do plano: etapa ${s} de 4`}>
      {/* terreno */}
      <ellipse cx="70" cy="106" rx="58" ry="8" fill="#D8CBB0" />
      {/* cúpula (revelada pelo clip) */}
      <defs>
        <clipPath id={`fv2-casa-clip-${s}`}>
          <rect x="0" y={clipY} width="140" height={115 - clipY} />
        </clipPath>
      </defs>
      <g clipPath={`url(#fv2-casa-clip-${s})`}>
        <path d="M18 104 C18 56 42 22 70 22 C98 22 122 56 122 104 Z" fill={BARRO} />
        <path d="M30 104 C30 64 48 34 70 34" stroke={BARRO_ESCURO} strokeWidth="4" fill="none" opacity="0.45" />
        <path d="M110 104 C110 68 96 40 78 30" stroke={BARRO_ESCURO} strokeWidth="4" fill="none" opacity="0.3" />
      </g>
      {/* porta + broto só na casa pronta */}
      {s >= 4 && (
        <>
          <path d="M55 104 L55 74 C55 63 85 63 85 74 L85 104 Z" fill={TINTA} />
          <path d="M70 20 C70 12 70 8 70 4 M70 12 C63 9 59 4 59 -2 C67 0 70 4 70 12 Z M70 14 C77 11 81 6 81 0 C73 2 70 6 70 14 Z" stroke="#2E9E52" strokeWidth="3.4" fill="#2E9E52" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** Ninho misterioso (passo da caixa-surpresa). */
export function Ninho({ size = 150, aberto = false }: { size?: number; aberto?: boolean }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 200 150" role="img" aria-label={aberto ? "Ninho aberto" : "Ninho misterioso"}>
      <ellipse cx="100" cy="132" rx="82" ry="12" fill="#D8CBB0" />
      <path d="M28 128 C28 92 58 66 100 66 C142 66 172 92 172 128 Z" fill={BARRO} />
      <path d="M40 126 C42 100 62 80 88 74 M160 126 C158 102 142 84 120 76" stroke={BARRO_ESCURO} strokeWidth="5" fill="none" opacity="0.4" strokeLinecap="round" />
      {aberto ? (
        <g>
          <circle cx="100" cy="52" r="26" fill={BARRO} />
          <polygon points="74,48 58,54 74,60" fill="#E8A13C" />
          <path d="M90 50 Q98 42 106 50" stroke={TINTA} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <text x="92" y="52" fontSize="34" fontWeight="800" fill={TINTA} fontFamily="'Bricolage Grotesque', sans-serif">?</text>
          {/* gravetos saindo do ninho */}
          <path d="M46 74 L30 58 M154 74 L172 60 M100 64 L100 44" stroke="#7A4A22" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
