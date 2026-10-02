import { useId } from "react";
import { TextoEmAnel } from "./TextoEmAnel";

/**
 * Metais dos níveis (26/09) — o selo em foil da capa muda de cor com o nível.
 * `foil`: o disco (6 paradas, diagonal); `plano`: os dentes; `tinta`: texto e
 * estrela gravados; `contorno`: o tom escuro do MESMO metal que contorna o
 * "NÍVEL", o nome e o "core" na capa (02/10, dono: a gravação segue o metal
 * do nível, igual em todas as capas — o contorno garante a leitura em capa
 * clara e escura, sem trocar a cor do metal).
 */
export interface Metal {
  foil: string[];
  plano: [string, string];
  tinta: string;
  contorno: string;
}

const PARADAS_FOIL = [0, 0.25, 0.5, 0.65, 0.8, 1];

export const METAIS: Record<string, Metal> = {
  Bronze: {
    foil: ["#fde2c8", "#e3a574", "#a55d2c", "#f9d2ae", "#c47c45", "#7a3e17"],
    plano: ["#ebb487", "#b8703c"],
    tinta: "#5a2b0e",
    contorno: "#391504",
  },
  Prata: {
    foil: ["#ffffff", "#dfe4ea", "#8e99a6", "#f4f6f9", "#b9c2cc", "#5f6a77"],
    plano: ["#eef1f4", "#aeb7c2"],
    tinta: "#39424d",
    contorno: "#242c36",
  },
  Ouro: {
    foil: ["#fff3c4", "#e9c65a", "#b8860b", "#fff1b0", "#d4a629", "#8f6a0c"],
    plano: ["#f6d77a", "#d9a72a"],
    tinta: "#6b4a05",
    contorno: "#4a3203",
  },
  Platina: {
    foil: ["#f6fbff", "#d3e0ec", "#8499ae", "#eef6fc", "#aec1d4", "#566b80"],
    plano: ["#e3ecf5", "#a2b6ca"],
    tinta: "#2c3e51",
    contorno: "#1d2c3a",
  },
  Diamante: {
    foil: ["#f0fbff", "#b5e3fa", "#4fa6e0", "#e6f6ff", "#8fcaf2", "#2f7cbf"],
    plano: ["#cdeefc", "#84c3ee"],
    tinta: "#15446b",
    contorno: "#0b3050",
  },
};

export const metalDo = (nivel: string): Metal => METAIS[nivel] ?? METAIS.Ouro;

const ESTRELA = "0,-7 2.1,-2.2 7.1,-2.2 3,1 4.4,6 0,3.2 -4.4,6 -3,1 -7.1,-2.2 -2.1,-2.2";

/** O texto do anel cabe nos dois tamanhos: nome curto repete, nome longo não. */
const textoDoSelo = (nivel: string) => {
  const n = nivel.toUpperCase();
  return n.length <= 6 ? `NÍVEL ${n} · CORE · NÍVEL ${n} · ` : `NÍVEL ${n} · MEMBRO CORE · `;
};

/** Selo dentado em foil com o nível gravado (a peça da capa). */
export const SeloNivel = ({ nivel, tamanho, sombra = true }: { nivel: string; tamanho: number; sombra?: boolean }) => {
  const uid = `selo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const m = metalDo(nivel);
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      style={{ overflow: "visible", filter: sombra ? `drop-shadow(0 ${tamanho / 32}px ${tamanho / 32}px rgba(0,0,0,.5))` : undefined, flexShrink: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="1" y2="1">
          {m.foil.map((c, i) => <stop key={i} offset={PARADAS_FOIL[i]} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`${uid}-p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.plano[0]} />
          <stop offset="1" stopColor={m.plano[1]} />
        </linearGradient>
      </defs>
      <g fill={`url(#${uid}-p)`}>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <circle key={i} cx={(50 + Math.cos(a) * 40).toFixed(1)} cy={(50 + Math.sin(a) * 40).toFixed(1)} r="7" />;
        })}
      </g>
      <circle cx="50" cy="50" r="40" fill={`url(#${uid}-f)`} />
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
      <circle cx="50" cy="50" r="28" fill="none" stroke={m.tinta} strokeOpacity=".55" strokeWidth="1" />
      <TextoEmAnel cx={50} cy={50} r={34} texto={textoDoSelo(nivel)} fontSize={7.6} fill={m.tinta} />
      <polygon transform="translate(50,50) scale(2.1)" points={ESTRELA} fill={m.tinta} />
    </svg>
  );
};

/**
 * A GRAVAÇÃO do nível (02/10): as cores do "NÍVEL", do nome do nível e do "core" na capa.
 * Depende SÓ do nível — a capa não entra na conta: Platina é platina no grafite, no kraft e no lilás.
 * `paradas` = o foil do disco da insígnia (as mesmas 6 cores); `contorno` = o tom escuro do metal.
 */
export const gravacaoDoNivel = (nivel: string): { paradas: string[]; contorno: string } => {
  const m = metalDo(nivel);
  return { paradas: m.foil, contorno: m.contorno };
};
