import { useId, type CSSProperties, type ReactNode } from "react";
import type { GrupoDoCorpo } from "@/lib/retrospectiva";
import { pictoDe } from "./pecas-planner";

/**
 * A BIBLIOTECA DE ADESIVOS DOS RECORTES (26/09) — portada do d2.html do
 * designer: chama com rótulo, halter com moeda, livro, gota, cofrinho,
 * roseta do dia, selo "fechado", coração, estrela, lua, a faixa do perfil e
 * o adesivo de treino (pictograma + moeda). Mesma régua dos adesivos das
 * Conquistas (contorno grafite, borda branca de recorte feita pelo
 * feMorphology, sombra curta) — e, como lá, cada SVG leva o PRÓPRIO filtro
 * (id único): o gerador dos Stories clona só o nó, e um filtro definido fora
 * dele sumiria na foto.
 */

const TRACO = "#2b2b2f";
const FONTE = "Inter, -apple-system, sans-serif";

export type TipoDeAdesivo =
  | "chama" | "halter" | "livro" | "gota" | "cofre" | "roseta" | "fechado" | "coracao" | "estrela" | "lua" | "faixa" | "treino";

interface Props {
  tipo: TipoDeAdesivo;
  /** o texto do adesivo: "9 DIAS" (chama), "14" (halter/livro/gota/treino), perfil (faixa), "4/4" (roseta) */
  txt?: string;
  /** roseta: o nome do dia ("TERÇA") e as cores; treino: o grupo e a cor pastel */
  dia?: string;
  cor?: string;
  grupo?: GrupoDoCorpo;
  style?: CSSProperties;
}

const Moeda = ({ x, y, r, txt, tam }: { x: number; y: number; r: number; txt: string; tam: number }) => (
  <>
    <circle cx={x} cy={y} r={r} fill="#fde047" />
    <text x={x} y={y + tam * 0.36} textAnchor="middle" fontFamily={FONTE} fontSize={tam} fontWeight={900} fill={TRACO} stroke="none">{txt}</text>
  </>
);

/** As cores da roseta por dia da semana (a da terça é a do mockup). */
const COR_DA_ROSETA: Record<string, [string, string, string]> = {
  SEGUNDA: ["#2563eb", "#3b82f6", "#fde047"],
  "TERÇA": ["#4f46e5", "#6366f1", "#fde047"],
  QUARTA: ["#15803d", "#22c55e", "#fef9c3"],
  QUINTA: ["#ca8a04", "#eab308", "#2b2b2f"],
  SEXTA: ["#db2777", "#ec4899", "#fde047"],
  "SÁBADO": ["#9333ea", "#a855f7", "#fde047"],
  DOMINGO: ["#7c3aed", "#8b5cf6", "#fde047"],
};

