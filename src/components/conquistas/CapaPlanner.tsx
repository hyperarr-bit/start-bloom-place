import "@fontsource/instrument-serif/latin-400-italic.css";
import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Flame } from "lucide-react";
import { NivelEmFoil, SeloNivel } from "./SeloNivel";
import { FotoWebKit } from "./foto-contexto";

/**
 * CAPA DO PLANNER (C2, aprovada 26/09) — o cartão de membro virou a capa de
 * um planner: espiral dourada, elástico, etiqueta com o nome, a tag da
 * sequência pendurada no elástico e o selo do nível em foil.
 *
 * É um OBJETO: fica igual no claro e no escuro. Por isso tudo aqui é cor
 * fixa em estilo inline — classe de cor do Tailwind seria remapeada pelo
 * modo escuro (styles/escuro.css) e a capa mudaria de cor à noite.
 *
 * Dois formatos com a mesma peça: "app" (deitada, 398×300, escalada pra
 * largura da tela) e "stories" (em pé, 760×1080, dentro da arte 1080×1920).
 */

export type CapaId = "grafite" | "vichy" | "salvia" | "lavanda" | "kraft" | "marinho";

export interface Capa {
  nome: string;
  bg: string;
  /** Trama do tecido (tamanho base em px; nos Stories multiplica por 2,4). */
  texBase: number;
  tex: string;
  elastico: string;
  relevoCor: string;
  relevoSombra: string;
  borda: string;
  /** Capa clara: o "NÍVEL Ouro" em foil escurece pra não sumir. */
  clara: boolean;
  /** Bolinha do seletor. */
  amostra: string;
  /** Fundo da arte dos Stories (a "mesa" onde o planner está). */
  mesa: string;
  rodape: string;
}

const MAGENTA = "linear-gradient(90deg,#a81f62,#e0438f 45%,#a81f62)";
const TRAMA_ESCURA = "linear-gradient(0deg, rgba(255,255,255,.05) 0 34%, transparent 34%), linear-gradient(90deg, rgba(255,255,255,.04) 0 34%, transparent 34%)";
const TRAMA_CLARA = "linear-gradient(0deg, rgba(255,255,255,.16) 0 34%, transparent 34%), linear-gradient(90deg, rgba(255,255,255,.10) 0 34%, transparent 34%)";
const RELEVO_ESCURO = "0 1px 0 rgba(255,255,255,.10), 0 -1px 0 rgba(0,0,0,.55)";

export const CAPAS: Record<CapaId, Capa> = {
  grafite: {
    nome: "Grafite", bg: "#2f3036", texBase: 3, tex: TRAMA_ESCURA, elastico: MAGENTA,
    relevoCor: "rgba(255,255,255,.16)", relevoSombra: RELEVO_ESCURO, borda: "rgba(255,255,255,.06)", clara: false,
    amostra: "#2f3036", mesa: "linear-gradient(180deg,#f3e6e9 0%,#ecdde3 100%)", rodape: "#8c7a80",
  },
  vichy: {
    nome: "Vichy rosa", bg: "#fde9ef", texBase: 20,
    tex: "linear-gradient(0deg, rgba(226,106,150,.30) 0 50%, transparent 50%), linear-gradient(90deg, rgba(226,106,150,.30) 0 50%, transparent 50%)",
    elastico: "linear-gradient(90deg,#1c1c20,#3b3b42 45%,#1c1c20)",
    relevoCor: "rgba(120,40,70,.30)", relevoSombra: "0 1px 0 rgba(255,255,255,.6), 0 -1px 0 rgba(0,0,0,.12)", borda: "rgba(0,0,0,.06)", clara: true,
    amostra: "repeating-conic-gradient(#f4b6c8 0 25%,#fde7ee 0 50%) 0 0/8px 8px", mesa: "linear-gradient(180deg,#eef1e6 0%,#e4e9db 100%)", rodape: "#7d8672",
  },
  salvia: {
    nome: "Sálvia", bg: "#b3c6ab", texBase: 3, tex: TRAMA_CLARA, elastico: MAGENTA,
    relevoCor: "rgba(20,50,20,.24)", relevoSombra: "0 1px 0 rgba(255,255,255,.45), 0 -1px 0 rgba(0,0,0,.15)", borda: "rgba(0,0,0,.06)", clara: true,
    amostra: "#b9c9b3", mesa: "linear-gradient(180deg,#f6ece4 0%,#efe1d6 100%)", rodape: "#8f7b6d",
  },
  lavanda: {
    nome: "Lavanda", bg: "#c9bce6", texBase: 3, tex: TRAMA_CLARA, elastico: MAGENTA,
    relevoCor: "rgba(60,30,110,.24)", relevoSombra: "0 1px 0 rgba(255,255,255,.45), 0 -1px 0 rgba(0,0,0,.15)", borda: "rgba(0,0,0,.06)", clara: true,
    amostra: "#cdbfe8", mesa: "linear-gradient(180deg,#f4efe2 0%,#ece5d3 100%)", rodape: "#8d8367",
  },
  kraft: {
    nome: "Kraft", bg: "#c9a97e", texBase: 5,
    tex: "linear-gradient(0deg, rgba(255,255,255,.08) 0 20%, transparent 20%), linear-gradient(90deg, rgba(0,0,0,.05) 0 20%, transparent 20%)",
    elastico: MAGENTA,
    relevoCor: "rgba(70,40,10,.30)", relevoSombra: "0 1px 0 rgba(255,255,255,.35), 0 -1px 0 rgba(0,0,0,.2)", borda: "rgba(0,0,0,.08)", clara: true,
    amostra: "#c7a77c", mesa: "linear-gradient(180deg,#e9eef2 0%,#dde5eb 100%)", rodape: "#7a8894",
  },
  marinho: {
    nome: "Marinho", bg: "#22304a", texBase: 3, tex: TRAMA_ESCURA, elastico: MAGENTA,
    relevoCor: "rgba(255,255,255,.16)", relevoSombra: RELEVO_ESCURO, borda: "rgba(255,255,255,.06)", clara: false,
    amostra: "#22304a", mesa: "linear-gradient(180deg,#f5eee4 0%,#ede3d5 100%)", rodape: "#8f806d",
  },
};

