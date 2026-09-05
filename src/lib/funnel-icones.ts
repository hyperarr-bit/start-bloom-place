/**
 * ÍCONES DO FUNIL (v105, 05/09 — pedido do dono: "só a primeira pergunta do
 * quiz tá com emojis, o resto não"). Toda opção de toda pergunta, a porta, os
 * compromissos e os 16 módulos ganham o MESMO vocabulário: ícones lucide, os
 * mesmos do painel do app (ModuleDrawer), em tile pastel. Emoji não é
 * iconografia — muda de cara em cada aparelho e some do tema.
 *
 * O mapa é por RÓTULO da opção (as trilhas em funnel.ts continuam intocadas —
 * o `emoji` delas segue existindo pra web antiga e pros testes). Rótulo sem
 * mapa cai no `Sparkles`, nunca em tela vazia.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlarmClock, Apple, BatteryLow, Bed, Banknote, Brain, Briefcase, BookOpen, CalendarCheck, CalendarDays, CalendarX,
  CheckCheck, CircleHelp, ClipboardList, Coins, Compass, CreditCard, DollarSign, Droplets, Dumbbell, EyeOff, Flame, Footprints,
  GraduationCap, Heart, Hourglass, House, Infinity as InfinityIcon, Landmark, Layers, LayoutDashboard, Leaf, Map as MapIcon, Moon, NotebookPen,
  PawPrint, PiggyBank, Pill, Plane, Repeat, Rocket, RotateCcw, Salad, Search, ShieldCheck, Smartphone, Smile, Sparkles, Sprout,
  Stethoscope, Sun, Table, Target, TrendingUp, Users, Utensils, Wallet, Zap,
} from "lucide-react";

const POR_ROTULO: Record<string, LucideIcon> = {
  // dinheiro
  "Gasto sem perceber": CreditCard, "Esqueço contas": CalendarX, "Não consigo guardar dinheiro": PiggyBank,
  "Não sei pra onde meu dinheiro vai": CircleHelp, "Quero organizar tudo": Sparkles,
  "Não controlo": EyeOff, "Bloco de notas": NotebookPen, "Planilha": Table, "App de banco": Landmark, "Outro app": Smartphone,
  "Menos de R$ 100": Coins, "R$ 100 a R$ 300": Banknote, "R$ 300 a R$ 500": Wallet, "Mais de R$ 500": Flame, "Não faço ideia": CircleHelp,
  "Sim, topo": Zap, "Topo, se for bem simples": Smile,
  "Entender meus gastos": Search, "Parar de esquecer contas": CalendarCheck, "Criar minha primeira meta": Target,
  "Saber quanto posso gastar": Wallet, "Organizar tudo em um painel": LayoutDashboard,
  // rotina
  "Acordo sem plano nenhum": AlarmClock, "Perco horas no celular": Smartphone, "Começo mil coisas e não termino": Layers,
  "Esqueço tarefas e compromissos": CalendarX,
  "Uns 3 dias": Hourglass, "Uma semana": CalendarDays, "Um mês, aí largo": Moon, "Nunca consegui manter": RotateCcw,
  "Manter um hábito 7 dias seguidos": Flame, "Acordar sabendo o que fazer": Sun, "Uma semana sem esquecer nada": CheckCheck,
  "Minha semana inteira num painel": LayoutDashboard,
  // corpo
  "Começo a treinar e desisto": Dumbbell, "Como mal e nem percebo": Utensils, "Não tenho plano de treino nem dieta": ClipboardList,
  "Falta constância, não vontade": BatteryLow,
  "Essa vai ser a primeira": Sprout, "Umas 2 ou 3": RotateCcw, "Perdi a conta": InfinityIcon, "Tô na ativa, mas sem controle": Activity,
  "Treinar a semana sem furar": Dumbbell, "Seguir o cardápio por 7 dias": Salad, "Ver meu progresso registrado": TrendingUp,
  "Treino e dieta num lugar só": LayoutDashboard,
  // saúde
  "Beber água": Droplets, "Dormir direito": Moon, "Vitaminas e remédios na hora": Pill, "Exames e check-ups": Stethoscope,
  "Um pouco de tudo": Sparkles,
  "Cansaço o dia todo": BatteryLow, "Sono ruim": Bed, "Ansiedade e estresse": Brain, "Tô bem — quero prevenir": ShieldCheck,
  "Dormir melhor essa semana": Moon, "Bater a meta de água todo dia": Droplets, "Não esquecer nenhuma vitamina": Pill,
  "Minha saúde inteira num painel": LayoutDashboard,
  // metas
  "Ficam na cabeça, nunca no papel": Brain, "Empolgo em janeiro, esqueço em março": CalendarX,
  "Tenho tantas que não sei por onde começar": Layers, "Sinto que não saio do lugar": RotateCcw,
  "Surgiu agora": Sprout, "Uns meses": CalendarDays, "Mais de um ano": Hourglass, "Anos… nem conto mais": InfinityIcon,
  "Minha meta com um plano de verdade": MapIcon, "Dar o primeiro passo, finalmente": Footprints,
  "Sentir que tô evoluindo de novo": TrendingUp, "Minhas metas todas num painel": LayoutDashboard,
};


/** PALETA DAS OPÇÕES DO QUIZ (05/09, dono: "o primeiro emoji do quiz tá
 *  colorido e o resto em preto e branco, deixa tudo colorido").
 *
 *  A porta pinta o tile com a cor do MÓDULO que a área abre. As perguntas
 *  seguintes não são módulos, então ganham a mesma paleta pastel do painel do
 *  app, em ordem fixa por posição na lista: a mesma opção cai sempre na mesma
 *  cor, e cada pergunta abre colorida de cima a baixo. Ordem escolhida pra dar
 *  contraste entre vizinhas (quente → frio → quente). */
