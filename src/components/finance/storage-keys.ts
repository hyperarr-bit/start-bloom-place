import { doPerfil, perfilAtivoLocal } from "@/lib/finance-perfil";
// Shared finance storage key utilities.
//
// IMPORTANT: All app data is stored in localStorage under a per-user prefix
// (`u:{userId}:{key}`) to prevent cross-account leakage on shared browsers.
// The helpers below accept a `userId` argument to build the right key.

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const getCurrentMonthName = () => monthNames[new Date().getMonth()];
export const getCurrentYear = () => new Date().getFullYear();

export const getMonthKey = (month: string) =>
  month.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const getMonthIndex = (month: string) => monthNames.indexOf(month);

export const isCurrentMonth = (month: string) => month === getCurrentMonthName();

/**
 * Migrate old format keys (finance-month-{monthkey}-*) to year-prefixed format.
 * Runs once per session. Old keys are removed after migration.
 *
 * NOTE: This migration only touches non-prefixed legacy keys. Per-user
 * namespaced keys (`u:...`) are written by the user-data hook and do not need
 * to be migrated here.
 */
const MIGRATION_FLAG = "finance-keys-migrated-v2";

export const migrateOldKeys = () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const currentYear = getCurrentYear();
  const currentMonthIdx = new Date().getMonth();

  const oldKeyPattern = /^finance-month-([a-z]+)-(.+)$/;
  const keysToMigrate: { oldKey: string; newKey: string }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const match = key.match(oldKeyPattern);
    if (!match) continue;

    const monthKey = match[1];
    const suffix = match[2];

    const monthIdx = monthNames.findIndex(m => getMonthKey(m) === monthKey);
    if (monthIdx === -1) continue;

    const year = monthIdx > currentMonthIdx ? currentYear - 1 : currentYear;
    const newKey = `finance-${year}-${monthKey}-${suffix}`;
    keysToMigrate.push({ oldKey: key, newKey });
  }

  for (const { oldKey, newKey } of keysToMigrate) {
    const value = localStorage.getItem(oldKey);
    if (value && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, value);
    }
    localStorage.removeItem(oldKey);
  }

  localStorage.setItem(MIGRATION_FLAG, "1");
};

migrateOldKeys();

/**
 * Returns the LOGICAL storage key prefix for a given month and year.
 * These are the keys used inside `useUserData` (Supabase) — they are NOT the
 * physical localStorage keys. To read from localStorage directly, wrap each
 * key with `userKeyOf(userId, key)`.
 */
export const getFinanceStorageKeys = (month: string, year?: number) => {
  const targetYear = year ?? getCurrentYear();
  const isNow = isCurrentMonth(month) && targetYear === getCurrentYear();

  if (isNow) {
    return {
      incomes: "finance-incomes",
      expenses: "finance-expenses",
      fixed: "finance-fixed-expenses",
      dueDays: "finance-dueDays",
      notes: "finance-notes",
      installments: "finance-installments",
    };
  }

  const key = getMonthKey(month);
  return {
    incomes: `finance-${targetYear}-${key}-incomes`,
    expenses: `finance-${targetYear}-${key}-expenses`,
    fixed: `finance-${targetYear}-${key}-fixed`,
    dueDays: `finance-${targetYear}-${key}-dueDays`,
    notes: `finance-${targetYear}-${key}-notes`,
    installments: `finance-${targetYear}-${key}-installments`,
  };
};

/**
 * Build the physical localStorage key for a given user + logical key.
 * Returns null when no user is provided (caller should treat as "no data").
 */
export const userKeyOf = (userId: string | null | undefined, logicalKey: string): string | null => {
  if (!userId) return null;
  return `u:${userId}:${logicalKey}`;
};

const readJsonForUser = (userId: string | null | undefined, logicalKey: string): any => {
  // Demo (/preview/:module): não há usuário e os dados moram num store em
  // memória exposto pelo PreviewUserDataProvider. Sem este fallback, os
  // leitores diretos de localStorage (gráficos do Dashboard, comparação de
  // meses, virada de mês) renderizam vazios na demo.
  if (!userId && typeof window !== "undefined" && (window as any).__PREVIEW_SEEDS__) {
    const v = (window as any).__PREVIEW_SEEDS__[logicalKey];
    return v === undefined ? null : v;
  }
  const k = userKeyOf(userId, logicalKey);
  if (!k) return null;
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const writeJsonForUser = (userId: string | null | undefined, logicalKey: string, value: any) => {
  const k = userKeyOf(userId, logicalKey);
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(value)); } catch {}
};

/**
 * Read month totals from localStorage for the given user.
 * Returns zeros when no user / no data.
 */
/**
 * 03/09: os totais seguem o PERFIL ATIVO (PF/PJ) por padrão — Dashboard,
 * comparação de meses, retrospectiva e Pergunte ao CORE somavam a empresa
 * junto com o pessoal. `perfil` explícito (ou PERFIL_TODOS) sobrepõe.
 * Leitores de cópia/arquivo (virada de mês) usam readMonthData, que segue cru.
 */
export const getMonthTotals = (month: string, userId: string | null | undefined, year?: number, perfil?: string) => {
  const keys = getFinanceStorageKeys(month, year);
  const p = perfil ?? perfilAtivoLocal(userId);

  const incomes = doPerfil(readJsonForUser(userId, keys.incomes) || [], p);
  const expenses = doPerfil(readJsonForUser(userId, keys.expenses) || [], p);
  const fixed = doPerfil(readJsonForUser(userId, keys.fixed) || [], p);
  const installments = doPerfil(readJsonForUser(userId, keys.installments) || [], p);

  return {
    receitas: incomes.reduce((s: number, i: any) => s + (i.value || 0), 0),
    custosFixos: fixed.reduce((s: number, e: any) => s + (e.value || 0), 0),
    custosVariaveis: expenses.reduce((s: number, e: any) => s + (e.value || 0), 0),
    dividas: installments.reduce(
      (s: number, i: any) => {
        const remaining = (i.totalInstallments || 0) - (i.paidInstallments || 0);
        return s + (remaining > 0 ? remaining * (i.installmentValue || 0) : 0);
      }, 0
    ),
  };
};

// Helpers re-exported for callers that need to read/write raw arrays.
export const readMonthData = (userId: string | null | undefined, logicalKey: string) =>
  readJsonForUser(userId, logicalKey);
export const writeMonthData = (userId: string | null | undefined, logicalKey: string, value: any) =>
  writeJsonForUser(userId, logicalKey, value);
