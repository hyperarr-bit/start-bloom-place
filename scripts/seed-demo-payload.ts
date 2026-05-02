/* eslint-disable */
// Generates a rich, coherent seed payload for the demo user.
// Run: bun scripts/seed-demo-payload.ts > /tmp/payload.json
// Persona: Lucas, 32, dev backend sênior em SP, casado, 1 cachorro.
// Horizon: ~90 days back from "today" (TODAY constant below).

const TODAY = new Date("2026-05-02");
const DAY_MS = 86_400_000;

const dStr = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const rand = (seed: number) => {
  // simple deterministic LCG so output is reproducible
  let x = (seed * 9301 + 49297) % 233280;
  return x / 233280;
};

// ---------- Persona constants ----------
const NAME = "Lucas";
const SALARY = 12500;
const FREELA = 2200;

// ---------- Last 90 days dates ----------
const days90 = range(90).map((i) => dStr(addDays(TODAY, -89 + i))); // oldest → newest

// ---------- Helpers ----------
const entries: Array<{ key: string; value: any }> = [];
const put = (key: string, value: any) => entries.push({ key, value });

// ============================================================================
// HOME + GAMIFICAÇÃO
// ============================================================================
put("core-user-name", NAME);
put("core-welcome-done", "true");
put("core-onboarding-done", "true");
put("core-tip-seen-financas", "true");
put("core-tip-seen-treino", "true");

put("core-home-widgets-v2", [
  { id: "finances", order: 0 },
  { id: "habits", order: 1 },
  { id: "health", order: 2 },
  { id: "workout", order: 3 },
  { id: "calories", order: 4 },
  { id: "week-progress", order: 5 },
  { id: "habit-streaks", order: 6 },
  { id: "quick-notes", order: 7 },
  { id: "countdown", order: 8 },
  { id: "macro-balance", order: 9 },
  { id: "reading", order: 10 },
  { id: "sleep-log", order: 11 },
]);

put("core-home-quick-notes", "• Levar Thor ao vet quinta\n• Reunião 1:1 com tech lead 14h\n• Comprar presente aniversário Ana");

put("core-home-countdowns", [
  { id: "cd1", title: "Viagem Lisboa", date: dStr(addDays(TODAY, 68)), emoji: "✈️" },
  { id: "cd2", title: "Aniversário Ana", date: dStr(addDays(TODAY, 22)), emoji: "🎂" },
  { id: "cd3", title: "Maratona Rio", date: dStr(addDays(TODAY, 134)), emoji: "🏃" },
]);

put("core-hub-streak", { current: 47, longest: 62, lastDate: dStr(TODAY) });
put("core-mood-log", Object.fromEntries(days90.filter((_, i) => i % 2 === 0).map((d, i) => [d, ["otimo", "bom", "neutro", "bom", "otimo"][i % 5]])));
put("core-module-prefs", { financas: true, rotina: true, saude: true, treino: true, dieta: true, hiperfoco: true, estudos: true, casa: true, biblioteca: true, beleza: true, viagens: true, carreira: true, relacionamentos: true, pet: true, detox: true });

put("conquistas_points", 1840);
put("conquistas_unlocked", [
  "first_transaction", "first_habit", "first_workout", "first_meal", "first_task",
  "first_water_log", "first_note", "streak_7", "streak_14", "streak_30",
  "habit_master", "fitness_starter", "saver_500", "saver_2k", "investor_first",
  "reader_3", "focus_10h", "early_bird", "night_owl_no", "balanced_life",
  "module_explorer_5", "module_explorer_10", "month_complete", "goal_25pct", "goal_50pct",
]);
put("gamification-lastCheckIn", dStr(TODAY));

// ============================================================================
// FINANÇAS
// ============================================================================
const finCats = ["alimentacao","transporte","moradia","saude","lazer","educacao","assinaturas","compras","servicos","investimentos","salario","freela"];
put("financas_categories", finCats);

const txTemplates = [
  { d: "Mercado Pão de Açúcar", c: "alimentacao", min: 180, max: 420 },
  { d: "iFood", c: "alimentacao", min: 28, max: 95 },
  { d: "Padaria do bairro", c: "alimentacao", min: 12, max: 38 },
  { d: "Uber", c: "transporte", min: 14, max: 65 },
  { d: "Gasolina Shell", c: "transporte", min: 180, max: 280 },
  { d: "Estacionamento", c: "transporte", min: 10, max: 35 },
  { d: "Aluguel", c: "moradia", min: 2400, max: 2400, monthly: true, day: 5 },
  { d: "Condomínio", c: "moradia", min: 680, max: 680, monthly: true, day: 10 },
  { d: "Conta de luz Enel", c: "moradia", min: 180, max: 320, monthly: true, day: 12 },
  { d: "Internet Vivo Fibra", c: "servicos", min: 129, max: 129, monthly: true, day: 8 },
  { d: "Plano de saúde Sulamérica", c: "saude", min: 580, max: 580, monthly: true, day: 15 },
  { d: "Farmácia Drogasil", c: "saude", min: 25, max: 120 },
  { d: "Academia Smart Fit", c: "saude", min: 99, max: 99, monthly: true, day: 7 },
  { d: "Cinema iMax", c: "lazer", min: 45, max: 78 },
  { d: "Restaurante", c: "lazer", min: 85, max: 240 },
  { d: "Bar com amigos", c: "lazer", min: 60, max: 180 },
  { d: "Netflix", c: "assinaturas", min: 55, max: 55, monthly: true, day: 3 },
  { d: "Spotify Family", c: "assinaturas", min: 27, max: 27, monthly: true, day: 4 },
  { d: "Notion AI", c: "assinaturas", min: 50, max: 50, monthly: true, day: 14 },
  { d: "Curso Udemy", c: "educacao", min: 39, max: 89 },
  { d: "Livro Amazon", c: "educacao", min: 35, max: 95 },
  { d: "Mercado Livre", c: "compras", min: 80, max: 450 },
  { d: "Aporte CDB Inter", c: "investimentos", min: 1500, max: 1500, monthly: true, day: 20 },
  { d: "Aporte Tesouro IPCA+", c: "investimentos", min: 800, max: 800, monthly: true, day: 22 },
];

const transactions: any[] = [];
let txId = 1;
// Generate ~120 transactions across 90 days
for (let i = 0; i < days90.length; i++) {
  const date = days90[i];
  const dayNum = new Date(date).getDate();
  // Salário no dia 5
  if (dayNum === 5) {
    transactions.push({ id: `tx_${txId++}`, date, description: "Salário CLT", category: "salario", type: "income", amount: SALARY });
  }
  if (dayNum === 18) {
    transactions.push({ id: `tx_${txId++}`, date, description: "Freela projeto landing page", category: "freela", type: "income", amount: FREELA });
  }
  // Fixed monthly bills
  for (const t of txTemplates) {
    if (t.monthly && t.day === dayNum) {
      transactions.push({ id: `tx_${txId++}`, date, description: t.d, category: t.c, type: "expense", amount: -t.min });
    }
  }
  // 1-2 random variable expenses on most days
  const r = rand(i + 1);
  const variable = txTemplates.filter((t) => !t.monthly);
  if (r > 0.2) {
    const tpl = variable[Math.floor(rand(i + 50) * variable.length)];
    const amt = Math.round(tpl.min + rand(i + 100) * (tpl.max - tpl.min));
    transactions.push({ id: `tx_${txId++}`, date, description: tpl.d, category: tpl.c, type: "expense", amount: -amt });
  }
  if (r > 0.7) {
    const tpl = variable[Math.floor(rand(i + 200) * variable.length)];
    const amt = Math.round(tpl.min + rand(i + 300) * (tpl.max - tpl.min));
    transactions.push({ id: `tx_${txId++}`, date, description: tpl.d, category: tpl.c, type: "expense", amount: -amt });
  }
}
put("financas_transactions", transactions);

