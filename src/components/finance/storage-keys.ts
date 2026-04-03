// Shared finance storage key utilities
// Keys include the year to separate data across years.
// Current month uses base keys (backward-compatible).
// Other months use year-prefixed keys: finance-{year}-{monthkey}-{type}

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
 */
const MIGRATION_FLAG = "finance-keys-migrated-v2";

export const migrateOldKeys = () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const currentYear = getCurrentYear();
  const currentMonthIdx = new Date().getMonth();
  const suffixes = ["incomes", "expenses", "fixed", "dueDays", "notes", "installments"];

  // Find all old-format keys: finance-month-{monthkey}-{suffix}
  const oldKeyPattern = /^finance-month-([a-z]+)-(.+)$/;
  const keysToMigrate: { oldKey: string; newKey: string }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const match = key.match(oldKeyPattern);
    if (!match) continue;

    const monthKey = match[1];
    const suffix = match[2];

    // Find which month this corresponds to
    const monthIdx = monthNames.findIndex(m => getMonthKey(m) === monthKey);
    if (monthIdx === -1) continue;

    // Determine which year this data belongs to.
    // App launched in 2025. If month > current month index, it's likely from prev year.
    // e.g., we're in April 2026 (idx 3), Sep/Nov/Dec (idx 8,10,11) → 2025
    let year: number;
    if (monthIdx > currentMonthIdx) {
      year = currentYear - 1; // previous year
    } else {
      year = currentYear; // current year
    }

    const newKey = `finance-${year}-${monthKey}-${suffix}`;
    keysToMigrate.push({ oldKey: key, newKey });
  }

  // Perform migration
  for (const { oldKey, newKey } of keysToMigrate) {
    const value = localStorage.getItem(oldKey);
    if (value && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, value);
    }
    localStorage.removeItem(oldKey);
  }

  localStorage.setItem(MIGRATION_FLAG, "1");
};

// Run migration on load
migrateOldKeys();

/**
 * Returns the storage key prefix for a given month and year.
 * Current month of current year → uses base keys (backward-compatible)
 * Other months → uses year-prefixed keys: finance-{year}-{monthkey}-{type}
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
 * Read month totals from localStorage
 */
export const getMonthTotals = (month: string, year?: number) => {
  const keys = getFinanceStorageKeys(month, year);
  const parse = (k: string) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const incomes = parse(keys.incomes);
  const expenses = parse(keys.expenses);
  const fixed = parse(keys.fixed);
  const installments = parse(keys.installments);

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
