import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { ALL_MODULE_ICONS, AREAS, type AreaKey } from "@/lib/funnel";

/**
 * Peças do funil ROI 2 (27/09) compartilhadas entre as telas do /inicio
 * (ComecarDia14) e o paywall (PaywallDia14). Identidade de PLANNER sem virar
 * tema: faixa colorida com título em caixa alta nas seções, post-it na
 * garantia, ✓ verde de "incluso" — os mesmos elementos dos módulos reais
 * (memória feedback_identidade_planner).
 */

/** Verde de "incluso/confirmado" — o mesmo tom em toda tela do funil. */
export const VERDE_OK = "#1F9D6A";
export const SERIF_ITALICO: CSSProperties = {
  fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  fontStyle: "italic",
  fontWeight: 400,
};

const COR_FAIXA = {
  magenta: "hsl(var(--accent))",
  verde: VERDE_OK,
  azul: "#3B82F6",
  amarelo: "#F2B233",
} as const;

/** Faixa de seção: barrinha colorida + título em caixa alta (planner). */
export function Faixa({ cor = "magenta", children, className = "" }: { cor?: keyof typeof COR_FAIXA; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground text-left ${className}`}>
      <span aria-hidden className="inline-block w-1.5 h-4 rounded-[3px] shrink-0" style={{ background: COR_FAIXA[cor] }} />
      {children}
    </div>
  );
}

/** Rótulo do tile (grade dos 16) do módulo em que a área escolhida começa. */
const ROTULO_DO_MODULO: Record<string, string> = {
  financas: "Finanças", rotina: "Rotina", treino: "Treino", saude: "Saúde", desenvolvimento: "Metas",
};
export const rotuloDoModulo = (area: AreaKey): string => ROTULO_DO_MODULO[AREAS[area].module] ?? "";

/**
 * Os 16 módulos, TODOS com ✓ verde (incluso); o da área escolhida ganha a
 * etiqueta "COMEÇA AQUI" em vez do ✓. Antes só o escolhido tinha marca e os
 * outros 15 eram lisos — lia como "os outros vêm depois".
 */
export function Grade16({ area, animar = false, compacta = false }: { area?: AreaKey; animar?: boolean; compacta?: boolean }) {
  const inicio = area ? rotuloDoModulo(area) : "";
  return (
    <div className={`grid grid-cols-4 ${compacta ? "gap-1.5" : "gap-2"}`} data-testid="grade-16">
      {ALL_MODULE_ICONS.map((m, i) => {
        const on = m.label === inicio;
        return (
          <motion.div
            key={m.label}
            initial={animar ? { opacity: 0, scale: 0.7 } : false}
            animate={animar ? { opacity: 1, scale: 1 } : undefined}
            transition={{ delay: 0.08 + i * 0.035, duration: 0.3 }}
            data-testid={on ? "tile-comeca-aqui" : "tile-incluso"}
            className={`relative rounded-2xl border-2 ${compacta ? "px-1 pt-2 pb-1.5" : "p-2.5"} flex flex-col items-center gap-1 bg-card ${
              on ? "border-accent bg-accent/[0.07]" : "border-border"
            }`}
          >
            {on ? (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-extrabold uppercase tracking-wide bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 whitespace-nowrap">
                começa aqui
              </span>
            ) : (
              <span
                aria-label="incluso"
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full grid place-items-center text-white border-2 border-white"
                style={{ background: VERDE_OK }}
              >
                <Check className="w-2.5 h-2.5" strokeWidth={4} />
              </span>
            )}
            <span className={compacta ? "text-lg leading-none" : "text-xl leading-none"}>{m.emoji}</span>
            <span className={`${compacta ? "text-[9.5px]" : "text-[10px]"} font-semibold leading-none text-foreground`}>{m.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Post-it amarelo (planner) — a garantia, escrita à mão na agenda. */
export function PostIt({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden
        className="absolute -top-2 left-1/2 -translate-x-1/2 rotate-2 w-[70px] h-4 rounded-[2px]"
        style={{ background: "hsl(var(--accent) / 0.35)" }}
      />
      <div
        className="rounded-md px-3.5 py-3 text-[13px] leading-snug text-left -rotate-1 shadow-[0_8px_20px_-14px_rgba(0,0,0,0.5)]"
        style={{ background: "#FFF3B0", color: "#262626" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Linha verde "✓ Os 16 inclusos…" usada na central e no paywall. */
export function LinhaInclusos({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] font-bold w-full text-center leading-snug" style={{ color: VERDE_OK }}>
      <Check className="inline-block w-3.5 h-3.5 align-[-2px] mr-1" strokeWidth={3} />
      {children}
    </p>
  );
}
