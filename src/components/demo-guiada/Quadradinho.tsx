import { Check } from "lucide-react";
import { VERDE_OK } from "@/pages/funis/dia14/pecas-roi2";

/** O quadradinho de marcar do planner (não bolinha). Arquivo próprio: o bloco
 *  do paywall usa só ele e não precisa baixar as peças da missão. */
export function Quadradinho({ marcado, tam = 14, claro = false }: { marcado: boolean; tam?: number; claro?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center shrink-0 rounded-[3px] border-2 transition-colors duration-300"
      style={{
        width: tam, height: tam,
        borderColor: marcado ? (claro ? "#fff" : VERDE_OK) : claro ? "rgba(255,255,255,.7)" : "hsl(var(--foreground) / .35)",
        background: marcado ? (claro ? "#fff" : VERDE_OK) : "transparent",
      }}
    >
      {marcado && <Check strokeWidth={4} style={{ width: tam - 5, height: tam - 5, color: claro ? VERDE_OK : "#fff" }} />}
    </span>
  );
}