export const ORDEM_CAPAS: CapaId[] = ["grafite", "vichy", "salvia", "lavanda", "kraft", "marinho"];
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

type Formato = "app" | "stories";

/** Medidas de cada formato (tiradas do mockup aprovado). */
const G = {
  app: {
    w: 398, h: 300, esq: 14, raio: "5px 18px 18px 5px", sombra: "0 22px 44px -20px rgba(0,0,0,.65)", inset: 1, texMult: 1,
    espiral: { n: 9, passo: 32, topo: 12, w: 13, h: 24, caixa: 30 },
    elastico: { dir: 40, w: 13, sobra: 3, sombra: "-3px 0 8px rgba(0,0,0,.4)" },
    etiqueta: { esq: 48, topo: 34, w: 234, pad: "11px 14px 12px", raio: 5, sombra: "0 10px 18px -10px rgba(0,0,0,.8)", moldura: 4, molduraW: 1, molduraRaio: 3, rot: 9.5, rotEsp: ".18em", nome: 31, nomeMt: 3, membro: 11.5, membroMt: 6 },
    fio: { esq: 318, topo: 140, w: 30, h: 40, d: "M28,6 C 22,16 14,24 7,34", traco: 1.6 },
    tag: { dir: 66, topo: 160, raio: "10px 4px 4px 10px", pad: "6px 18px 6px 11px", sombra: "0 6px 12px -6px rgba(0,0,0,.7)", gap: 5, furo: 6, furoDir: 5, furoAnel: 1.5, chama: 14, num: 12.5, seg: 10.5 },
    selo: { esq: 48, base: 26, gap: 12, tam: 64, rotulo: 9.5, nome: 22, espaco: 1.9 },
    relevo: { dir: 70, base: 22, tam: 19 },
  },
  stories: {
    w: 760, h: 1080, esq: 34, raio: "10px 44px 44px 10px", sombra: "0 60px 90px -40px rgba(0,0,0,.6)", inset: 2, texMult: 2.4,
    espiral: { n: 13, passo: 82, topo: 28, w: 32, h: 60, caixa: 70 },
    elastico: { dir: 96, w: 30, sobra: 8, sombra: "-6px 0 18px rgba(0,0,0,.45)" },
    etiqueta: { esq: 112, topo: 112, w: 470, pad: "28px 34px 30px", raio: 12, sombra: "0 24px 40px -22px rgba(0,0,0,.8)", moldura: 10, molduraW: 2, molduraRaio: 7, rot: 22, rotEsp: ".2em", nome: 74, nomeMt: 8, membro: 26, membroMt: 14 },
    fio: { esq: 576, topo: 500, w: 70, h: 100, d: "M60,12 C 46,40 30,62 12,90", traco: 3.5 },
    tag: { dir: 150, topo: 560, raio: "24px 10px 10px 24px", pad: "16px 44px 16px 28px", sombra: "0 16px 28px -14px rgba(0,0,0,.8)", gap: 12, furo: 14, furoDir: 14, furoAnel: 3, chama: 32, num: 32, seg: 24 },
    selo: { esq: 112, base: 96, gap: 28, tam: 168, rotulo: 24, nome: 60, espaco: 5.3 },
    relevo: { dir: 170, base: 90, tam: 52 },
  },
} as const;

