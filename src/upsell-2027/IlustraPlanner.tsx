import { useId } from "react";

/** O planner 2027 "sticker" (contorno de tinta + gradiente + argolas + fita), a mesma régua do presente — magenta do CORE. */
export function IlustraPlanner({ size = 140 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const capa = `u27c${id}`, fita = `u27f${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden="true" data-testid="u2027-ilustra">
      <defs>
        <linearGradient id={capa} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f45ba3" /><stop offset="1" stopColor="#d6338a" /></linearGradient>
        <linearGradient id={fita} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffdf85" /><stop offset="1" stopColor="#ffc63d" /></linearGradient>
      </defs>
      <ellipse cx="82" cy="148" rx="46" ry="6" fill="rgba(22,18,28,.12)" />
      <path d="M108 128v20l7-6 7 6v-20z" fill={`url(#${fita})`} stroke="#16121c" strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="38" y="30" width="92" height="106" rx="12" fill="#fff" stroke="#16121c" strokeWidth="4" />
      <rect x="32" y="26" width="92" height="106" rx="12" fill={`url(#${capa})`} stroke="#16121c" strokeWidth="4" />
      <rect x="38" y="36" width="7" height="86" rx="3.5" fill="#fff" opacity=".3" />
      <g stroke="#16121c" strokeWidth="3" fill="#fff">
        <rect x="44" y="17" width="8" height="18" rx="4" /><rect x="62" y="17" width="8" height="18" rx="4" />
        <rect x="80" y="17" width="8" height="18" rx="4" /><rect x="98" y="17" width="8" height="18" rx="4" />
      </g>
      <rect x="48" y="52" width="62" height="38" rx="9" fill="#fff" stroke="#16121c" strokeWidth="3.5" />
      <text x="79" y="79" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="22" fontWeight="900" letterSpacing="-1" fill="#16121c">2027</text>
      <rect x="50" y="100" width="40" height="5" rx="2.5" fill="#fff" opacity=".55" />
      <rect x="50" y="110" width="28" height="5" rx="2.5" fill="#fff" opacity=".4" />
      <circle cx="112" cy="110" r="11" fill="#fff" stroke="#16121c" strokeWidth="3.2" />
      <path d="M107 110.5l3.4 3.4 6.4-7" stroke="#16a34a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd25e" stroke="#16121c" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M142 30l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z" fill="#fff" stroke="#16121c" strokeWidth="2.3" strokeLinejoin="round" />
      <circle cx="146" cy="78" r="3.5" fill="#d6338a" />
      <circle cx="16" cy="96" r="3" fill="#7fb7e8" />
    </svg>
  );
}

export function Confete2027() {
  const cores = ["#d6338a", "#ffd25e", "#7fb7e8", "#16a34a", "#ff86bd"];
  return (
    <div className="u27-confete" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cores[i % 5], animationDelay: `${(i % 7) * 0.12}s` }} />
      ))}
    </div>
  );
}
