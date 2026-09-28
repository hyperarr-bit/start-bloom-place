import { useId, type CSSProperties, type ReactNode } from "react";
import { Adesivo as AdesivoDasConquistas } from "@/components/conquistas/adesivos-arte";
import { nomeDaCapa, type ConteudoDoCard, type TipoDoFato } from "@/lib/retrospectiva";
import { CountUp, INTER, SERIF, tamanhoQueCabe, useFontesProntas, useMedidas } from "./prancheta";
import { Cadeado } from "./pecas-planner";
import { Adesivo, COR_DO_ADESIVO_DE_TREINO, type TipoDeAdesivo } from "./adesivos-recortes";
import { fraseDoHabito, fraseDosDiasSemGasto, linhaDoMeuMes, numeroDaEdicao } from "./temas";
import { contagemDoHumor, diaDoInicio, diasDaCapaCurta, fraseDoFecho, horas, legendaDoSono, partesDoSentir } from "./paginas-comuns";
import { BotaoDosValores, TextoDosValores } from "./tema-paginas";
import type { Base, Moldura, PaginaPronta, Pele, PropsDinheiro, PropsFato, PropsFecho, PropsFoco } from "./pele";

/**
 * TEMA "Recortes" (26/09) — o scrapbook: polaroid com o número como foto,
 * rotulador (dymo), fita washi, papel rasgado, ingresso, cupom, post-it e
 * adesivos próprios. Cada página num papel (kraft, menta, manteiga, céu,
 * lavanda, caderno, vichy). Medidas do d2.html do designer.
 */

const R = { grafite: "#232327", magenta: "#d22d80", indigo: "#4f46e5", papel: "#fffaf0", rot: "#7a7263", tinta2: "#6b6357" } as const;

type Papel = "kraft" | "menta" | "manteiga" | "vichy" | "mesa" | "ceu" | "lavanda" | "caderno";
const PAPEL: Record<Papel, CSSProperties> = {
  kraft: {
    backgroundColor: "#d5b787",
    backgroundImage: "radial-gradient(rgba(255,255,255,.18) 1px, transparent 1.4px), radial-gradient(rgba(90,60,20,.16) 1px, transparent 1.4px)",
    backgroundSize: "9px 9px, 13px 13px", backgroundPosition: "0 0, 4px 6px",
  },
  menta: { backgroundColor: "#d9efe2", backgroundImage: "radial-gradient(rgba(20,90,50,.22) 1.2px, transparent 1.5px)", backgroundSize: "18px 18px", backgroundPosition: "9px 9px" },
  manteiga: {
    backgroundColor: "#fbeaa6",
    backgroundImage: "linear-gradient(rgba(160,110,10,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(160,110,10,.16) 1px, transparent 1px)",
    backgroundSize: "22px 22px, 22px 22px",
  },
  vichy: {
    backgroundColor: "#fbe3ea",
    backgroundImage: "linear-gradient(0deg, rgba(226,106,150,.26) 0 50%, transparent 50%), linear-gradient(90deg, rgba(226,106,150,.26) 0 50%, transparent 50%)",
    backgroundSize: "22px 22px, 22px 22px",
  },
  mesa: { backgroundColor: "#e6e1d8", backgroundImage: "radial-gradient(rgba(255,255,255,.5), transparent 70%)" },
  ceu: { backgroundColor: "#dbe9f7", backgroundImage: "radial-gradient(rgba(30,70,140,.22) 1.2px, transparent 1.5px)", backgroundSize: "18px 18px", backgroundPosition: "9px 9px" },
  lavanda: { backgroundColor: "#e9e3f7", backgroundImage: "radial-gradient(rgba(90,60,160,.22) 1.2px, transparent 1.5px)", backgroundSize: "18px 18px", backgroundPosition: "9px 9px" },
  caderno: {
    backgroundColor: "#fffdf8",
    backgroundImage: "linear-gradient(90deg, transparent 0 44px, rgba(220,70,90,.4) 44px 45.5px, transparent 45.5px), repeating-linear-gradient(180deg, transparent 0 27px, rgba(60,90,170,.22) 27px 28px)",
    backgroundPosition: "0 0, 0 10px",
  },
};

const MOLDURA: Moldura = {
  barraOn: R.grafite, barraOff: "rgba(35,35,39,.18)", topo: "rgba(35,35,39,.6)", esquerda: 14,
  chip: { fg: R.grafite, bg: "rgba(255,255,255,.75)", borda: "rgba(35,35,39,.2)" },
};

const pagina = (papel: Papel, conteudo: ReactNode): PaginaPronta => ({
  fundoCor: (PAPEL[papel].backgroundColor as string) ?? "#e6e1d8",
  fundo: <div style={{ position: "absolute", inset: 0, ...PAPEL[papel] }} />,
  moldura: MOLDURA,
  conteudo: <div style={{ position: "absolute", inset: 0, color: R.grafite }}>{conteudo}</div>,
});

const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });
const serif: CSSProperties = { fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 };
const rot = (fs: number, cor: string = R.rot): CSSProperties => ({ fontSize: fs, fontWeight: 800, letterSpacing: ".2em", textTransform: "uppercase", color: cor });
const numero: CSSProperties = { fontWeight: 900, letterSpacing: "-.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" };

/* ------------------------------------------------------------ peças */

/** Rotulador: a fita preta em relevo com o texto em caixa-alta. */
const Dymo = ({ children, cor = "#1f1f24", tam = 12.5, pad = "7px 14px 6px", raio = 3 }: { children: ReactNode; cor?: string; tam?: number; pad?: string; raio?: number }) => (
  <span
    style={{
      display: "inline-block", backgroundColor: cor, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.14))", color: "#f4f1ea",
      fontWeight: 800, fontSize: tam, letterSpacing: ".22em", textTransform: "uppercase", padding: pad, borderRadius: raio,
      boxShadow: "0 2px 5px rgba(0,0,0,.28)", textShadow: "0 1px 0 rgba(255,255,255,.28), 0 -1px 0 rgba(0,0,0,.7)", whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);
const DymoEm = ({ left, top, giro, children, cor, tam }: { left: number; top: number; giro: number; children: ReactNode; cor?: string; tam?: number }) => (
  <div style={abs({ left, top, transform: `rotate(${giro}deg)` })}><Dymo cor={cor} tam={tam}>{children}</Dymo></div>
);

/** Polaroid: a foto quadrada (o número ou o calendário) e a legenda escrita à mão. */
const Pola = ({ left, top, largura, giro, pad = [10, 10, 32], foto, fotoAltura, children, legenda, legendaTam = 16, legendaMt = 12 }: {
  left: number; top: number; largura: number; giro: number; pad?: [number, number, number]; foto: string; fotoAltura?: number;
  children?: ReactNode; legenda?: ReactNode; legendaTam?: number; legendaMt?: number;
}) => {
  const lado = largura - 2 * pad[1];
  return (
    <div
      style={{
        position: "absolute", left, top, width: largura, boxSizing: "border-box", background: "#fcfbf8", padding: `${pad[0]}px ${pad[1]}px ${pad[2]}px`,
        transform: `rotate(${giro}deg)`, boxShadow: "0 1px 0 rgba(255,255,255,.7) inset, 0 14px 28px -14px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.12)",
      }}
    >
      <div style={{ position: "relative", overflow: "hidden", width: lado, height: fotoAltura ?? lado, background: foto, display: "grid", placeItems: "center" }}>{children}</div>
      {legenda && <div style={{ ...serif, textAlign: "center", marginTop: legendaMt, fontSize: legendaTam, color: "#3b3b40", lineHeight: 1.05 }}>{legenda}</div>}
    </div>
  );
};

const FOTO = {
  indigo: "radial-gradient(120% 90% at 30% 20%,#5b54ea,#3b34b5 70%)",
  laranja: "radial-gradient(120% 90% at 30% 20%,#fb923c,#d9480f 75%)",
  azul: "radial-gradient(120% 90% at 30% 20%,#60a5fa,#1d4ed8 75%)",
  rosa: "radial-gradient(120% 90% at 30% 20%,#f9a8d4,#db2777 80%)",
};

