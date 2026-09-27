import { parseLocalDay } from "@/lib/utils";
import { numeroBR } from "@/lib/data-normalizers";

/* Contas e formatos da Casa (26/09, varredura) — puros, pra teste. */

const DIA_SO = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-09-26" → Date à meia-noite LOCAL. `new Date("2026-09-26")` é UTC e no
 *  Brasil vira 25/09 21h: o "✅ Feito" de hoje aparecia como "Último: 25/09".
 *  Data com hora (ISO completo) continua sendo um instante e passa direto. */
export const diaLocal = (s: string): Date | null => {
  if (!s) return null;
  const d = DIA_SO.test(s) ? parseLocalDay(s) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Data curta pt-BR ("26/09/2026") de uma chave de dia; vazio se não der. */
export const dataBR = (s: string) => diaLocal(s)?.toLocaleDateString("pt-BR") ?? "";

/** Dias de garantia que faltam. `null` = sem data de compra (não dá pra saber —
 *  antes aparecia "Expirada" em vermelho pra quem só não preencheu a data). */
export const diasDeGarantia = (compra: string, meses: number, hoje: Date = new Date()): number | null => {
  const inicio = diaLocal(compra);
  if (!inicio) return null;
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + (Number(meses) || 0));
  const zero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((fim.getTime() - zero.getTime()) / 86_400_000));
};

/** Número do WhatsApp com DDI: só dígitos; "+55…" ou 55 + DDD + número (12–13
 *  dígitos) já vêm prontos — antes "+55 11…" virava wa.me/5555… Número que
 *  começa com "+" é internacional e fica como está. Sem número → null. */
export const numeroWhatsApp = (telefone: string): string | null => {
  const bruto = String(telefone ?? "").trim();
  const d = bruto.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length < 8) return null;
  if (bruto.startsWith("+")) return d;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  return `55${d}`;
};

/** Monta o link na hora do clique (ver HomeUtilities: sem <a href="wa.me"> no DOM). */
export const linkWhatsApp = (telefone: string): string | null => {
  const n = numeroWhatsApp(telefone);
  return n ? `https://wa.me/${n}` : null;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-09" → "set/2026" (antes aparecia a chave crua). */
export const mesCurtoBR = (mes: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes ?? ""));
  if (!m) return String(mes ?? "");
  const i = Number(m[2]) - 1;
  return i >= 0 && i < 12 ? `${MESES[i]}/${m[1]}` : String(mes);
};

/** R$ 150,50 (antes "R$ 150.50"). */
export const brl = (v: unknown) => {
  const n = numeroBR(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

/** Nome de cada conta de consumo com acento (antes "Agua", "Gas" pelo capitalize). */
export const ROTULO_CONSUMO: Record<string, string> = { luz: "Luz", agua: "Água", gas: "Gás", internet: "Internet" };
