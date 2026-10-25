import {
  BookOpen, CalendarCheck, CalendarClock, Dumbbell, Droplets, Heart, Lightbulb, Moon, Pill, Receipt, Scale, Smile, Utensils, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TipoPendencia } from "@/lib/home-pendencias";

/**
 * A PALETA ÚNICA DA OPÇÃO E (rodada 3, 25/10) — 16 cores no MESMO TOM, como os anéis do Cal AI
 * (proteína #cf6f6c · carbo #d49d70 · gordura #7397d8: em OKLCH, luminosidade 0,66–0,72 e croma 0,10–0,12,
 * só a matiz muda). Aqui cada módulo é UMA matiz (H) e a luminosidade/croma vêm do tema (home-e.css:
 * --he-L/--he-C no claro, outros valores no escuro) — então qualquer cor da Home nasce da mesma fórmula:
 *   cor cheia   = oklch(var(--he-L) var(--he-C) H)         (ícone, anel, barra, número do anel)
 *   tinta       = oklch(var(--he-L) var(--he-C) H / 0,14)  (fundo do azulejo e dos discos)
 * As matizes ficam ~22° uma da outra, cada uma perto da família de cor que o módulo já tinha (Finanças
 * continua "amarelo", Treino "azul", Saúde "vermelho"…), e o fogo da sequência é o único que mantém a cor
 * própria (é a faixa, Conquistas). Uma família de ícones só: Lucide com traço 1,75 em tudo — os glifos dos
 * módulos são os de hoje (lib/modulos); só o traço e a cor mudam.
 */
export const TRACO = 1.75;

export const MATIZ_DO_MODULO: Record<string, number> = {
  // (o amarelo puro, 90–110, fica barrento neste croma: Pet vai pro mel mais quente e Detox pro verde-oliva mais verde)
  saude: 22, biblioteca: 45, financas: 65, pet: 84, detox: 126, dieta: 148, rotina: 168, viagens: 192,
  casa: 215, carreira: 240, treino: 262, estudos: 280, desenvolvimento: 305, hiperfoco: 325, beleza: 350, relacionamentos: 5,
};

/** Matiz de cada tipo de pendência = a do módulo de origem (água/sono em azuis, humor no lilás, gratidão no coral). */
export const MATIZ_DO_TIPO: Record<TipoPendencia, number> = {
  habitos: MATIZ_DO_MODULO.rotina, treino: MATIZ_DO_MODULO.treino, agua: MATIZ_DO_MODULO.casa, refeicoes: MATIZ_DO_MODULO.dieta,
  suplementos: MATIZ_DO_MODULO.saude, leitura: MATIZ_DO_MODULO.biblioteca, humor: MATIZ_DO_MODULO.desenvolvimento,
  gasto: MATIZ_DO_MODULO.financas, peso: MATIZ_DO_MODULO.saude, sono: MATIZ_DO_MODULO.estudos, ideia: MATIZ_DO_MODULO.hiperfoco,
  gratidao: MATIZ_DO_MODULO.relacionamentos,
};

/** Os ícones dos tipos (no lugar dos emojis ✅ 🍽️ 💧 …), a mesma família dos módulos. */
export const ICONE_DO_TIPO: Record<TipoPendencia, LucideIcon> = {
  habitos: CalendarCheck, treino: Dumbbell, agua: Droplets, refeicoes: Utensils, suplementos: Pill, leitura: BookOpen,
  humor: Smile, gasto: Wallet, peso: Scale, sono: Moon, ideia: Lightbulb, gratidao: Heart,
};
export const ICONE_COMPROMISSO = CalendarClock;
export const ICONE_CONTA = Receipt;

/** `oklch(L C H)` do tema, cheia ou com alfa (número ou uma variável CSS, ex.: "var(--he-tinta)"). */
export const cor = (h: number, alfa?: number | string): string =>
  alfa == null ? `oklch(var(--he-L) var(--he-C) ${h})` : `oklch(var(--he-L) var(--he-C) ${h} / ${alfa})`;

export const corDoModulo = (id: string, alfa?: number | string) => cor(MATIZ_DO_MODULO[id] ?? 240, alfa);
export const corDoTipo = (t: TipoPendencia, alfa?: number | string) => cor(MATIZ_DO_TIPO[t], alfa);
/** O fundo do azulejo/disco: a cor do módulo na tinta do tema (14 % no claro, 18 % no escuro). */
export const tintaDoModulo = (id: string) => corDoModulo(id, "var(--he-tinta)");

/** O anel do score: caramelo até 79, sálvia de 80 pra cima (no lugar do âmbar e do verde vivos). */
export const corDoScore = (score: number) => cor(score >= 80 ? MATIZ_DO_MODULO.dieta : MATIZ_DO_MODULO.financas);