const PALETA_OPCOES: Array<{ cor: string; tinta: string }> = [
  { cor: "#FDECCB", tinta: "#9A5B00" }, // âmbar
  { cor: "#CDEEE6", tinta: "#0B6E5E" }, // verde-água
  { cor: "#E6DEF8", tinta: "#5B3BB5" }, // roxo
  { cor: "#D7F0DD", tinta: "#1F7A45" }, // verde
  { cor: "#FBD8E8", tinta: "#B12A5B" }, // rosa
  { cor: "#D9E4FB", tinta: "#2E55B8" }, // azul
  { cor: "#FFE4CF", tinta: "#B4560E" }, // laranja
  { cor: "#D4EEF6", tinta: "#0E6F8C" }, // ciano
];
export const corDaOpcao = (i: number) => PALETA_OPCOES[i % PALETA_OPCOES.length];

export const iconeDaOpcao = (label: string): LucideIcon => POR_ROTULO[label] ?? Sparkles;
/** Só pra teste: o rótulo tem ícone escolhido de propósito (não caiu no fallback)? */
export const temIconeProprio = (label: string): boolean => label in POR_ROTULO;

/** Os 16 módulos como o painel do app os desenha (ModuleDrawer): ícone + pastel + tinta. */
export const MODULO_VISUAL: Record<string, { nome: string; cor: string; tinta: string; Icon: LucideIcon }> = {
  financas: { nome: "Finanças", cor: "#FDECCB", tinta: "#9A5B00", Icon: DollarSign },
  rotina: { nome: "Rotina", cor: "#CDEEE6", tinta: "#0B6E5E", Icon: CalendarCheck },
  treino: { nome: "Treino", cor: "#D9E4FB", tinta: "#2E55B8", Icon: Dumbbell },
  dieta: { nome: "Dieta", cor: "#D7F0DD", tinta: "#1F7A45", Icon: Apple },
  saude: { nome: "Saúde", cor: "#FBD8E8", tinta: "#B12A5B", Icon: Heart },
  desenvolvimento: { nome: "Metas", cor: "#E6DEF8", tinta: "#5B3BB5", Icon: Target },
  casa: { nome: "Casa", cor: "#D4EEF6", tinta: "#0E6F8C", Icon: House },
  relacionamentos: { nome: "Relações", cor: "#FBDCE0", tinta: "#B03442", Icon: Users },
  carreira: { nome: "Carreira", cor: "#E3E8EF", tinta: "#3D4C63", Icon: Briefcase },
  estudos: { nome: "Estudos", cor: "#E0E3FB", tinta: "#3B45B3", Icon: GraduationCap },
  beleza: { nome: "Beleza", cor: "#FBDDE6", tinta: "#B03A6A", Icon: Droplets },
  hiperfoco: { nome: "Mente", cor: "#E5DDF9", tinta: "#5A3AB8", Icon: Brain },
  biblioteca: { nome: "Leitura", cor: "#FFE4CF", tinta: "#B4560E", Icon: BookOpen },
  detox: { nome: "Detox", cor: "#E4F4CF", tinta: "#4F7A0E", Icon: Leaf },
  pet: { nome: "Pet", cor: "#FDEBD0", tinta: "#9A5B00", Icon: PawPrint },
  viagens: { nome: "Viagens", cor: "#D3F0EC", tinta: "#0D7A6C", Icon: Plane },
  tudo: { nome: "Tudo", cor: "#E6DEF8", tinta: "#5B3BB5", Icon: Sparkles },
};
/** Ordem da central: ranking real de uso dos pagantes (30 d, 04/09). */
export const ORDEM_CENTRAL = ["financas", "rotina", "treino", "dieta", "saude", "desenvolvimento", "casa", "relacionamentos", "carreira", "estudos", "beleza", "hiperfoco", "biblioteca", "detox", "pet", "viagens"];