put("finance-credit-cards", [
  { id: "cc1", name: "Nubank", brand: "mastercard", limit: 12000, closingDay: 5, bestPurchaseDay: 6, color: "#820AD1" },
  { id: "cc2", name: "Inter Black", brand: "mastercard", limit: 18000, closingDay: 12, bestPurchaseDay: 13, color: "#FF7A00" },
  { id: "cc3", name: "C6 Carbon", brand: "visa", limit: 15000, closingDay: 20, bestPurchaseDay: 21, color: "#1A1A1A" },
]);

put("finance-fixed-expenses", [
  { id: "fix-1", description: "Aluguel", category: "moradia", value: 2400, paymentMethod: "pix", dueDay: 5 },
  { id: "fix-2", description: "Condomínio", category: "moradia", value: 680, paymentMethod: "boleto", dueDay: 10 },
  { id: "fix-3", description: "Internet Vivo Fibra", category: "servicos", value: 129, paymentMethod: "cartao", cardName: "Nubank", dueDay: 8 },
  { id: "fix-4", description: "Conta de luz Enel", category: "moradia", value: 240, paymentMethod: "boleto", dueDay: 12 },
  { id: "fix-5", description: "Netflix + Spotify + Notion", category: "assinaturas", value: 132, paymentMethod: "cartao", cardName: "Nubank", dueDay: 4 },
  { id: "fix-6", description: "Academia Smart Fit", category: "saude", value: 99, paymentMethod: "cartao", cardName: "Inter Black", dueDay: 7 },
  { id: "fix-7", description: "Plano de saúde Sulamérica", category: "saude", value: 580, paymentMethod: "boleto", dueDay: 15 },
  { id: "fix-8", description: "Seguro carro Porto", category: "transporte", value: 320, paymentMethod: "boleto", dueDay: 18 },
]);

put("finance-incomes", [
  { id: "inc-1", description: "Salário CLT", source: "Empresa XPTO", value: SALARY, date: dStr(addDays(TODAY, -27)) },
  { id: "inc-2", description: "Freela landing page", source: "Cliente Aurora", value: FREELA, date: dStr(addDays(TODAY, -14)) },
]);

put("finance-investments", [
  { id: "inv-1", name: "CDB Inter 110% CDI", type: "renda-fixa", value: 18500, date: dStr(addDays(TODAY, -200)) },
  { id: "inv-2", name: "Tesouro IPCA+ 2035", type: "renda-fixa", value: 12300, date: dStr(addDays(TODAY, -150)) },
  { id: "inv-3", name: "ITSA4", type: "acoes", value: 4800, date: dStr(addDays(TODAY, -180)) },
  { id: "inv-4", name: "BOVA11", type: "etf", value: 6200, date: dStr(addDays(TODAY, -120)) },
  { id: "inv-5", name: "Bitcoin", type: "cripto", value: 3400, date: dStr(addDays(TODAY, -90)) },
]);

put("finance-goals", [
  { id: "goal-1", name: "Reserva de emergência", targetValue: 50000, currentValue: 36500, deadline: "2026-12-31", category: "seguranca" },
  { id: "goal-2", name: "Viagem Europa 2026", targetValue: 15000, currentValue: 8200, deadline: "2026-09-15", category: "viagem" },
  { id: "goal-3", name: "Entrada apartamento", targetValue: 80000, currentValue: 22000, deadline: "2028-06-30", category: "imovel" },
  { id: "goal-4", name: "MBA Insper", targetValue: 30000, currentValue: 5000, deadline: "2027-03-01", category: "educacao" },
]);

put("finance-wishlist", [
  { id: "w1", name: "MacBook Pro M4 14\"", price: 18999, savedAmount: 6000, priority: "alta", category: "Eletrônicos", targetDate: "2026-08-30" },
  { id: "w2", name: "PlayStation 5 Pro", price: 5499, savedAmount: 2200, priority: "media", category: "Eletrônicos", targetDate: "2026-11-15" },
  { id: "w3", name: "Monitor Dell 4K 32\"", price: 4200, savedAmount: 1500, priority: "media", category: "Eletrônicos" },
  { id: "w4", name: "Cadeira Herman Miller", price: 12000, savedAmount: 800, priority: "baixa", category: "Casa" },
  { id: "w5", name: "Câmera Sony A7 IV", price: 18500, savedAmount: 3200, priority: "baixa", category: "Hobby" },
]);

put("finance-installments", [
  { id: "inst-1", description: "Sofá Tok&Stok", installmentValue: 380, totalInstallments: 10, paidInstallments: 4, startDate: dStr(addDays(TODAY, -120)), cardName: "Nubank" },
  { id: "inst-2", description: "iPhone 16 Pro", installmentValue: 760, totalInstallments: 12, paidInstallments: 7, startDate: dStr(addDays(TODAY, -210)), cardName: "Inter Black" },
]);

put("finance-category-budgets", {
  alimentacao: 1200,
  transporte: 600,
  moradia: 3500,
  saude: 800,
  lazer: 700,
  educacao: 250,
  assinaturas: 200,
  compras: 500,
});

put("finance-expenses", transactions.filter((t) => t.type === "expense").slice(-30));
put("finance-incomes", [
  { id: "inc-1", description: "Salário CLT", source: "Empresa XPTO", value: SALARY, date: dStr(addDays(TODAY, -27)) },
  { id: "inc-2", description: "Freela landing page", source: "Cliente Aurora", value: FREELA, date: dStr(addDays(TODAY, -14)) },
]);

put("finance-dueDays", [
  { id: "due-1", description: "Fatura Nubank", value: 1840, dueDay: 15, isPaid: true, category: "cartao" },
  { id: "due-2", description: "Fatura Inter Black", value: 2200, dueDay: 22, isPaid: false, category: "cartao" },
  { id: "due-3", description: "IPVA carro", value: 980, dueDay: 28, isPaid: false, category: "transporte" },
]);

put("finance-notes", [
  { id: "n1", text: "Meta do mês: gastar menos de R$ 800 com lazer", date: dStr(addDays(TODAY, -10)) },
  { id: "n2", text: "Renegociar plano de internet em junho — Vivo subiu", date: dStr(addDays(TODAY, -5)) },
  { id: "n3", text: "Considerar trocar academia pela Bluefit (R$ 79)", date: dStr(addDays(TODAY, -2)) },
]);

put("finance-streak", 23);
put("finance-lastCheckIn", dStr(TODAY));
put("finance-last-seen-month", "Maio");

put("finance-trips", [
  { id: "trip-1", destination: "Lisboa", startDate: dStr(addDays(TODAY, 68)), endDate: dStr(addDays(TODAY, 78)), budget: 12000, savedAmount: 8200, expenses: [] },
]);

// Annual overview (12 months)
const monthsBR = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
put("finance-annual", monthsBR.map((m, i) => {
  const past = i < 4;
  const current = i === 4;
  return {
    month: m,
    receitas: past || current ? 14700 : 0,
    custosFixos: past || current ? 4580 : 0,
    custosVariaveis: past || current ? Math.round(2400 + i * 80) : 0,
    dividas: past || current ? 1140 : 0,
  };
}));