const WASHI: Record<string, string> = {
  listras: "repeating-linear-gradient(90deg, #f472b6 0 8px, #fce7f3 8px 16px)",
  bolinhas: "radial-gradient(#8b5cf6 2.2px, transparent 2.6px) 0 0/11px 11px, #ede9fe",
  xadrez: "linear-gradient(0deg, rgba(34,197,94,.42) 0 50%, transparent 50%) 0 0/12px 12px, linear-gradient(90deg, rgba(34,197,94,.42) 0 50%, transparent 50%) 0 0/12px 12px, #dcfce7",
  ambar: "repeating-linear-gradient(135deg, #f59e0b 0 6px, #fef3c7 6px 12px)",
};
const Washi = ({ tipo, left, top, giro, w = 118, h = 26 }: { tipo: keyof typeof WASHI; left: number; top: number; giro: number; w?: number; h?: number }) => (
  <div
    aria-hidden
    style={{
      position: "absolute", left, top, width: w, height: h, opacity: 0.88, boxShadow: "0 1px 2px rgba(0,0,0,.14)", mixBlendMode: "multiply",
      clipPath: "polygon(0 0, 100% 0, 97% 14%, 100% 28%, 97% 42%, 100% 56%, 97% 70%, 100% 84%, 98% 100%, 0 100%, 3% 86%, 0 72%, 3% 58%, 0 44%, 3% 30%, 0 16%)",
      background: WASHI[tipo], transform: `rotate(${giro}deg)`,
    }}
  />
);

/** Borda de papel rasgado em cima e embaixo (sempre a mesma pra mesma semente). */
const rasgado = (semente: number) => {
  let s = semente;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const n = 22;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(`${((i / n) * 100).toFixed(1)}% ${(r() * 6).toFixed(1)}px`);
  for (let i = n; i >= 0; i--) pts.push(`${((i / n) * 100).toFixed(1)}% calc(100% - ${(r() * 6).toFixed(1)}px)`);
  return `polygon(${pts.join(",")})`;
};
const Rasgo = ({ semente, pauta, style, children }: { semente: number; pauta?: boolean; style: CSSProperties; children: ReactNode }) => (
  <div
    style={{
      position: "absolute", boxSizing: "border-box", background: R.papel, padding: "12px 16px", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.22))",
      clipPath: rasgado(semente),
      ...(pauta ? { backgroundImage: "repeating-linear-gradient(180deg, transparent 0 21px, rgba(60,80,160,.22) 21px 22px)", backgroundPosition: "0 6px" } : null),
      ...style,
    }}
  >
    {children}
  </div>
);

