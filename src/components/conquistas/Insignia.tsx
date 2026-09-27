import { useEffect, useId, useRef, type CSSProperties, type ComponentType } from "react";
import { animate } from "framer-motion";
import {
  Apple, BadgeCheck, Ban, BookMarked, BookOpen, Bookmark, Brain, Briefcase, CalendarCheck, CalendarDays, Droplets, Dumbbell, Earth,
  Flag, Flame, GraduationCap, HandCoins, Heart, HeartPulse, House, Leaf, Library, Lightbulb, Medal, Moon, NotebookPen, PawPrint,
  PenLine, PiggyBank, Pill, Plane, Repeat, Scale, Send, Shield, ShieldCheck, Sparkles, Sprout, Sun, Sunrise, Ticket, Timer,
  TrendingDown, Trophy, UtensilsCrossed, Utensils, Wallet, Weight, Wrench, Zap, type LucideProps,
} from "lucide-react";
import { fmtNum, type Faixa, type Forma, type Insignia as DadosInsignia } from "./insignias";
import "./conquistas.css";

/**
 * A INSÍGNIA — direção B · Esmalte (pin), aprovada pelo dono em 27/09: chapa
 * de metal polido da FAIXA (ouro · prata · bronze; níquel escuro sem faixa),
 * esmalte chapado na cor da ÁREA separado por uma linha cloisonné, o glifo
 * em metal, o número grande com a unidade curta, brilho de vidro e as 3
 * estrelas. A FORMA é do módulo (escudo, hexágono, flâmula, losango, arco…).
 *
 * É um OBJETO: cor fixa em SVG, igual no claro e no escuro, e só gradientes
 * lineares/radiais + clipPath + UMA sombra — o que o html-to-image do iPhone
 * fotografa sem surpresa. O que é só tela (a varredura de luz e o clarão de
 * "prender", com mix-blend-mode) fica fora com `estatico`; o número pode
 * ficar de fora com `semNumero` (o vídeo desenha ele contando no canvas).
 */

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export interface Metal { claro: string; medio: string; escuro: string; sombra: string; texto: string; fio: string }
export const METAL: Record<Faixa | "nada" | "niquel", Metal> = {
  ouro: { claro: "#fff3c4", medio: "#e9c65a", escuro: "#b8860b", sombra: "#8f6a0c", texto: "#6b4a05", fio: "#d9a72a" },
  prata: { claro: "#ffffff", medio: "#dfe4ea", escuro: "#9aa5b3", sombra: "#5f6a77", texto: "#39424d", fio: "#b9c2cc" },
  bronze: { claro: "#fde2c8", medio: "#e3a574", escuro: "#a55d2c", sombra: "#7a3e17", texto: "#5a2b0e", fio: "#c47c45" },
  /** trancada: chapa cinza */
  nada: { claro: "#e7e5e4", medio: "#c7c3bf", escuro: "#8e8a86", sombra: "#5d5a57", texto: "#57534e", fio: "#a8a29e" },
  /** com dado e sem faixa (o herói de quem está começando): níquel escuro */
  niquel: { claro: "#6b7280", medio: "#3f3f46", escuro: "#18181b", sombra: "#000000", texto: "#e5e7eb", fio: "#52525b" },
};

/* ---------------- formas (caixa 120 × 120, centro 60,60) ----------------
   cada uma devolve o contorno em escala s (1 = borda externa); quem chama escala pra faixa interna */