/**
 * A espiral: argola dourada com o furo escuro aparecendo do lado — exatamente
 * como na peça aprovada (lá a argola fica no canto da caixa, 14 px antes do
 * tecido, e o furo aparece como a sombra do arame entrando).
 */
const Espiral = ({ f }: { f: Formato }) => {
  const { n, passo, topo, w, h, caixa } = G[f].espiral;
  // na foto do WebKit a sombrinha da argola girada vira um halo escuro em cima: sai
  const semSombra = useContext(FotoWebKit);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: caixa }} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const y = topo + i * passo;
        return (
          <div key={i}>
            <i style={{ position: "absolute", left: w * 0.25, top: y + h * 0.3, width: w * 0.5, height: h * 0.4, borderRadius: "50%", background: "#101114", boxShadow: "inset 0 1px 2px rgba(0,0,0,.9)" }} />
            <i style={{ position: "absolute", left: -w * 0.5, top: y, width: w, height: h, borderRadius: "50%", borderStyle: "solid", borderWidth: Math.max(2.5, w * 0.26), borderColor: "#fbe7a8 #c9932a #8f6a0c #e8c463", boxShadow: semSombra ? "none" : "0 1px 2px rgba(0,0,0,.6)", transform: "rotate(-10deg)", boxSizing: "border-box" }} />
          </div>
        );
      })}
    </div>
  );
};

interface CapaPlannerProps extends DadosCapa {
  capa: CapaId;
  formato?: Formato;
  /** Toque no selo (abre o progresso do nível). Só no app. */
  onSelo?: () => void;
}