const MASCARA_DO_INGRESSO = "radial-gradient(circle at 0 50%, transparent 9px, #000 9.5px), radial-gradient(circle at 100% 50%, transparent 9px, #000 9.5px)";
/** Ingresso com canhoto e os dois furos laterais. */
const Ingresso = ({ canhoto, corCanhoto = R.magenta, style, children, fs }: { canhoto: string; corCanhoto?: string; style: CSSProperties; children: ReactNode; fs: (n: number) => number }) => (
  <div
    style={{
      position: "absolute", background: "#fff7df", display: "flex", alignItems: "stretch", boxShadow: "0 8px 16px -8px rgba(0,0,0,.4)",
      WebkitMaskImage: MASCARA_DO_INGRESSO, WebkitMaskComposite: "source-in", maskImage: MASCARA_DO_INGRESSO, maskComposite: "intersect", ...style,
    } as CSSProperties}
  >
    <div style={{ borderRight: "2px dashed rgba(35,35,39,.35)", display: "grid", placeItems: "center", padding: "0 12px" }}>
      <span style={{ ...rot(fs(9.5), corCanhoto), writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{canhoto}</span>
    </div>
    {children}
  </div>
);

const serrilha = () => {
  const pts = ["0 0", "100% 0"];
  const n = 18;
  for (let i = n; i >= 0; i--) pts.push(`${((i / n) * 100).toFixed(1)}% calc(100% - ${i % 2 ? 0 : 7}px)`);
  return `polygon(${pts.join(",")})`;
};
/** Cupom fiscal com a serrilha embaixo. */
const Cupom = ({ style, cabeca, linhas, pe, tam = 12.5, testId }: { style: CSSProperties; cabeca: string; linhas: { k: string; v: string }[]; pe: string; tam?: number; testId?: string }) => (
  <div
    data-testid={testId}
    style={{
      position: "absolute", boxSizing: "border-box", background: "#fff", padding: `${tam * 1.1}px ${tam * 1.3}px ${tam * 1.75}px`, fontSize: tam, fontWeight: 600, color: "#333",
      filter: "drop-shadow(0 8px 10px rgba(0,0,0,.22))", letterSpacing: ".02em", clipPath: serrilha(), ...style,
    }}
  >
    <div style={{ textAlign: "center", fontSize: tam * 0.8, letterSpacing: ".24em", fontWeight: 800, color: "#666", paddingBottom: 8, marginBottom: 6, borderBottom: "1px dashed #ccc" }}>{cabeca}</div>
    {linhas.map((l) => (
      <div key={l.k} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "4px 0" }}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{l.k}</span>
        <span aria-hidden style={{ flex: 1, borderBottom: "1.5px dotted #bbb", transform: "translateY(-3px)", minWidth: 6 }} />
        <b style={{ fontWeight: 800, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{l.v}</b>
      </div>
    ))}
    <div style={{ textAlign: "center", fontSize: tam * 0.8, letterSpacing: ".24em", fontWeight: 800, color: "#666", paddingTop: 8, marginTop: 6, borderTop: "1px dashed #ccc" }}>{pe}</div>
  </div>
);

const PostIt = ({ style, children, testId }: { style: CSSProperties; children: ReactNode; testId?: string }) => (
  <div data-testid={testId} style={{ position: "absolute", boxSizing: "border-box", background: "#fef3c7", boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 12px 22px -12px rgba(146,64,14,.55)", padding: "16px 18px 18px", ...style }}>
    {children}
  </div>
);

const ESTRELA = "12,2 14.9,8.6 22,9.3 16.6,14.1 18.2,21 12,17.4 5.8,21 7.4,14.1 2,9.3 9.1,8.6";
const Estrela = ({ tam, id }: { tam: number; id: string }) => (
  <svg viewBox="0 0 24 24" width={tam} height={tam} style={{ display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))" }} aria-hidden>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff3c4" /><stop offset=".5" stopColor="#e2b23a" /><stop offset="1" stopColor="#a8780e" />
      </linearGradient>
    </defs>
    <polygon points={ESTRELA} fill={`url(#${id})`} stroke="#7a5308" strokeWidth={1} />
  </svg>
);

/** O calendário do mês em adesivos: estrela = dia anotado; anel = dia sem; pontilhado = antes do 1º uso. */
const CalendarioDeEstrelas = ({ c, tam, gap, dias: soDias, colunas = 7 }: {
  c: { ano: number; mesIdx: number; marcados: number[]; primeiroDia: number }; tam: number; gap: [number, number]; dias?: number[]; colunas?: number;
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const total = new Date(c.ano, c.mesIdx + 1, 0).getDate();
  const antes = soDias ? 0 : (new Date(c.ano, c.mesIdx, 1).getDay() + 6) % 7;
  const feitos = new Set(c.marcados);
  const lista = soDias ?? Array.from({ length: total }, (_, i) => i + 1);
  const anel = (pontilhado: boolean): CSSProperties => ({
    display: "block", width: tam * 0.5, height: tam * 0.5, borderRadius: "50%", boxSizing: "border-box",
    border: `${Math.max(1.5, tam * 0.07)}px ${pontilhado ? "dotted" : "solid"} rgba(246,241,231,${pontilhado ? 0.35 : 0.55})`,
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: `${gap[0]}px ${gap[1]}px`, alignContent: "center", width: "100%" }}>
      {Array.from({ length: antes }, (_, i) => <i key={`v${i}`} />)}
      {lista.map((d) => (
        <div key={d} style={{ display: "grid", placeItems: "center", height: tam }}>
          {feitos.has(d) ? <Estrela tam={tam} id={`e${uid}${d}`} /> : <i style={anel(d < c.primeiroDia)} />}
        </div>
      ))}
    </div>
  );
};

/** O carimbo de tinta azul (recorde), com a borda gasta. */
const CarimboTinta = ({ children }: { children: ReactNode }) => {
  const uid = `tinta${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id={uid} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={1.8} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span
        style={{
          display: "inline-block", padding: "8px 14px", border: "3px solid currentColor", borderRadius: 8, fontSize: 13, fontWeight: 900, letterSpacing: ".14em",
          textTransform: "uppercase", whiteSpace: "nowrap", opacity: 0.9, filter: `url(#${uid})`,
          WebkitMaskImage: "radial-gradient(rgba(0,0,0,.95) 60%, rgba(0,0,0,.6) 100%)", maskImage: "radial-gradient(rgba(0,0,0,.95) 60%, rgba(0,0,0,.6) 100%)",
        }}
      >
        {children}
      </span>
    </>
  );
};

/** O adesivo do hábito campeão: a gota pra água; o resto ganha o adesivo "semana completa" das Conquistas. */
const AdesivoDoHabito = ({ nome, dias, style }: { nome: string; dias: number; style: CSSProperties }) => {
  if (/água|agua/i.test(nome)) return <Adesivo tipo="gota" txt={String(dias)} style={style} />;
  if (/\bler\b|leitura|livro|página/i.test(nome)) return <Adesivo tipo="livro" txt={String(dias)} style={style} />;
  if (/dorm|sono/i.test(nome)) return <Adesivo tipo="lua" style={style} />;
  const tam = typeof style.width === "number" ? style.width : 90;
  return (
    <div aria-hidden style={{ position: "absolute", ...style }}>
      <AdesivoDasConquistas id="rotina-7" tamanho={tam} />
    </div>
  );
};

const Virar = () => {
  const { fs } = useMedidas();
  return <div style={abs({ left: 0, right: 0, bottom: 34, textAlign: "center", fontSize: fs(13), fontWeight: 600, color: "rgba(35,35,39,.62)" })}>toque pra virar a página →</div>;
};

const tamanhoDaFoto = (valor: number | string, base: number) => {
  const d = String(valor).length;
  return d <= 2 ? base : d === 3 ? base * 0.68 : base * 0.52;
};

export const FONTE_DA_PALAVRA = { familia: "inter", peso: 900, espaco: -0.05 } as const;
/**
 * A palavra do humor na foto da polaroide ("bem." · "no meio-termo."), com a foto de largura `w`.
 * Varredura 27/09: com o piso padrão do tamanhoQueCabe (40% do máximo), "no meio-termo." — a mais
 * comprida, 3× "bem." — não cabia e a foto cortava ("no meio-term") em 360 e 390; "pra baixo." e
 * "muito bem." também passavam. Piso baixo: a palavra diminui até caber na linha.
 */
export const tamanhoDaPalavra = (palavra: string, w: number) => tamanhoQueCabe([palavra], FONTE_DA_PALAVRA, w - 40, w * 0.42, 12);

/* ============================================================== capa */

const Capa = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const nc = nomeDaCapa(p.nome);
  const a = retro.atividade;
  const w = t(326, 268);
  const seq = retro.meuMes?.sequencia?.dias ?? 0;
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={-3}>{retro.mes} · {retro.ano}</DymoEm>
      <Rasgo semente={11} style={{ left: 26, top: m(140, 118), width: 290, transform: "rotate(1.2deg)", padding: "14px 18px 16px" }}>
        <div style={rot(fs(9.5))}>{nc ? `O ${retro.mes.toLowerCase()} de` : "Retrospectiva"}</div>
        <div style={{ fontSize: tamanhoQueCabe([nc ?? `O seu ${retro.mes.toLowerCase()}`], { familia: "inter", peso: 900, espaco: -0.04 }, 250, 40, 26), fontWeight: 900, letterSpacing: "-.04em", lineHeight: 0.95, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {nc ?? `O seu ${retro.mes.toLowerCase()}`}
        </div>
        <div style={{ ...serif, fontSize: 17, color: R.tinta2, marginTop: 6 }}>{p.paginas.length} páginas, {retro.base.dias} dias, 1 mês pra guardar.</div>
      </Rasgo>
      <Pola
        left={m(52, 60)} top={m(288, 254)} largura={w} giro={-2.5} foto={FOTO.indigo}
        legenda={<>{retro.mes.toLowerCase()} · <b style={{ fontFamily: INTER, fontStyle: "normal", fontWeight: 800 }}>{a.diasComRegistro} {a.diasComRegistro === 1 ? "dia" : "dias"}</b> com algo anotado</>}
      >
        <div style={{ position: "absolute", inset: `${w * 0.05}px ${w * 0.043}px`, display: "flex", alignItems: "center" }}>
          <CalendarioDeEstrelas c={{ ano: retro.ano, mesIdx: retro.mesIdx, marcados: a.dias, primeiroDia: retro.base.primeiroDia }} tam={w * 0.104} gap={[w * 0.018, w * 0.012]} />
        </div>
      </Pola>
      <Washi tipo="listras" left={26} top={m(280, 248)} giro={-38} />
      <Washi tipo="xadrez" left={300} top={m(664, 560)} giro={-34} />
      {seq >= 2
        ? <Adesivo tipo="chama" txt={`${seq} DIAS`} style={{ left: 302, top: m(706, 592), width: 96, height: 96, transform: "rotate(8deg)" }} />
        : <Adesivo tipo="estrela" style={{ left: 316, top: m(716, 600), width: 70, height: 70, transform: "rotate(8deg)" }} />}
      <Adesivo tipo="fechado" style={{ left: 212, top: m(740, 620), width: 84, height: 84, transform: "rotate(-10deg)" }} />
      <Adesivo tipo="coracao" style={{ left: 170, top: m(700, 586), width: 46, height: 46, transform: "rotate(-16deg)" }} />
      <Ingresso canhoto={`Nº ${numeroDaEdicao(retro.mesIdx)}`} fs={fs} style={{ left: 24, top: m(748, 622), width: 150, transform: "rotate(-4deg)" }}>
        <div style={{ padding: "10px 16px" }}>
          <div style={rot(fs(9.5))}>Ingresso</div>
          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{p.paginas.length} páginas</div>
          <div style={{ fontSize: fs(10.5), color: R.rot, marginTop: 2 }}>válido pra 1 pessoa</div>
        </div>
      </Ingresso>
      <Virar />
    </>
  );
};

const CapaCurta = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const nc = nomeDaCapa(p.nome);
  const a = retro.atividade;
  const { dias, de, ate } = diasDaCapaCurta(retro);
  const w = t(326, 280);
  const colunas = Math.min(7, Math.max(1, dias.length));
  const linhas = Math.ceil(dias.length / colunas);
  const tam = Math.min(48, (w * 0.8) / colunas);
  const inicio = diaDoInicio(a.primeiroDia ?? 1);
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={-3}>{retro.mes} · {retro.ano}</DymoEm>
      <Rasgo semente={17} style={{ left: 26, top: m(140, 122), width: 300, transform: "rotate(1.2deg)", padding: "14px 18px 16px" }}>
        <div style={rot(fs(9.5))}>Seus primeiros</div>
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 0.95, marginTop: 2 }}>
          <CountUp to={a.diasComRegistro} /> {a.diasComRegistro === 1 ? "dia" : "dias"}
        </div>
        <div style={{ ...serif, fontSize: 17, color: R.tinta2, marginTop: 6 }}>{nc ? `${nc} começou dia ${inicio}.` : `Você começou dia ${inicio}.`}</div>
      </Rasgo>
      <Pola
        left={m(52, 60)} top={m(300, 250)} largura={w} giro={-2.5} foto={FOTO.indigo} fotoAltura={Math.max((w - 20) / 1.6, linhas * (tam + 8) + 32)}
        legenda={<>{de === ate ? `dia ${de}` : `${de} a ${ate}`} — <b style={{ fontFamily: INTER, fontStyle: "normal", fontWeight: 800 }}>{a.diasComRegistro} de {retro.base.dias}</b> com algo anotado</>}
      >
        <div style={{ position: "absolute", inset: "16px 14px", display: "flex", alignItems: "center" }}>
          <CalendarioDeEstrelas c={{ ano: retro.ano, mesIdx: retro.mesIdx, marcados: a.dias, primeiroDia: retro.base.primeiroDia }} tam={tam} gap={[6, 4]} dias={dias} colunas={colunas} />
        </div>
      </Pola>
      <Washi tipo="listras" left={26} top={m(292, 242)} giro={-38} />
      <Adesivo tipo="coracao" style={{ left: 300, top: m(560, 470), width: 70, height: 70, transform: "rotate(-14deg)" }} />
      <Adesivo tipo="estrela" style={{ left: 236, top: m(590, 494), width: 56, height: 56, transform: "rotate(12deg)" }} />
      <Ingresso canhoto={`Nº ${numeroDaEdicao(retro.mesIdx)}`} fs={fs} style={{ left: 24, top: m(640, 540), width: 150, transform: "rotate(-4deg)" }}>
        <div style={{ padding: "10px 16px" }}>
          <div style={rot(fs(9.5))}>Ingresso</div>
          <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{p.paginas.length} páginas</div>
          <div style={{ fontSize: fs(10.5), color: R.rot, marginTop: 2 }}>edição curta</div>
        </div>
      </Ingresso>
      <Virar />
    </>
  );
};