// Per-month detailed sheets (jan/fev/mar/abr)
const monthKeys = ["janeiro","fevereiro","marco","abril"];
for (const mk of monthKeys) {
  put(`finance-month-${mk}-incomes`, [
    { id: `${mk}-inc-1`, description: "Salário CLT", source: "CLT", value: SALARY, date: `2026-${String(monthsBR.findIndex((m) => m.toLowerCase() === mk.replace("marco", "março")) + 1).padStart(2, "0")}-05` },
    { id: `${mk}-inc-2`, description: "Freela", source: "Aurora", value: FREELA, date: `2026-${String(monthsBR.findIndex((m) => m.toLowerCase() === mk.replace("marco", "março")) + 1).padStart(2, "0")}-18` },
  ]);
  put(`finance-month-${mk}-fixed`, [
    { id: `${mk}-f-1`, description: "Aluguel", category: "moradia", value: 2400, paymentMethod: "pix" },
    { id: `${mk}-f-2`, description: "Condomínio", category: "moradia", value: 680, paymentMethod: "boleto" },
    { id: `${mk}-f-3`, description: "Internet", category: "servicos", value: 129, paymentMethod: "cartao", cardName: "Nubank" },
    { id: `${mk}-f-4`, description: "Plano de saúde", category: "saude", value: 580, paymentMethod: "boleto" },
    { id: `${mk}-f-5`, description: "Streamings", category: "assinaturas", value: 132, paymentMethod: "cartao", cardName: "Nubank" },
  ]);
  put(`finance-month-${mk}-expenses`, transactions.filter((t) => t.type === "expense" && t.date.includes(`-${String(monthsBR.findIndex((m) => m.toLowerCase() === mk.replace("marco","março"))+1).padStart(2,"0")}-`)).slice(0, 20));
  put(`finance-month-${mk}-installments`, []);
  put(`finance-month-${mk}-dueDays`, [
    { id: `${mk}-due-1`, description: "Fatura Nubank", value: 1840, dueDay: 15, isPaid: true },
    { id: `${mk}-due-2`, description: "Fatura Inter", value: 2200, dueDay: 22, isPaid: true },
  ]);
  put(`finance-month-${mk}-notes`, [{ id: `${mk}-n1`, text: `Mês de ${mk} fechou no positivo 💪`, date: TODAY.toISOString() }]);
}

// ============================================================================
// ROTINA + HÁBITOS
// ============================================================================
put("rotina_tasks", [
  { id: "rt1", title: "Revisar PRs do time", time: "09:00", done: true, priority: "alta" },
  { id: "rt2", title: "Daily standup", time: "10:00", done: true, priority: "media" },
  { id: "rt3", title: "Deep work — refactor auth module", time: "10:30", done: false, priority: "alta" },
  { id: "rt4", title: "Almoço com Ana", time: "12:30", done: false, priority: "media" },
  { id: "rt5", title: "Treino — push day", time: "18:30", done: false, priority: "media" },
  { id: "rt6", title: "Estudar AWS — 1 capítulo", time: "20:00", done: false, priority: "baixa" },
  { id: "rt7", title: "Passear com Thor", time: "21:30", done: false, priority: "media" },
  { id: "rt8", title: "Ler 30min — Deep Work", time: "22:30", done: false, priority: "baixa" },
]);

const habits = [
  { id: "h1", name: "Beber 2L de água", emoji: "💧", color: "#3b82f6" },
  { id: "h2", name: "Ler 30 minutos", emoji: "📚", color: "#8b5cf6" },
  { id: "h3", name: "Meditar 10 min", emoji: "🧘", color: "#10b981" },
  { id: "h4", name: "Treino", emoji: "🏋️", color: "#f59e0b" },
  { id: "h5", name: "Inglês 15 min", emoji: "🇬🇧", color: "#ef4444" },
  { id: "h6", name: "Dormir antes das 23h30", emoji: "😴", color: "#6366f1" },
];
put("rotina-habits", habits);
put("habits", habits);

// 90 days × 6 habits with ~85% completion (deterministic)
const habitsChecked: Record<string, Record<string, boolean>> = {};
for (const d of days90) {
  habitsChecked[d] = {};
  for (let hi = 0; hi < habits.length; hi++) {
    const r = rand(d.charCodeAt(8) + d.charCodeAt(9) * 7 + hi * 13);
    habitsChecked[d][habits[hi].id] = r < 0.85;
  }
}
put("rotina-habits-checked", habitsChecked);

put("rotina-schedule", {
  segunda: [{ time: "07:00", title: "Acordar + meditar" }, { time: "09:00", title: "Trabalho" }, { time: "18:30", title: "Push day" }, { time: "22:30", title: "Leitura" }],
  terca: [{ time: "07:00", title: "Acordar" }, { time: "09:00", title: "Trabalho" }, { time: "18:30", title: "Pull day" }, { time: "20:00", title: "Inglês" }],
  quarta: [{ time: "07:00", title: "Acordar" }, { time: "09:00", title: "Trabalho" }, { time: "19:00", title: "Estudar AWS" }],
  quinta: [{ time: "07:00", title: "Acordar" }, { time: "09:00", title: "Trabalho" }, { time: "18:30", title: "Legs day" }, { time: "21:00", title: "Jantar com Ana" }],
  sexta: [{ time: "07:00", title: "Acordar" }, { time: "09:00", title: "Trabalho" }, { time: "19:30", title: "Happy hour time" }],
  sabado: [{ time: "08:00", title: "Corrida 5k" }, { time: "10:00", title: "Mercado" }, { time: "20:00", title: "Cinema/Jantar fora" }],
  domingo: [{ time: "09:00", title: "Café com a família" }, { time: "15:00", title: "Planejar a semana" }, { time: "19:00", title: "Meal prep" }],
});

put("rotina-urgencies", [
  { id: "u1", title: "Renovar passaporte", date: dStr(addDays(TODAY, 14)), priority: "alta" },
  { id: "u2", title: "Levar Thor ao vet", date: dStr(addDays(TODAY, 4)), priority: "media" },
]);

// Heatmap of activity (day-by-day score 0-4)
put("heatmap-log", Object.fromEntries(days90.map((d, i) => [d, Math.min(4, Math.floor(rand(i + 11) * 5))])));

put("weekly-reviews", range(12).map((i) => ({
  id: `wr-${i}`,
  weekOf: dStr(addDays(TODAY, -7 * (12 - i))),
  energy: 6 + Math.floor(rand(i + 3) * 4),
  focus: 6 + Math.floor(rand(i + 5) * 4),
  highlight: pick([
    "Fechei o refactor do módulo de auth",
    "Bati PR no supino: 95kg",
    "Consegui meditar 5 dias seguidos",
    "Almoço incrível com a Ana no sábado",
    "Terminei Deep Work — vida mudou",
    "Run de 10k em 52min",
  ], i),
  improve: pick([
    "Reduzir tempo de tela à noite",
    "Beber mais água",
    "Dormir mais cedo nas quartas",
    "Menos açúcar",
  ], i),
})));

// ============================================================================
// SAÚDE
// ============================================================================
// Weight: descending from 78 → 73 over 90 days
put("saude_weight", days90.filter((_, i) => i % 2 === 0).map((d, i, arr) => ({
  date: d,
  value: +(78 - (i / arr.length) * 5 + (rand(i + 7) - 0.5) * 0.4).toFixed(2),
})));

put("saude_pressao", range(12).map((i) => ({
  date: dStr(addDays(TODAY, -90 + i * 8)),
  sys: 115 + Math.floor(rand(i + 1) * 10),
  dia: 70 + Math.floor(rand(i + 3) * 10),
})));

