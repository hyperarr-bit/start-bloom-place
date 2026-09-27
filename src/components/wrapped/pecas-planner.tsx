import "@fontsource/instrument-serif/latin-400-italic.css";
import { Fragment, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { TextoEmAnel } from "@/components/conquistas/TextoEmAnel";
import { FotoWebKit } from "@/components/conquistas/foto-contexto";
import type { GrupoDoCorpo } from "@/lib/retrospectiva";
import { FOIL, SERIF, foilCss, usePrancheta } from "./prancheta";

/**
 * O VOCABULÁRIO DO PLANNER (26/09) — o tema padrão "Páginas de dentro" e o
 * card final de TODOS os temas. Portado de componentes.css/componentes.js do
 * designer: linho grafite, vinheta, espiral dourada, etiqueta de papel, tag
 * pendurada, fita marca-página, abas de índice, pauta com fio de ouro, grade
 * dos dias em foil, trilho, lacre de cera, carimbos de treino.
 *
 * É um OBJETO (um planner): cor fixa em estilo inline, igual no claro e no
 * escuro — classe de cor do Tailwind seria remapeada pelo modo escuro
 * (styles/escuro.css).
 */

export const P3 = {
  grafite: "#2f3036",
  mesa: "#141416",
  papel: "#fbf6ea",
  creme: "#f3eee4",
  magenta: "#d22d80",
  ouroTxt: "#e6c15c",
  rot: "#8c8272",
  tintaEtiqueta: "#6f665a",
  tag: "#f3e9d2",
  elastico: "linear-gradient(90deg, #a81f62, #e0438f 45%, #a81f62)",
  trama:
    "linear-gradient(0deg, rgba(255,255,255,.05) 0 34%, transparent 34%), linear-gradient(90deg, rgba(255,255,255,.04) 0 34%, transparent 34%)",
} as const;

/** Linho grafite (tamanho por CAMADA: com um valor só, a foto do WebKit não repete a 2ª). */
export const linho = (tam = 3): CSSProperties => ({
  backgroundColor: P3.grafite,
  backgroundImage: P3.trama,
  backgroundSize: `${tam}px ${tam}px, ${tam}px ${tam}px`,
  backgroundRepeat: "repeat, repeat",
});
export const vinheta: CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  background: "radial-gradient(130% 90% at 50% 20%, transparent 40%, rgba(0,0,0,.42) 100%)",
};
export const relevo: CSSProperties = { color: "rgba(255,255,255,.14)", textShadow: "0 1px 0 rgba(255,255,255,.10), 0 -1px 0 rgba(0,0,0,.55)" };
export const fio = (altura = 1): CSSProperties => ({
  height: altura,
  background: "linear-gradient(90deg, rgba(230,193,92,0), rgba(230,193,92,.75) 12%, rgba(230,193,92,.75) 88%, rgba(230,193,92,0))",
});
export const kicker = (fs = 10.5): CSSProperties => ({ fontSize: fs, fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: P3.ouroTxt });
export const rot = (fs = 9.5): CSSProperties => ({ fontSize: fs, fontWeight: 800, letterSpacing: ".18em", color: P3.rot, textTransform: "uppercase" });
export const serif: CSSProperties = { fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 };
export const heroi: CSSProperties = { fontWeight: 900, letterSpacing: "-.065em", lineHeight: 0.82, fontVariantNumeric: "tabular-nums", filter: "drop-shadow(0 3px 3px rgba(0,0,0,.55))" };
export const creme = (a: number) => `rgba(243,238,228,${a})`;

/** Etiqueta de papel com o fio interno (componente <Etiqueta> do designer). */
export const Etiqueta = ({ style, children, moldura = 4, espessura = 1, raioMoldura = 3, testId }: {
  style?: CSSProperties; children?: ReactNode; moldura?: number; espessura?: number; raioMoldura?: number; testId?: string;
}) => (
  <div
    data-testid={testId}
    style={{ position: "absolute", background: P3.papel, borderRadius: 5, boxShadow: "0 12px 20px -10px rgba(0,0,0,.85)", color: P3.grafite, boxSizing: "border-box", ...style }}
  >
    <div aria-hidden style={{ position: "absolute", inset: moldura, border: `${espessura}px solid rgba(43,43,47,.22)`, borderRadius: raioMoldura, pointerEvents: "none" }} />
    {children}
  </div>
);