/* =========================================================== meu mês */

const MeuMes = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const mm = retro.meuMes!;
  const base = retro.base;
  const w = t(262, 226);
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={2}>Meu mês</DymoEm>
      <Pola
        left={26} top={m(130, 118)} largura={w} giro={-2} foto={FOTO.indigo}
        legenda={<>{mm.diasAnotados === 1 ? "dia com a vida anotada" : "dias com a vida anotada"}<br /><span style={{ fontSize: fs(13), color: "#8a8478" }}>{base.primeiroDia > 1 ? `de ${base.dias} desde que você começou` : `dos ${base.diasDoMes} dias de ${retro.mes.toLowerCase()}`}</span></>}
      >
        <span style={{ ...numero, fontSize: tamanhoDaFoto(mm.diasAnotados, w * 0.64), letterSpacing: "-.07em", color: "#f6f1e7", marginTop: -6 }}><CountUp to={mm.diasAnotados} /></span>
      </Pola>
      <Washi tipo="bolinhas" left={4} top={m(128, 116)} giro={-40} />
      {mm.diaForte && <Adesivo tipo="roseta" dia={mm.diaForte.dia} txt={`${mm.diaForte.feitos}/${mm.diaForte.total}`} style={{ left: 300, top: m(150, 136), width: 112, height: 112, transform: "rotate(9deg)" }} />}
      <Adesivo tipo="estrela" style={{ left: 322, top: m(290, 262), width: 56, height: 56, transform: "rotate(-12deg)" }} />
      {mm.sequencia && (
        <Ingresso canhoto="Sequência" fs={fs} style={{ left: 34, top: m(520, 442), width: 330, transform: "rotate(1.5deg)" }}>
          <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
            <div style={{ ...numero, fontSize: 40 }}>{mm.sequencia.dias}</div>
            <div>
              <div style={rot(fs(9.5))}>Melhor sequência</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 1 }}>dias seguidos</div>
              <div style={{ fontSize: fs(12), color: R.rot }}>de {mm.sequencia.de} a {mm.sequencia.ate} de {retro.mes.toLowerCase()}</div>
            </div>
          </div>
        </Ingresso>
      )}
      {mm.habitoCampeao && (
        <>
          <Rasgo semente={23} pauta style={{ left: 26, top: m(626, 530), width: 300, transform: "rotate(-1.5deg)", padding: "14px 18px 18px" }}>
            <div style={rot(fs(9.5))}>Hábito campeão</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.01em", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mm.habitoCampeao.nome}</div>
            <div style={{ ...serif, fontSize: 16, color: R.tinta2, marginTop: 2 }}>{fraseDoHabito(mm.habitoCampeao.dias, mm.diasAnotados)}</div>
          </Rasgo>
          <AdesivoDoHabito nome={mm.habitoCampeao.nome} dias={mm.habitoCampeao.dias} style={{ left: 316, top: m(598, 506), width: 90, height: 90, transform: "rotate(12deg)" }} />
        </>
      )}
      {mm.aMaisQueAnterior ? (
        <DymoEm left={60} top={m(772, 650)} giro={-2} cor={R.magenta}>+{mm.aMaisQueAnterior.dias} {mm.aMaisQueAnterior.dias === 1 ? "dia" : "dias"} que em {mm.aMaisQueAnterior.mes}</DymoEm>
      ) : null}
      <div style={{ ...serif, ...abs({ left: 78, top: m(824, 694) }), fontSize: 19, color: "#3b3b40", transform: "rotate(-2deg)" }}>{linhaDoMeuMes(retro).replace(/^./, (x) => x.toLowerCase())}</div>
      <svg aria-hidden style={abs({ left: 74, top: m(852, 722), width: 250, height: 14, overflow: "visible" })} viewBox="0 0 250 14" fill="none" stroke={R.magenta} strokeWidth={2.4} strokeLinecap="round">
        <path d="M2,8 C40,2 70,12 110,6 S180,2 246,8" />
      </svg>
    </>
  );
};

/* ============================================================ dinheiro */