const arte = (p: Props): { viewBox: string; grossa?: boolean; g: ReactNode } => {
  const t = p.txt ?? "";
  switch (p.tipo) {
    case "chama": {
      const largo = t.length > 6;
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <path d="M50,12 C56,26 70,30 70,50 C70,64 61,74 50,76 C39,74 30,64 30,50 C30,44 33,38 37,34 C37,42 42,45 44,45 C42,36 46,22 50,12 Z" fill="#fb923c" />
            <path d="M50,42 C54,50 60,52 60,60 C60,67 55,72 50,73 C45,72 40,67 40,60 C40,56 42,52 45,50 C45,54 48,56 49,56 C48,52 49,46 50,42 Z" fill="#fde047" stroke="none" />
            <rect x={largo ? 14 : 20} y="72" width={largo ? 72 : 60} height="18" rx="4" fill="#d22d80" />
            <text x="50" y="85" textAnchor="middle" fontFamily={FONTE} fontSize="10.5" fontWeight={900} letterSpacing="1" fill="#fff" stroke="none">{t}</text>
          </>
        ),
      };
    }
    case "halter":
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <g transform="rotate(-30 50 50)">
              <rect x="30" y="46" width="40" height="8" rx="3" fill="#a3a3a3" />
              <rect x="16" y="34" width="12" height="32" rx="4" fill="#3b82f6" />
              <rect x="72" y="34" width="12" height="32" rx="4" fill="#3b82f6" />
              <rect x="8" y="39" width="8" height="22" rx="3" fill="#60a5fa" />
              <rect x="84" y="39" width="8" height="22" rx="3" fill="#60a5fa" />
            </g>
            <Moeda x={74} y={76} r={14} txt={t} tam={t.length > 2 ? 11 : 14} />
          </>
        ),
      };
    case "livro":
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <path d="M14,30 C26,24 40,26 50,34 C60,26 74,24 86,30 V76 C74,70 60,72 50,80 C40,72 26,70 14,76 Z" fill="#c4b5fd" />
            <path d="M50,34 V80" fill="none" />
            <path d="M20,38 C28,35 38,36 46,42 M20,48 C28,45 38,46 46,52 M20,58 C28,55 38,56 46,62" fill="none" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" />
            <path d="M54,42 C62,36 72,35 80,38 M54,52 C62,46 72,45 80,48 M54,62 C62,56 72,55 80,58" fill="none" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" />
            <path d="M62,14 H72 V40 L67,36 L62,40 Z" fill="#d22d80" />
            <Moeda x={80} y={76} r={13} txt={t} tam={t.length > 2 ? 11 : 14} />
          </>
        ),
      };
    case "gota":
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <path d="M50,12 C60,30 74,42 74,58 A24,24 0 0 1 26,58 C26,42 40,30 50,12 Z" fill="#38bdf8" />
            <path d="M36,60 C36,52 40,46 44,42" fill="none" stroke="#e0f2fe" strokeWidth={3.5} strokeLinecap="round" />
            <circle cx="76" cy="30" r="5" fill="#bae6fd" />
            {t && <Moeda x={76} y={78} r={13} txt={t} tam={t.length > 2 ? 10.5 : 13} />}
          </>
        ),
      };
    case "cofre":
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <ellipse cx="50" cy="58" rx="30" ry="22" fill="#60a5fa" />
            <path d="M34,42 L30,32 L42,38 Z" fill="#60a5fa" />
            <ellipse cx="80" cy="60" rx="7" ry="6" fill="#93c5fd" />
            <circle cx="78" cy="59" r="1.4" fill={TRACO} stroke="none" />
            <circle cx="82" cy="59" r="1.4" fill={TRACO} stroke="none" />
            <rect x="30" y="76" width="9" height="9" rx="2" fill="#60a5fa" />
            <rect x="60" y="76" width="9" height="9" rx="2" fill="#60a5fa" />
            <circle cx="64" cy="52" r="2" fill={TRACO} stroke="none" />
            <rect x="43" y="34" width="14" height="4" rx="2" fill={TRACO} stroke="none" />
            <Moeda x={50} y={20} r={9} txt="$" tam={10} />
            <path d="M20,60 C16,56 17,50 22,49" fill="none" strokeLinecap="round" />
          </>
        ),
      };
    case "roseta": {
      const [dente, miolo, valor] = COR_DA_ROSETA[p.dia ?? "TERÇA"] ?? COR_DA_ROSETA["TERÇA"];
      const nome = (p.dia ?? "").replace("-FEIRA", "");
      return {
        viewBox: "0 0 100 100",
        g: (
          <g stroke="none">
            <g fill={dente} stroke={TRACO} strokeWidth={2}>
              {Array.from({ length: 14 }, (_, i) => {
                const a = (i / 14) * Math.PI * 2;
                return <circle key={i} cx={(50 + Math.cos(a) * 36).toFixed(1)} cy={(50 + Math.sin(a) * 36).toFixed(1)} r="8" />;
              })}
            </g>
            <circle cx="50" cy="50" r="33" fill={miolo} stroke={TRACO} strokeWidth={2.2} />
            <circle cx="50" cy="50" r="26" fill="none" stroke="#fff" strokeWidth={1.4} strokeDasharray="3 3" />
            <text x="50" y="46" textAnchor="middle" fontFamily={FONTE} fontSize={nome.length > 6 ? 9.5 : 11} fontWeight={900} letterSpacing="1.5" fill="#fff">{nome}</text>
            <text x="50" y="63" textAnchor="middle" fontFamily={FONTE} fontSize="15" fontWeight={900} fill={valor}>{t}</text>
          </g>
        ),
      };
    }
    case "fechado":
      return {
        viewBox: "0 0 100 100",
        g: (
          <g stroke="none">
            <circle cx="50" cy="50" r="40" fill="#d22d80" stroke={TRACO} strokeWidth={2.2} />
            <circle cx="50" cy="50" r="33" fill="none" stroke="#fff" strokeWidth={1.5} />
            {/* (26/09) 10.5 e não 11.5: na régua do desenho o "FECHADO" passava do anel branco */}
            <text x="50" y="47" textAnchor="middle" fontFamily={FONTE} fontSize="10.5" fontWeight={900} letterSpacing="1.1" fill="#fff">FECHADO</text>
            <path d="M40,58 l6,6 l14,-14" fill="none" stroke="#fde047" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ),
      };
    case "coracao":
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <path d="M50,84 C30,68 14,56 14,38 C14,26 23,18 33,18 C41,18 47,23 50,29 C53,23 59,18 67,18 C77,18 86,26 86,38 C86,56 70,68 50,84 Z" fill="#f472b6" />
            <path d="M26,36 C26,29 30,25 35,25" fill="none" stroke="#fce7f3" strokeWidth={3.5} strokeLinecap="round" />
          </>
        ),
      };
    case "estrela":
      return { viewBox: "0 0 100 100", g: <polygon points="50,10 61,38 90,38 67,55 75,84 50,67 25,84 33,55 10,38 39,38" fill="#fde047" /> };
    case "lua":
      return {
        viewBox: "0 0 100 100",
        g: (
          <>
            <path d="M62,14 C40,18 26,36 30,58 C34,78 54,90 74,84 C56,80 44,66 44,48 C44,34 51,22 62,14 Z" fill="#c4b5fd" />
            <circle cx="76" cy="30" r="4" fill="#fde047" />
          </>
        ),
      };
    case "faixa": {
      const T = t.toUpperCase();
      return {
        viewBox: "0 0 300 100",
        grossa: true,
        g: (
          <g stroke="none">
            <path d="M18,22 H282 L266,50 L282,78 H18 L34,50 Z" fill="#d22d80" stroke={TRACO} strokeWidth={2.4} strokeLinejoin="round" />
            <text x="150" y="44" textAnchor="middle" fontFamily={FONTE} fontSize="11" fontWeight={800} letterSpacing="3" fill="#fbcfe8">PERFIL DO MÊS</text>
            <text x="150" y="68" textAnchor="middle" fontFamily={FONTE} fontSize={T.length > 19 ? (19 * 19) / T.length : 19} fontWeight={900} letterSpacing="1" fill="#fff">{T}</text>
          </g>
        ),
      };
    }
    case "treino":
      return {
        viewBox: "0 0 100 100",
        g: (
          <g>
            <circle cx="48" cy="50" r="36" fill={p.cor ?? "#bfdbfe"} stroke={TRACO} strokeWidth={2.2} />
            <svg x="22" y="24" width="52" height="52" viewBox="0 0 48 48" fill="none" stroke={TRACO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              {pictoDe(p.grupo ?? "pernas")}
            </svg>
            <circle cx="80" cy="76" r="14" fill="#fde047" stroke={TRACO} strokeWidth={2.2} />
            <text x="80" y="81" textAnchor="middle" fontFamily={FONTE} fontSize="14" fontWeight={900} fill={TRACO} stroke="none">{t}</text>
          </g>
        ),
      };
  }
};

