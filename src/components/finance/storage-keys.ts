// Shared finance storage key utilities
// The main financeiro tab stores data for the CURRENT month using base keys.
// Monthly sheets for other months use month-prefixed keys.
// This ensures current month data is always connected.

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const getCurrentMonthName = () => monthNames[new Date().getMonth()];

export const getMonthKey = (month: string) =>
  month.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const isCurrentMonth = (month: string) => month === getCurrentMonthName();

/**
 * Returns the storage key prefix for a given month.
 * Current month → uses base keys (same as main financeiro tab)
 * Other months → uses month-prefixed keys
 */
export const getFinanceStorageKeys = (month: string) => {
  if (isCurrentMonth(month)) {
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
    incomes: `finance-month-${key}-incomes`,
    expenses: `finance-month-${key}-expenses`,
    fixed: `finance-month-${key}-fixed`,
    dueDays: `finance-month-${key}-dueDays`,
    notes: `finance-month-${key}-notes`,
    installments: `finance-month-${key}-installments`,
  };
};

/**
 * Read month totals from localStorage for AnnualBudget
 */
export const getMonthTotals = (month: string) => {
  const keys = getFinanceStorageKeys(month);
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