const moods = ["otimo", "bom", "neutro", "bom", "otimo", "bom", "otimo"];
put("saude_mood", days90.filter((_, i) => i % 2 === 0).map((d, i) => ({ date: d, mood: moods[i % moods.length] })));

put("core-saude-water", Object.fromEntries(days90.map((d, i) => [d, 6 + Math.floor(rand(i + 17) * 4)])));
put("core-saude-sleep", Object.fromEntries(days90.map((d, i) => [d, +(6.5 + rand(i + 19) * 2).toFixed(1)])));
put("hidratacao", Object.fromEntries(days90.slice(-30).map((d, i) => [d, 6 + Math.floor(rand(i + 21) * 4)])));

put("core-saude-measures", [
  { id: "m1", date: dStr(addDays(TODAY, -90)), peso: 78, cintura: 88, peito: 102, bracoD: 36, bracoE: 35.5, pernaD: 58, pernaE: 58, bf: 21 },
  { id: "m2", date: dStr(addDays(TODAY, -60)), peso: 76, cintura: 86, peito: 103, bracoD: 36.5, bracoE: 36, pernaD: 58.5, pernaE: 58.5, bf: 19 },
  { id: "m3", date: dStr(addDays(TODAY, -30)), peso: 74.5, cintura: 84, peito: 104, bracoD: 37, bracoE: 36.5, pernaD: 59, pernaE: 59, bf: 17.5 },
  { id: "m4", date: dStr(addDays(TODAY, -7)), peso: 73.2, cintura: 82, peito: 105, bracoD: 37.5, bracoE: 37, pernaD: 59.5, pernaE: 59.5, bf: 16 },
]);

put("core-saude-sentiment", Object.fromEntries(days90.filter((_, i) => i % 3 === 0).map((d, i) => [d, {
  sentiment: pick(["contente", "desafio", "calmo", "produtivo", "cansado", "contente"], i),
  note: pick([
    "Dia produtivo, bati todas as metas",
    "Treino pesado, mas saí satisfeito",
    "Reunião difícil mas resolvi bem",
    "Deep work funcionou — 3h de foco",
    "Sono ruim ontem, hoje arrastado",
    "Ana e eu cozinhamos juntos, ótimo",
  ], i),
  items: [],
}])));

put("saude-bmi-height", 178);
put("saude-bmi-weight", 73);
put("saude-carb-goal", 240);
put("saude-prot-goal", 180);
put("saude-fat-goal", 80);
put("saude-fast-goal", 16);
put("core-saude-fasting-start", null);

put("energy-log", Object.fromEntries(days90.slice(-30).map((d, i) => [d, 6 + Math.floor(rand(i + 33) * 4)])));
put("mood-log", Object.fromEntries(days90.slice(-45).map((d, i) => [d, pick(moods, i)])));

// ============================================================================
// TREINO
// ============================================================================
put("treino_split", {
  segunda: { name: "Push (Peito + Ombro + Tríceps)", exercises: ["Supino reto", "Supino inclinado halter", "Desenvolvimento militar", "Elevação lateral", "Tríceps testa", "Tríceps corda"] },
  terca: { name: "Pull (Costas + Bíceps)", exercises: ["Barra fixa", "Remada curvada", "Puxada frontal", "Remada baixa", "Rosca direta", "Rosca martelo"] },
  quarta: { name: "Legs (Pernas + Glúteo)", exercises: ["Agachamento livre", "Leg press 45°", "Cadeira extensora", "Mesa flexora", "Stiff", "Panturrilha em pé"] },
  quinta: { name: "Push 2 (Peito + Ombro)", exercises: ["Supino declinado", "Crucifixo halter", "Desenvolvimento Arnold", "Crucifixo invertido", "Tríceps frânces"] },
  sexta: { name: "Pull 2 + Core", exercises: ["Levantamento terra", "Remada cavalinho", "Pulldown", "Rosca scott", "Prancha 3min"] },
  sabado: { name: "Cardio + Mobilidade", exercises: ["Corrida 5k", "Mobilidade ombro", "Foam roller"] },
  domingo: { name: "Descanso ativo", exercises: [] },
});

// ~50 sessions over 90 days (4-5x/week)
const treinoNames = ["Push", "Pull", "Legs", "Push 2", "Pull 2", "Cardio"];
put("treino_sessions", days90.filter((_, i) => i % 7 !== 6 && rand(i + 41) > 0.25).map((d, i) => ({
  id: `ts-${i}`,
  date: d,
  type: treinoNames[i % treinoNames.length],
  duration: 55 + Math.floor(rand(i + 43) * 25),
  exercises: 6 + Math.floor(rand(i + 47) * 3),
  volume: 4500 + Math.floor(rand(i + 53) * 2500),
  notes: pick(["Treino forte", "Bem disposto", "Cansado mas fui", "PR no supino!", "Carga subiu", ""], i),
})));

const exHistory: Record<string, any[]> = {};
const lifts = [
  { ex: "Supino reto", start: 70, end: 95 },
  { ex: "Agachamento livre", start: 90, end: 130 },
  { ex: "Levantamento terra", start: 100, end: 145 },
  { ex: "Desenvolvimento militar", start: 40, end: 55 },
  { ex: "Remada curvada", start: 60, end: 85 },
];
for (const l of lifts) {
  exHistory[l.ex] = range(15).map((i) => ({
    date: dStr(addDays(TODAY, -90 + i * 6)),
    weight: +(l.start + ((l.end - l.start) * i) / 14).toFixed(1),
    reps: 8 + Math.floor(rand(i + l.ex.length) * 3),
    sets: 4,
  }));
}
put("treino-exercise-history", exHistory);
put("treino-active-days", days90.filter((_, i) => i % 7 !== 6 && rand(i + 41) > 0.25));
put("treino-weekly-volume", range(13).map((i) => ({ week: dStr(addDays(TODAY, -7 * (13 - i))), volume: 18000 + Math.floor(rand(i + 61) * 8000) })));
put("treino-view", "split");
put("treino-sound", true);
put("treino-session-start", null);
put("core-treino-log", { lastSession: dStr(addDays(TODAY, -1)), totalSessions: 142 });

put("saude-workouts-v2", [
  { id: "w1", name: "Push Day", exercises: [{ name: "Supino reto", sets: 4, reps: "8-10" }, { name: "Supino inclinado halter", sets: 3, reps: "10-12" }, { name: "Desenvolvimento militar", sets: 4, reps: "8-10" }, { name: "Elevação lateral", sets: 3, reps: "12-15" }, { name: "Tríceps testa", sets: 3, reps: "10-12" }] },
  { id: "w2", name: "Pull Day", exercises: [{ name: "Barra fixa", sets: 4, reps: "AMRAP" }, { name: "Remada curvada", sets: 4, reps: "8-10" }, { name: "Puxada frontal", sets: 3, reps: "10-12" }, { name: "Rosca direta", sets: 3, reps: "10-12" }] },
  { id: "w3", name: "Leg Day", exercises: [{ name: "Agachamento", sets: 5, reps: "5-8" }, { name: "Leg press", sets: 4, reps: "10-12" }, { name: "Stiff", sets: 4, reps: "8-10" }, { name: "Panturrilha", sets: 4, reps: "15-20" }] },
]);
put("saude-workout-log", days90.slice(-30).filter((_, i) => i % 2 === 0).map((d, i) => ({ date: d, workoutId: `w${(i % 3) + 1}`, duration: 60 + Math.floor(rand(i) * 20) })));
put("saude-workout-notes", [{ id: "wn1", date: dStr(addDays(TODAY, -3)), note: "Bati 95kg no supino — meta era 90kg!" }, { id: "wn2", date: dStr(addDays(TODAY, -10)), note: "Ajustei agachamento, postura melhor" }]);

