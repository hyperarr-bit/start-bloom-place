import { useId, type CSSProperties } from "react";
import { RARIDADE_LABEL, XP_RARIDADE, type Raridade } from "@/components/gamification/types";
import { Adesivo } from "./adesivos-arte";
import "./conquistas.css";

/**
 * RARIDADE NO ADESIVO (27/09, Duolingo sem sorteio): o adesivo de sempre com o
 * tratamento da raridade em volta — borda azul (raro), anel holográfico
 * girando + brilho (épico), anel de ouro + faíscas (lendário) — e o estado
 * trancado (silhueta com halo). O anel e o brilho são CSS (transform só);
 * pras artes dos Stories, que viram foto, existe o `AnelRaridadeSvg`, porque
 * conic-gradient + mask + mix-blend-mode não são garantidos no html-to-image.
 */

const ESTRELA4 = "12 0 14.5 9.5 24 12 14.5 14.5 12 24 9.5 14.5 0 12 9.5 9.5";

const Faiscas = () => (
  <>
    <svg className="ad-faisca" viewBox="0 0 24 24" style={{ left: "-4%", top: "6%", animationDelay: ".2s" }} aria-hidden><polygon points={ESTRELA4} fill="currentColor" /></svg>
    <svg className="ad-faisca" viewBox="0 0 24 24" style={{ right: "-6%", top: "22%", width: 8, height: 8, animationDelay: ".9s" }} aria-hidden><polygon points={ESTRELA4} fill="currentColor" /></svg>
    <svg className="ad-faisca" viewBox="0 0 24 24" style={{ right: "8%", bottom: "-2%", width: 9, height: 9, animationDelay: "1.4s" }} aria-hidden><polygon points={ESTRELA4} fill="currentColor" /></svg>
  </>
);

interface Props {
  id: string;
  raridade: Raridade;
  tamanho: number;
  trancado?: boolean;
  titulo?: string;
  bordaGrossa?: boolean;
  /** Rotação "colada à mão", em graus. */
  giro?: number;
  className?: string;
  style?: CSSProperties;
  /** Índice na entrada da tela (pipoca em sequência). */
  entradaIndice?: number;
}

export const AdesivoRaro = ({ id, raridade, tamanho, trancado, titulo, bordaGrossa, giro = 0, className, style, entradaIndice }: Props) => {
  const brilha = !trancado && (raridade === "epico" || raridade === "lendario");
  return (
    <span
      className={`ad-rar${entradaIndice !== undefined ? " ad-entra" : ""}${className ? ` ${className}` : ""}`}
      data-rar={raridade}
      data-trancado={trancado ? "" : undefined}
      style={{ width: tamanho, height: tamanho, "--giro": `${giro}deg`, "--i": entradaIndice, transform: giro ? `rotate(${giro}deg)` : undefined, ...style } as CSSProperties}
    >
      {brilha && <span className="ad-anel" aria-hidden />}
      {brilha && <span className="ad-sheen" aria-hidden />}
      {!trancado && raridade === "lendario" && <Faiscas />}
      <Adesivo id={id} tamanho={tamanho} titulo={titulo} bordaGrossa={bordaGrossa} />
    </span>
  );
};

/** "ÉPICO · +200 XP" · "ADESIVO ÉPICO · +200 XP" · "A CAMINHO · LENDÁRIO · +400 XP" (o `texto` troca o rótulo). */
export const ChipRaridade = ({ raridade, texto, tam = "p", className }: { raridade: Raridade; texto?: string; tam?: "p" | "m" | "g"; className?: string }) => (
  <span className={`chip-rar${className ? ` ${className}` : ""}`} data-rar={raridade} data-tam={tam === "p" ? undefined : tam}>
    {texto ?? RARIDADE_LABEL[raridade]} · +{XP_RARIDADE[raridade]} XP
  </span>
);

const HOLO = ["#ff7ad9", "#ffd36e", "#7dffb3", "#6ec8ff", "#b98bff", "#ff7ad9"];
const OURO = ["#fff1b0", "#d4a629", "#8f6a0c", "#fff3c4", "#e9c65a", "#8f6a0c", "#fff1b0"];
/** As cores do anel (o vídeo do álbum desenha o mesmo anel no canvas). */
export const CORES_ANEL: Record<"epico" | "lendario", string[]> = { epico: HOLO, lendario: OURO };
/** Halo por trás do anel (idem). */
export const HALO_ANEL: Record<"epico" | "lendario", string> = { epico: "rgba(185,139,255,.28)", lendario: "rgba(212,166,41,.35)" };

/** A cor em `t` (0..1) ao longo da lista, misturando os vizinhos. */
export const corDoAnel = (cores: string[], t: number): string => {
  const pos = Math.max(0, Math.min(1, t)) * (cores.length - 1);
  const i = Math.min(cores.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = cores[i], b = cores[i + 1];
  const mix = (k: number) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - f) + parseInt(b.slice(k, k + 2), 16) * f);
  return `rgb(${mix(1)},${mix(3)},${mix(5)})`;
};

/**
 * O anel da raridade desenhado em SVG (arcos coloridos com degradê entre
 * vizinhos) — pra foto dos Stories, sem animação. `tamanho` é o lado do
 * adesivo; o anel fica 9% pra fora, como o de CSS.
 */
export const AnelRaridadeSvg = ({ raridade, tamanho }: { raridade: "epico" | "lendario"; tamanho: number }) => {
  const uid = `anel${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cores = raridade === "lendario" ? OURO : HOLO;
  const lado = tamanho * 1.18;
  const c = lado / 2;
  const rExt = c;
  const rInt = c * 0.83;
  const n = 72;
  const passo = (Math.PI * 2) / n;
  const corEm = (t: number) => corDoAnel(cores, t);
  const fatias = Array.from({ length: n }, (_, i) => {
    const a0 = i * passo - Math.PI / 2 + (raridade === "lendario" ? 0.35 : 0);
    const a1 = a0 + passo * 1.15;
    const p = (r: number, a: number) => `${(c + Math.cos(a) * r).toFixed(2)},${(c + Math.sin(a) * r).toFixed(2)}`;
    return <path key={i} d={`M${p(rExt, a0)} A${rExt},${rExt} 0 0 1 ${p(rExt, a1)} L${p(rInt, a1)} A${rInt},${rInt} 0 0 0 ${p(rInt, a0)} Z`} fill={corEm(i / n)} />;
  });
  return (
    <svg viewBox={`0 0 ${lado} ${lado}`} width={lado} height={lado} style={{ position: "absolute", left: -(lado - tamanho) / 2, top: -(lado - tamanho) / 2, overflow: "visible" }} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-h`} cx=".5" cy=".5" r=".5">
          <stop offset=".72" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor={HALO_ANEL[raridade]} />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={rExt * 1.08} fill={`url(#${uid}-h)`} />
      {fatias}
      <circle cx={c} cy={c} r={(rExt + rInt) / 2} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={(rExt - rInt) * 0.22} />
    </svg>
  );
};