const k = (v: number, s: number) => 60 + (v - 60) * s;
export const FORMAS: Record<Forma, (s: number) => string> = {
  circulo: (s) => { const r = 56 * s; return `M${60 - r},60 a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`; },
  escudo: (s) => `M${k(60, s)},${k(4, s)} L${k(112, s)},${k(20, s)} V${k(60, s)} C${k(112, s)},${k(90, s)} ${k(88, s)},${k(110, s)} ${k(60, s)},${k(118, s)} C${k(32, s)},${k(110, s)} ${k(8, s)},${k(90, s)} ${k(8, s)},${k(60, s)} V${k(20, s)} Z`,
  hexagono: (s) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 2; pts.push(`${k(60 + 57 * Math.cos(a), s).toFixed(1)},${k(60 + 57 * Math.sin(a), s).toFixed(1)}`); }
    return `M${pts.join(" L")} Z`;
  },
  flamula: (s) => `M${k(14, s)},${k(8, s)} H${k(106, s)} a${6 * s},${6 * s} 0 0 1 ${6 * s},${6 * s} V${k(78, s)} L${k(60, s)},${k(118, s)} L${k(8, s)},${k(78, s)} V${k(14, s)} a${6 * s},${6 * s} 0 0 1 ${6 * s},${-6 * s} Z`,
  losango: (s) => `M${k(60, s)},${k(4, s)} C${k(70, s)},${k(20, s)} ${k(100, s)},${k(50, s)} ${k(116, s)},${k(60, s)} C${k(100, s)},${k(70, s)} ${k(70, s)},${k(100, s)} ${k(60, s)},${k(116, s)} C${k(50, s)},${k(100, s)} ${k(20, s)},${k(70, s)} ${k(4, s)},${k(60, s)} C${k(20, s)},${k(50, s)} ${k(50, s)},${k(20, s)} ${k(60, s)},${k(4, s)} Z`,
  arco: (s) => `M${k(10, s)},${k(114, s)} V${k(56, s)} A${50 * s},${50 * s} 0 0 1 ${k(110, s)},${k(56, s)} V${k(114, s)} a${5 * s},${5 * s} 0 0 1 ${-5 * s},${5 * s} H${k(15, s)} a${5 * s},${5 * s} 0 0 1 ${-5 * s},${-5 * s} Z`,
  quadrado: (s) => { const r = 22 * s; return `M${k(8, s) + r},${k(8, s)} H${k(112, s) - r} a${r},${r} 0 0 1 ${r},${r} V${k(112, s) - r} a${r},${r} 0 0 1 ${-r},${r} H${k(8, s) + r} a${r},${r} 0 0 1 ${-r},${-r} V${k(8, s) + r} a${r},${r} 0 0 1 ${r},${-r} Z`; },
  recortado: (s) => {
    const n = 12, R = 56 * s;
    let d = "";
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
      const x0 = 60 + R * Math.cos(a0), y0 = 60 + R * Math.sin(a0);
      const xm = 60 + (R + 4 * s) * Math.cos(a1), ym = 60 + (R + 4 * s) * Math.sin(a1);
      const x2 = 60 + R * Math.cos(a2), y2 = 60 + R * Math.sin(a2);
      d += (i ? "" : `M${x0.toFixed(1)},${y0.toFixed(1)} `) + `Q${xm.toFixed(1)},${ym.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} `;
    }
    return d + "Z";
  },
};
/** Onde o miolo (glifo/número/unidade) fica: as formas pontudas empurram o centro. */
const MIOLO: Record<Forma, number> = { flamula: -6, escudo: -4, arco: 2, losango: 0, hexagono: 0, circulo: 0, quadrado: 0, recortado: 0 };

/** Centro vertical do miolo (o vídeo desenha o número aqui). */
export const centroDoMiolo = (forma: Forma) => 60 + MIOLO[forma];
/** Tamanho da fonte do número (unidades da caixa de 120) pelo comprimento do texto. */
export const tamanhoDoNumero = (txt: string, fmt: DadosInsignia["fmt"]): number => {
  const base = fmt === "int" ? 31 : 29;
  const n = txt.replace(/[^\dA-Za-z%$,.]/g, "").length;
  return n <= 2 ? base : n <= 3 ? base * 0.86 : n <= 5 ? base * 0.7 : n <= 8 ? base * 0.56 : base * 0.46;
};
/** "DIAS DE MEDITAR" — o rótulo dentro do objeto (o hábito campeão leva o nome). */
export const rotuloDe = (i: Pick<DadosInsignia, "id" | "rotulo" | "sub">) => (i.id === "rot-campeao" && i.sub ? `${i.rotulo} ${i.sub}` : i.rotulo).toUpperCase();

const GLIFOS: Record<string, ComponentType<LucideProps>> = {
  flame: Flame, "calendar-days": CalendarDays, trophy: Trophy, "piggy-bank": PiggyBank, wallet: Wallet, ban: Ban, "trending-down": TrendingDown,
  shield: Shield, sun: Sun, "badge-check": BadgeCheck, "utensils-crossed": UtensilsCrossed, "hand-coins": HandCoins, dumbbell: Dumbbell,
  "calendar-check": CalendarCheck, weight: Weight, medal: Medal, apple: Apple, utensils: Utensils, droplets: Droplets, moon: Moon, pill: Pill,
  scale: Scale, sprout: Sprout, sunrise: Sunrise, "pen-line": PenLine, brain: Brain, timer: Timer, "graduation-cap": GraduationCap,
  lightbulb: Lightbulb, repeat: Repeat, "book-open": BookOpen, "book-marked": BookMarked, bookmark: Bookmark, library: Library, flag: Flag,
  leaf: Leaf, "shield-check": ShieldCheck, zap: Zap, wrench: Wrench, sparkles: Sparkles, "paw-print": PawPrint, "notebook-pen": NotebookPen,
  ticket: Ticket, earth: Earth, plane: Plane, heart: Heart, "heart-pulse": HeartPulse, house: House, send: Send, briefcase: Briefcase,
};