put("core-focus-timer-running", false);
put("core-focus-timer-start", 0);

// ============================================================================
// DIETA
// ============================================================================
put("dieta_macros", { calories: 2400, protein: 180, carbs: 240, fat: 80 });
put("dieta-meals-config", ["Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", "Janta"]);

const mealTemplates = [
  { id: "cafe", name: "Café da manhã", calories: 480, options: ["Ovos mexidos + pão integral + abacate", "Iogurte grego + granola + frutas vermelhas", "Whey + banana + aveia + pasta de amendoim", "Tapioca de frango com queijo branco"] },
  { id: "lanche1", name: "Lanche da manhã", calories: 220, options: ["Banana + 30g castanhas", "Whey + maçã", "Iogurte natural + mel", "Barrinha proteica"] },
  { id: "almoco", name: "Almoço", calories: 780, options: ["Frango grelhado + arroz integral + brócolis + salada", "Salmão grelhado + batata-doce + aspargos", "Filé mignon + purê de batata + legumes assados", "Strogonoff de frango light + arroz + batata palha"] },
  { id: "lanche2", name: "Lanche da tarde", calories: 260, options: ["Sanduíche de peito de peru integral", "Whey + 1 fruta", "Pão integral + ovo + queijo", "Mix castanhas + iogurte"] },
  { id: "janta", name: "Janta", calories: 660, options: ["Omelete de claras + salada + arroz", "Wrap integral de frango + salada", "Sopa de legumes + frango desfiado", "Salmão + quinoa + aspargos"] },
];

const dietaMeals: Record<string, any> = {};
for (let i = 0; i < days90.length; i++) {
  const d = days90[i];
  const meals = mealTemplates.map((m, mi) => ({
    id: m.id,
    name: m.name,
    calories: m.calories + Math.floor((rand(i * 7 + mi) - 0.5) * 80),
    foods: [m.options[(i + mi) % m.options.length]],
  }));
  const total = meals.reduce((s, m) => s + m.calories, 0);
  dietaMeals[d] = { meals, totalCalories: total, targetCalories: 2400 };
}
put("dieta_meals", dietaMeals);

put("dieta-diary-v2", Object.fromEntries(days90.slice(-45).map((d, i) => [d, {
  followed: rand(i + 71) > 0.18,
  weight: +(74 + (rand(i) - 0.5) * 1).toFixed(1),
  notes: pick(["Dia limpo", "Saí da dieta no jantar", "Tudo certo", "Comi um doce", ""], i),
}])));
put("dieta-diary-followed", Object.fromEntries(days90.map((d, i) => [d, rand(i + 73) > 0.18])));
put("dieta-cal-log", Object.fromEntries(days90.map((d, i) => [d, 2200 + Math.floor((rand(i + 79) - 0.5) * 400)])));
put("core-dieta-log", { totalDaysLogged: 87, currentStreak: 12, totalCalories: 198400 });

put("dieta-smart-list", [
  { id: "sl1", category: "Proteínas", items: [{ name: "Peito de frango 2kg", checked: true }, { name: "Patinho moído 1kg", checked: true }, { name: "Salmão 500g", checked: false }, { name: "Ovos 30un", checked: true }] },
  { id: "sl2", category: "Carboidratos", items: [{ name: "Arroz integral 5kg", checked: true }, { name: "Batata-doce 2kg", checked: false }, { name: "Aveia em flocos 500g", checked: true }] },
  { id: "sl3", category: "Vegetais", items: [{ name: "Brócolis", checked: true }, { name: "Espinafre", checked: false }, { name: "Cenoura", checked: true }, { name: "Tomate", checked: true }] },
  { id: "sl4", category: "Frutas", items: [{ name: "Banana", checked: true }, { name: "Maçã", checked: true }, { name: "Mirtilo", checked: false }] },
]);

// ============================================================================
// ESTUDOS
// ============================================================================
put("estudos_courses", [
  { id: "c1", name: "React Avançado — Patterns + Performance", platform: "Udemy", progress: 78, totalHours: 24, hoursDone: 18.7 },
  { id: "c2", name: "Inglês Fluente — C1", platform: "Cambly", progress: 62, totalHours: 100, hoursDone: 62 },
  { id: "c3", name: "AWS Solutions Architect Associate", platform: "A Cloud Guru", progress: 41, totalHours: 40, hoursDone: 16.4 },
  { id: "c4", name: "System Design Masterclass", platform: "ByteByteGo", progress: 28, totalHours: 30, hoursDone: 8.4 },
  { id: "c5", name: "Algoritmos para Entrevistas", platform: "AlgoExpert", progress: 55, totalHours: 50, hoursDone: 27.5 },
]);

put("estudos_pomodoros", days90.flatMap((d, i) => {
  const count = Math.floor(rand(i + 89) * 4) + (i % 7 === 5 || i % 7 === 6 ? 0 : 1);
  return range(count).map((p) => ({
    id: `pom-${i}-${p}`,
    date: d,
    duration: 25,
    course: pick(["c1", "c3", "c4", "c5", "c2"], i + p),
    completed: true,
  }));
}));

put("estudos-schedule", {
  "7h00":  { SEGUNDA: "Inglês 30min", TERÇA: "Inglês 30min", QUARTA: "Inglês 30min", QUINTA: "Inglês 30min", SEXTA: "Inglês 30min" },
  "12h30": { SEGUNDA: "Algoritmos", TERÇA: "", QUARTA: "Algoritmos", QUINTA: "", SEXTA: "Algoritmos" },
  "20h00": { SEGUNDA: "AWS", TERÇA: "React Avançado", QUARTA: "AWS", QUINTA: "System Design", SEXTA: "" },
  "21h00": { SEGUNDA: "", TERÇA: "Revisão", QUARTA: "", QUINTA: "Revisão", SEXTA: "" },
});

put("estudos-notebooks", [
  { id: "nb1", materia: "AWS — VPC + Networking", curso: "AWS SA", date: dStr(addDays(TODAY, -3)), resumo: "VPC, subnets, route tables, NAT gateway. CIDR /16 → /20 boa prática.", duvidas: "Diferença prática entre NAT gateway vs NAT instance em escala?", frases: "Always assume failure", planoLeitura: "Capítulos 4-6" },
  { id: "nb2", materia: "System Design — Caching", curso: "ByteByteGo", date: dStr(addDays(TODAY, -8)), resumo: "Write-through, write-back, cache aside. TTL e invalidação.", duvidas: "Como dimensionar Redis cluster?", frases: "Cache is a tax on correctness", planoLeitura: "Cap. 3" },
  { id: "nb3", materia: "React — useMemo vs useCallback", curso: "React Avançado", date: dStr(addDays(TODAY, -14)), resumo: "useMemo memoiza valores, useCallback memoiza funções. Não otimize prematuramente.", duvidas: "", frases: "Premature optimization is the root of all evil", planoLeitura: "Módulo 7" },
  { id: "nb4", materia: "Algoritmos — Two Pointers", curso: "AlgoExpert", date: dStr(addDays(TODAY, -20)), resumo: "Padrão útil pra arrays ordenados. Reduz O(n²) → O(n).", duvidas: "Quando combinar com sliding window?", frases: "", planoLeitura: "Lista 8" },
  { id: "nb5", materia: "Inglês — Phrasal verbs", curso: "Cambly", date: dStr(addDays(TODAY, -27)), resumo: "Look up, look into, look forward to, look after — uso em contexto técnico.", duvidas: "", frases: "I'm looking forward to the meeting", planoLeitura: "Unit 12" },
]);

