import type { TipoCard } from "./tipos";

/**
 * AS CORES DE CADA CARD (29/09, direção A · Pôster): um BLOCO DE COR por
 * assunto (o card de treino é azul, o de leitura é terracota…), texto
 * branco. Cada degradê foi escolhido pro texto branco passar no AA em
 * TODOS os pontos do fundo (o teste confere com a conta do WCAG): as
 * legendas pequenas precisam de 4,5:1; os números gigantes, de 3:1.
 */

export interface TemaDoCard {
  /** As paradas do degradê (de cima pra baixo). */
  paradas: string[];
  /** Ângulo do degradê. */
  angulo: number;
  /** Texto principal e texto suave. */
  tinta: string;
  suave: string;
  /** O "apagado" (casa sem nada, trilho da barra). */
  apagado: string;
  /** O nome que aparece no chip. */
  modulo: string;
  /** A cor que pinta o número DENTRO das casas acesas (casa branca). */
  destaque: string;
}

export const TEMAS: Record<TipoCard, TemaDoCard> = {
  treinos: { paradas: ["#2563eb", "#1d4ed8", "#1e3a8a"], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Treino", destaque: "#1d4ed8" },
  azul: { paradas: ["#f5efe3", "#f1e9da"], angulo: 180, tinta: "#1f1f24", suave: "#5f574d", apagado: "rgba(31,31,36,.08)", modulo: "Finanças", destaque: "#1d4ed8" },
  poupanca: { paradas: ["#f5efe3", "#f1e9da"], angulo: 180, tinta: "#1f1f24", suave: "#5f574d", apagado: "rgba(31,31,36,.08)", modulo: "Finanças", destaque: "#047857" },
  livros: { paradas: ["#c2410c", "#9a3412", "#7c2d12"], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Leitura", destaque: "#9a3412" },
  sequencia: { paradas: ["#c2410c", "#b91c1c", "#7f1d1d"], angulo: 160, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Sequência", destaque: "#b91c1c" },
  agua: { paradas: ["#0369a1", "#075985", "#0c4a6e"], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Saúde · Água", destaque: "#0369a1" },
  sono: { paradas: ["#4338ca", "#312e81", "#1e1b4b"], angulo: 170, tinta: "#ffffff", suave: "rgba(255,255,255,.84)", apagado: "rgba(255,255,255,.14)", modulo: "Saúde · Sono", destaque: "#4338ca" },
  habitos: { paradas: ["#047857", "#065f46", "#064e3b"], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Rotina", destaque: "#047857" },
  metas: { paradas: ["#be185d", "#9d174d", "#831843"], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Metas", destaque: "#be185d" },
  insignia: { paradas: ["#065f46", "#064e3b", "#022c22"], angulo: 180, tinta: "#ffffff", suave: "rgba(255,255,255,.84)", apagado: "rgba(255,255,255,.14)", modulo: "Insígnia", destaque: "#065f46" },
  figurinha: { paradas: ["#fde68a", "#fbbf24", "#f59e0b"], angulo: 165, tinta: "#1f1f24", suave: "#422006", apagado: "rgba(31,31,36,.10)", modulo: "Figurinha", destaque: "#b45309" },
  numero: { paradas: ["#334155", "#1e293b", "#0f172a"], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo: "Conquista", destaque: "#334155" },
};

/** Mistura duas cores hex (t = 0 → a, 1 → b). */
export const misturar = (a: string, b: string, t: number) => {
  const p = (h: string) => { const n = h.replace("#", ""); const x = n.length === 3 ? n.split("").map((c) => c + c).join("") : n; return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
  const [ra, ga, ba] = p(a), [rb, gb, bb] = p(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(ra + (rb - ra) * t)}${h(ga + (gb - ga) * t)}${h(ba + (bb - ba) * t)}`;
};

/**
 * O tema do card GERAL a partir da cor da área: escurece até o branco passar
 * no AA (4,5:1) no ponto mais claro do degradê.
 */
export const temaDaCor = (cor: string, modulo: string): TemaDoCard => {
  let topo = cor;
  for (let i = 0; i < 12 && contraste("#ffffff", topo) < 4.6; i++) topo = misturar(topo, "#000000", 0.08);
  return { paradas: [topo, misturar(topo, "#000000", 0.22), misturar(topo, "#000000", 0.45)], angulo: 165, tinta: "#ffffff", suave: "rgba(255,255,255,.86)", apagado: "rgba(255,255,255,.16)", modulo, destaque: topo };
};

export const fundoDo = (t: TemaDoCard) => (t.paradas.length === 1 ? t.paradas[0] : `linear-gradient(${t.angulo}deg, ${t.paradas.join(", ")})`);

/* ------------------------------------------------------------------------- *
 * Contraste (WCAG 2.x) — usado no teste e na escolha das cores
 * ------------------------------------------------------------------------- */

const canal = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export const luminancia = (hex: string) => {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
export const contraste = (a: string, b: string) => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
