import type { CSSProperties } from "react";
import { Palette, X } from "lucide-react";
import { useMedidas } from "./prancheta";
import type { Moldura } from "./pele";

/**
 * A moldura dos stories (26/09): barras de progresso, "CORE · RETROSPECTIVA",
 * o chip "Tema" (só na capa) e o X — nas cores da página aberta. É a mesma
 * peça na retrospectiva e nas miniaturas da folha de temas (lá, parada).
 */

export interface BarraAnimada {
  /** duração da página (null = espera a pessoa: barra cheia) */
  auto: number | null;
  pausado: boolean;
  onFim?: () => void;
}

export const TopoEBarras = ({ moldura, total, atual, animada, chip, onChip, onFechar, estatica = false }: {
  moldura: Moldura;
  total: number;
  atual: number;
  animada?: BarraAnimada;
  chip?: boolean;
  onChip?: () => void;
  onFechar?: () => void;
  /** miniatura: sem botão de verdade */
  estatica?: boolean;
}) => {
  const { fs } = useMedidas();
  return (
    <>
      <div style={{ position: "absolute", top: 14, left: moldura.esquerda, right: 14, display: "grid", gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap: 4, zIndex: 5 }}>
        {Array.from({ length: total }, (_, i) => {
          const corrente = i === atual;
          const auto = corrente ? animada?.auto ?? null : null;
          const estilo: CSSProperties = i < atual || (corrente && !auto)
            ? { width: "100%" }
            : corrente && animada
              ? { width: 0, animation: `retro-barra ${auto}ms linear forwards`, animationPlayState: animada.pausado ? "paused" : "running" }
              : { width: 0 };
          return (
            <i key={i} data-barra={estatica ? undefined : ""} style={{ display: "block", height: 3, borderRadius: 3, overflow: "hidden", background: moldura.barraOff }}>
              <b
                key={corrente ? `atual-${atual}` : "x"}
                style={{ display: "block", height: "100%", borderRadius: 3, background: moldura.barraOn, ...estilo }}
                onAnimationEnd={corrente && auto && animada?.onFim ? animada.onFim : undefined}
              />
            </i>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute", top: 28, left: moldura.esquerda, right: 18, height: 18, display: "flex", alignItems: "center", zIndex: 6,
          fontSize: fs(11), fontWeight: 800, letterSpacing: ".18em", color: moldura.topo, whiteSpace: "nowrap",
        }}
      >
        <span>CORE · RETROSPECTIVA</span>
        {chip && (estatica ? (
          <span style={chipEstilo(moldura, fs)}><Palette style={{ width: 13, height: 13 }} strokeWidth={2.2} aria-hidden />Tema</span>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChip?.(); }}
            aria-label="Trocar o tema da retrospectiva"
            className="p-0"
            style={{ ...chipEstilo(moldura, fs), pointerEvents: "auto", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Palette style={{ width: 13, height: 13 }} strokeWidth={2.2} aria-hidden />
            Tema
          </button>
        ))}
        {estatica ? (
          <X style={{ width: 18, height: 18, marginLeft: chip ? 12 : "auto", color: moldura.topo }} strokeWidth={2.2} aria-hidden />
        ) : (
          /* p-0 tira este X da regra global de alvo de toque (index.css) */
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFechar?.(); }}
            aria-label="Fechar"
            className="p-0"
            style={{ marginLeft: chip ? 4 : "auto", marginRight: -8, width: 34, height: 34, display: "grid", placeItems: "center", background: "none", border: 0, color: moldura.topo, pointerEvents: "auto", cursor: "pointer" }}
          >
            <X style={{ width: 18, height: 18 }} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </>
  );
};

const chipEstilo = (m: Moldura, fs: (n: number) => number): CSSProperties => ({
  marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px 0 9px", borderRadius: 999, boxSizing: "border-box",
  fontSize: fs(11), fontWeight: 800, letterSpacing: ".06em", textTransform: "none", color: m.chip.fg, background: m.chip.bg, border: `1px solid ${m.chip.borda}`,
});
