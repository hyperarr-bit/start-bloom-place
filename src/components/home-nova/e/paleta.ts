import {
  BookOpen, CalendarCheck, CalendarClock, Dumbbell, Droplets, Heart, Lightbulb, Moon, Pill, Receipt, Scale, Smile, Utensils, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TipoPendencia } from "@/lib/home-pendencias";

/**
 * A PALETA ÚNICA DA OPÇÃO E (rodadas 3 e 4, 25/10) — 16 cores no mesmo tom do Cal AI (anéis #cf6f6c /
 * #d49d70 / #7397d8: em OKLCH, luminosidade 0,62–0,72 e croma 0,10–0,13), feitas pra serem DISTINGUÍVEIS
 * lado a lado na grade de 4.
 *
 * RODADA 4 (refeita do zero, dono: "16 cores, nenhum par confundível"): cada módulo é um TOM {matiz, nível}.
 *  - dois níveis de luminosidade em XADREZ na grade (ordem padrão de lib/modulos): A = profundo
 *    (L 0,62 · C 0,13) e B = claro (L 0,72 · C 0,10). Vizinho horizontal e vertical SEMPRE troca de nível →
 *    ΔL 0,10, que a deuteranopia preserva (ela apaga a diferença vermelho×verde, não a de luminosidade).
 *  - dentro de cada nível, as 8 matizes ficam ≥ 38° uma da outra (ΔE OKLab ≥ 0,065 entre todos os pares).
 *  - 1 neutro: Carreira = aço (C 0,03).
 *  Teste numérico e simulação de daltonismo: novidades-guardadas/…/E/v4/scripts/paleta-verifica.cjs.
 *  Os valores L/C vêm do tema (home-e.css: --he-L-A/--he-C-A, --he-L-B/…, --he-L-N/…; no escuro, mais claros).
 *    cor cheia = oklch(L C h)        (ícone, anel, barra, disco)
 *    tinta     = oklch(L C h / 0,14) (fundo do azulejo e dos discos; 0,18 no escuro)
 * Uma família de ícones só: Lucide com traço 1,75 em tudo; os glifos dos módulos são os de hoje (lib/modulos).
 */
export const TRACO = 1.75;

export type Nivel = "A" | "B" | "N";
export interface Tom { h: number; n: Nivel }

/** Módulo → tom (a ordem é a da grade; A/B alternam em xadrez). */
export const TOM_DO_MODULO: Record<string, Tom> = {
  financas: { h: 98, n: "B" },        // dourado — dinheiro é ouro
  treino: { h: 240, n: "A" },         // azul
  dieta: { h: 54, n: "B" },           // pêssego — comida
  rotina: { h: 160, n: "A" },         // verde — o hábito feito
  desenvolvimento: { h: 285, n: "A" }, // roxo
  saude: { h: 14, n: "B" },           // coral — o vermelho do coração, no nível claro
  casa: { h: 205, n: "A" },           // petróleo
  estudos: { h: 250, n: "B" },        // pervinca
  biblioteca: { h: 296, n: "B" },     // lilás-ameixa — a capa de um livro
  beleza: { h: 352, n: "A" },         // rosa
  viagens: { h: 190, n: "B" },        // água-marinha — o mar
  carreira: { h: 250, n: "N" },       // aço — o neutro
  hiperfoco: { h: 318, n: "A" },      // violeta (Mente)
  relacionamentos: { h: 338, n: "B" }, // rosa-claro
  pet: { h: 60, n: "A" },             // caramelo — o pelo
  detox: { h: 140, n: "B" },          // sálvia — a folha
};

/** Tipo de pendência → tom do módulo de origem (água num azul próprio, humor no roxo, gratidão no rosa-claro). */
export const TOM_DO_TIPO: Record<TipoPendencia, Tom> = {
  habitos: TOM_DO_MODULO.rotina, treino: TOM_DO_MODULO.treino, agua: { h: 240, n: "A" }, refeicoes: TOM_DO_MODULO.dieta,
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

/** `oklch(L C h)` do tom, cheia ou com alfa (número ou uma variável CSS, ex.: "var(--he-tinta)"). */
export const cor = (t: Tom, alfa?: number | string): string =>
  `oklch(var(--he-L-${t.n}) var(--he-C-${t.n}) ${t.h}${alfa == null ? "" : ` / ${alfa}`})`;

export const corDoModulo = (id: string, alfa?: number | string) => cor(TOM_DO_MODULO[id] ?? TOM_DO_MODULO.carreira, alfa);
export const corDoTipo = (t: TipoPendencia, alfa?: number | string) => cor(TOM_DO_TIPO[t], alfa);
/** O fundo do azulejo/disco: a cor do módulo na tinta do tema (14 % no claro, 18 % no escuro). */
export const tintaDoModulo = (id: string) => corDoModulo(id, "var(--he-tinta)");

/**
 * A TINTA: o anel do score e a estrela dentro dele (rodada 4, dono: "preto como o do Cal AI") — grafite no
 * claro e, no escuro, a tinta invertida (clara), a mesma do botão "+" (--hn-mais, home-nova.css). O trilho
 * continua cinza claro (--he-trilho). Nada de caramelo/sálvia no anel.
 */
export const TINTA = "var(--hn-mais)";
