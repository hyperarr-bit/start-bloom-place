import type { CSSProperties } from "react";
import type { Faixa, FaixaId } from "@/lib/fogo-sequencia";
import { TOM_DO_MODULO, cor, tinta, type Tom } from "./paleta";

/**
 * O FOGO CHAPADO DA HOME NOVA (1.0.19, dono: "o fogo com degradê/brilho, estilo emoji, destoa da Home E").
 * Uma chama SÓLIDA de 2 tons, no desenho do Codex: o corpo na cor da faixa e uma gota clara dentro — sem
 * degradê, sem brilho, sem contorno. Só a Home E usa este (o Fogo das outras telas — Conquistas, figurinhas,
 * capas — continua o de sempre).
 *
 * As CORES continuam por faixa (lib/fogo-sequencia: laranja 1+ · vermelho 7+ · roxo 14+ · azul 30+ · dourado
 * 100+), convertidas pro tom da paleta da E (o nível "mais suave" que o tema aplica): laranja = o laranja da
 * Dieta, vermelho = o tijolo da Saúde, roxo = a AMEIXA (o roxo do Codex), azul = o cobalto do Treino, dourado =
 * o ouro das Finanças. A gota é a mesma matiz, bem clara.
 *  · aceso    → cor cheia (+ o pulso 1x/dia, que é da pílula);
 *  · apagado  → a mesma chama na tinta (bem clarinha), gota no branco do card — dia ainda não garantido;
 *  · neutro   → cinza claro — sem sequência.
 */
export type EstadoDoFogoChapado = "aceso" | "apagado" | "neutro";

export const TOM_DA_FAIXA: Record<FaixaId, Tom> = {
  laranja: TOM_DO_MODULO.dieta,
  vermelho: TOM_DO_MODULO.saude,
  roxo: TOM_DO_MODULO.relacionamentos,
  azul: TOM_DO_MODULO.treino,
  dourado: TOM_DO_MODULO.financas,
  // faixas que o app guarda pra temas antigos: caem perto do que eram
  salvia: TOM_DO_MODULO.detox,
  ambar: TOM_DO_MODULO.financas,
  petroleo: TOM_DO_MODULO.hiperfoco,
  violeta: TOM_DO_MODULO.desenvolvimento,
};

/** A gota: a mesma matiz da faixa, bem clara (no escuro o tema também clareia — fica ~0,93). */
const gotaDe = (t: Tom) => `oklch(calc(var(--he-Lk) + var(--he-Lm) * 0.94) calc(var(--he-Cm) * 0.035) ${t.h})`;

/** O corpo da chama (ponta à direita, ombro à esquerda) e a gota de dentro — os dois sem contorno. */
export const CORPO = "M13.3 1.9c.5 3.3 2.4 5 4 7 1.2 1.5 1.9 3 1.9 4.9 0 4.1-3.2 7.3-7.2 7.3S4.8 17.9 4.8 13.8c0-2.2 1-4 2.5-5.5.2 1.2.8 2.1 1.7 2.7-.2-3.5 1.4-6.6 4.3-9.1z";
export const GOTA = "M12 11.1c1.4 1.7 2.8 3.1 2.8 4.9a2.8 2.8 0 0 1-5.6 0c0-1.8 1.4-3.2 2.8-4.9z";

interface Props {
  faixa: Faixa;
  estado: EstadoDoFogoChapado;
  tamanho: number;
  className?: string;
  style?: CSSProperties;
}

export const FogoChapado = ({ faixa, estado, tamanho, className, style }: Props) => {
  const t = TOM_DA_FAIXA[faixa.id] ?? TOM_DO_MODULO.dieta;
  const corpo = estado === "aceso" ? cor(t) : estado === "apagado" ? tinta(t) : "hsl(var(--muted-foreground) / 0.3)";
  const gota = estado === "aceso" ? gotaDe(t) : "hsl(var(--card))";
  return (
    <svg
      viewBox="0 0 24 24" width={tamanho} height={tamanho} className={className} style={{ flexShrink: 0, display: "block", ...style }}
      data-fogo={estado} data-faixa={faixa.id} aria-hidden
    >
      <path d={CORPO} fill={corpo} />
      <path d={GOTA} fill={gota} />
    </svg>
  );
};