// ============================================================================
// HIPERFOCO
// ============================================================================
put("hiperfoco_sessions", days90.filter((_, i) => i % 3 === 0).map((d, i) => ({
  id: `hf-${i}`,
  date: d,
  duration: 45 + Math.floor(rand(i + 91) * 60),
  task: pick([
    "Refactor módulo de autenticação",
    "Implementar feature de notificações",
    "Estudar System Design",
    "Resolver 3 problemas de algoritmos",
    "Revisar PRs do time",
    "Documentar API interna",
    "Migrar testes pra Vitest",
  ], i),
  completed: rand(i + 93) > 0.15,
})));

put("hiperfoco-thoughts", [
  { id: "th1", text: "Ideia: criar um agregador de PRs do time pra ver gargalos", date: dStr(addDays(TODAY, -2)), tag: "ideia" },
  { id: "th2", text: "Devemos migrar do REST pro GraphQL no módulo de feed?", date: dStr(addDays(TODAY, -5)), tag: "decisao" },
  { id: "th3", text: "Estudar Tailwind v4 quando sair do beta", date: dStr(addDays(TODAY, -7)), tag: "estudo" },
  { id: "th4", text: "Conversar com tech lead sobre senior promotion em julho", date: dStr(addDays(TODAY, -10)), tag: "carreira" },
  { id: "th5", text: "Melhorar setup do home office — cadeira é prioridade", date: dStr(addDays(TODAY, -14)), tag: "vida" },
  { id: "th6", text: "Anki pra vocabulário técnico em inglês", date: dStr(addDays(TODAY, -18)), tag: "estudo" },
  { id: "th7", text: "Bloquear redes sociais das 9-12 e 14-18", date: dStr(addDays(TODAY, -22)), tag: "produtividade" },
  { id: "th8", text: "Fazer side project: SaaS de habit tracking", date: dStr(addDays(TODAY, -28)), tag: "ideia" },
]);

put("goals-board-v2", [
  { id: "g1", title: "Promoção a Senior", category: "carreira", progress: 65, deadline: "2026-09-30", subtasks: [{ id: "s1", text: "Liderar 1 projeto crítico", done: true }, { id: "s2", text: "Mentorar 2 juniors", done: true }, { id: "s3", text: "Apresentar tech talk interno", done: false }, { id: "s4", text: "Conversar com tech lead", done: false }] },
  { id: "g2", title: "Correr 10k em < 50min", category: "saude", progress: 75, deadline: "2026-08-15", subtasks: [{ id: "s5", text: "Treino base 4 semanas", done: true }, { id: "s6", text: "Run 5k em 24min", done: true }, { id: "s7", text: "Run 8k em 40min", done: true }, { id: "s8", text: "Run 10k abaixo de 50min", done: false }] },
  { id: "g3", title: "Reserva de R$ 50k", category: "financas", progress: 73, deadline: "2026-12-31", subtasks: [{ id: "s9", text: "Aporte mensal R$ 2.300", done: true }, { id: "s10", text: "Migrar pra CDB 110%", done: true }] },
  { id: "g4", title: "Fluência em inglês — C1", category: "educacao", progress: 62, deadline: "2026-12-31", subtasks: [{ id: "s11", text: "100h Cambly", done: false }, { id: "s12", text: "Ler 3 livros em inglês", done: true }] },
  { id: "g5", title: "Lançar side project", category: "projeto", progress: 30, deadline: "2026-11-01", subtasks: [{ id: "s13", text: "Validar ideia", done: true }, { id: "s14", text: "MVP", done: false }, { id: "s15", text: "Landing page", done: false }] },
  { id: "g6", title: "Viajar pra Europa com Ana", category: "viagem", progress: 55, deadline: "2026-09-15", subtasks: [{ id: "s16", text: "Comprar passagens", done: true }, { id: "s17", text: "Reservar hotéis", done: false }, { id: "s18", text: "Roteiro Lisboa", done: true }] },
]);
put("goals-home", [{ id: "gh1", title: "Promoção a Senior", progress: 65 }, { id: "gh2", title: "Reserva R$ 50k", progress: 73 }, { id: "gh3", title: "Run 10k <50min", progress: 75 }]);

// ============================================================================
// CASA
// ============================================================================
put("casa_tasks", [
  { id: "ct1", title: "Limpar quarto", frequency: "semanal", lastDone: dStr(addDays(TODAY, -5)) },
  { id: "ct2", title: "Lavar roupa", frequency: "semanal", lastDone: dStr(addDays(TODAY, -3)) },
  { id: "ct3", title: "Limpar banheiro", frequency: "semanal", lastDone: dStr(addDays(TODAY, -6)) },
  { id: "ct4", title: "Trocar lençol", frequency: "quinzenal", lastDone: dStr(addDays(TODAY, -10)) },
  { id: "ct5", title: "Aspirar sala", frequency: "semanal", lastDone: dStr(addDays(TODAY, -2)) },
  { id: "ct6", title: "Pagar condomínio", frequency: "mensal", lastDone: dStr(addDays(TODAY, -27)) },
  { id: "ct7", title: "Levar lixo reciclável", frequency: "semanal", lastDone: dStr(addDays(TODAY, -4)) },
  { id: "ct8", title: "Manutenção ar-condicionado", frequency: "trimestral", lastDone: dStr(addDays(TODAY, -45)) },
  { id: "ct9", title: "Regar plantas", frequency: "semanal", lastDone: dStr(addDays(TODAY, -1)) },
  { id: "ct10", title: "Limpar fogão e forno", frequency: "quinzenal", lastDone: dStr(addDays(TODAY, -8)) },
]);

put("casa-recipes", [
  { id: "r1", emoji: "🍝", name: "Lasanha de frango", ingredients: ["Massa de lasanha", "Peito de frango desfiado", "Molho branco", "Queijo mussarela", "Tomate"], time: 60 },
  { id: "r2", emoji: "🍗", name: "Frango grelhado com legumes", ingredients: ["Peito de frango", "Brócolis", "Cenoura", "Azeite", "Alho"], time: 30 },
  { id: "r3", emoji: "🥗", name: "Salada Caesar", ingredients: ["Alface americana", "Frango", "Croutons", "Parmesão", "Molho caesar"], time: 15 },
  { id: "r4", emoji: "🍣", name: "Salmão ao forno", ingredients: ["Salmão", "Limão", "Alecrim", "Batata"], time: 35 },
  { id: "r5", emoji: "🍳", name: "Omelete proteica", ingredients: ["3 ovos", "Claras", "Espinafre", "Queijo branco"], time: 10 },
  { id: "r6", emoji: "🥩", name: "Strogonoff light", ingredients: ["Filé mignon", "Cogumelo", "Iogurte natural", "Cebola"], time: 30 },
  { id: "r7", emoji: "🍲", name: "Sopa de legumes", ingredients: ["Abóbora", "Cenoura", "Mandioquinha", "Frango desfiado"], time: 40 },
  { id: "r8", emoji: "🌯", name: "Wrap de frango", ingredients: ["Tortilha integral", "Frango", "Alface", "Tomate", "Iogurte"], time: 15 },
]);

put("casa-meal-plan", {
  Segunda: { almoco: "r2", janta: "r5" },
  Terça: { almoco: "r6", janta: "r3" },
  Quarta: { almoco: "r4", janta: "r7" },
  Quinta: { almoco: "r2", janta: "r8" },
  Sexta: { almoco: "r1", janta: "r3" },
  Sábado: { almoco: "r4", janta: "r6" },
  Domingo: { almoco: "r1", janta: "r5" },
});