/** Tag de papel pendurada, com o furo. */
export const Tag = ({ style, children }: { style?: CSSProperties; children?: ReactNode }) => (
  <div
    style={{
      position: "absolute", background: P3.tag, borderRadius: "10px 4px 4px 10px", padding: "7px 18px 7px 12px",
      boxShadow: "0 8px 14px -7px rgba(0,0,0,.8)", color: P3.grafite, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", ...style,
    }}
  >
    <i aria-hidden style={{ position: "absolute", right: 5, top: "50%", marginTop: -3, width: 6, height: 6, borderRadius: "50%", background: P3.grafite, boxShadow: "inset 0 0 0 1.5px #d6c7a3" }} />
    {children}
  </div>
);

/** Fita marca-página magenta, com o bico cortado. */
export const Fita = ({ style, largura = 14, bico = 9 }: { style?: CSSProperties; largura?: number; bico?: number }) => (
  <div
    aria-hidden
    style={{
      position: "absolute", width: largura, background: P3.elastico, boxShadow: "-3px 0 8px rgba(0,0,0,.45)",
      clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${bico}px), 0 100%)`, ...style,
    }}
  />
);

/** A espiral dourada na borda esquerda (mesma receita da capa do planner das Conquistas). */
export const Espiral = ({ n, passo, topo, esquerda, w = 13, h = 24, caixa = 36 }: {
  n: number; passo: number; topo: number; esquerda: number; w?: number; h?: number; caixa?: number;
}) => {
  // na foto do WebKit a sombrinha da argola girada vira um halo escuro em cima: sai
  const semSombra = useContext(FotoWebKit);
  return (
    <div aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: caixa, zIndex: 4 }}>
      {Array.from({ length: n }, (_, i) => {
        const y = topo + i * passo;
        return (
          <Fragment key={i}>
            <i style={{ position: "absolute", left: esquerda + w * 0.25, top: y + h * 0.3, width: w * 0.5, height: h * 0.4, borderRadius: "50%", background: "#101114", boxShadow: "inset 0 1px 2px rgba(0,0,0,.9)" }} />
            <i
              style={{
                position: "absolute", left: esquerda - w * 0.5, top: y, width: w, height: h, borderRadius: "50%", boxSizing: "border-box",
                borderStyle: "solid", borderWidth: Math.max(2.5, w * 0.26), borderColor: "#fbe7a8 #c9932a #8f6a0c #e8c463",
                boxShadow: semSombra ? "none" : "0 1px 2px rgba(0,0,0,.6)", transform: "rotate(-10deg)",
              }}
            />
          </Fragment>
        );
      })}
    </div>
  );
};

/** O fundo das páginas do planner: mesa, linho a partir da espiral, vinheta e a espiral inteira. */
export const FundoPlanner = ({ fita }: { fita?: number }) => {
  const { cheia, H } = usePrancheta();
  // tela mais baixa: a fita encurta junto com a página (não desce sobre a grade)
  const alturaDaFita = fita ? Math.round(fita - ((fita * 0.2) * Math.max(0, 932 - H)) / 172) : 0;
  return (
    <div style={{ position: "absolute", inset: 0, background: P3.mesa }}>
      <div style={{ position: "absolute", left: 16, top: 0, right: 0, bottom: 0, borderRadius: "4px 0 0 4px", ...linho() }} />
      <div style={vinheta} />
      <Espiral n={Math.ceil((cheia - 16) / 66) + 1} passo={66} topo={16} esquerda={16} />
      {fita ? <Fita style={{ right: 34, top: -4, height: alturaDaFita }} /> : null}
    </div>
  );
};

/** Abas de índice na borda direita: a da página atual é de papel e mais larga. */
export interface Aba { id: string; rotulo: string; cor: string }
export const Abas = ({ abas, atual, top, altura }: { abas: Aba[]; atual: string; top: number; altura: number }) => (
  <div aria-hidden style={{ position: "absolute", right: 0, top, display: "flex", flexDirection: "column", gap: 6, zIndex: 3 }}>
    {abas.map((a) => {
      const on = a.id === atual;
      return (
        <span
          key={a.id}
          style={{
            width: on ? 26 : 20, height: altura, borderRadius: "6px 0 0 6px", display: "grid", placeItems: "center",
            writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 8.5, fontWeight: 800, letterSpacing: ".14em",
            textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden",
            color: on ? P3.grafite : "rgba(255,255,255,.92)", background: on ? P3.papel : a.cor, boxShadow: "-2px 0 4px rgba(0,0,0,.3)",
          }}
        >
          {a.rotulo}
        </span>
      );
    })}
  </div>
);

/** Linhas pautadas com fio de ouro: rótulo, valor e o lado direito. */
export interface LinhaDaPauta { k: string; v: ReactNode; s?: ReactNode }
export const Pauta = ({ linhas, style, pad = [11, 12], fs }: { linhas: LinhaDaPauta[]; style?: CSSProperties; pad?: [number, number]; fs: (n: number) => number }) => (
  <div style={style}>
    {linhas.map((l, i) => (
      <div
        key={l.k}
        style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", columnGap: 10, padding: `${pad[0]}px 0 ${pad[1]}px`, borderTop: i ? "1px solid rgba(230,193,92,.32)" : undefined }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: fs(10), fontWeight: 800, letterSpacing: ".2em", color: P3.ouroTxt, textTransform: "uppercase" }}>{l.k}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.05, marginTop: 3, color: P3.creme, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.v}</div>
        </div>
        {l.s != null && <div style={{ fontSize: fs(12.5), color: creme(0.62), textAlign: "right" }}>{l.s}</div>}
      </div>
    ))}
  </div>
);

const CHECK = "M5 12l5 5L20 7";
/** Check escuro gravado no foil. */
export const CheckDourado = ({ tam }: { tam: number }) => (
  <svg viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="#5a3d05" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={CHECK} />
  </svg>
);

/**
 * A grade dos dias em foil (componente <Grade30>): 7 colunas começando na
 * segunda. Dia anotado = foil com check; dia da base sem registro = afundado;
 * antes do 1º dia de uso = pontilhado (não conta).
 */
export const Grade30 = ({ ano, mesIdx, marcados, primeiroDia, largura, gap, check, cabecalho = false, fs, dias }: {
  ano: number; mesIdx: number; marcados: number[]; primeiroDia: number; largura: number; gap: number; check: number;
  cabecalho?: boolean; fs?: (n: number) => number;
  /** só estes dias (a capa da versão curta) — sem a folga da semana */
  dias?: number[];
}) => {
  const total = new Date(ano, mesIdx + 1, 0).getDate();
  const antes = dias ? 0 : (new Date(ano, mesIdx, 1).getDay() + 6) % 7;
  const colunas = dias ? Math.min(7, Math.max(1, dias.length)) : 7;
  const celula = (largura - (colunas - 1) * gap) / colunas;
  const feitos = new Set(marcados);
  const lista = dias ?? Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${colunas}, ${celula}px)`, gap, width: largura }} data-testid="grade-dos-dias">
      {cabecalho && ["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
        <b key={`c${i}`} style={{ fontSize: fs ? fs(9) : 9, fontWeight: 800, color: P3.ouroTxt, textAlign: "center", letterSpacing: ".1em", lineHeight: 1.2 }}>{d}</b>
      ))}
      {Array.from({ length: antes }, (_, i) => <i key={`v${i}`} aria-hidden />)}
      {lista.map((dia) => {
        const on = feitos.has(dia);
        const fora = dia < primeiroDia;
        return (
          <i
            key={dia}
            aria-label={on ? `dia ${dia}: anotado` : `dia ${dia}`}
            style={{
              width: celula, height: celula, borderRadius: celula > 20 ? 5 : 3, display: "grid", placeItems: "center", boxSizing: "border-box",
              ...(on
                ? { background: FOIL, boxShadow: "0 1px 2px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.35)" }
                : fora
                  ? { border: "1px dotted rgba(255,255,255,.22)" }
                  : { background: "rgba(0,0,0,.18)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16), 0 1px 0 rgba(255,255,255,.05)" }),
            }}
          >
            {on && <CheckDourado tam={check} />}
          </i>
        );
      })}
    </div>
  );
};