const Dinheiro = (p: PropsDinheiro) => {
  const { m, t, fs } = useMedidas();
  const { retro, revelado } = p;
  const f = retro.financas!;
  const base = retro.base;
  const comGasto = new Set(f.diasComGasto);
  const w = t(246, 216);
  const soma = f.topCategories.reduce((s, c) => s + c.pct, 0);
  const reais = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  const resto = Math.max(0, f.outflow - f.topCategories.reduce((x, c) => x + c.value, 0));
  const linhas = [
    ...f.topCategories.map((c) => ({ k: c.label, v: revelado ? reais(c.value) : `${Math.round(c.pct)}%` })),
    ...(soma < 99.5 ? [{ k: "Resto", v: revelado ? reais(resto) : `${Math.round(100 - soma)}%` }] : []),
  ];
  const heroiN = f.gastosAnotados > 0 ? f.gastosAnotados : f.txCount;
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={-2}>Dinheiro</DymoEm>
      <Pola left={26} top={m(130, 118)} largura={w} giro={2} foto={FOTO.laranja} legenda={f.gastosAnotados > 0 ? (f.gastosAnotados === 1 ? "gasto anotado" : "gastos anotados") : "lançamentos no mês"}>
        <span style={{ ...numero, fontSize: tamanhoDaFoto(heroiN, w * 0.634), letterSpacing: "-.07em", color: "#fff7ea", marginTop: -6 }}><CountUp to={heroiN} /></span>
      </Pola>
      <Washi tipo="ambar" left={-8} top={m(408, 360)} giro={36} />
      {linhas.length > 0 && (() => {
        // nome de categoria comprido ("Plano de Saúde") alarga o cupom pra dentro da polaroid
        const largo = revelado || linhas.some((l) => l.k.length > 9);
        return <Cupom style={{ left: largo ? 238 : 262, top: m(196, 176), width: largo ? 180 : 150, transform: "rotate(3deg)" }} cabeca="PRA ONDE FOI" linhas={linhas} pe="VOLTE SEMPRE" tam={fs(12.5)} />;
      })()}
      {f.diasSemGasto !== null && (
        <>
          <Rasgo semente={31} style={{ left: 26, top: m(530, 452), width: 330, transform: "rotate(-1.5deg)", padding: "16px 18px 18px" }}>
            <div style={rot(fs(9.5))}>Dias sem gastar nada</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
              <span style={{ ...numero, fontSize: 44 }}>{f.diasSemGasto}</span>
              <span style={{ ...serif, fontSize: 18, color: R.tinta2 }}>{fraseDosDiasSemGasto(f.diasSemGasto, base.dias)}</span>
            </div>
            <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(16, Math.ceil(base.dias / 2))}, 1fr)`, gap: 5, marginTop: 12 }}>
              {Array.from({ length: base.dias }, (_, i) => base.primeiroDia + i).map((d) => (
                <i key={d} style={{ display: "block", aspectRatio: "1", borderRadius: "50%", ...(comGasto.has(d) ? { background: "rgba(35,35,39,.12)" } : { background: "#22c55e", boxShadow: "inset 0 0 0 2px #fff, 0 0 0 1.5px #16a34a" }) }} />
              ))}
            </div>
          </Rasgo>
          <Adesivo tipo="cofre" style={{ left: 320, top: m(488, 414), width: 96, height: 96, transform: "rotate(-8deg)" }} />
        </>
      )}
      {revelado ? (
        <PostIt testId="valores-revelados" style={{ left: 34, right: 34, top: m(732, 612), transform: "rotate(-1.5deg)", color: "#3b2a10" }}>
          <TextoDosValores retro={retro} proximo={p.proximo.nome} />
        </PostIt>
      ) : (
        <>
          <DymoEm left={48} top={m(748, 622)} giro={1} cor={R.indigo}>Cada gasto anotado</DymoEm>
          <DymoEm left={96} top={m(790, 660)} giro={-1.5} cor={R.indigo}>é uma decisão que você viu</DymoEm>
        </>
      )}
      <div style={abs({ left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center" })}>
        <BotaoDosValores revelado={revelado} onRevelar={p.onRevelar} cor="rgba(35,35,39,.7)" fs={fs} style={{ fontSize: fs(12.5) }} />
      </div>
    </>
  );
};

/* ============================================================== corpo */

const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

const Corpo = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const c = p.retro.corpo!;
  const w = t(246, 212);
  const heroiDe = c.treinos > 0 ? "treinos" : c.agua ? "agua" : "sono";
  const agua = c.agua && heroiDe !== "agua" ? c.agua : null;
  const sono = c.sono && heroiDe !== "sono" ? c.sono : null;
  const posicoes: [number, number, number, number][] = [[296, 150, 104, 8], [300, 256, 104, -7], [296, 362, 104, 6], [186, 452, 104, -9]];
  const heroi = heroiDe === "treinos"
    ? { n: c.treinos as number | string, l: c.treinos === 1 ? "treino no mês" : "treinos no mês", s: c.meta ? `${c.meta.semanas} ${c.meta.semanas === 1 ? "semana" : "semanas"} na meta` : "" }
    : heroiDe === "agua"
      ? { n: c.agua!.diasNaMeta as number | string, l: "dias na meta de água", s: `meta de ${c.agua!.meta} copos` }
      : { n: horas(c.sono!.mediaMin) as number | string, l: "de sono por noite", s: legendaDoSono(c.sono!) };
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={-2}>Corpo</DymoEm>
      <Pola left={26} top={m(130, 118)} largura={w} giro={-2} foto={FOTO.azul} legenda={<>{heroi.l}{heroi.s && <><br /><span style={{ fontSize: fs(13), color: "#8a8478" }}>{heroi.s}</span></>}</>}>
        <span style={{ ...numero, fontSize: tamanhoDaFoto(heroi.n, w * 0.634), letterSpacing: "-.07em", color: "#f6f1e7", marginTop: -6 }}>
          {typeof heroi.n === "number" ? <CountUp to={heroi.n} /> : heroi.n}
        </span>
      </Pola>
      <Washi tipo="bolinhas" left={200} top={m(120, 108)} giro={28} />
      {c.grupos.slice(0, 4).map((g, i) => {
        const [l, top, tam, giro] = posicoes[i];
        return <Adesivo key={g.grupo} tipo="treino" grupo={g.grupo} txt={String(g.dias)} cor={COR_DO_ADESIVO_DE_TREINO[i]} style={{ left: l, top: m(top, top * 0.86), width: tam * (t(1, 0.86)), height: tam * t(1, 0.86), transform: `rotate(${giro}deg)` }} />;
      })}
      {c.grupos.length > 0 && (
        <>
          <DymoEm left={24} top={m(488, 408)} giro={-2} tam={11}>O que você treinou</DymoEm>
          <div style={{ ...serif, ...abs({ left: 30, top: m(534, 446), width: 150 }), fontSize: 16, color: "#3f4d66", lineHeight: 1.2 }}>
            {juntar(c.grupos.slice(0, 4).map((g) => g.rotulo.toLowerCase()))} — {c.treinos} no total.
          </div>
        </>
      )}
      {agua && (
        <>
          <Ingresso canhoto="Água" corCanhoto="#2563eb" fs={fs} style={{ left: 34, top: m(586, 506), width: 300, transform: "rotate(1.5deg)" }}>
            <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
              <div style={{ ...numero, fontSize: 40 }}>{agua.diasNaMeta}</div>
              <div><div style={rot(fs(9.5))}>Água na meta</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 1 }}>dias de {agua.dias.length}</div></div>
            </div>
          </Ingresso>
          <Adesivo tipo="gota" txt={String(agua.diasNaMeta)} style={{ left: 318, top: m(566, 488), width: 84, height: 84, transform: "rotate(12deg)" }} />
        </>
      )}
      {sono && (
        <>
          <Rasgo semente={41} style={{ left: 26, top: m(676, 584), width: 250, transform: "rotate(-1.5deg)", padding: "12px 16px 14px" }}>
            <div style={rot(fs(9.5))}>Sono médio</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...numero, fontSize: 30, letterSpacing: "-.04em", lineHeight: 1.1 }}>{horas(sono.mediaMin)}</span>
              <span style={{ ...serif, fontSize: 15, color: R.tinta2 }}>{legendaDoSono(sono)}</span>
            </div>
          </Rasgo>
          <Adesivo tipo="lua" style={{ left: 270, top: m(664, 572), width: 76, height: 76, transform: "rotate(-10deg)" }} />
        </>
      )}
      {c.recorde && (
        <div style={abs({ left: 60, top: m(786, 668), transform: "rotate(-4deg)", color: "#2563eb" })}>
          <CarimboTinta>Novo recorde · {c.recorde.exercicio} {c.recorde.carga > 0 ? `${c.recorde.carga.toLocaleString("pt-BR")} kg` : `${c.recorde.reps} reps`}</CarimboTinta>
        </div>
      )}
    </>
  );
};

/* ================================================== como você estava */

const COR_DO_HUMOR: Record<number, string> = { 1: "#f87171", 2: "#fb923c", 3: "#fde047", 4: "#86efac", 5: "#22c55e" };

const Humor = (p: Base) => {
  const { m, t, fs } = useMedidas();
  const { retro } = p;
  const s = retro.sentir!;
  const MM = String(retro.mesIdx + 1).padStart(2, "0");
  const nota = new Map(s.porDia.map((n) => [n.dia, n.nota]));
  const { bons, total } = contagemDoHumor(s.porDia);
  const partes = partesDoSentir(s);
  const escreveu = !!s.frase || s.diasDeDiario > 0 || s.gratidoes > 0;
  const w = t(246, 212);
  const palavra = s.palavra ? `${s.palavra}.` : null;
  const foto = palavra ?? String(s.diasDeDiario || s.gratidoes);
  // a medida é do Inter 900: se a fonte ainda estava chegando na 1ª pintura, mede de novo quando chegar
  useFontesProntas();
  const tamFoto = palavra ? tamanhoDaPalavra(palavra, w) : tamanhoDaFoto(foto, w * 0.634);
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={2}>Como você estava</DymoEm>
      <Pola
        left={26} top={m(136, 122)} largura={w} giro={-2} foto={FOTO.rosa}
        legenda={palavra
          ? <>na maior parte dos dias<br /><span style={{ fontSize: fs(13), color: "#8a8478" }}>{s.pesado ? "registrar já é um jeito de se cuidar" : bons > 0 ? `${bons} de ${total} bem ou melhor` : `${total} com o humor anotado`}</span></>
          : s.diasDeDiario > 0 ? "dias de diário" : "coisas pelas quais você agradeceu"}
      >
        <span style={{ fontSize: tamFoto, fontWeight: 900, letterSpacing: "-.05em", color: "#fff7fb", lineHeight: 1, whiteSpace: "nowrap" }}>{foto}</span>
      </Pola>
      <Washi tipo="listras" left={-2} top={m(140, 126)} giro={-38} />
      <Adesivo tipo="coracao" style={{ left: 306, top: m(170, 150), width: 80, height: 80, transform: "rotate(-12deg)" }} />
      <Adesivo tipo="estrela" style={{ left: 326, top: m(270, 238), width: 60, height: 60, transform: "rotate(14deg)" }} />
      {s.porDia.length > 0 && (
        <Rasgo semente={53} style={{ left: 26, top: m(470, 406), width: 352, transform: "rotate(1deg)", padding: "14px 18px 16px" }}>
          {/* columnGap (varredura 27/09): em 360 a legenda cabia na linha sem folga e grudava no rótulo ("DIA A DIA●ótimo") */}
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", rowGap: 4, columnGap: 10 }}>
            <span style={{ ...rot(fs(9.5)), whiteSpace: "nowrap" }}>Seu humor, dia a dia</span>
            <span aria-hidden style={{ marginLeft: "auto", display: "flex", gap: 7, fontSize: fs(9.5), fontWeight: 700, color: R.rot }}>
              {[["ótimo", 5], ["bem", 4], ["ok", 3], ["mal", 2]].map(([n, v]) => (
                <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: COR_DO_HUMOR[v as number] }} />{n}</span>
              ))}
            </span>
          </div>
          <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${Math.ceil(retro.base.diasDoMes / 2)}, 1fr)`, gap: m(6, 5), marginTop: 12 }}>
            {Array.from({ length: retro.base.diasDoMes }, (_, i) => {
              const n = nota.get(i + 1);
              const nivel = n ? Math.min(5, Math.max(1, Math.round(n))) : 0;
              return (
                <i key={i} style={{ display: "block", aspectRatio: "1", borderRadius: "50%", boxSizing: "border-box", ...(nivel ? { background: COR_DO_HUMOR[nivel], boxShadow: "inset 0 0 0 2px #fff, 0 0 0 1.5px rgba(35,35,39,.35)" } : { border: "1.5px dotted rgba(35,35,39,.35)" }) }} />
              );
            })}
          </div>
          <div style={{ display: "flex", fontSize: fs(10), fontWeight: 700, color: "#a39a8b", marginTop: 8 }}><span>1/{MM}</span><span style={{ marginLeft: "auto" }}>{retro.base.diasDoMes}/{MM}</span></div>
        </Rasgo>
      )}
      {s.frase && (
        <PostIt testId="frase-da-pessoa" style={{ left: 34, top: s.porDia.length ? m(626, 540) : m(470, 406), width: 330, transform: "rotate(-2deg)" }}>
          <div style={rot(fs(9.5), "#92400e")}>{s.frase.quando ? `Você escreveu · ${s.frase.quando}` : `Você escreveu sobre ${retro.mes.toLowerCase()}`}</div>
          <div style={{ ...serif, fontSize: t(22, 20), lineHeight: 1.15, marginTop: 6, color: "#3b2a10" }}>“{s.frase.texto}”</div>
        </PostIt>
      )}
      {(partes.length > 0 || escreveu) && (
        <div style={abs({ left: 28, right: 28, bottom: m(106, 30), fontSize: fs(12), color: "rgba(35,35,39,.65)", lineHeight: 1.5 })}>
          {partes.length > 0 && <div>{partes.join(" · ")}</div>}
          {escreveu && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />O que você escreve nunca vai pro card.</span>}
        </div>
      )}
    </>
  );
};