/** Porta: cada área com o módulo que ela abre; "Tudo" ganha o próprio tile. */
export const ICONE_PORTA: Record<string, keyof typeof MODULO_VISUAL> = {
  "Meu dinheiro": "financas", "Minha rotina e hábitos": "rotina", "Treino e alimentação": "treino",
  "Minhas metas paradas": "desenvolvimento", "Tudo, sinceramente": "tudo",
};

/** Compromissos (Claro!×3) por área, na ordem das perguntas. */
export const ICONES_COMPROMISSO: Record<string, LucideIcon[]> = {
  dinheiro: [DollarSign, CalendarCheck, Rocket],
  rotina: [CalendarCheck, Repeat, Rocket],
  corpo: [Dumbbell, Apple, Rocket],
  saude: [Heart, Moon, Rocket],
  metas: [Target, Compass, Rocket],
};

/** Os 8 recortes da welcome: os módulos que os pagantes mais usam, com peso pelo uso. */
export const RECORTES_WELCOME: Array<{ m: string; dado: string; x: number; y: number; r: number; s: number; pontos?: number; barra?: number }> = [
  { m: "financas", dado: "Sobrando R$ 1.240", x: 194, y: 30, r: 5, s: 1.08 },
  { m: "rotina", dado: "Hoje", x: 22, y: 40, r: -7, s: 1.08, pontos: 4 },
  { m: "treino", dado: "3 de 5", x: 250, y: 118, r: 8, s: 1, pontos: 3 },
  { m: "dieta", dado: "1.640 kcal · no plano", x: 8, y: 146, r: -4, s: 1 },
  { m: "saude", dado: "Água 6 de 8", x: 246, y: 268, r: -6, s: 1 },
  { m: "desenvolvimento", dado: "62%", x: 36, y: 296, r: 6, s: 0.96, barra: 62 },
  { m: "casa", dado: "Luz vence sexta", x: 96, y: 376, r: 3, s: 0.92 },
  { m: "relacionamentos", dado: "Ligar pra mãe", x: 246, y: 350, r: -5, s: 0.92 },
];
