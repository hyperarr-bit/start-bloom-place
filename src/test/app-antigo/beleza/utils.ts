// @ts-nocheck
// cópia congelada de 78883beb:src/components/beleza/utils.ts (o app das lojas: iPhone 1.0.7/1.0.8, Android 125) — NÃO editar; é o leitor antigo dos testes de compatibilidade
import { parseLocalDay } from "@/lib/utils";

// ============= CONFLICT DATABASE =============
export interface ConflictRule {
  ingredients: [string, string];
  severity: "high" | "medium";
  message: string;
  suggestion: string;
  /** A dica manda ALTERNAR OS DIAS: os dois no mesmo dia já é conflito, mesmo
   *  um de manhã e outro à noite. Sem isso, só conflita no mesmo período. */
  mesmoDia?: boolean;
}

export const CONFLICT_RULES: ConflictRule[] = [
  { ingredients: ["retinol", "ácido glicólico"], severity: "high", message: "Retinol + Ácido Glicólico podem causar irritação severa", suggestion: "Use Retinol à noite e Ácido Glicólico em dias alternados", mesmoDia: true },
  { ingredients: ["retinol", "aha"], severity: "high", message: "Retinol + AHA causam descamação excessiva", suggestion: "Alterne os dias de uso", mesmoDia: true },
  { ingredients: ["retinol", "bha"], severity: "high", message: "Retinol + BHA podem sensibilizar a pele", suggestion: "Use BHA de manhã e Retinol à noite" },
  { ingredients: ["retinol", "vitamina c"], severity: "medium", message: "Retinol + Vitamina C podem reduzir eficácia", suggestion: "Vitamina C de manhã, Retinol à noite" },
  { ingredients: ["retinol", "peróxido de benzoíla"], severity: "high", message: "Peróxido de Benzoíla inativa o Retinol", suggestion: "Use em horários diferentes" },
  { ingredients: ["vitamina c", "niacinamida"], severity: "medium", message: "Em alta concentração podem causar vermelhidão", suggestion: "Espere 15 min entre aplicações ou use em horários diferentes" },
  { ingredients: ["aha", "bha"], severity: "medium", message: "AHA + BHA juntos podem ressecar demais", suggestion: "Alterne: AHA em um dia, BHA no outro", mesmoDia: true },
  { ingredients: ["aha", "vitamina c"], severity: "medium", message: "Ambos são ácidos e podem irritar", suggestion: "Vitamina C de manhã, AHA à noite" },
  { ingredients: ["peróxido de benzoíla", "vitamina c"], severity: "high", message: "Peróxido oxida a Vitamina C, anulando o efeito", suggestion: "Nunca use juntos" },
  { ingredients: ["retinol", "ácido salicílico"], severity: "medium", message: "Ambos esfoliam e podem irritar peles sensíveis", suggestion: "Ácido Salicílico de manhã, Retinol à noite" },
];

export const SKINCARE_STEP_ICONS: Record<string, string> = {
  "limpeza": "🧹", "cleanser": "🧹", "sabonete": "🧹",
  "tônico": "💧", "tonico": "💧", "toner": "💧",
  "sérum": "🧴", "serum": "🧴",
  "hidratante": "🧊", "moisturizer": "🧊", "creme": "🧊",
  "protetor solar": "☀️", "fps": "☀️", "sunscreen": "☀️",
  "óleo": "🧼", "oil": "🧼",
  "máscara": "🎭", "mascara": "🎭", "mask": "🎭",
  "esfoliante": "✨", "exfoliant": "✨",
  "retinol": "💎", "ácido": "⚗️", "acido": "⚗️",
  "contorno dos olhos": "👁️", "eye cream": "👁️",
  "primer": "🎨", "água micelar": "🌊", "demaquilante": "🧽",
};

export function getStepIcon(stepName: string): string {
  const lower = String(stepName ?? "").toLowerCase();
  for (const [key, icon] of Object.entries(SKINCARE_STEP_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "💆";
}

// ============= CONFLICT CHECKER =============
export function checkConflicts(steps: string[]): ConflictRule[] {
  const lowerSteps = steps.map(s => s.toLowerCase());
  const found: ConflictRule[] = [];
  for (const rule of CONFLICT_RULES) {
    const [a, b] = rule.ingredients;
    const hasA = lowerSteps.some(s => s.includes(a));
    const hasB = lowerSteps.some(s => s.includes(b));
    if (hasA && hasB) found.push(rule);
  }
  return found;
}

/** Conflitos da rotina olhando manhã e noite SEPARADAS (26/09, varredura).
 *  Antes a rotina juntava os dois períodos: Vitamina C de manhã + Retinol à
 *  noite dava "CONFLITOS DETECTADOS… 💡 Vitamina C de manhã, Retinol à noite"
 *  — o alerta contradizia a própria dica. Regra de "horários diferentes" só
 *  conflita no mesmo período; regra de "alterne os dias" (mesmoDia) conflita
 *  com os dois em qualquer período do dia. */
export function conflitosDaRotina(manha: string[], noite: string[]): ConflictRule[] {
  const m = manha.map(s => String(s ?? "").toLowerCase());
  const n = noite.map(s => String(s ?? "").toLowerCase());
  const tem = (lista: string[], ingrediente: string) => lista.some(s => s.includes(ingrediente));
  return CONFLICT_RULES.filter(({ ingredients: [a, b], mesmoDia }) => {
    const noMesmoPeriodo = (tem(m, a) && tem(m, b)) || (tem(n, a) && tem(n, b));
    if (noMesmoPeriodo) return true;
    return !!mesmoDia && (tem(m, a) || tem(n, a)) && (tem(m, b) || tem(n, b));
  });
}

// ============= PASSOS DA ROTINA × CHECKS DO DIA =============
/* Os checks do dia guardam o ÍNDICE do passo (skincare-*-checked, formato
   gravado em conta real — não muda). Apagar um passo desloca os índices de
   quem vem depois, então os checks de HOJE andam junto; dias passados só
   contam pra sequência (tamanho > 0) e ficam como estão. */
export const marcadosAposRemover = (marcados: number[], idx: number): number[] =>
  marcados.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i));

