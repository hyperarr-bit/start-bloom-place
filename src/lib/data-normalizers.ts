/**
 * Data normalizers per user_data key.
 *
 * Several modules accumulated mixed shapes across versions/seeds. Instead of
 * scattering defensive parsing throughout components, we normalize once on
 * read (via usePersistedState).
 *
 * Each normalizer must be PURE and SAFE: never throw, always return a value
 * compatible with the component's expected type.
 */

const isPlainObject = (v: any): v is Record<string, any> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const dateKeyRe = /^\d{4}-\d{2}-\d{2}$/;

const warn = (key: string, msg: string, extra?: any) => {
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[data-normalizer] ${key}: ${msg}`, extra ?? "");
  }
};

// ----------------------------- normalizers ---------------------------------

const normalizeGratitude = (v: any) => {
  if (!isPlainObject(v)) return {};
  const out: Record<string, string[]> = {};
  let dropped = 0;
  for (const [k, val] of Object.entries(v)) {
    if (!dateKeyRe.test(k)) {
      // legacy entries indexed by "0","1" → try to migrate via .date
      if (isPlainObject(val) && typeof val.date === "string" && dateKeyRe.test(val.date)) {
        const items = Array.isArray(val.items) ? val.items.map(String) : [];
        if (!out[val.date]) out[val.date] = items;
      } else {
        dropped++;
      }
      continue;
    }
    if (Array.isArray(val)) out[k] = val.map(String);
    else if (isPlainObject(val) && Array.isArray(val.items)) out[k] = val.items.map(String);
    else dropped++;
  }
  if (dropped) warn("dp-gratitude", `dropped ${dropped} malformed entries`);
  return out;
};

const normalizeMoodLog = (v: any) => {
  if (!isPlainObject(v)) return {};
  const out: Record<string, { value: number; emoji?: string; time?: string }> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!dateKeyRe.test(k)) continue;
    if (typeof val === "number") {
      out[k] = { value: val };
    } else if (isPlainObject(val)) {
      const value =
        typeof val.value === "number" ? val.value :
        typeof val.mood === "number" ? val.mood :
        typeof val.score === "number" ? val.score :
        Number(val.value);
      if (Number.isFinite(value)) {
        out[k] = {
          value,
          emoji: typeof val.emoji === "string" ? val.emoji : undefined,
          time: typeof val.time === "string" ? val.time : undefined,
        };
      }
    }
  }
  return out;
};

const dayCanon: Record<string, string> = {
  segunda: "Segunda", terca: "Terça", "terça": "Terça",
  quarta: "Quarta", quinta: "Quinta", sexta: "Sexta",
  sabado: "Sábado", "sábado": "Sábado", domingo: "Domingo",
};
const normalizeSaudeMeals = (v: any) => {
  if (!isPlainObject(v)) return {};
  const merged: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    const norm = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const canon = dayCanon[norm] ?? k;
    // Title-case version wins; if two map to same canon, prefer the one that
    // is already Title Case (heuristic: matches canon exactly).
    if (!merged[canon] || k === canon) merged[canon] = val;
  }
  return merged;
};

const normalizeDietaDiary = (v: any) => {
  // BUG 16/07 (relato real: "refeições somem ao reabrir"): a versão anterior
  // esperava meals como ARRAY, mas o Dieta.tsx grava meals como OBJETO
  // (Record por refeição) + extraFood. O normalizador substituía meals por []
  // e descartava extraFood — triturava o diário inteiro na LEITURA, e a
  // escrita seguinte persistia a versão mutilada. Agora: só filtra chaves de
  // data e entradas não-objeto; o formato interno passa intacto.
  if (!isPlainObject(v)) return {};
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!dateKeyRe.test(k)) continue;
    if (!isPlainObject(val)) continue;
    out[k] = val;
  }
  return out;
};

const normalizeStrategies = (v: any) => {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isPlainObject)
    .map((s: any) => ({
      id: typeof s.id === "string" ? s.id : crypto.randomUUID(),
      title: typeof s.title === "string" ? s.title : "",
      description: typeof s.description === "string" ? s.description : "",
      status: typeof s.status === "string" ? s.status : "planejando",
      actions: Array.isArray(s.actions) ? s.actions.filter(isPlainObject) : [],
    }));
};

const normalizeGoalsBoard = (v: any) => {
  if (!Array.isArray(v)) return [];
  return v.filter(isPlainObject).map((g: any) => ({
    ...g,
    id: typeof g.id === "string" ? g.id : crypto.randomUUID(),
    title: typeof g.title === "string" ? g.title : "",
    actionGroups: Array.isArray(g.actionGroups) ? g.actionGroups : [],
    problems: Array.isArray(g.problems) ? g.problems : [],
    referenceImages: Array.isArray(g.referenceImages) ? g.referenceImages : [],
    referenceLinks: Array.isArray(g.referenceLinks) ? g.referenceLinks : [],
    vision: isPlainObject(g.vision) ? g.vision : {},
  }));
};

const normalizeMonthlyBudgets = (v: any) => {
  if (!Array.isArray(v)) return v;
  return v.filter(isPlainObject).map((b: any) => ({
    month: typeof b.month === "string" ? b.month : "",
    value: Number.isFinite(Number(b.value)) ? Number(b.value) : 0,
    hasNote: Boolean(b.hasNote),
  }));
};

// ----------------------------- registry -----------------------------------

const NORMALIZERS: Record<string, (value: any) => any> = {
  "dp-gratitude": normalizeGratitude,
  "core-mood-log": normalizeMoodLog,
  "saude-meals": normalizeSaudeMeals,
  "dieta-diary-v2": normalizeDietaDiary,
  "hiperfoco-strategies": normalizeStrategies,
  "goals-board-v2": normalizeGoalsBoard,
  "finance-monthly-budgets": normalizeMonthlyBudgets,
};

export const normalizeForKey = <T,>(key: string, value: T): T => {
  const fn = NORMALIZERS[key];
  if (!fn) return value;
  try {
    return fn(value) as T;
  } catch (e) {
    warn(key, "normalizer threw — returning original value", e);
    return value;
  }
};