/** A capa no tamanho de desenho (398×300 ou 760×1080). Quem escala é o CapaResponsiva. */
export const CapaPlanner = ({ capa, formato = "app", nome, membroDesde, dias, nivel, onSelo }: CapaPlannerProps) => {
  const c = CAPAS[capa] ?? CAPAS.grafite;
  const g = G[formato];
  const tex = g.texMult * c.texBase;
  const fotoWebKit = useContext(FotoWebKit);
  const etiqueta = nomeDaEtiqueta(nome);
  // nome comprido encolhe um pouco pra caber na etiqueta
  const tamNome = etiqueta.length > 13 ? g.etiqueta.nome * 0.84 : g.etiqueta.nome;
  const selo = (
    <>
      <SeloNivel nivel={nivel} tamanho={g.selo.tam} />
      <NivelEmFoil nivel={nivel} capaClara={c.clara} rotulo={g.selo.rotulo} nome={g.selo.nome} espaco={g.selo.espaco} />
    </>
  );
  const estiloSelo: CSSProperties = { position: "absolute", left: g.selo.esq, bottom: g.selo.base, display: "flex", alignItems: "center", gap: g.selo.gap };

  return (
    <div
      data-capa={capa}
      style={{ position: "relative", width: g.w, height: g.h, fontFamily: INTER, WebkitFontSmoothing: "antialiased", color: "#2b2b2f" }}
    >
      {/* foto do WebKit: a sombra grande da capa sai recortada — vai desenhada, num degradê por baixo */}
      {fotoWebKit && (
        <div
          aria-hidden
          style={{
            position: "absolute", left: g.esq - g.w * 0.02, right: -g.w * 0.02, bottom: -g.h * 0.12, height: g.h * 0.3,
            background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,.34) 0%, rgba(0,0,0,.16) 45%, rgba(0,0,0,0) 100%)",
          }}
        />
      )}
      {/* superfície (tecido) */}
      <div
        style={{
          position: "absolute", left: g.esq, top: 0, right: 0, bottom: 0, borderRadius: g.raio,
          // tamanho por CAMADA: com um valor só, a foto do WebKit (iPhone) não repetia a 2ª camada da trama
          backgroundColor: c.bg, backgroundImage: c.tex, backgroundSize: `${tex}px ${tex}px, ${tex}px ${tex}px`, backgroundRepeat: "repeat, repeat",
          boxShadow: fotoWebKit ? `inset 0 0 0 ${g.inset}px ${c.borda}` : `${g.sombra}, inset 0 0 0 ${g.inset}px ${c.borda}`,
        }}
      />
      <Espiral f={formato} />
      {/* elástico */}
      <div style={{ position: "absolute", top: -g.elastico.sobra, bottom: -g.elastico.sobra, right: g.elastico.dir, width: g.elastico.w, background: c.elastico, boxShadow: g.elastico.sombra }} />
      {/* etiqueta */}
      <div
        style={{
          position: "absolute", left: g.etiqueta.esq, top: g.etiqueta.topo, width: g.etiqueta.w, boxSizing: "border-box",
          background: "#fbf6ea", padding: g.etiqueta.pad, borderRadius: g.etiqueta.raio, boxShadow: g.etiqueta.sombra, transform: "rotate(-1.2deg)",
        }}
      >
        <div style={{ position: "absolute", inset: g.etiqueta.moldura, border: `${g.etiqueta.molduraW}px solid rgba(43,43,47,.22)`, borderRadius: g.etiqueta.molduraRaio, pointerEvents: "none" }} />
        <div style={{ fontSize: g.etiqueta.rot, fontWeight: 800, letterSpacing: g.etiqueta.rotEsp, color: "#8c8272", textTransform: "uppercase", lineHeight: 1.2 }}>Planner de</div>
        <div
          data-nome-capa=""
          style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: tamNome, lineHeight: 1.05, color: "#2b2b2f", marginTop: g.etiqueta.nomeMt, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {etiqueta}
        </div>
        <div style={{ fontSize: g.etiqueta.membro, color: "#6f665a", marginTop: g.etiqueta.membroMt, fontWeight: 500, lineHeight: 1.25 }}>membro desde {membroDesde}</div>
      </div>
      {/* fio da tag, saindo do elástico */}
      <svg style={{ position: "absolute", left: g.fio.esq, top: g.fio.topo, width: g.fio.w, height: g.fio.h, overflow: "visible" }} aria-hidden>
        <path d={g.fio.d} fill="none" stroke="#e9d8b8" strokeWidth={g.fio.traco} />
      </svg>
      {/* tag da sequência */}
      <div
        style={{
          position: "absolute", right: g.tag.dir, top: g.tag.topo, background: "#f3e9d2", borderRadius: g.tag.raio, padding: g.tag.pad,
          transform: "rotate(-6deg)", transformOrigin: "right center", boxShadow: g.tag.sombra, display: "flex", alignItems: "center", gap: g.tag.gap, whiteSpace: "nowrap",
        }}
      >
        <i style={{ position: "absolute", right: g.tag.furoDir, top: "50%", marginTop: -g.tag.furo / 2, width: g.tag.furo, height: g.tag.furo, borderRadius: "50%", background: c.bg, boxShadow: `inset 0 0 0 ${g.tag.furoAnel}px #d6c7a3` }} />
        <Flame style={{ width: g.tag.chama, height: g.tag.chama, color: "#ea580c", flexShrink: 0 }} strokeWidth={2.2} aria-hidden />
        {dias > 0 ? (
          <>
            <span style={{ fontSize: g.tag.num, fontWeight: 800, color: "#2b2b2f", fontVariantNumeric: "tabular-nums" }}>
              {dias} {dias === 1 ? "dia" : "dias"}
            </span>
            <span style={{ fontSize: g.tag.seg, color: "#6f665a", fontWeight: 600 }}>{dias === 1 ? "seguido" : "seguidos"}</span>
          </>
        ) : (
          <span style={{ fontSize: g.tag.num, fontWeight: 800, color: "#2b2b2f" }}>comece hoje</span>
        )}
      </div>
      {/* selo do nível (no app, tocável: abre o progresso) */}
      {onSelo && formato === "app" ? (
        <button type="button" onClick={onSelo} aria-label={`Nível ${nivel} — ver progresso`} style={{ ...estiloSelo, background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
          {selo}
        </button>
      ) : (
        <div style={estiloSelo}>{selo}</div>
      )}
      {/* marca em baixo-relevo */}
      <div aria-hidden style={{ position: "absolute", right: g.relevo.dir, bottom: g.relevo.base, fontSize: g.relevo.tam, fontWeight: 900, letterSpacing: "-.03em", color: c.relevoCor, textShadow: c.relevoSombra, lineHeight: 1 }}>
        core
      </div>
    </div>
  );
};

/** A capa do app escalada pra largura disponível (430 → 398 px; 360 → 328 px). */
export const CapaResponsiva = (props: Omit<CapaPlannerProps, "formato">) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(() =>
    typeof window === "undefined" ? G.app.w : Math.min(G.app.w, Math.max(240, window.innerWidth - 32)),
  );
  useLayoutEffect(() => {
    const el = caixa.current;
    if (el && el.clientWidth) setLargura(el.clientWidth);
  }, []);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (el.clientWidth) setLargura(el.clientWidth); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = Math.min(1, largura / G.app.w);
  return (
    <div ref={caixa} style={{ width: "100%", maxWidth: G.app.w, height: G.app.h * k, margin: "0 auto" }}>
      <div style={{ width: G.app.w, height: G.app.h, transform: `scale(${k})`, transformOrigin: "top left" }}>
        <CapaPlanner {...props} formato="app" />
      </div>
    </div>
  );
};

export const MEDIDAS_CAPA = { app: { w: G.app.w, h: G.app.h }, stories: { w: G.stories.w, h: G.stories.h } };
