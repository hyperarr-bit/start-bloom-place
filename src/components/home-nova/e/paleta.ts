import {
  BookOpen, CalendarCheck, CalendarClock, Dumbbell, Droplets, Heart, Lightbulb, Moon, Pill, Receipt, Scale, Smile, Utensils, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TipoPendencia } from "@/lib/home-pendencias";

/**
 * A PALETA DA OPÇÃO E — rodada 5 "cores separadas" + rodada 6 "meio-termo" (25/10).
 *
 * Cada módulo é uma COR COM NOME {h, L, C} em OKLCH, escolhida pra ser distinta a olho nu (só um rosa e um roxo;
 * três azuis separados pela luminosidade; esmeralda × oliva × turquesa; ouro de verdade; vinho e chocolate; dois
 * neutros). As MATIZES não mudam entre as rodadas — são o que separa os grupos.
 *
 * RODADA 6 (dono: a v5 ficou forte demais, a r4 era "meio transparente" — quer o meio-termo): cada tom traz também
 * um ALVO "r4-like" {L4, C4} — mais claro onde a v5 era pesada (esmeralda, marinho, vinho, chocolate) e com croma
 * ~0,105–0,12 como a rodada 4 — e o tema escolhe o ponto da régua com `--he-t`: 0 = v5 · 0,5 = "suave" ·
 * 0,7 = "mais suave" (data-suave no .hn.he). L(t) = L + t·(L4 − L) e C(t) = C + t·(C4 − C). A tinta do azulejo/disco
 * também lava com t: luminosidade 0,955 → 0,962 e a fração do croma 0,30 → 0,18 (home-e.css).
 * Teste (ΔE OKLab, grupos críticos, deuteranopia, teste do olho) nos dois níveis:
 * novidades-guardadas/…/E/v6/scripts/paleta-v6-verifica.cjs. Ícones: Lucide, traço 1,75 em tudo.
 */
export const TRACO = 1.75;

export interface Tom { h: number; L: number; C: number; L4: number; C4: number; nome: string }

/** Módulo → cor (ordem da grade de lib/modulos). {L, C} = v5 (forte) · {L4, C4} = alvo r4-like (suave). */
export const TOM_DO_MODULO: Record<string, Tom> = {
  financas: { h: 90, L: 0.78, C: 0.15, L4: 0.78, C4: 0.14, nome: "ouro" },
  treino: { h: 262, L: 0.55, C: 0.15, L4: 0.64, C4: 0.12, nome: "cobalto" },
  dieta: { h: 48, L: 0.66, C: 0.15, L4: 0.66, C4: 0.12, nome: "laranja" },
  rotina: { h: 158, L: 0.50, C: 0.13, L4: 0.66, C4: 0.12, nome: "esmeralda" },
  desenvolvimento: { h: 310, L: 0.60, C: 0.15, L4: 0.70, C4: 0.14, nome: "roxo" },
  saude: { h: 22, L: 0.54, C: 0.15, L4: 0.56, C4: 0.13, nome: "tijolo" },
  casa: { h: 240, L: 0.80, C: 0.09, L4: 0.80, C4: 0.09, nome: "céu" },
  estudos: { h: 262, L: 0.42, C: 0.10, L4: 0.52, C4: 0.09, nome: "marinho" },
  biblioteca: { h: 55, L: 0.42, C: 0.085, L4: 0.54, C4: 0.08, nome: "chocolate" },
  beleza: { h: 350, L: 0.72, C: 0.13, L4: 0.74, C4: 0.11, nome: "rosa" },
  viagens: { h: 185, L: 0.64, C: 0.13, L4: 0.76, C4: 0.12, nome: "turquesa" },
  carreira: { h: 250, L: 0.50, C: 0.03, L4: 0.58, C4: 0.03, nome: "aço" },
  hiperfoco: { h: 195, L: 0.52, C: 0.11, L4: 0.56, C4: 0.12, nome: "petróleo" },
  relacionamentos: { h: 335, L: 0.44, C: 0.14, L4: 0.50, C4: 0.12, nome: "ameixa" },
  pet: { h: 80, L: 0.76, C: 0.025, L4: 0.76, C4: 0.025, nome: "areia" },
  detox: { h: 95, L: 0.60, C: 0.10, L4: 0.72, C4: 0.10, nome: "oliva" },
};

/** Tipo de pendência → tom do módulo de origem (água no cobalto, humor no roxo, gratidão no vinho). */
export const TOM_DO_TIPO: Record<TipoPendencia, Tom> = {
  habitos: TOM_DO_MODULO.rotina, treino: TOM_DO_MODULO.treino, agua: TOM_DO_MODULO.treino, refeicoes: TOM_DO_MODULO.dieta,
  suplementos: TOM_DO_MODULO.saude, leitura: TOM_DO_MODULO.biblioteca, humor: TOM_DO_MODULO.desenvolvimento,
  gasto: TOM_DO_MODULO.financas, peso: TOM_DO_MODULO.saude, sono: TOM_DO_MODULO.estudos, ideia: TOM_DO_MODULO.hiperfoco,
  gratidao: TOM_DO_MODULO.relacionamentos,
};

/** Os ícones dos tipos (no lugar dos emojis ✅ 🍽️ 💧 …), a mesma família dos módulos. */
export const ICONE_DO_TIPO: Record<TipoPendencia, LucideIcon> = {
  habitos: CalendarCheck, treino: Dumbbell, agua: Droplets, refeicoes: Utensils, suplementos: Pill, leitura: BookOpen,
  humor: Smile, gasto: Wallet, peso: Scale, sono: Moon, ideia: Lightbulb, gratidao: Heart,
};
export const ICONE_COMPROMISSO = CalendarClock;
export const ICONE_CONTA = Receipt;

const n = (x: number) => Number(x.toFixed(4));
/** L e C no ponto `--he-t` da régua v5 → r4 (expressões CSS). */
const Lt = (t: Tom) => `(${n(t.L)} + var(--he-t) * ${n(t.L4 - t.L)})`;
const Ct = (t: Tom) => `(${n(t.C)} + var(--he-t) * ${n(t.C4 - t.C)})`;

/** A cor cheia do tom (ícone, anel, barra). No escuro o tema clareia: L' = Lk + Lm·L(t), C' = Cm·C(t). */
export const cor = (t: Tom): string =>
  `oklch(calc(var(--he-Lk) + var(--he-Lm) * ${Lt(t)}) calc(var(--he-Cm) * ${Ct(t)}) ${t.h})`;
/** A tinta do tom (fundo de azulejo e de disco): luminosidade fixa do tema + uma fração do croma da cor. */
export const tinta = (t: Tom): string =>
  `oklch(var(--he-tinta-L) calc(var(--he-tinta-k) * ${Ct(t)}) ${t.h})`;

export const corDoModulo = (id: string) => cor(TOM_DO_MODULO[id] ?? TOM_DO_MODULO.carreira);
export const tintaDoModulo = (id: string) => tinta(TOM_DO_MODULO[id] ?? TOM_DO_MODULO.carreira);
export const corDoTipo = (t: TipoPendencia) => cor(TOM_DO_TIPO[t]);
export const tintaDoTipo = (t: TipoPendencia) => tinta(TOM_DO_TIPO[t]);

/**
 * A TINTA do anel do score e da estrela (rodada 4, dono: "preto como o do Cal AI") — grafite no claro e, no
 * escuro, a tinta invertida (clara), a mesma do botão "+" (--hn-mais, home-nova.css).
 */
export const TINTA = "var(--hn-mais)";
