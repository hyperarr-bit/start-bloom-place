/**
 * Detecção de vazamento no extrato (ramo opcional). Pura.
 * Regex na descrição normalizada: sem acento, minúscula.
 * Janela de 30 dias, só saídas. O resultado substitui a estimativa.
 */
import type { ParsedTx } from "@/lib/extrato-parser";
import { suggestCategory } from "@/lib/extrato-parser";
import { CHAVES, type Chave } from "./conteudo";
import { montarResumo, type ResumoRaiox } from "./estimativa";

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const REGRAS: { chave: Chave; re: RegExp }[] = [
  { chave: "delivery", re: /ifood|rappi|ze delivery|aiqfome|james delivery|uber eats|99food|delivery/ },
  { chave: "assinaturas", re: /netflix|spotify|disney|max\b|hbo|prime video|amazon prime|globoplay|youtube premium|apple\.com\/bill|icloud|deezer|crunchyroll|paramount|star\+|telecine|google one|chatgpt|openai|canva|duolingo/ },
  { chave: "transporte_app", re: /uber(?!\s*eats)|99 ?(app|pop|taxi)?\b|cabify|indriver/ },
  { chave: "compras_online", re: /shopee|shein|temu|mercado ?livre|mercadolivre|amazon(?!\s*prime)|aliexpress|magalu|americanas/ },
];

const FORMIGA_TEXTO = /padaria|cafe|lanche|acai|conveniencia/;
const FORMIGA_CAT = new Set(["alimentacao", "restaurante"]);

export type TxClassificada = ParsedTx & { chave: Chave | null; category: string };

export function classificarDescricao(description: string, amount: number): Chave | null {
  const n = normalizar(description);
  for (const regra of REGRAS) {
    if (regra.re.test(n)) return regra.chave;
  }
  const abs = Math.abs(amount);
  if (amount < 0 && abs < 20) {
    const cat = suggestCategory(description, {});
    if (FORMIGA_CAT.has(cat) || FORMIGA_TEXTO.test(n)) return "formiga";
  }
  return null;
}

const diaMs = (iso: string): number => {
  const t = Date.parse(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isFinite(t) ? t : NaN;
};

export function naJanela(date: string, agora: Date): boolean {
  const t = diaMs(date);
  if (!Number.isFinite(t)) return false;
  const fim = new Date(agora);
  fim.setHours(23, 59, 59, 999);
  const ini = new Date(fim);
  ini.setDate(ini.getDate() - 30);
  ini.setHours(0, 0, 0, 0);
  return t >= ini.getTime() && t <= fim.getTime();
}

/** Saídas dos últimos 30 dias, agrupadas. Descrições ficam no array `txs` (memória); o resumo não as carrega. */
export function detectarVazamentos(txs: ParsedTx[], agora = new Date()): { resumo: ResumoRaiox; txs: TxClassificada[] } {
  const classificadas: TxClassificada[] = [];
  const soma = new Map<Chave, number>();
  for (const chave of CHAVES) soma.set(chave, 0);
  for (const tx of txs) {
    if (!(tx.amount < 0)) continue;
    if (!naJanela(tx.date, agora)) continue;
    const chave = classificarDescricao(tx.description, tx.amount);
    const category = suggestCategory(tx.description, {});
    classificadas.push({ ...tx, chave, category });
    if (chave) soma.set(chave, (soma.get(chave) ?? 0) + Math.abs(tx.amount));
  }
  const itens = CHAVES.map((chave) => ({ chave, mes: Math.round(soma.get(chave) ?? 0), fonte: "extrato" as const }));
  return { resumo: montarResumo(itens, { fonte: "extrato" }), txs: classificadas.filter((t) => t.chave) };
}
