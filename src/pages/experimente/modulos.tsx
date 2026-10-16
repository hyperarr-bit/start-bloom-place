import { lazy } from "react";
import type { ModuloDemo } from "./conteudo";

/**
 * Os 5 módulos DE VERDADE que a demo monta (carregados sob demanda) + o esqueleto enquanto carregam.
 * Usados pelo funil-demo (/experimente) e pela demo que vende no site (/liberar, 16/10).
 */
const lazyModulo = (carregar: () => Promise<{ default?: unknown }>) =>
  lazy(async () => {
    const mod = await carregar();
    if (mod && typeof mod.default !== "undefined") return mod as { default: React.ComponentType };
    throw new Error("Failed to fetch dynamically imported module (módulo resolveu vazio)");
  });
export const COMPONENTES: Record<ModuloDemo, React.ComponentType> = {
  financas: lazyModulo(() => import("@/pages/Index")),
  rotina: lazyModulo(() => import("@/pages/Rotina")),
  treino: lazyModulo(() => import("@/pages/Treino")),
  saude: lazyModulo(() => import("@/pages/Saude")),
  dieta: lazyModulo(() => import("@/pages/Dieta")),
};

export const CarregandoModulo = () => (
  <div className="min-h-[60vh] px-4 pt-6 space-y-3 animate-pulse" aria-busy="true" aria-label="Carregando">
    <div className="h-8 w-40 rounded-lg bg-muted" />
    <div className="h-10 rounded-xl bg-muted/70" />
    <div className="h-40 rounded-2xl bg-muted/60" />
    <div className="h-24 rounded-2xl bg-muted/50" />
  </div>
);