/** Um adesivo recortado (posição/tamanho/giro pelo `style`). */
export const Adesivo = (p: Props) => {
  const uid = `rc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const a = arte(p);
  const raio = a.grossa ? 4.5 : 3;
  return (
    <div aria-hidden style={{ position: "absolute", overflow: "visible", ...p.style }} data-adesivo={p.tipo}>
      <svg viewBox={a.viewBox} style={{ width: "100%", height: "100%", overflow: "visible", display: "block" }}>
        <defs>
          <filter id={uid} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius={raio} result="dil" />
            <feFlood floodColor="#ffffff" result="w" />
            <feComposite in="w" in2="dil" operator="in" result="borda" />
            <feGaussianBlur in="dil" stdDeviation={a.grossa ? 2.5 : 2} result="bl" />
            <feOffset in="bl" dx="0" dy={a.grossa ? 3 : 2} result="off" />
            <feFlood floodColor="#000" floodOpacity={a.grossa ? 0.3 : 0.26} result="sc" />
            <feComposite in="sc" in2="off" operator="in" result="sombra" />
            <feMerge>
              <feMergeNode in="sombra" />
              <feMergeNode in="borda" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#${uid})`} stroke={TRACO} strokeWidth={2.2} strokeLinejoin="round">
          {a.g}
        </g>
      </svg>
    </div>
  );
};

/** As cores pastel do adesivo de treino, na ordem dos grupos do mês. */
export const COR_DO_ADESIVO_DE_TREINO = ["#bfdbfe", "#c7d2fe", "#fbcfe8", "#bbf7d0", "#fde68a"];
