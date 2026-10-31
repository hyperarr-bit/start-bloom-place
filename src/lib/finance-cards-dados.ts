/**
 * As 11 bandeiras e as chaves dos cartões (31/10), sem React: ./finance-cards (o hook) re-exporta daqui, e o planner 2027
 * (./planner-2027-preenchido) lê as faturas sem puxar o store do app. Ver ./finance-cards pro porquê de cada coisa.
 */
export type FinanceCard = { value: string; label: string; color: string; custom?: boolean };

// As 11 bandeiras de sempre — values e cores IDÊNTICOS aos que estavam nos três
// arquivos, senão os dados já gravados perderiam a cor/rótulo.
export const DEFAULT_CARDS: FinanceCard[] = [
  { value: "nubank", label: "Nubank", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "inter", label: "Inter", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "itau", label: "Itaú", color: "bg-blue-600/15 text-blue-700 dark:text-blue-300" },
  { value: "bradesco", label: "Bradesco", color: "bg-red-600/15 text-red-700 dark:text-red-300" },
  { value: "santander", label: "Santander", color: "bg-red-500/15 text-red-600 dark:text-red-300" },
  { value: "c6", label: "C6 Bank", color: "bg-gray-800/15 text-gray-700 dark:text-gray-300" },
  { value: "bb", label: "Banco do Brasil", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  { value: "caixa", label: "Caixa", color: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  { value: "neon", label: "Neon", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { value: "picpay", label: "PicPay", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { value: "outro", label: "Outro", color: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
];

export const CUSTOM_CARDS_KEY = "finance-custom-cards";
/** Fechamento e vencimento por cartão (ver ./finance-cards). */
export const CARD_CONFIG_KEY = "finance-card-config";
