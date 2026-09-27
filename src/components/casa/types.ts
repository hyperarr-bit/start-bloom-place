import { parseLocalDay } from "@/lib/utils";

export interface CleaningTask {
  id: string;
  name: string;
  room: string;
  emoji: string;
  frequencyDays: number;
  lastDone: string;
}

export interface PantryItem {
  id: string;
  name: string;
  category: 'geladeira' | 'armario' | 'limpeza' | 'banheiro';
  status: 'cheio' | 'acabando' | 'acabou';
}

export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
  fromPantry: boolean;
  /** De onde o item saiu da despensa quando "acabou" (07/09, avaliação da
   *  Play: "os itens voltam todos para o armário, poderia voltar o item
   *  para o local onde foi colocado inicial"). Opcional: item que já estava
   *  na lista antes disto não tem — e volta pro armário como sempre voltou. */
  origemCategory?: PantryItem["category"];
  /** Item que o "comprei" recriou na despensa (26/09, varredura): desmarcar
   *  tira ele de novo, em vez de marcar/desmarcar/marcar duplicar. */
  devolvidoId?: string;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  ingredients: string[];
}

export interface MealPlan {
  [day: string]: { almoco: string; janta: string };
}

export interface MaintenanceTask {
  id: string;
  task: string;
  frequencyMonths: number;
  lastDone: string;
  icon: string;
}

export interface Warranty {
  id: string;
  product: string;
  purchaseDate: string;
  warrantyMonths: number;
  photoUrl: string;
  notes: string;
}

export interface RoomMeasure {
  id: string;
  room: string;
  label: string;
  value: string;
}

export interface PlantOrPet {
  id: string;
  name: string;
  type: 'plant' | 'pet';
  emoji: string;
  careInterval: number;
  lastCare: string;
  careAction: string;
  photoUrl: string;
}

export interface HouseMember {
  id: string;
  name: string;
  emoji: string;
}

export interface ChoreTask {
  id: string;
  name: string;
  currentTurnIndex: number;
  lastRotation: string;
  done: boolean;
}

export interface ServiceContact {
  id: string;
  name: string;
  phone: string;
  tag: string;
  lastService: string;
  lastValue: string;
}

export interface DeclutterItem {
  id: string;
  name: string;
  price: string;
  photoUrl: string;
  status: 'separar' | 'anunciado' | 'vendido';
}

export interface UtilityRecord {
  id: string;
  month: string;
  type: 'luz' | 'agua' | 'gas' | 'internet';
  cost: number;
  consumption: number;
  unit: string;
}

export interface EmergencyItem {
  id: string;
  name: string;
  checked: boolean;
  lastChecked: string;
}

export interface GuestAllergy {
  id: string;
  name: string;
  restriction: string;
}

// Utility functions
export const daysSince = (dateStr: string): number => {
  if (!dateStr) return 999;
  const diff = Date.now() - parseLocalDay(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Meses COMPLETOS desde a data (26/09, auditoria da virada). Contava mês de
 * calendário: o filtro trocado em 30/09 "a cada 1 mês" aparecia ATRASADO em
 * 01/10 — um dia depois — enquanto o aviso de Casa (planejarManutencao) dizia
 * 30/10. Agora o mês só fecha no mesmo dia do mês seguinte, limitado ao fim
 * dele (31/08 + 1 mês = 30/09), a mesma conta do aviso.
 */
export const monthsSince = (dateStr: string, now: Date = new Date()): number => {
  if (!dateStr) return 999;
  const d = parseLocalDay(dateStr);
  let meses = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  const diaQueFecha = Math.min(d.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  if (now.getDate() < diaQueFecha) meses -= 1;
  return Math.max(0, meses);
};

export const healthPercent = (lastDone: string, frequencyDays: number): number => {
  const days = daysSince(lastDone);
  if (days >= frequencyDays) return 0;
  return Math.max(0, Math.round(((frequencyDays - days) / frequencyDays) * 100));
};

export const healthColor = (percent: number): string => {
  if (percent >= 60) return "bg-green-500";
  if (percent >= 30) return "bg-yellow-500";
  return "bg-red-500";
};

export const healthTextColor = (percent: number): string => {
  if (percent >= 60) return "text-green-500";
  if (percent >= 30) return "text-yellow-500";
  return "text-red-500";
};

export const pantryCategoryEmoji: Record<string, string> = {
  geladeira: "🧊",
  armario: "🗄️",
  limpeza: "🧹",
  banheiro: "🛁",
};

export const pantryCategoryLabel: Record<string, string> = {
  geladeira: "Geladeira",
  armario: "Armário",
  limpeza: "Limpeza",
  banheiro: "Banheiro",
};

export const statusEmoji: Record<string, string> = {
  cheio: "🟢",
  acabando: "🟡",
  acabou: "🔴",
};

export const defaultCleaningTasks: CleaningTask[] = [];

export const defaultEmergencyItems: EmergencyItem[] = [];

export const defaultTravelChecklist: { id: string; text: string; checked: boolean }[] = [];