const Glifo = ({ nome, x, y, tam, cor, sw, opacidade }: { nome: string; x: number; y: number; tam: number; cor: string; sw: number; opacidade?: number }) => {
  const Icone = GLIFOS[nome] ?? Sparkles;
  return <Icone x={x} y={y} width={tam} height={tam} color={cor} strokeWidth={sw} style={opacidade !== undefined ? { opacity: opacidade } : undefined} aria-hidden />;
};

const ESTRELA = "0,-7 2.1,-2.2 7.1,-2.2 3,1 4.4,6 0,3.2 -4.4,6 -3,1 -7.1,-2.2 -2.1,-2.2";

const gradMetal = (id: string, m: Metal, ang: number) => {
  const r = (ang * Math.PI) / 180, x2 = 50 + Math.cos(r) * 50, y2 = 50 + Math.sin(r) * 50, x1 = 100 - x2, y1 = 100 - y2;
  return (
    <linearGradient id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
      <stop offset="0" stopColor={m.claro} />
      <stop offset=".22" stopColor={m.medio} />
      <stop offset=".48" stopColor={m.escuro} />
      <stop offset=".62" stopColor={m.claro} />
      <stop offset=".8" stopColor={m.medio} />
      <stop offset="1" stopColor={m.sombra} />
    </linearGradient>
  );
};

export const metalDaInsignia = (i: Pick<DadosInsignia, "faixa">, trancada = false): Metal => (trancada ? METAL.nada : i.faixa ? METAL[i.faixa] : METAL.niquel);