put("casa-cleaning-reminders", [
  { id: "cr1", task: "Limpeza geral", frequency: 7, lastDone: dStr(addDays(TODAY, -3)) },
  { id: "cr2", task: "Limpar geladeira", frequency: 30, lastDone: dStr(addDays(TODAY, -12)) },
  { id: "cr3", task: "Trocar filtro do ar", frequency: 90, lastDone: dStr(addDays(TODAY, -45)) },
]);

// ============================================================================
// BIBLIOTECA
// ============================================================================
const books = [
  { id: "bk1", title: "Hábitos Atômicos", author: "James Clear", status: "lido", rating: 5, finishedAt: dStr(addDays(TODAY, -85)) },
  { id: "bk2", title: "Deep Work", author: "Cal Newport", status: "lido", rating: 5, finishedAt: dStr(addDays(TODAY, -50)) },
  { id: "bk3", title: "O Poder do Hábito", author: "Charles Duhigg", status: "lido", rating: 4, finishedAt: dStr(addDays(TODAY, -120)) },
  { id: "bk4", title: "Pense em Sistemas", author: "Donella Meadows", status: "lido", rating: 5, finishedAt: dStr(addDays(TODAY, -200)) },
  { id: "bk5", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", status: "lendo", progress: 62 },
  { id: "bk6", title: "Almanaque do Naval Ravikant", author: "Eric Jorgenson", status: "lendo", progress: 28 },
  { id: "bk7", title: "Mindset", author: "Carol Dweck", status: "wishlist" },
  { id: "bk8", title: "Antifrágil", author: "Nassim Taleb", status: "wishlist" },
  { id: "bk9", title: "Range", author: "David Epstein", status: "wishlist" },
  { id: "bk10", title: "Show Your Work", author: "Austin Kleon", status: "wishlist" },
  { id: "bk11", title: "Continuous Discovery Habits", author: "Teresa Torres", status: "wishlist" },
  { id: "bk12", title: "Staff Engineer", author: "Will Larson", status: "wishlist" },
];
put("biblioteca_books", books);
put("lib-books", books);

// ============================================================================
// BELEZA / SKINCARE
// ============================================================================
put("beleza_skincare", [
  { id: "sk1", step: "Limpeza facial", time: "manha", done: true, product: "Effaclar Concentrado" },
  { id: "sk2", step: "Tônico hidratante", time: "manha", done: true, product: "Hydraporin La Roche" },
  { id: "sk3", step: "Hidratante", time: "manha", done: true, product: "Effaclar Mat" },
  { id: "sk4", step: "Protetor solar FPS 60", time: "manha", done: true, product: "Anthelios Airlicium" },
  { id: "sk5", step: "Limpeza noturna", time: "noite", done: true, product: "Effaclar Concentrado" },
  { id: "sk6", step: "Sérum antioxidante", time: "noite", done: true, product: "Vitamina C 10%" },
  { id: "sk7", step: "Hidratante noturno", time: "noite", done: true, product: "Cicaplast Baume" },
]);

put("skincare-daily-checkin", Object.fromEntries(days90.slice(-60).map((d, i) => [d, {
  manha: rand(i + 101) > 0.1,
  noite: rand(i + 103) > 0.15,
}])));

// ============================================================================
// CARREIRA
// ============================================================================
put("carreira_metas", [
  { id: "cm1", title: "Promoção a Senior", quarter: "Q3 2026", progress: 65 },
  { id: "cm2", title: "Mentorar 2 desenvolvedores juniors", quarter: "Q2 2026", progress: 80 },
  { id: "cm3", title: "Contribuir em open source (5 PRs aceitos)", quarter: "Q3 2026", progress: 40 },
  { id: "cm4", title: "Palestrar em meetup local", quarter: "Q4 2026", progress: 20 },
  { id: "cm5", title: "Networking — 30 cafés com pessoas novas", quarter: "Q4 2026", progress: 35 },
]);

// ============================================================================
// RELACIONAMENTOS
// ============================================================================
put("rel-people", [
  { id: "p1", name: "Ana (esposa)", relation: "Esposa", birthday: dStr(addDays(TODAY, 22)), notes: "Adora viagens e culinária italiana" },
  { id: "p2", name: "Maria (mãe)", relation: "Mãe", birthday: "1965-08-14", notes: "Liga toda quarta de noite" },
  { id: "p3", name: "Carlos (pai)", relation: "Pai", birthday: "1962-03-22", notes: "Apaixonado por futebol" },
  { id: "p4", name: "João (irmão)", relation: "Irmão", birthday: "1992-11-05", notes: "Mora em BH, vem em julho" },
  { id: "p5", name: "Pedro (melhor amigo)", relation: "Amigo", birthday: "1993-05-18", notes: "Companheiro de academia" },
  { id: "p6", name: "Rafa (amiga faculdade)", relation: "Amigo", birthday: "1994-09-30", notes: "Cafés mensais" },
  { id: "p7", name: "Bruno (tech lead)", relation: "Trabalho", notes: "1:1 toda quinta" },
  { id: "p8", name: "Camila (cunhada)", relation: "Família", birthday: "1996-02-12" },
]);

put("relacionamentos_contacts", [
  { id: "rc1", name: "Ana (esposa)", frequency: "diaria", lastContact: dStr(TODAY) },
  { id: "rc2", name: "Maria (mãe)", frequency: "semanal", lastContact: dStr(addDays(TODAY, -3)) },
  { id: "rc3", name: "Carlos (pai)", frequency: "semanal", lastContact: dStr(addDays(TODAY, -5)) },
  { id: "rc4", name: "João (irmão)", frequency: "semanal", lastContact: dStr(addDays(TODAY, -6)) },
  { id: "rc5", name: "Pedro", frequency: "semanal", lastContact: dStr(addDays(TODAY, -2)) },
  { id: "rc6", name: "Rafa", frequency: "mensal", lastContact: dStr(addDays(TODAY, -18)) },
]);

// ============================================================================
// PET
// ============================================================================
put("pet_data", { name: "Thor", species: "cachorro", breed: "Golden Retriever", age: 3 });
put("pet-list", [
  { id: "pet-thor", name: "Thor", species: "Cachorro", breed: "Golden Retriever", birthday: "2023-01-15", weight: 32 },
]);
const petKeys = days90.slice(-7).map((d) => `pet-routine-${d}`);
for (const pk of petKeys) {
  put(pk, [
    { id: "pr1", task: "Ração manhã (350g)", time: "07:00", done: true },
    { id: "pr2", task: "Passeio matinal 30min", time: "07:30", done: true },
    { id: "pr3", task: "Ração noite (350g)", time: "19:00", done: true },
    { id: "pr4", task: "Passeio noturno 20min", time: "21:30", done: true },
    { id: "pr5", task: "Brincadeira / treino", time: "22:00", done: false },
  ]);
}
put("pet-routine-tasks-1775362152993", [
  { id: "prt1", task: "Banho", frequency: "semanal", lastDone: dStr(addDays(TODAY, -4)) },
  { id: "prt2", task: "Vermífugo", frequency: "trimestral", lastDone: dStr(addDays(TODAY, -65)) },
  { id: "prt3", task: "Vacina anual", frequency: "anual", lastDone: dStr(addDays(TODAY, -180)) },
]);

// ============================================================================
// VIAGENS
// ============================================================================
put("viagens_planejadas", [
  { id: "tr1", destination: "Lisboa, Portugal", date: dStr(addDays(TODAY, 68)), endDate: dStr(addDays(TODAY, 78)), budget: 12000, status: "planejada" },
  { id: "tr2", destination: "Florianópolis", date: dStr(addDays(TODAY, 134)), endDate: dStr(addDays(TODAY, 140)), budget: 4500, status: "ideia" },
  { id: "tr3", destination: "Buenos Aires", date: dStr(addDays(TODAY, 220)), endDate: dStr(addDays(TODAY, 226)), budget: 6000, status: "ideia" },
]);

put("travel-budget-v2", {
  id: "tb-lisboa",
  destination: "Lisboa, Portugal",
  startDate: dStr(addDays(TODAY, 68)),
  endDate: dStr(addDays(TODAY, 78)),
  categories: {
    passagens: [
      { id: "p1", description: "Voo GRU → LIS (TAP)", estimated: 3800, actual: 3650 },
      { id: "p2", description: "Voo LIS → GRU", estimated: 0, actual: 0 },
    ],
    hotel: [
      { id: "h1", description: "Hotel Avenida Liberdade — 9 noites", estimated: 3200, actual: 3100 },
    ],
    alimentacao: [
      { id: "a1", description: "Restaurantes (~€60/dia)", estimated: 1700, actual: 0 },
      { id: "a2", description: "Supermercado", estimated: 200, actual: 0 },
    ],
    transporte: [
      { id: "t1", description: "Metrô + Ubers", estimated: 280, actual: 0 },
      { id: "t2", description: "Trem para Sintra", estimated: 80, actual: 0 },
    ],
    passeios: [
      { id: "ps1", description: "Tour Sintra + Cabo da Roca", estimated: 320, actual: 0 },
      { id: "ps2", description: "Tour Porto (2 dias)", estimated: 980, actual: 0 },
      { id: "ps3", description: "Castelo de São Jorge", estimated: 80, actual: 0 },
    ],
    compras: [
      { id: "co1", description: "Lembranças e roupas", estimated: 800, actual: 0 },
    ],
  },
  places: [
    { id: "pl1", name: "Pastéis de Belém", category: "comida", status: "quero_ir", mapsLink: "" },
    { id: "pl2", name: "Time Out Market", category: "comida", status: "quero_ir" },
    { id: "pl3", name: "Mosteiro dos Jerónimos", category: "passeio", status: "quero_ir" },
    { id: "pl4", name: "Sintra — Palácio da Pena", category: "passeio", status: "quero_ir" },
    { id: "pl5", name: "Mirador da Senhora do Monte", category: "passeio", status: "quero_ir" },
    { id: "pl6", name: "Cervejaria Ramiro", category: "comida", status: "quero_ir" },
  ],
});

put("travel-timeline-v2", range(7).map((i) => ({
  id: `tl-${i}`,
  tripId: "tb-lisboa",
  date: dStr(addDays(TODAY, 68 + i)),
  dayNumber: i + 1,
  items: [
    pick([
      { time: "09:00", title: "Café da manhã no hotel" },
      { time: "08:30", title: "Bondinho 28E" },
      { time: "10:00", title: "Walking tour centro" },
    ], i),
    pick([
      { time: "12:30", title: "Almoço — Time Out Market" },
      { time: "13:00", title: "Pastéis de Belém" },
      { time: "12:00", title: "Restaurante típico Alfama" },
    ], i),
    pick([
      { time: "15:00", title: "Mosteiro dos Jerónimos" },
      { time: "14:30", title: "Sintra — Palácio da Pena" },
      { time: "16:00", title: "Castelo de São Jorge" },
    ], i),
    { time: "20:00", title: "Jantar e fado em Alfama" },
  ],
})));

// ============================================================================
// DESENVOLVIMENTO PESSOAL
// ============================================================================
put("dp-life-goals", [
  { id: "lg1", text: "Comprar apartamento próprio até 2028", deadline: "2028-06-30", done: false },
  { id: "lg2", text: "Tornar-se referência técnica na empresa", deadline: "2027-12-31", done: false },
  { id: "lg3", text: "Visitar 5 países diferentes", deadline: "2027-12-31", done: false },
  { id: "lg4", text: "Ter um filho", deadline: "2028-12-31", done: false },
  { id: "lg5", text: "Aprender a tocar violão", deadline: "2026-12-31", done: false },
  { id: "lg6", text: "Correr uma maratona completa", deadline: "2027-06-30", done: false },
]);

put("dp-wheel", { saude: 8, financas: 8, carreira: 7, relacionamentos: 9, lazer: 7, intelectual: 8, espiritualidade: 6, emocional: 8 });

put("dp-weekly-scores", Object.fromEntries(range(13).map((i) => {
  const week = `2026-W${String(5 + i).padStart(2, "0")}`;
  return [week, {
    saude: 6 + Math.floor(rand(i + 111) * 4),
    financas: 7 + Math.floor(rand(i + 113) * 3),
    carreira: 6 + Math.floor(rand(i + 117) * 4),
    relacionamentos: 7 + Math.floor(rand(i + 119) * 3),
    lazer: 5 + Math.floor(rand(i + 121) * 4),
    intelectual: 6 + Math.floor(rand(i + 123) * 4),
    espiritualidade: 5 + Math.floor(rand(i + 127) * 3),
    emocional: 6 + Math.floor(rand(i + 131) * 4),
  }];
})));

put("dp-mood-log", Object.fromEntries(days90.slice(-30).map((d, i) => [d, pick(moods, i)])));

// ============================================================================
// DETOX
// ============================================================================
put("detox-habits", [
  { id: "dh1", name: "Sem celular na primeira hora do dia", emoji: "📵", streak: 18 },
  { id: "dh2", name: "Sem rede social até 12h", emoji: "🚫", streak: 12 },
  { id: "dh3", name: "Sem celular 1h antes de dormir", emoji: "🌙", streak: 7 },
  { id: "dh4", name: "Domingo offline", emoji: "🧘", streak: 3 },
]);

put("detox_log", days90.slice(-60).map((d, i) => ({
  date: d,
  screenTime: 180 + Math.floor((rand(i + 141) - 0.5) * 90),
  socialTime: 45 + Math.floor((rand(i + 143) - 0.5) * 30),
  pickups: 50 + Math.floor((rand(i + 147) - 0.5) * 20),
  habitsCompleted: Math.floor(rand(i + 151) * 4) + 1,
})));

put("detox-diary", [
  { id: "dd1", date: dStr(addDays(TODAY, -2)), text: "Domingo offline foi libertador. Li 80 páginas e cozinhei com Ana." },
  { id: "dd2", date: dStr(addDays(TODAY, -8)), text: "Reduzi tempo de Instagram pra 20min/dia. Sinto menos ansioso." },
  { id: "dd3", date: dStr(addDays(TODAY, -15)), text: "Bloqueio de notificações no Slack pós 19h mudou meu jantar." },
  { id: "dd4", date: dStr(addDays(TODAY, -22)), text: "Voltei a usar despertador analógico. Acordo melhor." },
  { id: "dd5", date: dStr(addDays(TODAY, -30)), text: "Caminhada sem fones. Notei coisas que nunca tinha visto no bairro." },
]);

// ============================================================================
// END — dedupe (last write wins) + print payload
// ============================================================================
const seen = new Map<string, any>();
for (const e of entries) seen.set(e.key, e.value);
const finalEntries = Array.from(seen.entries()).map(([key, value]) => ({ key, value }));
console.log(JSON.stringify(finalEntries, null, 0));
console.error(`Generated ${entries.length} entries.`);