export const marcadosAposInserir = (marcados: number[], idx: number, marcar: boolean): number[] => {
  const deslocados = marcados.map(i => (i >= idx ? i + 1 : i));
  return marcar ? [...deslocados, idx] : deslocados;
};

export const inserirEm = <T,>(lista: T[], idx: number, item: T): T[] => {
  const pos = Math.min(Math.max(0, idx), lista.length);
  return [...lista.slice(0, pos), item, ...lista.slice(pos)];
};

/** Fase do skin cycling (0–3) contando dias LOCAIS desde o início gravado.
 *  Início vazio ou inválido = hoje é o dia 1 (nunca NaN na tela). */
export const faseDoCiclo = (inicio: string, hoje: string): number => {
  const ehDia = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!ehDia(inicio) || !ehDia(hoje)) return 0;
  // round, não floor: dia com horário de verão tem 23 ou 25 h
  const dias = Math.round((parseLocalDay(hoje).getTime() - parseLocalDay(inicio).getTime()) / 86_400_000);
  return ((dias % 4) + 4) % 4;
};

// ============= COST PER DOSE =============
const DOSE_ESTIMATES: Record<string, number> = {
  "Skincare": 0.5, "Cabelo": 10, "Maquiagem": 0.3, "Corpo": 5, "Unhas": 0.2, "Outro": 1,
};

export function calculateCostPerDose(price: number, sizeMl: number, category: string): number {
  const doseSize = DOSE_ESTIMATES[category] || 1;
  const totalDoses = sizeMl / doseSize;
  return totalDoses > 0 ? price / totalDoses : 0;
}

// ============= PAO EXPIRY =============
export function calculateExpiryDate(openedDate: string, paoMonths: number): Date {
  const d = new Date(openedDate + "T12:00:00");
  d.setMonth(d.getMonth() + paoMonths);
  return d;
}

export function getExpiryProgress(openedDate: string, paoMonths: number): { percent: number; daysLeft: number; expired: boolean } {
  const opened = new Date(openedDate + "T12:00:00").getTime();
  const expiry = calculateExpiryDate(openedDate, paoMonths).getTime();
  const now = Date.now();
  const total = expiry - opened;
  const elapsed = now - opened;
  const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return { percent, daysLeft, expired: daysLeft <= 0 };
}

// ============= POROSITY TEST =============
export type PorosityResult = "baixa" | "media" | "alta";
export function calculatePorosity(answers: [number, number, number]): PorosityResult {
  const score = answers.reduce((a, b) => a + b, 0);
  if (score <= 3) return "baixa";
  if (score <= 6) return "media";
  return "alta";
}

export function getPorosityRecommendation(result: PorosityResult): { focus: string; cycle: string; description: string } {
  switch (result) {
    case "baixa": return { focus: "Hidratação", cycle: "H-H-N (foco em hidratar)", description: "Cabelo de baixa porosidade tem dificuldade de absorver produtos. Foque em hidratação com calor." };
    case "media": return { focus: "Equilibrado", cycle: "H-N-R (equilibrado)", description: "Cabelo de média porosidade absorve e retém bem. Mantenha o equilíbrio entre os três." };
    case "alta": return { focus: "Reconstrução", cycle: "R-R-N (foco em reconstruir)", description: "Cabelo de alta porosidade perde umidade rápido. Foque em reconstrução para selar as cutículas." };
  }
}

// ============= HAIR RESULT TAGS =============
export const HAIR_RESULT_TAGS = [
  { id: "brilho", label: "Brilho", emoji: "✨" },
  { id: "frizz", label: "Frizz", emoji: "⚡" },
  { id: "maciez", label: "Maciez", emoji: "☁️" },
  { id: "peso", label: "Peso", emoji: "⚖️" },
  { id: "volume", label: "Volume", emoji: "💨" },
  { id: "definicao", label: "Definição", emoji: "🌀" },
];

export const WASH_STEPS = [
  { id: "pre-shampoo", label: "Pré-shampoo", emoji: "🧼" },
  { id: "shampoo", label: "Shampoo", emoji: "🧴" },
  { id: "mascara", label: "Máscara", emoji: "🎭" },
  { id: "condicionador", label: "Condicionador", emoji: "🧊" },
  { id: "finalizador", label: "Finalizador/Óleo", emoji: "✨" },
];

// ============= TYPES =============
export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  opened: boolean;
  openedDate: string;
  paoMonths: number;
  expiry: string;
  notes: string;
  rating: number;
  repurchase: boolean;
  price: number;
  sizeMl: number;
  photoUrl: string;
  frequency: string;
  finished: boolean;
}

export interface SkinEntry {
  id: string;
  date: string;
  skin: string;
  mood: string;
  notes: string;
  products: string;
  photoUrl: string;
}

export interface HairEvent {
  id: string;
  type: string;
  date: string;
  notes: string;
}

export interface WashLog {
  id: string;
  date: string;
  dayOfWeek: number;
  type: string;
  stepsCompleted: string[];
  productsUsed: Record<string, string>;
  resultTags: string[];
  notes: string;
}