/* ============================================================== foco */

const Foco = (p: PropsFoco) => {
  const { m, t, fs } = useMedidas();
  const { opcoes, escolha, texto, salvo } = p;
  const proximo = p.proximo.nome.toLowerCase();
  const foco = (texto.trim() || escolha || "").trim();
  const caixa = (on: boolean, tracejada = false): CSSProperties => ({
    position: "absolute", left: 30, top: "50%", width: 24, height: 24, marginTop: -12, borderRadius: 5, boxSizing: "border-box", display: "grid", placeItems: "center",
    border: `2px ${tracejada ? "dashed" : "solid"} ${on ? R.magenta : tracejada ? "#a39a8b" : R.grafite}`, background: on ? R.magenta : "#fff",
  });
  return (
    <>
      <DymoEm left={60} top={m(84, 76)} giro={-2}>Foco de {proximo}</DymoEm>
      <Adesivo tipo="estrela" style={{ left: 344, top: m(70, 64), width: 56, height: 56, transform: "rotate(14deg)" }} />
      <div style={abs({ left: 60, right: 28, top: m(150, 132) })}>
        <div style={{ ...serif, fontSize: t(44, 38), lineHeight: 1, letterSpacing: "-.01em" }}>Escolha 1 foco pro mês.</div>
        <div style={{ fontSize: fs(13.5), color: R.tinta2, marginTop: 12, lineHeight: 1.5 }}>Uma coisa só, a partir do que você já faz.<br />Fica anotado na sua Rotina, na aba Mês.</div>
      </div>
      {salvo ? (
        <PostIt testId="foco-salvo" style={{ left: 60, right: 28, top: m(318, 280), transform: "rotate(-1.5deg)" }}>
          <div style={rot(fs(9.5), "#92400e")}>Anotado</div>
          <div style={{ ...serif, fontSize: 24, lineHeight: 1.15, marginTop: 6, color: "#3b2a10" }}>“{salvo}”</div>
        </PostIt>
      ) : (
        <div style={abs({ left: 0, right: 28, top: m(318, 262) })}>
          {opcoes.map((o) => {
            const on = !texto.trim() && escolha === o.texto;
            return (
              <button
                key={o.texto}
                type="button"
                aria-pressed={on}
                onClick={(e) => { e.stopPropagation(); p.onEscolha(o.texto); }}
                style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", height: m(56, 50), paddingLeft: 70, textAlign: "left", background: "none", border: 0, color: "inherit", fontFamily: "inherit" }}
              >
                <i aria-hidden style={caixa(on)}>
                  {on && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                </i>
                <div>
                  <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-.01em" }}>{o.texto}</div>
                  {o.contexto && <div style={{ fontSize: fs(11.5), color: R.rot, marginTop: 1 }}>{o.contexto}</div>}
                </div>
              </button>
            );
          })}
          <div style={{ position: "relative", height: m(56, 50), display: "flex", alignItems: "center", paddingLeft: 70 }}>
            <i aria-hidden style={caixa(false, true)} />
            <div style={{ flex: 1 }}>
              <div style={rot(fs(9.5))}>Ou escreva o seu</div>
              <input
                value={texto}
                onChange={(e) => p.onTexto(e.target.value.slice(0, 80))}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Em ${proximo} eu vou…`}
                aria-label="Seu foco pro mês"
                style={{ ...serif, display: "block", width: "100%", marginTop: 1, border: 0, background: "transparent", padding: 0, fontSize: 17, color: R.grafite, outline: "none" }}
              />
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={!salvo && !foco}
        onClick={(e) => { e.stopPropagation(); if (salvo) p.onFechar(); else p.onSalvar(); }}
        style={{ ...abs({ left: 60, right: 28, top: m(600, 520) }), height: 48, borderRadius: 12, background: R.grafite, color: "#fff", fontSize: 14, fontWeight: 800, border: 0, opacity: salvo || foco ? 1 : 0.45, fontFamily: "inherit" }}
      >
        {salvo ? "Fechar a retrospectiva" : "Guardar foco"}
      </button>
      {!salvo && <div style={abs({ left: 60, right: 28, top: m(662, 580), textAlign: "center", fontSize: fs(12), color: "#8a8478" })}>Você pode trocar o foco quando quiser.</div>}
      <Washi tipo="xadrez" left={280} top={m(700, 626)} giro={-8} />
    </>
  );
};

/* ================================================ versão curta: o fato */

const ADESIVO_DO_FATO: Record<TipoDoFato, TipoDeAdesivo> = {
  gastos: "cofre", lancamentos: "cofre", treinos: "halter", livros: "livro", humor: "coracao", agua: "gota", gratidao: "coracao", habitos: "estrela", diario: "estrela", dias: "estrela",
};

const Fato = (p: PropsFato) => {
  const { m, t, fs } = useMedidas();
  const { fato } = p;
  const w = t(262, 226);
  return (
    <>
      <DymoEm left={24} top={m(84, 76)} giro={2}>1 fato de verdade</DymoEm>
      <Pola left={26} top={m(136, 122)} largura={w} giro={-2} foto={FOTO.laranja} legenda={fato.rotulo}>
        <span style={{ ...numero, fontSize: tamanhoDaFoto(fato.valor, w * 0.64), letterSpacing: "-.07em", color: "#fff7ea", marginTop: -6 }}><CountUp to={fato.valor} /></span>
      </Pola>
      <Washi tipo="ambar" left={4} top={m(134, 120)} giro={-40} />
      {fato.tipo === "diario" ? (
        <div aria-hidden style={abs({ left: 300, top: m(160, 146), transform: "rotate(9deg)" })}><AdesivoDasConquistas id="diario-7" tamanho={100} /></div>
      ) : fato.tipo === "habitos" ? (
        <div aria-hidden style={abs({ left: 300, top: m(160, 146), transform: "rotate(9deg)" })}><AdesivoDasConquistas id="rotina-7" tamanho={100} /></div>
      ) : (
        <Adesivo tipo={ADESIVO_DO_FATO[fato.tipo]} txt={fato.tipo === "treinos" || fato.tipo === "livros" || fato.tipo === "agua" ? String(fato.valor) : undefined} style={{ left: 300, top: m(160, 146), width: 100, height: 100, transform: "rotate(9deg)" }} />
      )}
      <Rasgo semente={61} pauta style={{ left: 26, top: m(540, 460), width: 330, transform: "rotate(-1.5deg)", padding: "14px 18px 18px" }}>
        <div style={rot(fs(9.5))}>Por que isso importa</div>
        <div style={{ ...serif, fontSize: 22, lineHeight: 1.15, marginTop: 6 }}>{fato.porque}</div>
        <div style={{ fontSize: fs(12), color: R.rot, marginTop: 8 }}>{fato.sub}</div>
      </Rasgo>
      {fato.dinheiro && (
        <div style={abs({ left: 0, right: 0, bottom: 34, textAlign: "center", fontSize: fs(12.5), fontWeight: 600, color: "rgba(35,35,39,.7)" })}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Cadeado />Os valores em R$ ficam só com você.</span>
        </div>
      )}
    </>
  );
};

/* ============================================== versão curta: o fecho */

const Fecho = (p: PropsFecho) => {
  const { m, t, fs } = useMedidas();
  const proximo = p.proximo.nome;
  return (
    <>
      {p.recente && <DymoEm left={24} top={m(160, 128)} giro={-3}>{proximo}</DymoEm>}
      <Rasgo semente={71} style={{ left: 26, top: m(216, 180), width: 350, transform: "rotate(1deg)", padding: "22px 24px 24px" }}>
        <div style={{ ...serif, fontSize: t(52, 46), lineHeight: 0.98, letterSpacing: "-.01em" }}>Cada registro conta.</div>
        <div style={{ fontSize: fs(14), color: R.tinta2, marginTop: 14, lineHeight: 1.45 }}>{fraseDoFecho(p.recente, proximo)}</div>
      </Rasgo>
      <Adesivo tipo="estrela" style={{ left: 314, top: m(182, 150), width: 70, height: 70, transform: "rotate(14deg)" }} />
      <Adesivo tipo="coracao" style={{ left: 40, top: m(430, 370), width: 64, height: 64, transform: "rotate(-14deg)" }} />
      <Washi tipo="bolinhas" left={250} top={m(430, 370)} giro={-30} />
      <button type="button" onClick={(e) => { e.stopPropagation(); p.onFechar(); }} style={{ ...abs({ left: 38, right: 38, top: m(560, 470) }), height: 48, borderRadius: 12, background: R.grafite, color: "#fff", fontSize: 14, fontWeight: 800, border: 0, fontFamily: "inherit" }}>
        Voltar pro planner
      </button>
      {p.podeFocar && (
        <button type="button" onClick={(e) => { e.stopPropagation(); p.onFocar(); }} style={{ ...abs({ left: 38, right: 38, top: m(622, 530) }), background: "none", border: 0, textAlign: "center", fontSize: fs(12.5), color: "rgba(35,35,39,.7)", padding: "4px 0", fontFamily: "inherit" }}>
          Escolher 1 foco pra {proximo.toLowerCase()} →
        </button>
      )}
    </>
  );
};

/* ================================================ o card: página de recortes */

type Slot = [number, number, number, number];
const GC = {
  app: {
    w: 354, h: 630, raio: 6, fundo: "22px 22px, 22px 22px",
    dymo: { l: 16, t: 16, tam: 11, pad: "7px 14px 6px", raio: 3 },
    rasgo: { l: 16, t: 58, w: 200, pad: "9px 12px 10px", rot: 8.5, txt: 13 },
    faixa: { l: 22, t: 112, w: 312, h: 104 },
    pola: { l: 24, t: 214, w: 196, pad: [7, 7, 22] as [number, number, number], tam: 22, gap: [4, 3] as [number, number], inset: "10px 8px", legenda: 12, legendaMt: 8 },
    washi: [[-4, 212, 90, 20, -38], [170, 436, 90, 20, -30]] as [number, number, number, number, number][],
    slots: { halter: [238, 224, 92, 10], livro: [246, 316, 84, -8], chama: [232, 400, 90, 6], cofre: [150, 470, 84, -6], gota: [246, 486, 80, 12], estrela: [20, 490, 40, 14] } as Record<string, Slot>,
    semGasto: { l: 18, t: 540, w: 124, pad: "8px 10px 9px", rot: 8, txt: 14 },
    cupom: { l: 14, t: 452, w: 136, tam: 9.5 },
    rodape: { l: 16, b: 12, tam: 10, pad: "5px 10px 4px", url: 9.5, gap: 8, raio: 3, bComValores: 12 },
  },
  stories: {
    w: 1080, h: 1920, raio: 0, fundo: "44px 44px, 44px 44px",
    dymo: { l: 80, t: 262, tam: 30, pad: "16px 30px 14px", raio: 6 },
    rasgo: { l: 80, t: 372, w: 560, pad: "26px 34px 28px", rot: 22, txt: 38 },
    faixa: { l: 70, t: 505, w: 800, h: 266 },
    pola: { l: 90, t: 790, w: 460, pad: [18, 18, 56] as [number, number, number], tam: 52, gap: [9, 7] as [number, number], inset: "24px 20px", legenda: 30, legendaMt: 20 },
    washi: [[20, 782, 240, 54, -38], [430, 1330, 220, 54, -30]] as [number, number, number, number, number][],
    slots: { halter: [640, 800, 250, 10], livro: [680, 1030, 224, -8], chama: [640, 1260, 236, 6], gota: [470, 1390, 170, 12], estrela: [590, 1420, 96, 14] } as Record<string, Slot>,
    semGasto: { l: 80, t: 1400, w: 310, pad: "20px 26px 22px", rot: 20, txt: 36 },
    cupom: { l: 80, t: 1370, w: 330, tam: 20 },
    // com os R$ o cupom desce até 1580: a marca vai pra 1600 (ainda fora da barra de resposta dos Stories)
    rodape: { l: 80, b: 1920 - 1524 - 44, tam: 22, pad: "10px 22px 9px", url: 22, gap: 18, raio: 5, bComValores: 1920 - 1600 - 44 },
  },
} as const;

/** A página de scrapbook do mês (o card próprio do tema; 354×630 no app, 1080×1920 nos Stories). */
export const CardRecortes = ({ c, formato = "app", testId }: { c: ConteudoDoCard; formato?: "app" | "stories"; testId?: string }) => {
  const g = GC[formato];
  const s = (slot: Slot): CSSProperties => ({ left: slot[0], top: slot[1], width: slot[2], height: slot[2], transform: `rotate(${slot[3]}deg)` });
  const a = c.adesivos;
  const lado = g.pola.w - 2 * g.pola.pad[1];
  return (
    <div
      data-testid={testId}
      data-card="recortes"
      style={{ position: "relative", width: g.w, height: g.h, overflow: "hidden", borderRadius: g.raio, color: R.grafite, fontFamily: INTER, WebkitFontSmoothing: "antialiased", ...PAPEL.vichy, backgroundSize: g.fundo }}
    >
      <div style={abs({ left: g.dymo.l, top: g.dymo.t, transform: "rotate(-3deg)" })}><Dymo tam={g.dymo.tam} pad={g.dymo.pad} raio={g.dymo.raio}>{c.fita}</Dymo></div>
      {formato === "stories" && (
        <>
          <Adesivo tipo="fechado" style={{ left: 800, top: 262, width: 210, height: 210, transform: "rotate(9deg)" }} />
          <Adesivo tipo="coracao" style={{ left: 700, top: 400, width: 110, height: 110, transform: "rotate(-14deg)" }} />
        </>
      )}
      <Rasgo semente={11} style={{ left: g.rasgo.l, top: g.rasgo.t, width: g.rasgo.w, padding: g.rasgo.pad, transform: "rotate(1deg)" }}>
        <div style={rot(g.rasgo.rot)}>{c.abertura}</div>
        <div style={{ fontSize: g.rasgo.txt, fontWeight: 800, marginTop: formato === "app" ? 1 : 4, letterSpacing: formato === "app" ? undefined : "-.02em" }}>um mês pra guardar</div>
      </Rasgo>
      <Adesivo tipo="faixa" txt={c.perfil} style={{ left: g.faixa.l, top: g.faixa.t, width: g.faixa.w, height: g.faixa.h, transform: "rotate(-2deg)" }} />
      <div
        style={{
          position: "absolute", left: g.pola.l, top: g.pola.t, width: g.pola.w, boxSizing: "border-box", background: "#fcfbf8", transform: "rotate(-3deg)",
          padding: `${g.pola.pad[0]}px ${g.pola.pad[1]}px ${g.pola.pad[2]}px`, boxShadow: "0 1px 0 rgba(255,255,255,.7) inset, 0 14px 28px -14px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.12)",
        }}
      >
        <div style={{ position: "relative", width: lado, height: lado, background: FOTO.indigo }}>
          <div style={{ position: "absolute", inset: g.pola.inset, display: "flex", alignItems: "center" }}>
            <CalendarioDeEstrelas c={{ ano: c.ano, mesIdx: c.mesIdx, marcados: c.tira.marcados, primeiroDia: c.primeiroDia }} tam={g.pola.tam} gap={g.pola.gap} />
          </div>
        </div>
        <div style={{ ...serif, textAlign: "center", marginTop: g.pola.legendaMt, fontSize: g.pola.legenda, color: "#3b3b40", lineHeight: 1.05 }}>
          <b style={{ fontFamily: INTER, fontStyle: "normal", fontWeight: 800 }}>{c.diasAnotados} {c.diasAnotados === 1 ? "dia" : "dias"}</b> {c.diasAnotados === 1 ? "anotado" : "anotados"}{c.seguidos ? ` · ${c.seguidos} seguidos` : ""}
        </div>
      </div>
      {g.washi.map(([l, t, w, h, giro], i) => <Washi key={i} tipo={i ? "bolinhas" : "listras"} left={l} top={t} w={w} h={h} giro={giro} />)}
      {a.treinos > 0 ? <Adesivo tipo="halter" txt={String(a.treinos)} style={s(g.slots.halter)} /> : <Adesivo tipo="fechado" style={s(g.slots.halter)} />}
      {a.livros > 0 ? <Adesivo tipo="livro" txt={String(a.livros)} style={s(g.slots.livro)} /> : <Adesivo tipo="coracao" style={s(g.slots.livro)} />}
      {a.sequencia > 0 ? <Adesivo tipo="chama" txt={`${a.sequencia} DIAS`} style={s(g.slots.chama)} /> : <Adesivo tipo="estrela" style={s(g.slots.chama)} />}
      {"cofre" in g.slots && c.semGasto !== null && <Adesivo tipo="cofre" style={s((g.slots as Record<string, Slot>).cofre)} />}
      {a.agua > 0 && <Adesivo tipo="gota" txt={String(a.agua)} style={s(g.slots.gota)} />}
      {!c.dinheiro && <Adesivo tipo="estrela" style={s(g.slots.estrela)} />}
      {c.dinheiro ? (
        <Cupom
          testId="cupom-do-card"
          style={{ left: g.cupom.l, top: g.cupom.t, width: g.cupom.w, transform: "rotate(-2deg)" }}
          cabeca="O MÊS EM R$"
          linhas={c.dinheiro.map((d) => ({ k: d.rotulo, v: d.valor }))}
          pe="SÓ PRA VOCÊ"
          tam={g.cupom.tam}
        />
      ) : c.semGasto !== null && c.semGasto > 0 ? (
        <Rasgo semente={29} style={{ left: g.semGasto.l, top: g.semGasto.t, width: g.semGasto.w, padding: g.semGasto.pad, transform: "rotate(-2deg)" }}>
          <div style={rot(g.semGasto.rot)}>Sem gastar nada</div>
          <div style={{ fontSize: g.semGasto.txt, fontWeight: 800, marginTop: formato === "app" ? 1 : 2 }}><span style={{ fontVariantNumeric: "tabular-nums" }}>{c.semGasto}</span> {c.semGasto === 1 ? "dia" : "dias"}</div>
        </Rasgo>
      ) : null}
      <div style={abs({ left: g.rodape.l, bottom: c.dinheiro ? g.rodape.bComValores : g.rodape.b, display: "flex", alignItems: "center", gap: g.rodape.gap })}>
        <Dymo tam={g.rodape.tam} pad={g.rodape.pad} raio={g.rodape.raio}>core</Dymo>
        <span style={{ fontSize: g.rodape.url, fontWeight: 600, color: "#7a5a66", letterSpacing: ".06em" }}>coreaplicativo.com.br</span>
      </div>
    </div>
  );
};

export const StoryRecortes = ({ c }: { c: ConteudoDoCard }) => <CardRecortes c={c} formato="stories" />;

/* ============================================================== a pele */

export const PELE_RECORTES: Pele = {
  capa: (p) => pagina("kraft", <Capa {...p} />),
  capaCurta: (p) => pagina("kraft", <CapaCurta {...p} />),
  meuMes: (p) => pagina("menta", <MeuMes {...p} />),
  dinheiro: (p) => pagina("manteiga", <Dinheiro {...p} />),
  corpo: (p) => pagina("ceu", <Corpo {...p} />),
  humor: (p) => pagina("lavanda", <Humor {...p} />),
  foco: (p) => pagina("caderno", <Foco {...p} />),
  fato: (p) => pagina("menta", <Fato {...p} />),
  fecho: (p) => pagina("vichy", <Fecho {...p} />),
  card: {
    fundoCor: "#e6e1d8",
    fundo: <div style={{ position: "absolute", inset: 0, ...PAPEL.mesa }} />,
    moldura: MOLDURA,
    linha: { bg: "rgba(255,255,255,.7)", fg: R.grafite, sombra: "inset 0 0 0 1px rgba(0,0,0,.08)", trilhoOff: "#c9c3b8" },
    salvar: { bg: "rgba(255,255,255,.6)", fg: R.grafite, borda: "1.5px solid rgba(35,35,39,.3)" },
    postar: { bg: R.grafite, fg: "#fff" },
    proxima: "rgba(35,35,39,.62)",
    seg: { bg: "rgba(255,255,255,.7)", fg: R.grafite, onBg: R.grafite, onFg: "#fff" },
  },
  folha: { bg: "#fffaf0", fg: R.grafite, acento: R.magenta },
};
