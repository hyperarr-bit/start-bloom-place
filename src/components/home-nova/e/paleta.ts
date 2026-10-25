import {
  BookOpen, CalendarCheck, CalendarClock, Dumbbell, Droplets, Heart, Lightbulb, Moon, Pill, Receipt, Scale, Smile, Utensils, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TipoPendencia } from "@/lib/home-pendencias";

/**
 * A PALETA DA OPÇÃO E — RODADA 5, versão "cores separadas" (25/10).
 *
 * A rodada 4 tinha 16 cores no MESMO tom (L/C iguais, só a matiz mudava) e passava no ΔE, mas no olho ainda
 * havia grupos: três rosados, três lilases, dois azuis, e um "dourado" que lia como oliva. Aqui cada módulo
 * é uma COR COM NOME, escolhida pra ser distinta a olho nu — aceitando variar luminosidade e croma dentro de
 * uma faixa sóbria (L 0,42–0,76 · C 0,03–0,15 em OKLCH; nada neon):
 *   só UM rosa (Beleza) e UM roxo (Dev. Pessoal); três azuis que se separam pela luminosidade (marinho ·
 *   cobalto · céu); dois verdes que se separam pela matiz e pelo croma (folha · oliva) + o turquesa; o
 *   dourado de verdade (L alta, C alta); vinho e chocolate escuros; dois neutros (aço frio, areia quente).
 * Cada tom guarda {h, L, C}; o tema muda a luminosidade no escuro (home-e.css: --he-Lk/--he-Lm/--he-Cm) e a
 * TINTA dos azulejos/discos tem luminosidade FIXA (--he-tinta-L) com um pouco do croma da cor — assim as
 * cores escuras (marinho, vinho) não viram azulejos pesados.
 * Teste numérico (ΔE OKLab, deuteranopia) + "teste do olho" (pares críticos em tamanho real):
 * novidades-guardadas/…/E/v5/scripts/paleta-v5-verifica.cjs. Ícones: Lucide, traço 1,75 em tudo.
 */
export const TRACO = 1.75;

export interface Tom { h: number; L: number; C: number; nome: string }

/** Módulo → cor (ordem da grade de lib/modulos). */
export const TOM_DO_MODULO: Record<string, Tom> = {
  financas: { h: 90, L: 0.78, C: 0.15, nome: "ouro" },            // dinheiro é ouro — amarelo-ouro de verdade
  treino: { h: 262, L: 0.55, C: 0.15, nome: "cobalto" },          // o azul do meio
  dieta: { h: 48, L: 0.66, C: 0.15, nome: "laranja" },            // comida
  rotina: { h: 158, L: 0.50, C: 0.13, nome: "esmeralda" },        // o hábito feito — verde-folha escuro
  desenvolvimento: { h: 310, L: 0.60, C: 0.15, nome: "roxo" },    // o único roxo (mais claro que o petróleo da Mente)
  saude: { h: 25, L: 0.54, C: 0.15, nome: "tijolo" },             // o vermelho do coração
  casa: { h: 235, L: 0.78, C: 0.10, nome: "céu" },                // o azul claro
  estudos: { h: 262, L: 0.42, C: 0.10, nome: "marinho" },         // o azul escuro
  biblioteca: { h: 55, L: 0.42, C: 0.085, nome: "chocolate" },    // couro de livro
  beleza: { h: 350, L: 0.72, C: 0.13, nome: "rosa" },             // o único rosa
  viagens: { h: 185, L: 0.64, C: 0.13, nome: "turquesa" },        // o mar
  carreira: { h: 250, L: 0.50, C: 0.03, nome: "aço" },            // neutro frio
  hiperfoco: { h: 205, L: 0.52, C: 0.11, nome: "petróleo" },      // Mente: fundo do mar, não lilás
  relacionamentos: { h: 350, L: 0.44, C: 0.14, nome: "vinho" },   // o calor, escuro — não um 2º rosa
  pet: { h: 85, L: 0.72, C: 0.035, nome: "areia" },               // neutro quente (pelo)
  detox: { h: 108, L: 0.60, C: 0.085, nome: "oliva" },            // a folha madura
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

/** A cor cheia do tom (ícone, anel, barra). No escuro o tema clareia: L' = Lk + Lm·L, C' = Cm·C. */
export const cor = (t: Tom): string =>
  `oklch(calc(var(--he-Lk) + var(--he-Lm) * ${t.L}) calc(var(--he-Cm) * ${t.C}) ${t.h})`;
/** A tinta do tom (fundo de azulejo e de disco): luminosidade fixa do tema + um pouco do croma da cor. */
export const tinta = (t: Tom): string =>
  `oklch(var(--he-tinta-L) calc(var(--he-tinta-k) * ${t.C}) ${t.h})`;

export const corDoModulo = (id: string) => cor(TOM_DO_MODULO[id] ?? TOM_DO_MODULO.carreira);
export const tintaDoModulo = (id: string) => tinta(TOM_DO_MODULO[id] ?? TOM_DO_MODULO.carreira);
export const corDoTipo = (t: TipoPendencia) => cor(TOM_DO_TIPO[t]);
export const tintaDoTipo = (t: TipoPendencia) => tinta(TOM_DO_TIPO[t]);

/**
 * A TINTA do anel do score e da estrela (rodada 4, dono: "preto como o do Cal AI") — grafite no claro e, no
 * escuro, a tinta invertida (clara), a mesma do botão "+" (--hn-mais, home-nova.css).
 */
export const TINTA = "var(--hn-mais)";
