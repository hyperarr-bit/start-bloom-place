import { useId } from "react";
import { TextoEmAnel } from "./TextoEmAnel";

/**
 * Metais dos níveis (26/09) — o selo em foil da capa muda de cor com o nível.
 * `foil`: o disco (6 paradas, diagonal); `plano`: os dentes; `tinta`: texto e
 * estrela gravados; `txtClara`/`txtEscura`: o "NÍVEL Ouro" escrito ao lado —
 * claro em capa escura, escurecido em capa clara (senão some no vichy).
 */
export interface Metal {
  foil: string[];
  plano: [string, string];
  tinta: string;
  txtClara: string[];
  txtEscura: string[];
}

const PARADAS_FOIL = [0, 0.25, 0.5, 0.65, 0.8, 1];

export const METAIS: Record<string, Metal> = {
  Bronze: {
    foil: ["#fde2c8", "#e3a574", "#a55d2c", "#f9d2ae", "#c47c45", "#7a3e17"],
    plano: ["#ebb487", "#b8703c"],
    tinta: "#5a2b0e",
    txtClara: ["#fde2c8", "#e3a574", "#b8703c", "#f9d2ae", "#d08a52", "#a55d2c"],
    txtEscura: ["#b8703c", "#7a3e17", "#d99a66", "#7a3e17", "#a55d2c"],
  },
  Prata: {
    foil: ["#ffffff", "#dfe4ea", "#8e99a6", "#f4f6f9", "#b9c2cc", "#5f6a77"],
    plano: ["#eef1f4", "#aeb7c2"],
    tinta: "#39424d",
    txtClara: ["#ffffff", "#dfe4ea", "#a3adb9", "#f4f6f9", "#c7cfd8", "#8e99a6"],
    txtEscura: ["#8e99a6", "#4f5965", "#b9c2cc", "#4f5965", "#6f7a87"],
  },
  Ouro: {
    foil: ["#fff3c4", "#e9c65a", "#b8860b", "#fff1b0", "#d4a629", "#8f6a0c"],
    plano: ["#f6d77a", "#d9a72a"],
    tinta: "#6b4a05",
    txtClara: ["#fff3c4", "#e9c65a", "#b8860b", "#fff1b0", "#d4a629", "#8f6a0c"],
    txtEscura: ["#c9961a", "#8f6a0c", "#e6c25a", "#8f6a0c", "#b8860b"],
  },
  Platina: {
    foil: ["#f6fbff", "#d3e0ec", "#8499ae", "#eef6fc", "#aec1d4", "#566b80"],
    plano: ["#e3ecf5", "#a2b6ca"],
    tinta: "#2c3e51",
    txtClara: ["#f6fbff", "#d3e0ec", "#9db0c3", "#eef6fc", "#bccbdb", "#8499ae"],
    txtEscura: ["#8499ae", "#3f5367", "#aec1d4", "#3f5367", "#566b80"],
  },
  Diamante: {
    foil: ["#f0fbff", "#b5e3fa", "#4fa6e0", "#e6f6ff", "#8fcaf2", "#2f7cbf"],
    plano: ["#cdeefc", "#84c3ee"],
    tinta: "#15446b",
    txtClara: ["#f0fbff", "#b5e3fa", "#6ab7e8", "#e6f6ff", "#9fd3f5", "#4fa6e0"],
    txtEscura: ["#4fa6e0", "#1f5f96", "#8fcaf2", "#1f5f96", "#2f7cbf"],
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

/** "NÍVEL / Ouro" em foil — SVG com degradê (o `background-clip: text` não sai na foto do Safari). */
export const NivelEmFoil = ({
  nivel, capaClara, rotulo = 9.5, nome = 22, espaco = 1.9,
}: { nivel: string; capaClara: boolean; rotulo?: number; nome?: number; espaco?: number }) => {
  const uid = `foil${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const m = metalDo(nivel);
  const cores = capaClara ? m.txtEscura : m.txtClara;
  const alturaRotulo = rotulo * 1.3;
  return (
    <svg width={nome * 5.6} height={alturaRotulo + nome * 1.15} style={{ overflow: "visible", display: "block" }} aria-label={`Nível ${nivel}`} role="img">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          {cores.map((c, i) => <stop key={i} offset={i / (cores.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <text x="0" y={rotulo} fontFamily="Inter, -apple-system, sans-serif" fontSize={rotulo} fontWeight={800} letterSpacing={espaco} fill={`url(#${uid})`}>
        NÍVEL
      </text>
      <text x="0" y={alturaRotulo + nome * 0.9} fontFamily="Inter, -apple-system, sans-serif" fontSize={nome} fontWeight={800} letterSpacing={-0.01 * nome} fill={`url(#${uid})`}>
        {nivel}
      </text>
    </svg>
  );
};
