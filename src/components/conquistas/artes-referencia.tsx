import type { ReactNode } from "react";

/** Artes vetoriais desenhadas a partir da referência fornecida pelo dono.
 * Contorno arredondado, cores vivas e recorte branco aplicado pelo Adesivo. */
const FOGO = "M49 8C31 24 28 44 35 51C27 48 24 42 23 35C12 51 12 68 23 78C35 92 66 92 78 76C90 59 79 40 73 35C74 47 70 49 67 52C67 32 48 25 49 8Z";
const Miolo = () => <><path d="M49 39C48 53 61 55 61 64C67 63 68 58 68 55C76 70 65 83 50 83C36 83 27 72 32 62C33 59 36 56 37 53C36 62 43 65 46 65C44 58 47 44 49 39Z" fill="#ffdf55" stroke="none"/><path d="M50 62C48 68 57 70 56 76C55 83 43 82 43 75C43 71 46 68 46 67C46 72 50 72 50 62Z" fill="#fff1a7" stroke="none"/></>;

export const ChamaReferencia = ({ tamanho, apagada = false }: { tamanho: number; apagada?: boolean }) => <svg width={tamanho} height={tamanho * 1.18} viewBox="0 0 100 100" aria-hidden data-fogo={apagada ? "apagado" : "coral"} style={{flexShrink:0, filter: apagada ? "grayscale(1)" : "drop-shadow(0 2px 2px #d9453d22)"}}>
  <path d={FOGO} fill="#ff9854" stroke="#ee615c" strokeWidth="4" strokeLinejoin="round"/><Miolo/>
</svg>;

export function arteReferencia(id: string): ReactNode | null {
  const marco = /^sequencia-(2|3|7|14|30|100)$/.exec(id)?.[1];
  if (marco) return <g stroke="#36343d" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round">
    <g transform="translate(4 -1) scale(.92)"><path d={FOGO} fill="#ffa354"/><path d="M44 21Q35 36 38 44" fill="none" stroke="#ffcb7e" strokeWidth="3"/><Miolo/></g>
    <rect x="9" y="70" width="82" height="24" rx="7" fill="#d52382" stroke="#fff" strokeWidth="4"/>
    <path d="M18 74H80" stroke="#f47fbb" strokeWidth="1.5" opacity=".6"/>
    <text x="50" y="86" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize={marco.length === 3 ? 11 : 12} fill="white" stroke="none">{marco === "2" ? "DIA 2" : `${marco} DIAS`}</text>
  </g>;
  if (id === "saver-20") return <g stroke="#38343e" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round">
    <path d="M77 48C87 39 92 48 87 53C83 58 80 53 83 50" fill="none"/>
    <path d="M26 37L22 22Q35 22 39 32C53 24 74 34 78 51C82 63 77 76 69 80V90H59V84Q48 87 39 82L37 91H27L26 80C15 75 12 67 17 54Q19 44 26 37Z" fill="#f7a6b0"/>
    <path d="M27 27L30 38L35 32Z" fill="#ed7e94" strokeWidth="1.4"/>
    <path d="M60 35Q74 40 75 53" fill="none" stroke="#ffd0d1" strokeWidth="4"/>
    <rect x="9" y="54" width="18" height="17" rx="6" fill="#f6b4bd"/>
    <path d="M15 59V64M21 59V64M30 51V55" strokeWidth="2.5"/>
    <ellipse cx="43" cy="48" rx="3.2" ry="5" fill="#ffc9cc" transform="rotate(-20 43 48)" strokeWidth="1.8"/>
    <path d="M44 29Q50 26 58 29" fill="none"/>
    <circle cx="51" cy="20" r="13" fill="#f3c854"/><circle cx="51" cy="20" r="9" fill="#ffe480" stroke="#d9a132" strokeWidth="1.5"/>
    <text x="51" y="26" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="17" fontWeight="800" fill="#c89628" stroke="none">$</text>
  </g>;
  if (id === "leitura-1") return <g stroke="#594187" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round">
    <path d="M11 20Q32 14 50 24Q70 13 88 18L92 81Q71 76 51 87Q31 78 8 83Z" fill="#b797e8"/>
    <path d="M17 16Q32 12 50 23Q66 12 83 16L86 75Q68 72 51 82Q34 73 13 77Z" fill="#e8d9fb"/>
    <path d="M50 24L51 81M20 29Q32 28 43 34M20 39Q31 38 43 43M19 50Q31 48 43 54M18 60Q31 58 43 64M58 33Q67 27 77 28M58 43Q68 37 78 39M59 54Q69 48 79 50M59 64Q70 58 80 60" fill="none" strokeWidth="2.5"/>
    <path d="M51 82V87" strokeWidth="3.5"/>
  </g>;
  if (id === "rotina-21") return <g stroke="#383c38" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round">
    <path d="M44 52H56L61 88L47 90Z" fill="#c9954d"/>
    <path d="M24 61C11 59 10 44 21 40C12 28 25 17 34 21C37 9 51 8 58 18C72 11 83 23 77 33C91 41 85 56 75 58C76 71 61 74 55 65C43 78 27 72 29 62Z" fill="#50c47b"/>
    <path d="M27 34Q23 27 33 27M42 22Q47 17 52 23" fill="none" stroke="#a7e6ac" strokeWidth="4"/>
    <circle cx="37" cy="49" r="3.5" fill="#e96e80" stroke="none"/><circle cx="63" cy="34" r="3.5" fill="#e96e80" stroke="none"/><circle cx="67" cy="53" r="3.5" fill="#e96e80" stroke="none"/>
  </g>;
  return null;
}
