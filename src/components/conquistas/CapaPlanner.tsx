import "@fontsource/instrument-serif/latin-400-italic.css";
import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import "./conquistas.css";
import { SeloNivel, gravacaoDoNivel } from "./SeloNivel";
import { Fogo } from "./Fogo";
import { FotoWebKit } from "./foto-contexto";

/**
 * CAPA DO PLANNER — v3 "planner físico premium" (02/10; a C2 de 26/09 era
 * bonita só no grafite: no vichy o "NÍVEL" sumia, "Platina" ficava rosado, a
 * insígnia prata perdia força, o "core" sumia e o elástico grafite destoava).
 *
 * Cada capa agora é um MATERIAL com paleta própria:
 *  - textura de verdade (couro com grão, xadrez vichy tecido, linho, veludo,
 *    papel kraft, couro granulado, noite estrelada) — tudo em degradês CSS,
 *    nenhuma imagem;
 *  - borda chanfrada + COSTURA pontilhada no fio da capa;
 *  - gravação em HOT STAMPING pro "NÍVEL", o nome do nível e o "core" — SEMPRE
 *    no METAL DO NÍVEL (bronze, prata, ouro, platina, diamante), igual em todas
 *    as capas e igual à insígnia (02/10, dono: a cor da gravação depende só do
 *    nível, nunca da capa); o contorno escuro do mesmo metal + o relevo da
 *    prensa garantem a leitura em capa clara e escura; a insígnia assenta num
 *    rebaixo circular;
 *  - etiqueta de papel com sombra de contato + sombra difusa;
 *  - elástico tecido na cor que combina com a capa, com a etiqueta do fogo
 *    pendurada (o fogo muda de cor com a sequência: lib/fogo-sequencia.ts);
 *  - luz: brilho diagonal e vinheta, discretos.
 *
 * É um OBJETO: fica igual no claro e no escuro — por isso tudo é cor fixa
 * inline (classe do Tailwind seria remapeada por styles/escuro.css).
 *
 * Duas capas são LIBERADAS pelo tempo (Bordô · 14 dias, Noite · 30 dias):
 * a regra mora em lib/fogo-sequencia.ts; aqui só o desenho.
 */

export type CapaId = "grafite" | "vichy" | "salvia" | "lavanda" | "kraft" | "marinho" | "bordo" | "noite";

/** Onde a capa escolhida fica gravada (por conta). */
export const CHAVE_CAPA = "conquistas-capa";

export interface Capa {
  nome: string;
  /** Uma linha pro seletor/popup ("couro grafite"). */
  descricao: string;
  bg: string;
  /** As camadas da textura e da luz (background-image) e os tamanhos delas. */
  camadas: string;
  tamanhos: string;
  /** Capa clara (muda só o chanfro e a luz — o metal da gravação é o do nível, em qualquer capa). */
  clara: boolean;
  /** Linha fina do chanfro. */
  chanfro: string;
  /** O fio da costura. */
  costura: string;
  /** O relevo da prensa: sombra escura e luz. */
  prensaSombra: string;
  prensaLuz: string;
  /** O rebaixo onde a insígnia assenta. */
  rebaixo: string;
  /** Elástico: cor, luz e sombra. */
  elastico: [string, string, string];
  /** Papel da etiqueta e da tag (cream nas escuras; branco quente nas claras). */
  papel: string;
  papelMoldura: string;
  /** Bolinha/amostra do seletor. */
  amostra: string;
}

/**
 * GRÃO DE COURO: ruído de verdade (feTurbulence num ladrilho de 160 px que emenda sem costura, como
 * imagem de fundo) — pintado uma vez, barato no WebView — mais dois véus de pontos irregulares.
 * `alfa` = quanto o ruído aparece (0…1); `freq` = o tamanho do grão (maior = mais fino).
 */
