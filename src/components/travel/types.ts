export const genId = () => crypto.randomUUID();

// ===== DESTINATION / BUCKET LIST =====
export type Destination = {
  id: string;
  name: string;
  country: string;
  continent: string;
  notes: string;
  visited: boolean;
  rating: number;
  photoUrl: string;
  priority: "sonho" | "planejando" | "próximo";
};

// ===== ITINERARY / DAILY TIMELINE =====
export type ItineraryDay = {
  id: string;
  tripId: string;
  dayNumber: number;
  date: string;
  items: TimelineItem[];
};

export type TimelineItem = {
  id: string;
  time: string;
  title: string;
  location: string;
  mapsLink: string;
  estimatedCost: number;
  type: "voo" | "hotel" | "restaurante" | "atividade" | "transporte" | "compras";
  done: boolean;
  pinned: boolean;
};

// ===== PACKING LIST =====
export type PackingTemplate = "praia" | "neve" | "trabalho" | "acampamento" | "custom";

export type PackingItem = {
  id: string;
  name: string;
  packed: boolean;
  category: string;
  linkedToSkincare?: boolean;
};

export type PackingList = {
  id: string;
  tripName: string;
  template: PackingTemplate;
  items: PackingItem[];
};

export const PACKING_TEMPLATES: Record<Exclude<PackingTemplate, "custom">, { label: string; emoji: string; items: { name: string; category: string; skincare?: boolean }[] }> = {
  praia: {
    label: "Praia", emoji: "🏖️",
    items: [
      { name: "Protetor Solar", category: "Higiene", skincare: true },
      { name: "Óculos de Sol", category: "Acessórios" },
      { name: "Chinelo", category: "Calçados" },
      { name: "Bermuda/Short", category: "Roupas" },
      { name: "Biquíni/Sunga", category: "Roupas" },
      { name: "Canga/Toalha de praia", category: "Acessórios" },
      { name: "Chapéu/Boné", category: "Acessórios" },
      { name: "Hidratante pós-sol", category: "Higiene", skincare: true },
      { name: "Camiseta leve", category: "Roupas" },
      { name: "Saída de praia", category: "Roupas" },
    ],
  },
  neve: {
    label: "Neve", emoji: "❄️",
    items: [
      { name: "Casaco térmico", category: "Roupas" },
      { name: "Luvas", category: "Acessórios" },
      { name: "Gorro", category: "Acessórios" },
      { name: "Botas impermeáveis", category: "Calçados" },
      { name: "Cachecol", category: "Acessórios" },
      { name: "Segunda pele (térmica)", category: "Roupas" },
      { name: "Meias grossas", category: "Roupas" },
      { name: "Protetor labial", category: "Higiene", skincare: true },
      { name: "Hidratante corporal", category: "Higiene", skincare: true },
      { name: "Protetor Solar facial", category: "Higiene", skincare: true },
    ],
  },
  trabalho: {
    label: "Trabalho", emoji: "💼",
    items: [
      { name: "Notebook + carregador", category: "Eletrônicos" },
      { name: "Adaptador de tomada", category: "Eletrônicos" },
      { name: "Camisa social", category: "Roupas" },
      { name: "Calça social", category: "Roupas" },
      { name: "Sapato social", category: "Calçados" },
      { name: "Cinto", category: "Acessórios" },
      { name: "Perfume", category: "Higiene" },
      { name: "Desodorante", category: "Higiene" },
      { name: "Cartões de visita", category: "Trabalho" },
      { name: "Power bank", category: "Eletrônicos" },
    ],
  },
  acampamento: {
    label: "Acampamento", emoji: "🏕️",
    items: [
      { name: "Barraca", category: "Equipamento" },
      { name: "Saco de dormir", category: "Equipamento" },
      { name: "Lanterna/Headlamp", category: "Equipamento" },
      { name: "Repelente", category: "Higiene" },
      { name: "Protetor Solar", category: "Higiene", skincare: true },
      { name: "Canivete", category: "Equipamento" },
      { name: "Garrafa d'água", category: "Equipamento" },
      { name: "Corda", category: "Equipamento" },
      { name: "Kit primeiros socorros", category: "Saúde" },
      { name: "Roupa de banho rápido", category: "Roupas" },
    ],
  },
};

// ===== BILL SPLITTER =====
export type BillEntry = {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  date: string;
};

export type BillSplitData = {
  tripName: string;
  people: string[];
  entries: BillEntry[];
};

// ===== PLACES BOARD =====
export type Place = {
  id: string;
  name: string;
  category: "comida" | "turistico" | "compras" | "cafe" | "bar";
  address: string;
  mapsLink: string;
  status: "quero_ir" | "ja_fui" | "favorito";
  notes: string;
  city: string;
};

export const PLACE_CATEGORIES = {
  comida: { label: "Comida", emoji: "🍕" },
  turistico: { label: "Pontos Turísticos", emoji: "📸" },
  compras: { label: "Compras", emoji: "🛍️" },
  cafe: { label: "Cafés", emoji: "☕" },
  bar: { label: "Bares", emoji: "🍸" },
};

export const PLACE_STATUS = {
  quero_ir: { label: "Quero ir", emoji: "📌" },
  ja_fui: { label: "Já fui", emoji: "✅" },
  favorito: { label: "Favorito", emoji: "❤️" },
};

// ===== SAFETY CARD =====
export type SafetyInfo = {
  insuranceNumber: string;
  embassyPhone: string;
  localEmergency: string;
  allergies: string;
  bloodType: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  medications: string;
};

// ===== CURRENCY CONVERTER =====
export type CurrencyRate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
};

// ===== TRAVEL DIARY =====
export type DiaryEntry = {
  id: string;
  tripName: string;
  date: string;
  bestThing: string;
  wouldNotDoAgain: string;
  photoUrl: string;
  mood: string;
};

// ===== TRAVEL BUDGET =====
export type TravelExpense = {
  id: string;
  trip: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
};

// ===== WEATHER PREP (AI-created feature) =====
export type WeatherPrep = {
  destination: string;
  month: string;
  avgTemp: string;
  rainChance: string;
  tips: string;
};

// ===== TRIP COUNTDOWN (AI-created feature) =====
export type TripCountdown = {
  id: string;
  tripName: string;
  departureDate: string;
  photoUrl: string;
};

// ===== HELPERS =====
export function calculateSettlement(data: BillSplitData): { from: string; to: string; amount: number }[] {
  const balances: Record<string, number> = {};
  data.people.forEach(p => (balances[p] = 0));

  data.entries.forEach(entry => {
    const share = entry.amount / entry.splitBetween.length;
    balances[entry.paidBy] = (balances[entry.paidBy] || 0) + entry.amount;
    entry.splitBetween.forEach(person => {
      balances[person] = (balances[person] || 0) - share;
    });
  });

  const debts: { from: string; to: string; amount: number }[] = [];
  const debtors = Object.entries(balances).filter(([, b]) => b < -0.01).sort((a, b) => a[1] - b[1]);
  const creditors = Object.entries(balances).filter(([, b]) => b > 0.01).sort((a, b) => b[1] - a[1]);

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i][1], creditors[j][1]);
    if (amount > 0.01) {
      debts.push({ from: debtors[i][0], to: creditors[j][0], amount: Math.round(amount * 100) / 100 });
    }
    debtors[i][1] += amount;
    creditors[j][1] -= amount;
    if (Math.abs(debtors[i][1]) < 0.01) i++;
    if (Math.abs(creditors[j][1]) < 0.01) j++;
  }

  return debts;
}

export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

export function convertCurrency(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}