export interface InsigniaProps {
  ins: DadosInsignia;
  tamanho: number;
  /** Sem faixa, em contorno cinza com o progresso ("17/30"). */
  trancada?: boolean;
  /** Entrada "cai e prende" (atraso em ms) — só na tela. */
  entrada?: number;
  /** Conta o número de zero até o valor (com a entrada). */
  contar?: boolean;
  semSombra?: boolean;
  /** Foto/vídeo: sem varredura, sem clarão, sem animação (só gradientes + clipPath + sombra). */
  estatico?: boolean;
  /** O vídeo desenha o número no canvas. */
  semNumero?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const Insignia = ({ ins, tamanho, trancada = false, entrada, contar = false, semSombra = false, estatico = false, semNumero = false, className, style }: InsigniaProps) => {
  const id = `ins${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const forma = FORMAS[ins.forma];
  const m = metalDaInsignia(ins, trancada);
  const corEsm = trancada ? "#ecebe7" : ins.cor;
  const txt = trancada ? "" : ins.texto;
  const tn = tamanhoDoNumero(txt, ins.fmt);
  const cy = centroDoMiolo(ins.forma);
  const rotulo = rotuloDe(ins);
  const tamRotulo = rotulo.length > 12 ? 5.4 : 6.4;
  const animar = entrada !== undefined && !estatico;

  // o número conta de zero (textContent direto nos dois <text>: sem re-render por quadro)
  const fundo = useRef<SVGTextElement>(null);
  const frente = useRef<SVGTextElement>(null);
  useEffect(() => {
    if (!contar || trancada || estatico || semNumero || !ins.faixa) return;
    const alvo = ins.valor;
    const escrever = (v: number) => {
      const t = fmtNum(ins.fmt === "int" || ins.fmt === "pct" || ins.fmt === "pctneg" ? Math.round(v) : v, ins.fmt);
      if (fundo.current) fundo.current.textContent = t;
      if (frente.current) frente.current.textContent = t;
    };
    escrever(0);
    const c = animate(0, alvo, { duration: 0.76, delay: ((entrada ?? 0) + 120) / 1000, ease: "easeOut", onUpdate: escrever, onComplete: () => escrever(alvo) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contar, ins.id, ins.valor]);

  const numero = !semNumero && !trancada && (
    <>
      <text ref={fundo} x="60" y={cy + 9} textAnchor="middle" fontFamily={INTER} fontSize={tn} fontWeight={900} letterSpacing={tn > 24 ? -1.2 : -0.3} fill="none" stroke={m.escuro} strokeWidth={1.3} strokeLinejoin="round" style={{ fontVariantNumeric: "tabular-nums" }} data-numero="fundo">{txt}</text>
      <text ref={frente} x="60" y={cy + 9} textAnchor="middle" fontFamily={INTER} fontSize={tn} fontWeight={900} letterSpacing={tn > 24 ? -1.2 : -0.3} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }} data-numero="frente">{txt}</text>
    </>
  );

  return (
    <span
      className={`ins${animar ? " ins-entra" : ""}${className ? ` ${className}` : ""}`}
      data-ins={ins.id}
      data-faixa={ins.faixa ?? (trancada ? "trancada" : "sem-faixa")}
      style={{ width: tamanho, height: tamanho, "--d": `${entrada ?? 0}ms`, ...style } as CSSProperties}
    >
      <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} role="img" aria-label={`${ins.nome}: ${trancada ? "a conquistar" : `${ins.texto} ${ins.unid}`.trim()}`}>
        <defs>
          {!semSombra && (
            <filter id={`${id}s`} x="-25%" y="-25%" width="150%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.4" floodColor="#000" floodOpacity={trancada ? 0.15 : 0.38} />
            </filter>
          )}
          {gradMetal(`${id}m`, m, 135)}
          {gradMetal(`${id}m2`, m, 315)}
          <linearGradient id={`${id}v`} x1="0" y1="0" x2=".6" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".55" />
            <stop offset=".38" stopColor="#fff" stopOpacity=".12" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".16" />
            <stop offset="1" stopColor="#000" stopOpacity=".14" />
          </linearGradient>
          <clipPath id={`${id}k`}><path d={forma(0.86)} /></clipPath>
          <clipPath id={`${id}kk`}><path d={forma(1)} /></clipPath>
          {animar && (
            <radialGradient id={`${id}cl`}>
              <stop offset="0" stopColor="#fff" stopOpacity=".95" />
              <stop offset=".45" stopColor="#fff" stopOpacity=".5" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          )}
        </defs>
        <g filter={semSombra ? undefined : `url(#${id}s)`}>
          {/* chapa de metal polido */}
          <path d={forma(1)} fill={`url(#${id}m)`} />
          <path d={forma(0.96)} fill="none" stroke={m.claro} strokeWidth=".9" opacity=".7" />
          <path d={forma(0.9)} fill={`url(#${id}m2)`} />
          {/* esmalte */}
          <path d={forma(0.86)} fill={corEsm} />
          <path d={forma(0.86)} fill={`url(#${id}e)`} />
          <g clipPath={`url(#${id}k)`}>
            {/* cloisonné: a linha de metal separando o campo do glifo */}
            <path d={`M8,${cy - 12} H112`} stroke={m.medio} strokeWidth="1.3" opacity=".75" />
            <rect x="0" y="0" width="120" height={cy - 12} fill="rgba(0,0,0,.14)" />
            {trancada ? (
              <>
                <Glifo nome={ins.glifo} x={49} y={cy - 37} tam={22} cor="#b5b0a8" sw={2.2} />
                <text x="60" y={cy + 7} textAnchor="middle" fontFamily={INTER} fontSize="15" fontWeight={900} fill="#a8a29e" letterSpacing="-.5">
                  {ins.texto}
                  <tspan fontSize="9" fontWeight={800} fill="#b8b3ab">/{ins.proxima ? ins.proxima.alvo : "—"}</tspan>
                </text>
                <text x="60" y={cy + 19} textAnchor="middle" fontFamily={INTER} fontSize="6.2" fontWeight={800} letterSpacing="1" fill="#b5b0a8">{rotulo}</text>
              </>
            ) : (
              <>
                <Glifo nome={ins.glifo} x={49} y={cy - 37} tam={22} cor={m.sombra} sw={3.4} opacidade={0.55} />
                <Glifo nome={ins.glifo} x={49} y={cy - 37} tam={22} cor={m.claro} sw={2.2} />
                {numero}
                <text x="60" y={cy + 20} textAnchor="middle" fontFamily={INTER} fontSize={tamRotulo} fontWeight={800} letterSpacing="1" fill="rgba(255,255,255,.95)">{rotulo}</text>
              </>
            )}
            {/* brilho de vidro do esmalte */}
            <ellipse cx="38" cy="30" rx="44" ry="26" fill={`url(#${id}v)`} transform="rotate(-18 38 30)" />
          </g>
          {[0, 1, 2].map((i) => (
            <polygon key={i} transform={`translate(${60 + (i - 1) * 11.5},${cy + 31}) scale(0.6)`} points={ESTRELA} fill={!trancada && i < ins.estrelas ? m.claro : trancada ? "#d6d3cf" : "rgba(0,0,0,.22)"} />
          ))}
          {/* só na tela: a luz que varre o metal e o clarão de prender */}
          {!estatico && !trancada && (
            <g clipPath={`url(#${id}kk)`}>
              <rect className="ins-varre" x="-40" y="-10" width="30" height="140" fill="rgba(255,255,255,.55)" />
            </g>
          )}
          {animar && <circle className="ins-clarao" cx="60" cy="60" r="78" fill={`url(#${id}cl)`} />}
        </g>
      </svg>
    </span>
  );
};