/** Quantas linhas de semana o mês ocupa na grade (segunda primeiro). */
export const semanasDoMes = (ano: number, mesIdx: number) => {
  const total = new Date(ano, mesIdx + 1, 0).getDate();
  const antes = (new Date(ano, mesIdx, 1).getDay() + 6) % 7;
  return Math.ceil((antes + total) / 7);
};

/** Barra em foil num trilho afundado. */
export const Trilho = ({ pct, style, atraso = 0.3 }: { pct: number; style?: CSSProperties; atraso?: number }) => {
  const { miniatura } = usePrancheta();
  const w = `${Math.max(2, Math.min(100, pct))}%`;
  return (
    <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.09)", boxShadow: "inset 0 1px 2px rgba(0,0,0,.5)", overflow: "hidden", ...style }}>
      <motion.i
        style={{ display: "block", height: "100%", background: FOIL, borderRadius: 4 }}
        initial={{ width: miniatura ? w : 0 }}
        animate={{ width: w }}
        transition={{ delay: atraso, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
};

const ESTRELA = "0,-7 2.1,-2.2 7.1,-2.2 3,1 4.4,6 0,3.2 -4.4,6 -3,1 -7.1,-2.2 -2.1,-2.2";

/** Lacre de cera magenta com o texto em anel ("SETEMBRO · 2026 · FECHADO · ") e a estrela. */
export const Lacre = ({ texto, tamanho, style, titulo }: { texto: string; tamanho: number; style?: CSSProperties; titulo?: string }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const fotoWebKit = useContext(FotoWebKit);
  return (
    <div style={{ position: "absolute", width: tamanho, height: tamanho, ...style }}>
      <svg
        viewBox="0 0 120 120"
        style={{ width: "100%", height: "100%", overflow: "visible", filter: fotoWebKit ? undefined : "drop-shadow(0 4px 4px rgba(0,0,0,.6))" }}
        role="img"
        aria-label={titulo}
      >
        {titulo && <title>{titulo}</title>}
        <defs>
          <radialGradient id={`lacre${uid}`} cx=".38" cy=".32" r=".75">
            <stop offset="0" stopColor="#f06aae" />
            <stop offset=".55" stopColor="#c8266f" />
            <stop offset="1" stopColor="#8f1a52" />
          </radialGradient>
          <filter id={`cera${uid}`} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves={2} seed={4} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={7} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#cera${uid})`}>
          <circle cx="60" cy="60" r="50" fill={`url(#lacre${uid})`} />
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
        </g>
        <circle cx="60" cy="60" r="43" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="41" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
        <TextoEmAnel cx={60} cy={60} r={36} texto={texto} fontSize={8.6} fill="rgba(255,255,255,.85)" fontWeight={800} />
        <polygon transform="translate(60,60) scale(2.4)" points={ESTRELA} fill="rgba(0,0,0,.28)" />
        <polygon transform="translate(60,58) scale(2.4)" points={ESTRELA} fill="rgba(255,255,255,.55)" />
      </svg>
    </div>
  );
};

/* ------------------------------------------------ pictogramas de treino */

/**
 * Pictogramas de treino do designer (linha, 48×48, currentColor) — viram
 * carimbo no planner, círculo de fio na revista e adesivo nos recortes.
 * "core" (abdômen) é o 5º grupo do Treino: desenhado na mesma régua.
 */
const PICTOS: Record<GrupoDoCorpo, ReactNode> = {
  pernas: (
    <>
      <circle cx="24" cy="8" r="4" /><path d="M10 15 H38" /><path d="M24 12 V22" /><path d="M24 22 L15 30 L14 40" />
      <path d="M24 22 L33 30 L34 40" /><path d="M10 40 H18 M30 40 H38" />
    </>
  ),
  superiores: (
    <>
      <circle cx="9" cy="30" r="3.5" /><path d="M13 30 H36" /><path d="M8 38 H40" /><path d="M20 30 V19 M30 30 V19" />
      <path d="M13 19 H37" /><path d="M14 15 V23 M36 15 V23" />
    </>
  ),
  costas: (
    <>
      <path d="M8 8 H40" /><path d="M16 8 V17 M32 8 V17" /><circle cx="24" cy="14" r="3.5" /><path d="M16 17 H32" />
      <path d="M24 18 V31" /><path d="M24 31 L18 42 M24 31 L30 42" />
    </>
  ),
  cardio: (
    <>
      <path d="M24 41 C10 31 6 23 10 16 C14 9 22 10 24 16 C26 10 34 9 38 16 C42 23 38 31 24 41 Z" />
      <path d="M12 25 H18 L21 19 L25 31 L28 25 H36" />
    </>
  ),
  core: (
    <>
      <circle cx="10" cy="22" r="4" /><path d="M14 24 L38 30" /><path d="M8 38 H42" /><path d="M17 25 L15 38 M36 30 L38 38" />
      <path d="M22 16 C26 13 30 13 33 16" />
    </>
  ),
};

export const Picto = ({ grupo, tam, cor = "currentColor" }: { grupo: GrupoDoCorpo; tam: number; cor?: string }) => (
  <svg viewBox="0 0 48 48" width={tam} height={tam} fill="none" stroke={cor} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {PICTOS[grupo] ?? PICTOS.pernas}
  </svg>
);
/** O desenho puro (pra quem monta o próprio <svg>, como o adesivo dos recortes). */
export const pictoDe = (grupo: GrupoDoCorpo) => PICTOS[grupo] ?? PICTOS.pernas;

/** Carimbo de treino em ouro: anel duplo, pictograma, número em foil, rótulo. */
export const CarimboTreino = ({ grupo, n, rotulo, fs }: { grupo: GrupoDoCorpo; n: number; rotulo: string; fs: (x: number) => number }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
    <div
      style={{
        width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", color: P3.ouroTxt,
        boxShadow: "inset 0 0 0 1.5px rgba(230,193,92,.85), inset 0 0 0 4px rgba(47,48,54,1), inset 0 0 0 5px rgba(230,193,92,.35)",
      }}
    >
      <Picto grupo={grupo} tam={30} />
    </div>
    <div style={{ ...foilCss, fontSize: 24, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
    <div style={{ fontSize: fs(10.5), fontWeight: 800, letterSpacing: rotulo.length > 8 ? ".06em" : ".14em", textTransform: "uppercase", color: creme(0.7), whiteSpace: "nowrap" }}>{rotulo}</div>
  </div>
);

/** Carimbo de recorde em relevo dourado (texto em foil, moldura dupla). */
export const CarimboOuro = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <span
    style={{
      display: "inline-block", padding: "9px 14px", border: `2px solid ${P3.ouroTxt}`, borderRadius: 8,
      boxShadow: `inset 0 0 0 3px ${P3.grafite}, inset 0 0 0 4px rgba(230,193,92,.55)`,
      fontSize: 12.5, fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase", whiteSpace: "nowrap", ...foilCss, ...style,
    }}
  >
    {children}
  </span>
);

/** Rádio dourado da opção de foco (ligado = foil com check). */
export const RadioDourado = ({ on }: { on: boolean }) => (
  <i
    aria-hidden
    style={{
      position: "absolute", left: 16, top: "50%", width: 20, height: 20, marginTop: -10, borderRadius: "50%", display: "grid", placeItems: "center",
      ...(on ? { background: FOIL, boxShadow: "0 1px 2px rgba(0,0,0,.4)" } : { boxShadow: "inset 0 0 0 1.5px #b8860b" }),
    }}
  >
    {on && <CheckDourado tam={13} />}
  </i>
);

/** O cadeado das frases de privacidade. */
export const Cadeado = ({ tam = 14 }: { tam?: number }) => (
  <svg viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
