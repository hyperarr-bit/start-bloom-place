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
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const monthsSince = (dateStr: string): number => {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
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

export const defaultCleaningTasks: CleaningTask[] = [
  { id: "1", name: "Lavar banheiro", room: "Banheiro", emoji: "🚿", frequencyDays: 7, lastDone: "" },
  { id: "2", name: "Aspirar/varrer sala", room: "Sala", emoji: "🧹", frequencyDays: 3, lastDone: "" },
  { id: "3", name: "Trocar lençol", room: "Quarto", emoji: "🛏️", frequencyDays: 7, lastDone: "" },
  { id: "4", name: "Limpar cozinha", room: "Cozinha", emoji: "🍳", frequencyDays: 2, lastDone: "" },
  { id: "5", name: "Lavar roupa", room: "Área", emoji: "👕", frequencyDays: 3, lastDone: "" },
  { id: "6", name: "Tirar o lixo", room: "Geral", emoji: "🗑️", frequencyDays: 2, lastDone: "" },
];

export const defaultEmergencyItems: EmergencyItem[] = [
  { id: "1", name: "Velas", checked: false, lastChecked: "" },
  { id: "2", name: "Pilhas AA/AAA", checked: false, lastChecked: "" },
  { id: "3", name: "Lanterna", checked: false, lastChecked: "" },
  { id: "4", name: "Kit Primeiros Socorros", checked: false, lastChecked: "" },
  { id: "5", name: "Água mineral (reserva)", checked: false, lastChecked: "" },
  { id: "6", name: "Fósforos/Isqueiro", checked: false, lastChecked: "" },
];

export const defaultTravelChecklist = [
  { id: "1", text: "Desligar gás", checked: false },
  { id: "2", text: "Tirar lixo da pia", checked: false },
  { id: "3", text: "Desligar eletrônicos da tomada", checked: false },
  { id: "4", text: "Trancar janelas", checked: false },
  { id: "5", text: "Conferir torneiras", checked: false },
  { id: "6", text: "Pedir para alguém regar plantas", checked: false },
];
