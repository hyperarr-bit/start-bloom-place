// Kit de props do funil v2 — doodles sticker-style (contorno de tinta) pra
// montar cenas, como o lixo espalhado do BitePal. Cada um ~28-40px.

const TINTA = "#2E1B29";

export function Moeda({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="#FFC94D" stroke={TINTA} strokeWidth="3.5" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#E8A13C" strokeWidth="2.5" />
      <text x="20" y="26" textAnchor="middle" fontSize="15" fontWeight="800" fill={TINTA} fontFamily="system-ui">$</text>
    </svg>
  );
}

export function Recibo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true">
      <path d="M6 4 L34 4 L34 40 L29 36 L24 40 L19 36 L14 40 L9 36 L6 40 Z" fill="#fff" stroke={TINTA} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 13 h16 M12 20 h16 M12 27 h9" stroke="#B9AFC4" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Cedula({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 48 28" aria-hidden="true">
      <rect x="3" y="3" width="42" height="22" rx="5" fill="#7ED9A2" stroke={TINTA} strokeWidth="3" />
      <circle cx="24" cy="14" r="6.5" fill="#A9E8C3" stroke={TINTA} strokeWidth="2.5" />
    </svg>
  );
}

export function Lupa({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="17" cy="17" r="10" fill="#CDE7F8" stroke={TINTA} strokeWidth="3.5" />
      <path d="M25 25 L34 34" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
