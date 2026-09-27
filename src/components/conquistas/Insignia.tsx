import { useEffect, useId, useRef, type CSSProperties } from "react";
import { animate } from "framer-motion";
import { fmtInsignia, type GlifoInsignia, type Insignia as DadosInsignia } from "./insignias";
import "./conquistas.css";

/**
 * INSÍGNIA (27/09) — o patch redondo BORDADO de escoteiro: borda merrow,
 * feltro com trama de fio, ponto corrido claro por fora e escuro por dentro,
 * o glifo, o rótulo, o número de verdade e as 3 estrelas de patamar.
 *
 * Só SVG (pattern + feDropShadow): sai igual na tela e na foto dos Stories.
 * `costurar`: ao abrir o planner cada patch pipoca e o ponto corrido é
 * revelado ao redor (um traço da cor do fundo encolhe — `.p-cover`), e o
 * número conta de zero até o valor (760 ms). Tudo por CSS com delay (--d);
 * a contagem é a única parte em JS.
 */

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const ESTRELA = "0,-7 2.1,-2.2 7.1,-2.2 3,1 4.4,6 0,3.2 -4.4,6 -3,1 -7.1,-2.2 -2.1,-2.2";

const GLIFOS: Record<GlifoInsignia, JSX.Element> = {
  chama: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  moeda: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h3.8a1.7 1.7 0 0 1 0 3.4h-2.6a1.7 1.7 0 0 0 0 3.4h3.8" /></>,
  halter: <><rect x="6.5" y="10" width="11" height="4" rx="1" /><rect x="2.5" y="7" width="4" height="10" rx="1.2" /><rect x="17.5" y="7" width="4" height="10" rx="1.2" /></>,
  livro: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  gota: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
  agenda: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>,
  grafico: <><path d="M22 7 13.5 15.5 8.5 10.5 2 17" /><path d="M16 7h6v6" /></>,
  alvo: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
};

const tamNumero = (txt: string) => (txt.length <= 3 ? 30 : txt.length <= 5 ? 23 : txt.length <= 8 ? 17.5 : 14.5);

interface Props {
  ins: DadosInsignia;
  tamanho: number;
  /** Costura ao entrar (delay em ms). */
  costurar?: number;
  className?: string;
  style?: CSSProperties;
}

export const Insignia = ({ ins, tamanho, costurar, className, style }: Props) => {
  const uid = `pt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const numRef = useRef<SVGTextElement>(null);
  const apagada = !ins.temDado;
  const cor = apagada ? "#a3a3a3" : ins.cor;
  const borda = apagada ? "#737373" : ins.borda;
  const txt = apagada ? "—" : fmtInsignia(ins.valor, ins.fmt);
  const tn = apagada ? 30 : tamNumero(txt);

  // contagem de zero até o valor, começando junto com a costura
  useEffect(() => {
    if (costurar === undefined || apagada) return;
    const el = numRef.current;
    if (!el) return;
    const reduzida = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzida) return;
    el.textContent = fmtInsignia(0, ins.fmt);
    const ctrl = animate(0, ins.valor, {
      duration: 0.76,
      delay: (costurar + 90) / 1000,
      ease: "easeOut",
      onUpdate: (v) => { el.textContent = fmtInsignia(v, ins.fmt); },
      onComplete: () => { el.textContent = fmtInsignia(ins.valor, ins.fmt); },
    });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costurar]);

  return (
    <span
      className={`patch${className ? ` ${className}` : ""}`}
      data-patch={ins.id}
      data-costura={costurar !== undefined ? "" : undefined}
      data-apagada={apagada ? "" : undefined}
      style={{ width: tamanho, height: tamanho, "--d": `${costurar ?? 0}ms`, ...style } as CSSProperties}
    >
      <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} role="img" aria-label={apagada ? `${ins.rotulo}: a conquistar` : `${ins.rotulo}: ${txt}`}>
        <defs>
          <pattern id={`${uid}f`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="1.3" fill="rgba(255,255,255,.13)" />
          </pattern>
          <filter id={`${uid}s`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#000" floodOpacity={apagada ? 0.14 : 0.28} />
          </filter>
        </defs>
        <g filter={`url(#${uid}s)`} opacity={apagada ? 0.55 : 1}>
          <circle cx="60" cy="60" r="56" fill={borda} />
          <circle cx="60" cy="60" r="56" fill={`url(#${uid}f)`} />
          <circle className="p-stitch" cx="60" cy="60" r="53.5" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.7" />
          <circle className="p-cover" cx="60" cy="60" r="53.5" fill="none" stroke={borda} strokeWidth="2.6" pathLength={100} strokeDasharray="100" strokeDashoffset="100" transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r="47" fill={cor} />
          <circle cx="60" cy="60" r="47" fill={`url(#${uid}f)`} />
          <circle className="p-stitch" cx="60" cy="60" r="44.5" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="1.3" />
          <circle className="p-cover" cx="60" cy="60" r="44.5" fill="none" stroke={cor} strokeWidth="2.2" pathLength={100} strokeDasharray="100" strokeDashoffset="100" transform="rotate(-90 60 60)" />
          <svg x="49" y="16" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            {GLIFOS[ins.glifo]}
          </svg>
          <text x="60" y="49.5" textAnchor="middle" fontFamily={INTER} fontSize="6.6" fontWeight={800} letterSpacing="1.3" fill="rgba(255,255,255,.9)">
            {ins.rotulo}
          </text>
          {apagada ? (
            <text x="60" y="80" textAnchor="middle" fontFamily={INTER} fontSize="7.2" fontWeight={800} letterSpacing="1.2" fill="rgba(255,255,255,.92)">
              A CONQUISTAR
            </text>
          ) : (
            <text ref={numRef} className="p-num" x="60" y={tn >= 23 ? 84 : 81} textAnchor="middle" fontFamily={INTER} fontSize={tn} fontWeight={900} letterSpacing={tn >= 23 ? -1 : -0.3} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>
              {txt}
            </text>
          )}
          {[0, 1, 2].map((i) => (
            <polygon
              key={i}
              transform={`translate(${60 + (i - 1) * 13},98) scale(.75)`}
              points={ESTRELA}
              fill={!apagada && i < ins.estrelas ? "#fde047" : "rgba(255,255,255,.28)"}
              stroke={!apagada && i < ins.estrelas ? "rgba(0,0,0,.35)" : "none"}
              strokeWidth=".8"
            />
          ))}
        </g>
      </svg>
    </span>
  );
};
