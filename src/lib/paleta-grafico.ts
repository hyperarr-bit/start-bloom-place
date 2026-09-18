/**
 * Paleta dos gráficos por tema (17/09, modo escuro como sistema).
 *
 * Antes a lista de cores era uma só (a do claro, a 100 % de saturação) e no
 * escuro cada fatia gritava. A escura é a mesma ordem de matizes (violeta,
 * magenta, dourado, verde, azul, coral…) em tons que passam no fundo escuro:
 * validada pra daltonismo (ΔE 10,5) e visão normal (ΔE 18,3), contraste ≥ 3:1
 * sobre #171A20. Ordem FIXA — a cor segue a categoria, nunca a posição.
 */
import { useTheme } from "@/hooks/use-theme";

export const PALETA_CLARA = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#6366f1", "#14b8a6"];
export const PALETA_ESCURA = ["#8A7DE6", "#D4568C", "#BF7F12", "#2AA379", "#3B8AE0", "#D9694F", "#6E7FE0", "#2E9C9A"];

const SEMANTICA = {
  clara:  { positivo: "#10b981", negativo: "#ef4444", azul: "#3b82f6", roxo: "#a855f7" },
  escura: { positivo: "#2AA379", negativo: "#D9694F", azul: "#3B8AE0", roxo: "#8A7DE6" },
};

export function usePaletaGrafico() {
  const { mode } = useTheme();
  const escuro = mode === "dark";
  return { escuro, cores: escuro ? PALETA_ESCURA : PALETA_CLARA, ...(escuro ? SEMANTICA.escura : SEMANTICA.clara) };
}
