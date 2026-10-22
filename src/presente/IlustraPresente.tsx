import { useId } from "react";

/** O presente "sticker" (contorno de tinta + gradiente + brilho), na régua do funil V2 — magenta do CORE, fita amarela. */
export function IlustraPresente({ size = 160 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const c = `pvc${id}`, t = `pvt${id}`, f = `pvf${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden="true" data-testid="presente-ilustra">
      <defs>
        <linearGradient id={c} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f45ba3" /><stop offset="1" stopColor="#d6338a" /></linearGradient>
        <linearGradient id={t} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff86bd" /><stop offset="1" stopColor="#e7449a" /></linearGradient>
        <linearGradient id={f} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffdf85" /><stop offset="1" stopColor="#ffc63d" /></linearGradient>
      </defs>
      <ellipse cx="80" cy="146" rx="46" ry="6" fill="rgba(22,18,28,.12)" />
      <rect x="30" y="70" width="100" height="70" rx="11" fill={`url(#${c})`} stroke="#16121c" strokeWidth="4" />
      <rect x="70" y="72" width="20" height="66" fill={`url(#${f})`} />
      <path d="M70 72v66M90 72v66" stroke="#16121c" strokeWidth="3.5" />
      <rect x="21" y="52" width="118" height="24" rx="9" fill={`url(#${t})`} stroke="#16121c" strokeWidth="4" />
      <rect x="69" y="52" width="22" height="24" fill={`url(#${f})`} stroke="#16121c" strokeWidth="3.5" />
      <path d="M80 52C66 26 40 30 48 46c4 8 20 8 32 6z" fill={`url(#${f})`} stroke="#16121c" strokeWidth="4" strokeLinejoin="round" />
      <path d="M80 52c14-26 40-22 32-6-4 8-20 8-32 6z" fill={`url(#${f})`} stroke="#16121c" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="80" cy="51" r="8" fill="#ffc63d" stroke="#16121c" strokeWidth="4" />
      <rect x="38" y="82" width="7" height="42" rx="3.5" fill="#fff" opacity=".38" />
      <rect x="29" y="57" width="26" height="5" rx="2.5" fill="#fff" opacity=".5" />
      <path d="M55 40c-2-5 3-8 6-4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".7" />
      <path d="M116 100c0-6 7-8 9-3 2-5 9-3 9 3 0 7-9 12-9 12s-9-5-9-12z" fill="#fff" stroke="#16121c" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M121 102c0-2 1-3 3-3" stroke="#d6338a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M22 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd25e" stroke="#16121c" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M140 20l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z" fill="#fff" stroke="#16121c" strokeWidth="2.3" strokeLinejoin="round" />
      <circle cx="147" cy="62" r="3.5" fill="#d6338a" />
      <circle cx="13" cy="74" r="3" fill="#7fb7e8" />
    </svg>
  );
}

/** Ícone do WhatsApp (traço branco). */
export function IconeZap({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2z" />
    </svg>
  );
}

/** Confete leve (só CSS; some com prefers-reduced-motion). */
export function ConfetePresente() {
  const cores = ["#d6338a", "#ffd25e", "#7fb7e8", "#16a34a", "#ff86bd"];
  return (
    <div className="pv-confete" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cores[i % 5], animationDelay: `${(i % 7) * 0.12}s` }} />
      ))}
    </div>
  );
}