const RUIDO = (freq: number, alfa: number, semente: number, claro = false) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch' seed='${semente}'/><feColorMatrix type='matrix' values='0 0 0 0 ${claro ? 1 : 0}  0 0 0 0 ${claro ? 1 : 0}  0 0 0 0 ${claro ? 1 : 0}  0 0 0 ${alfa} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`;
/** Grão escuro (a sombra do relevo) + grão claro (a luz nos altos) + dois véus de pontos irregulares. */
const COURO_GRAO = (luz: string, sombra: string, semente = 7) =>
  `${RUIDO(0.9, 0.55, semente)}, ${RUIDO(0.4, 0.22, semente + 3, true)}, radial-gradient(circle at 30% 40%, ${luz} 0 .8px, transparent 1.6px), radial-gradient(circle at 70% 70%, ${sombra} 0 1px, transparent 1.9px)`;
const COURO_GRAO_TAM = "160px 160px, 160px 160px, 11px 13px, 17px 11px";
const LUZ_ESCURA = "linear-gradient(118deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.05) 26%, rgba(255,255,255,0) 48%, rgba(0,0,0,.16) 100%)";
const LUZ_CLARA = "linear-gradient(118deg, rgba(255,255,255,.34) 0%, rgba(255,255,255,.10) 26%, rgba(255,255,255,0) 48%, rgba(0,0,0,.07) 100%)";
const VINHETA = "radial-gradient(130% 100% at 50% 42%, rgba(0,0,0,0) 58%, rgba(0,0,0,.30) 100%)";
const VINHETA_CLARA = "radial-gradient(130% 100% at 50% 42%, rgba(0,0,0,0) 62%, rgba(0,0,0,.10) 100%)";
const LOMBADA = "linear-gradient(90deg, rgba(0,0,0,.38) 0, rgba(0,0,0,.12) 10px, rgba(0,0,0,0) 22px)";
const LOMBADA_CLARA = "linear-gradient(90deg, rgba(0,0,0,.16) 0, rgba(0,0,0,.05) 10px, rgba(0,0,0,0) 22px)";
const TODO = "100% 100%";

/** A constelação da capa Noite: 14 estrelas (as maiores com halo) espalhadas pela capa. */
const ESTRELA = (x: number, y: number, r: number, a: number, halo = 0) =>
  `radial-gradient(circle at ${x}% ${y}%, rgba(255,243,196,${a}) 0 ${r}px, rgba(255,243,196,${halo ? 0.28 : 0}) ${r + 0.6}px, rgba(255,243,196,0) ${r + (halo || 1.2)}px)`;
const ESTRELAS = [
  ESTRELA(80, 22, 1.5, 1, 6), ESTRELA(62, 63, 1.2, 0.95, 5), ESTRELA(89, 72, 1.1, 0.9, 4), ESTRELA(70, 42, 0.9, 0.8),
  ESTRELA(93, 47, 0.8, 0.85), ESTRELA(56, 27, 0.8, 0.7), ESTRELA(85, 88, 0.7, 0.7), ESTRELA(47, 74, 0.7, 0.6),
  ESTRELA(74, 80, 0.6, 0.6), ESTRELA(96, 30, 0.6, 0.55), ESTRELA(66, 12, 0.6, 0.6), ESTRELA(52, 48, 0.5, 0.5),
  ESTRELA(38, 88, 0.6, 0.55), ESTRELA(90, 60, 0.5, 0.5),
].join(", ");
const ESTRELAS_TAM = Array(14).fill("100% 100%").join(", ");

export const CAPAS: Record<CapaId, Capa> = {
  grafite: {
    nome: "Grafite", descricao: "couro grafite", bg: "#3a3b43", clara: false,
    camadas: `${LUZ_ESCURA}, ${LOMBADA}, ${VINHETA}, ${COURO_GRAO("rgba(255,255,255,.07)", "rgba(0,0,0,.30)")}`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, ${COURO_GRAO_TAM}`,
    chanfro: "rgba(255,255,255,.10)", costura: "rgba(233,198,90,.55)",
    prensaSombra: "rgba(0,0,0,.6)", prensaLuz: "rgba(255,255,255,.12)", rebaixo: "rgba(0,0,0,.32)",
    elastico: ["#a81f62", "#e0438f", "#6f1340"], papel: "#fbf6ea", papelMoldura: "rgba(43,43,47,.22)",
    amostra: "linear-gradient(135deg,#3a3b42,#26272c)",
  },
  vichy: {
    nome: "Vichy rosa", descricao: "tecido xadrez", bg: "#fff4f7", clara: true,
    camadas: `${LUZ_CLARA}, ${LOMBADA_CLARA}, ${VINHETA_CLARA}, repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgba(120,30,70,.05) 0 1px, transparent 1px 3px), repeating-linear-gradient(0deg, rgba(220,86,140,.46) 0 12px, transparent 12px 24px), repeating-linear-gradient(90deg, rgba(220,86,140,.46) 0 12px, transparent 12px 24px)`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, 6px 6px, 6px 6px, 24px 24px, 24px 24px`,
    chanfro: "rgba(120,30,70,.14)", costura: "rgba(140,40,80,.45)",
    prensaSombra: "rgba(120,30,70,.45)", prensaLuz: "rgba(255,255,255,.85)", rebaixo: "rgba(120,30,70,.13)",
    elastico: ["#b4245f", "#e0438f", "#7a1444"], papel: "#fffdf7", papelMoldura: "rgba(120,30,70,.28)",
    amostra: "repeating-conic-gradient(#ea8fb4 0 25%,#fff2f6 0 50%) 0 0/8px 8px",
  },
  salvia: {
    nome: "Sálvia", descricao: "linho verde-sálvia", bg: "#a9bea0", clara: true,
    camadas: `${LUZ_CLARA}, ${LOMBADA_CLARA}, ${VINHETA_CLARA}, repeating-linear-gradient(0deg, rgba(255,255,255,.26) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(30,60,30,.10) 0 1px, transparent 1px 3px), radial-gradient(ellipse 70% 45% at 50% 50%, rgba(255,255,255,.10), transparent 70%)`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, 3px 3px, 3px 3px, 41px 17px`,
    chanfro: "rgba(20,50,20,.14)", costura: "rgba(60,80,50,.45)",
    prensaSombra: "rgba(20,50,20,.45)", prensaLuz: "rgba(255,255,255,.75)", rebaixo: "rgba(20,50,20,.14)",
    elastico: ["#3f5f3c", "#6a8a62", "#283f26"], papel: "#fffdf5", papelMoldura: "rgba(43,43,47,.26)",
    amostra: "linear-gradient(135deg,#b9cab0,#9bb292)",
  },
  lavanda: {
    nome: "Lavanda", descricao: "veludo lilás", bg: "#b5a1dc", clara: true,
    camadas: `linear-gradient(120deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 34%, rgba(60,20,120,.16) 72%, rgba(255,255,255,.14) 100%), ${LOMBADA_CLARA}, ${VINHETA_CLARA}, radial-gradient(circle, rgba(255,255,255,.14) 0 .6px, transparent 1.1px)`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, 3px 3px`,
    chanfro: "rgba(60,30,110,.16)", costura: "rgba(80,50,130,.45)",
    prensaSombra: "rgba(60,30,110,.45)", prensaLuz: "rgba(255,255,255,.8)", rebaixo: "rgba(60,30,110,.14)",
    elastico: ["#4c2f8f", "#7a5bc4", "#2f1a5e"], papel: "#fffcf6", papelMoldura: "rgba(60,30,110,.26)",
    amostra: "linear-gradient(135deg,#c9b8ea,#a38dd0)",
  },
  kraft: {
    nome: "Kraft", descricao: "papel kraft", bg: "#c39664", clara: true,
    camadas: `${LUZ_CLARA}, ${LOMBADA_CLARA}, ${VINHETA_CLARA}, repeating-linear-gradient(97deg, rgba(255,255,255,.08) 0 2px, transparent 2px 9px), repeating-linear-gradient(172deg, rgba(60,30,0,.07) 0 1px, transparent 1px 6px), radial-gradient(circle at 30% 40%, rgba(255,255,255,.10) 0 14px, transparent 40px), radial-gradient(circle at 70% 70%, rgba(60,30,0,.06) 0 10px, transparent 36px)`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, 23px 23px, 17px 17px, 90px 90px, 110px 110px`,
    chanfro: "rgba(60,30,0,.16)", costura: "rgba(90,50,15,.45)",
    prensaSombra: "rgba(60,30,0,.45)", prensaLuz: "rgba(255,255,255,.6)", rebaixo: "rgba(60,30,0,.14)",
    elastico: ["#4a2e1b", "#7a5236", "#2d1a0e"], papel: "#fffcf4", papelMoldura: "rgba(60,30,0,.26)",
    amostra: "linear-gradient(135deg,#d2a977,#b4875a)",
  },
  marinho: {
    nome: "Marinho", descricao: "couro granulado azul-marinho", bg: "#283a5c", clara: false,
    camadas: `${LUZ_ESCURA}, ${LOMBADA}, ${VINHETA}, ${COURO_GRAO("rgba(150,180,230,.10)", "rgba(0,0,0,.34)")}`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, ${COURO_GRAO_TAM}`,
    chanfro: "rgba(255,255,255,.10)", costura: "rgba(233,198,90,.55)",
    prensaSombra: "rgba(0,0,0,.6)", prensaLuz: "rgba(255,255,255,.12)", rebaixo: "rgba(0,0,0,.32)",
    elastico: ["#9a6b20", "#d4a12f", "#6a4712"], papel: "#fbf6ea", papelMoldura: "rgba(43,43,47,.22)",
    amostra: "linear-gradient(135deg,#2b3d5e,#182338)",
  },
  bordo: {
    nome: "Bordô", descricao: "couro vinho · libera com 14 dias seguidos", bg: "#6e2036", clara: false,
    camadas: `${LUZ_ESCURA}, ${LOMBADA}, ${VINHETA}, ${COURO_GRAO("rgba(255,200,210,.09)", "rgba(0,0,0,.34)")}`,
    tamanhos: `${TODO}, ${TODO}, ${TODO}, ${COURO_GRAO_TAM}`,
    chanfro: "rgba(255,255,255,.10)", costura: "rgba(233,198,90,.6)",
    prensaSombra: "rgba(0,0,0,.6)", prensaLuz: "rgba(255,255,255,.12)", rebaixo: "rgba(0,0,0,.32)",
    elastico: ["#9a6b20", "#e2b64a", "#6a4712"], papel: "#fbf6ea", papelMoldura: "rgba(43,43,47,.22)",
    amostra: "linear-gradient(135deg,#6e2236,#45121f)",
  },
  noite: {
    nome: "Noite", descricao: "preto estrelado · libera com 30 dias seguidos", bg: "#1a1a21", clara: false,
    camadas: `${LUZ_ESCURA}, ${LOMBADA}, ${ESTRELAS}, radial-gradient(120% 90% at 75% 30%, rgba(90,70,140,.32), rgba(0,0,0,0) 60%), ${COURO_GRAO("rgba(255,255,255,.05)", "rgba(0,0,0,.4)", 11)}`,
    tamanhos: `${TODO}, ${TODO}, ${ESTRELAS_TAM}, ${TODO}, ${COURO_GRAO_TAM}`,
    chanfro: "rgba(255,255,255,.12)", costura: "rgba(233,198,90,.7)",
    prensaSombra: "rgba(0,0,0,.7)", prensaLuz: "rgba(255,255,255,.14)", rebaixo: "rgba(255,241,176,.10)",
    elastico: ["#9a6b20", "#e2b64a", "#6a4712"], papel: "#fbf6ea", papelMoldura: "rgba(43,43,47,.22)",
    amostra: "radial-gradient(circle at 70% 30%, #fff1b0 0 1px, transparent 2px), radial-gradient(circle at 35% 65%, #fff1b0 0 .8px, transparent 1.6px), linear-gradient(135deg,#1c1c22,#0c0c10)",
  },
};

/** Ordem no seletor: as 6 de saída, depois as que o tempo libera. */
export const ORDEM_CAPAS: CapaId[] = ["grafite", "vichy", "salvia", "lavanda", "kraft", "marinho", "bordo", "noite"];
export const ehCapa = (v: unknown): v is CapaId => typeof v === "string" && v in CAPAS;

export interface DadosCapa {
  nome: string;
  /** "julho de 2026" */
  membroDesde: string;
  dias: number;
  nivel: string;
}

/** Nome da etiqueta: até dois nomes, e só o primeiro quando os dois não cabem. */
export const nomeDaEtiqueta = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "Você";
  const dois = partes.slice(0, 2).join(" ");
  return dois.length <= 16 ? dois : partes[0];
};

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Medidas (as da peça aprovada, 398 × 300). */
const G = {
  w: 398, h: 300, esq: 14, raio: "5px 18px 18px 5px", sombra: "0 22px 44px -20px rgba(0,0,0,.65)",
  espiral: { n: 9, passo: 32, topo: 12, w: 13, h: 24, caixa: 30 },
  elastico: { dir: 40, w: 13, sobra: 3 },
  etiqueta: { esq: 48, topo: 34, w: 234, pad: "11px 14px 12px", raio: 5, moldura: 4, molduraRaio: 3, rot: 9.5, rotEsp: ".18em", nome: 31, nomeMt: 3, membro: 11.5, membroMt: 6 },
  fio: { esq: 318, topo: 140, w: 30, h: 40, d: "M28,6 C 22,16 14,24 7,34", traco: 1.6 },
  tag: { dir: 66, topo: 160, raio: "10px 4px 4px 10px", pad: "6px 18px 6px 11px", gap: 5, furo: 6, furoDir: 5, furoAnel: 1.5, chama: 16, num: 12.5, seg: 10.5 },
  selo: { esq: 48, base: 26, gap: 12, tam: 64, rotulo: 9.5, nome: 22, espaco: 1.9 },
  relevo: { dir: 70, base: 22, tam: 19 },
  costura: 9,
} as const;

/**
 * A espiral: argola dourada com o furo escuro aparecendo do lado — exatamente
 * como na peça aprovada (a argola fica no canto da caixa, 14 px antes do
 * tecido, e o furo aparece como a sombra do arame entrando).
 */
export const Espiral = ({ f: _f }: { f?: "app" } = {}) => {
  const { n, passo, topo, w, h, caixa } = G.espiral;
  // na foto do WebKit a sombrinha da argola girada vira um halo escuro em cima: sai
  const semSombra = useContext(FotoWebKit);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: caixa }} aria-hidden data-espiral="">
      {Array.from({ length: n }, (_, i) => {
        const y = topo + i * passo;
        return (
          <div key={i}>
            <i style={{ position: "absolute", left: w * 0.25, top: y + h * 0.3, width: w * 0.5, height: h * 0.4, borderRadius: "50%", background: "#101114", boxShadow: "inset 0 1px 2px rgba(0,0,0,.9)" }} />
            {/* .capa-argola / --i: a entrada da tela acende as argolas em sequência */}
            <i className="capa-argola" style={{ position: "absolute", left: -w * 0.5, top: y, width: w, height: h, borderRadius: "50%", borderStyle: "solid", borderWidth: Math.max(2.5, w * 0.26), borderColor: "#fbe7a8 #c9932a #8f6a0c #e8c463", boxShadow: semSombra ? "none" : "0 1px 2px rgba(0,0,0,.6)", transform: "rotate(-10deg)", boxSizing: "border-box", "--i": i } as CSSProperties} />
          </div>
        );
      })}
    </div>
  );
};

/** Furos e argolas: `y` de cada argola (pra página do planner alinhar os furos). */
export const ARGOLAS_APP = Array.from({ length: G.espiral.n }, (_, i) => G.espiral.topo + i * G.espiral.passo + G.espiral.h * 0.5);

/**
 * HOT STAMPING: texto em foil (degradê diagonal) prensado no material —
 * sombra da prensa pra cima/esquerda, luz pra baixo/direita, contorno fino.
 * SVG (o `background-clip: text` não sai na foto do Safari).
 */
export const HotStamp = ({ texto, paradas, tamanho, peso = 900, espaco = 0, sombra, luz, contorno, largura, altura, style, fonte, italico, contornoFino }: {
  texto: string; paradas: string[]; tamanho: number; peso?: number; espaco?: number; sombra: string; luz: string;
  /** Contorno escuro do metal (tom do próprio metal): a leitura em capa clara e escura. */
  contorno?: string; largura: number; altura: number; style?: CSSProperties;
  /** Outra fonte (a capa do álbum grava o título em serif itálico). */
  fonte?: string; italico?: boolean;
  /** Contorno mais fino (serif): o traço grosso engole a letra. */
  contornoFino?: boolean;
}) => {
  const uid = `hs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const fotoWebKit = useContext(FotoWebKit);
  return (
    <svg width={largura} height={altura} style={{ overflow: "visible", display: "block", filter: fotoWebKit ? undefined : `drop-shadow(0 -0.6px 0 ${sombra}) drop-shadow(0 0.7px 0 ${luz})`, ...style }} aria-hidden>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          {paradas.map((c, i) => <stop key={i} offset={i / (paradas.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <text x="0" y={tamanho * 0.86} fontFamily={fonte ?? INTER} fontStyle={italico ? "italic" : undefined} fontSize={tamanho} fontWeight={peso} letterSpacing={espaco} fill={`url(#${uid})`} stroke={contorno ?? sombra} strokeWidth={contorno ? (contornoFino ? Math.max(0.7, tamanho * 0.04) : Math.max(1.1, tamanho * 0.075)) : 0.35} strokeLinejoin="round" paintOrder="stroke">
        {texto}
      </text>
    </svg>
  );
};

/** "NÍVEL" + nome do nível, os dois no METAL do nível (igual em toda capa) com o contorno escuro do mesmo metal. */
const NivelPrensado = ({ nivel, c }: { nivel: string; c: Capa }) => {
  const g = gravacaoDoNivel(nivel);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }} data-nivel-capa="">
      <HotStamp texto="NÍVEL" paradas={g.paradas} contorno={g.contorno} tamanho={G.selo.rotulo} peso={800} espaco={G.selo.espaco} sombra={c.prensaSombra} luz={c.prensaLuz} largura={G.selo.nome * 5.2} altura={G.selo.rotulo * 1.15} />
      <HotStamp texto={nivel} paradas={g.paradas} contorno={g.contorno} tamanho={G.selo.nome} peso={800} espaco={-0.01 * G.selo.nome} sombra={c.prensaSombra} luz={c.prensaLuz} largura={G.selo.nome * 5.2} altura={G.selo.nome * 1.1} />
    </div>
  );
};

interface CapaPlannerProps extends DadosCapa {
  capa: CapaId;
  /** Mantido por compatibilidade (só existe o formato do app). */
  formato?: "app";
  /** Toque no selo (abre o progresso do nível). */
  onSelo?: () => void;
  /** Sem a espiral (o planner aberto desenha a espiral numa camada própria). */
  semEspiral?: boolean;
}

/** A capa no tamanho de desenho (398×300). Quem escala é o CapaResponsiva. */
export const CapaPlanner = ({ capa, nome, membroDesde, dias, nivel, onSelo, semEspiral }: CapaPlannerProps) => {
  const c = CAPAS[capa] ?? CAPAS.grafite;
  // a tag "13 dias" dá um pulinho quando o número muda com a capa na tela (não na 1ª pintura)
  const diasIniciais = useRef(dias);
  const tagPula = diasIniciais.current !== dias;
  const fotoWebKit = useContext(FotoWebKit);
  const etiqueta = nomeDaEtiqueta(nome);
  // nome comprido encolhe um pouco pra caber na etiqueta
  const tamNome = etiqueta.length > 13 ? G.etiqueta.nome * 0.84 : G.etiqueta.nome;
  const [e0, e1, e2] = c.elastico;
  const selo = (
    <>
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: G.selo.tam + 10, height: G.selo.tam + 10 }}>
        {/* o rebaixo: a insígnia assenta num círculo prensado no material */}
        <i aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: c.rebaixo, boxShadow: `inset 0 1px 2px ${c.prensaSombra}, 0 0.7px 0 ${c.prensaLuz}` }} />
        <span style={{ position: "relative", display: "block", lineHeight: 0 }}><SeloNivel nivel={nivel} tamanho={G.selo.tam} /></span>
      </span>
      <NivelPrensado nivel={nivel} c={c} />
    </>
  );
  const estiloSelo: CSSProperties = { position: "absolute", left: G.selo.esq - 5, bottom: G.selo.base - 5, display: "flex", alignItems: "center", gap: G.selo.gap - 3 };

  return (
    <div
      data-capa={capa}
      data-material=""
      style={{ position: "relative", width: G.w, height: G.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased", color: "#2b2b2f" }}
    >
      {/* foto do WebKit: a sombra grande da capa sai recortada — vai desenhada, num degradê por baixo */}
      {fotoWebKit && (
        <div aria-hidden style={{ position: "absolute", left: G.esq - G.w * 0.02, right: -G.w * 0.02, bottom: -G.h * 0.12, height: G.h * 0.3, background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,.34) 0%, rgba(0,0,0,.16) 45%, rgba(0,0,0,0) 100%)" }} />
      )}
      {/* o MATERIAL: cor + camadas de textura e luz; chanfro na borda */}
      <div
        data-superficie=""
        style={{
          position: "absolute", left: G.esq, top: 0, right: 0, bottom: 0, borderRadius: G.raio,
          backgroundColor: c.bg, backgroundImage: c.camadas, backgroundSize: c.tamanhos, backgroundRepeat: "repeat",
          boxShadow: fotoWebKit
            ? `inset 0 0 0 1px ${c.chanfro}`
            : `${G.sombra}, inset 1px 1px 0 ${c.clara ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.16)"}, inset -1px -1px 0 ${c.clara ? "rgba(0,0,0,.12)" : "rgba(0,0,0,.45)"}, inset 0 0 0 1px ${c.chanfro}`,
        }}
      />
      {/* a COSTURA no fio da capa (sombra do ponto + o fio) */}
      <div aria-hidden style={{ position: "absolute", left: G.esq + G.costura, top: G.costura, right: G.costura, bottom: G.costura, borderRadius: "3px 12px 12px 3px", border: `1.4px dashed ${c.prensaSombra}`, transform: "translateY(.6px)", opacity: 0.55, pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", left: G.esq + G.costura, top: G.costura, right: G.costura, bottom: G.costura, borderRadius: "3px 12px 12px 3px", border: `1.4px dashed ${c.costura}`, pointerEvents: "none" }} />
      {!semEspiral && <Espiral />}
      {/* ELÁSTICO tecido */}
      <div
        className="capa-elastico"
        style={{
          position: "absolute", top: -G.elastico.sobra, bottom: -G.elastico.sobra, right: G.elastico.dir, width: G.elastico.w,
          backgroundColor: e0,
          backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, rgba(0,0,0,0) 1px 3px), linear-gradient(90deg, ${e2} 0%, ${e0} 28%, ${e1} 50%, ${e0} 72%, ${e2} 100%)`,
          boxShadow: "-3px 0 8px rgba(0,0,0,.42), inset 0 0 0 .5px rgba(0,0,0,.25)",
        }}
      />
      {/* ETIQUETA de papel */}
      <div
        style={{
          position: "absolute", left: G.etiqueta.esq, top: G.etiqueta.topo, width: G.etiqueta.w, boxSizing: "border-box",
          background: c.papel, backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.018) 0 1px, transparent 1px 3px)", padding: G.etiqueta.pad, borderRadius: G.etiqueta.raio,
          boxShadow: fotoWebKit ? "0 2px 3px rgba(0,0,0,.4)" : "0 1px 1px rgba(0,0,0,.22), 0 2px 2px rgba(0,0,0,.12), 0 10px 18px -8px rgba(0,0,0,.6)", transform: "rotate(-1.2deg)",
        }}
      >
        <div style={{ position: "absolute", inset: G.etiqueta.moldura, border: `1px solid ${c.papelMoldura}`, borderRadius: G.etiqueta.molduraRaio, pointerEvents: "none" }} />
        <div style={{ fontSize: G.etiqueta.rot, fontWeight: 800, letterSpacing: G.etiqueta.rotEsp, color: "#8c8272", textTransform: "uppercase", lineHeight: 1.2 }}>Planner de</div>
        <div
          data-nome-capa=""
          style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: tamNome, lineHeight: 1.05, color: "#2b2b2f", marginTop: G.etiqueta.nomeMt, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {etiqueta}
        </div>
        <div style={{ fontSize: G.etiqueta.membro, color: "#6f665a", marginTop: G.etiqueta.membroMt, fontWeight: 500, lineHeight: 1.25 }}>membro desde {membroDesde}</div>
      </div>
      {/* fio da tag, saindo do elástico */}
      <svg style={{ position: "absolute", left: G.fio.esq, top: G.fio.topo, width: G.fio.w, height: G.fio.h, overflow: "visible" }} aria-hidden>
        <path d={G.fio.d} fill="none" stroke="#e9d8b8" strokeWidth={G.fio.traco} />
      </svg>
      {/* a TAG da sequência (o fogo muda de cor com os dias) */}
      <div
        className="capa-tag"
        data-tag-sequencia=""
        style={{
          position: "absolute", right: G.tag.dir, top: G.tag.topo, background: c.papel, borderRadius: G.tag.raio, padding: G.tag.pad,
          transform: "rotate(-6deg)", transformOrigin: "right center", boxShadow: fotoWebKit ? "0 2px 3px rgba(0,0,0,.4)" : "0 1px 1px rgba(0,0,0,.2), 0 6px 12px -6px rgba(0,0,0,.7)", display: "flex", alignItems: "center", gap: G.tag.gap, whiteSpace: "nowrap",
        }}
      >
        <i style={{ position: "absolute", right: G.tag.furoDir, top: "50%", marginTop: -G.tag.furo / 2, width: G.tag.furo, height: G.tag.furo, borderRadius: "50%", background: c.bg, boxShadow: `inset 0 0 0 ${G.tag.furoAnel}px #d6c7a3` }} />
        <Fogo dias={dias} tamanho={G.tag.chama} semBrilho={fotoWebKit} />
        {dias > 0 ? (
          <>
            <span key={dias} className={tagPula ? "capa-tag-pula" : undefined} data-tag-dias="" style={{ fontSize: G.tag.num, fontWeight: 800, color: "#2b2b2f", fontVariantNumeric: "tabular-nums" }}>
              {dias} {dias === 1 ? "dia" : "dias"}
            </span>
            <span style={{ fontSize: G.tag.seg, color: "#6f665a", fontWeight: 600 }}>{dias === 1 ? "seguido" : "seguidos"}</span>
          </>
        ) : (
          <span style={{ fontSize: G.tag.num, fontWeight: 800, color: "#2b2b2f" }}>comece hoje</span>
        )}
      </div>
      {/* selo do nível (tocável: abre o progresso) */}
      {onSelo ? (
        <button type="button" onClick={onSelo} aria-label={`Nível ${nivel} — ver progresso`} style={{ ...estiloSelo, background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
          {selo}
        </button>
      ) : (
        <div style={estiloSelo}>{selo}</div>
      )}
      {/* a marca "core" em hot stamping */}
      <div aria-hidden data-marca-core="" style={{ position: "absolute", right: G.relevo.dir, bottom: G.relevo.base, lineHeight: 0 }}>
        <HotStamp texto="core" paradas={gravacaoDoNivel(nivel).paradas} contorno={gravacaoDoNivel(nivel).contorno} tamanho={G.relevo.tam} peso={900} espaco={-0.03 * G.relevo.tam} sombra={c.prensaSombra} luz={c.prensaLuz} largura={G.relevo.tam * 2.4} altura={G.relevo.tam * 1.05} />
      </div>
    </div>
  );
};

/** A capa escalada pra largura disponível (430 → 398 px; 360 → 328 px) — ou pra `largura` fixa. */
export const CapaResponsiva = ({ largura: fixa, ...props }: Omit<CapaPlannerProps, "formato"> & { largura?: number }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(() =>
    fixa ?? (typeof window === "undefined" ? G.w : Math.min(G.w, Math.max(240, window.innerWidth - 32))),
  );
  useLayoutEffect(() => {
    if (fixa) return;
    const el = caixa.current;
    if (el && el.clientWidth) setLargura(el.clientWidth);
  }, [fixa]);
  useEffect(() => {
    if (fixa) return;
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (el.clientWidth) setLargura(el.clientWidth); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixa]);
  const k = Math.min(1, (fixa ?? largura) / G.w);
  return (
    <div ref={caixa} style={{ width: fixa ?? "100%", maxWidth: G.w, height: G.h * k, margin: "0 auto" }}>
      <div style={{ width: G.w, height: G.h, transform: `scale(${k})`, transformOrigin: "top left" }}>
        <CapaPlanner {...props} />
      </div>
    </div>
  );
};

/** A amostra do seletor: um quadradinho do material (textura de verdade, em escala). */
export const AmostraDaCapa = ({ capa, tamanho = 22, style }: { capa: CapaId; tamanho?: number; style?: CSSProperties }) => {
  const c = CAPAS[capa] ?? CAPAS.grafite;
  return (
    <i
      aria-hidden
      data-amostra={capa}
      style={{
        display: "block", width: tamanho, height: tamanho, borderRadius: tamanho * 0.28, backgroundColor: c.bg, backgroundImage: c.camadas, backgroundSize: c.tamanhos.replace(/100% 100%/g, `${tamanho}px ${tamanho}px`), backgroundRepeat: "repeat",
        boxShadow: `inset 0 0 0 1px ${c.chanfro}, inset 1px 1px 0 ${c.clara ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.14)"}`,
        ...style,
      }}
    />
  );
};

export const MEDIDAS_CAPA = { app: { w: G.w, h: G.h } };
