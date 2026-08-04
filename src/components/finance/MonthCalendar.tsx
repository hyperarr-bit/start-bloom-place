import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { computeMonthlyBalance, computeUnpaidBillsEstimate } from "@/lib/finance-totals";

/**
 * MEU MÊS — calendário financeiro que se preenche sozinho.
 *
 * Nasceu do feedback escrito da assinante de 11/07: "no lançamento das
 * despesas já deveria aparecer no calendário… as coisas estarem mais
 * integradas". Substitui os cards manuais de "Contas a Vencer"
 * (BillsDueCards) POR CIMA dos mesmos dados: continua lendo/escrevendo
 * `finance-dueDays` no shape DueDay{day,color,bills} — Dashboard, Saúde
 * Financeira, AskCore e billsPaidRate seguem funcionando sem mudança.
 *
 * O grid integra o que JÁ tem data no módulo:
 *  - despesas (`finance-expenses`, date YYYY-MM-DD) → ponto violeta no dia
 *  - rendas   (`finance-incomes`)                   → ponto âmbar no dia
 *  - contas   (`finance-dueDays`, day 1-31)         → ✓ paga / ⚠ aberta
 *  - parcela ativa (`finance-installments`)         → dia derivado do `date`
 * Gasto fixo não tem dia — fica fora do grid de propósito (sem chutar data).
 */

interface Bill {
  id: string;
  name: string;
  paid: boolean;
  value?: number;
}

interface DueDay {
  day: number;
  color: string;
  bills: Bill[];
}

interface Props {
  incomes: any[];
  expenses: any[];
  fixedExpenses: any[];
  dueDays: DueDay[];
  setDueDays: (days: DueDay[]) => void;
  installments: any[];
  totalIncome: number;
  monthlyOutflow: number;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    /* minimumFractionDigits EXPLÍCITO (04/08): com style currency, motor de
       WebView antigo assume mínimo 2 — e máximo 0 < mínimo 2 lança
       "RangeError: maximumFractionDigits value is out of range". Era O crash
       de "algo deu errado nesta seção" ao abrir a aba MEU FINANCEIRO no
       aparelho do dono (foto com o detalhe técnico aberto, 04/08). Motor
       novo tolera a omissão; o antigo não — os dois aceitam o explícito. */
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

/** Dia do mês (1-31) de uma data "YYYY-MM-DD", só se ela cair no mês corrente. */
const dayInCurrentMonth = (date: string | undefined, now: Date): number | null => {
  if (!date || date.length < 10) return null;
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!date.startsWith(ym)) return null;
  const d = Number(date.slice(8, 10));
  return d >= 1 && d <= 31 ? d : null;
};

export const MonthCalendar = ({
  incomes, expenses, fixedExpenses, dueDays, setDueDays, installments,
  totalIncome, monthlyOutflow,
}: Props) => {
  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay(); // 0=domingo
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long" });

  const [selectedDay, setSelectedDay] = useState<number>(today);
  const [newBill, setNewBill] = useState("");

  // mapa dia → itens (recalcula só quando os dados mudam)
  const byDay = useMemo(() => {
    const map: Record<number, { expenses: any[]; incomes: any[]; bills: Bill[]; installments: any[] }> = {};
    const get = (d: number) => (map[d] ??= { expenses: [], incomes: [], bills: [], installments: [] });
    for (const e of expenses) {
      const d = dayInCurrentMonth(e?.date, now);
      if (d) get(d).expenses.push(e);
    }
    for (const i of incomes) {
      // Renda é recorrente (salário): se a data for de outro mês, usa o DIA
      // dela — "Salário dia 5" aparece todo mês, não só no mês do cadastro.
      const d = dayInCurrentMonth(i?.date, now) ?? Number(String(i?.date ?? "").slice(8, 10));
      if (d >= 1) get(Math.min(d, daysInMonth)).incomes.push(i);
    }
    // Custo fixo com "dia" NÃO entra direto: o sync (finance-sync.ts) já o
    // transformou em conta do dia — com checkbox de pago e alertas.
    for (const dd of dueDays ?? []) {
      if (dd?.day >= 1 && dd.day <= 31 && Array.isArray(dd.bills) && dd.bills.length)
        get(Math.min(dd.day, daysInMonth)).bills.push(...dd.bills);
    }
    for (const p of installments ?? []) {
      // Parcela ativa: o dia vem do `date` da compra (melhor sinal disponível).
      if (p?.paidInstallments < p?.totalInstallments && p?.date) {
        const d = Number(String(p.date).slice(8, 10));
        if (d >= 1) get(Math.min(d, daysInMonth)).installments.push(p);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, incomes, fixedExpenses, dueDays, installments, daysInMonth]);

  const unpaidEstimate = computeUnpaidBillsEstimate(dueDays ?? [], fixedExpenses ?? []);
  const balance = computeMonthlyBalance(totalIncome, monthlyOutflow);

  // Mini-alerta do header: mesma lógica dos alertas inteligentes do Dashboard
  // (mesma fonte finance-dueDays) — atrasadas > próxima a vencer > tudo pago.
  const headerAlert = useMemo(() => {
    let overdue = 0;
    let next: { name: string; inDays: number } | null = null;
    let totalBills = 0;
    for (const d of dueDays ?? []) {
      const unpaid = (Array.isArray(d?.bills) ? d.bills : []).filter((b) => !b?.paid);
      totalBills += Array.isArray(d?.bills) ? d.bills.length : 0;
      if (!unpaid.length) continue;
      if (d.day < today) { overdue += unpaid.length; continue; }
      const inDays = d.day - today;
      if (!next || inDays < next.inDays) next = { name: unpaid[0].name, inDays };
    }
    if (overdue > 0) return { tone: "alert" as const, text: `⚠ ${overdue} conta${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""}` };
    if (next) return {
      tone: "warn" as const,
      text: next.inDays === 0 ? `${next.name} vence hoje` : next.inDays === 1 ? `${next.name} vence amanhã` : `${next.name} vence em ${next.inDays} dias`,
    };
    if (totalBills > 0) return { tone: "ok" as const, text: "✓ contas em dia" };
    return null;
  }, [dueDays, today]);

  // escreve no MESMO shape DueDay[] — cria o dia se ainda não existir
  const setBillsForDay = (day: number, mutate: (bills: Bill[]) => Bill[]) => {
    const exists = (dueDays ?? []).some((d) => d.day === day);
    const next = exists
      ? dueDays.map((d) => (d.day === day ? { ...d, bills: mutate(d.bills ?? []) } : d))
      : [...(dueDays ?? []), { day, color: "slate", bills: mutate([]) }];
    setDueDays(next.sort((a, b) => a.day - b.day));
  };

  const addBill = (day: number) => {
    const name = newBill.trim();
    if (!name) return;
    setBillsForDay(day, (bills) => [...bills, { id: Date.now().toString(), name, paid: false }]);
    setNewBill("");
  };
  const toggleBill = (day: number, billId: string) =>
    setBillsForDay(day, (bills) => bills.map((b) => (b.id === billId ? { ...b, paid: !b.paid } : b)));
  const removeBill = (day: number, billId: string) =>
    setBillsForDay(day, (bills) => bills.filter((b) => b.id !== billId));

  const sel = byDay[selectedDay] ?? { expenses: [], incomes: [], bills: [], installments: [] };
  const selSpent = sel.expenses.reduce((s, e) => s + (e.value || 0), 0);

  const cellStatus = (day: number) => {
    const d = byDay[day];
    if (!d?.bills?.length) return null;
    const unpaid = d.bills.some((b) => !b.paid);
    if (!unpaid) return "paid";
    return day < today ? "overdue" : "due";
  };

  return (
    <div
      data-spotlight="add-bill"
      className="rounded-2xl border border-sky-100 dark:border-sky-900/40 overflow-hidden animate-fade-in bg-gradient-to-b from-sky-50 via-white to-white dark:from-sky-950/60 dark:via-slate-950 dark:to-slate-950"
    >
      {/* céu do header: azul bebê + nuvens (chá revelação ☁️) */}
      <div className="relative overflow-hidden bg-gradient-to-r from-sky-300 via-sky-400 to-sky-300 dark:from-sky-900 dark:via-sky-800 dark:to-sky-900 py-3 px-4">
        {/* nuvens decorativas — blobs brancos borrados, baratos e sem imagem */}
        <div aria-hidden className="absolute -top-3 left-6 w-16 h-8 rounded-full bg-white/70 dark:bg-white/15 blur-[2px]" />
        <div aria-hidden className="absolute -top-1 left-12 w-10 h-6 rounded-full bg-white/60 dark:bg-white/10 blur-[3px]" />
        <div aria-hidden className="absolute -bottom-3 right-8 w-20 h-9 rounded-full bg-white/60 dark:bg-white/10 blur-[2px]" />
        <div aria-hidden className="absolute top-1 right-24 w-8 h-5 rounded-full bg-white/50 dark:bg-white/10 blur-[3px]" />
        <div className="relative flex items-center justify-between gap-2">
          <span
            className="font-bold text-sm tracking-widest text-white"
            style={{ WebkitTextStroke: "0.6px rgba(0,0,0,0.45)", textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
          >
            MEU MÊS — {monthLabel.toUpperCase()}
          </span>
          {headerAlert && (
            <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
              headerAlert.tone === "alert"
                ? "bg-rose-500/90 text-white"
                : headerAlert.tone === "warn"
                  ? "bg-white/90 text-amber-600"
                  : "bg-white/25 text-white"
            }`}>
              {headerAlert.text}
            </span>
          )}
        </div>
      </div>

      {/* resumo do mês — mesmos números do Dashboard (fonte única) */}
      <div className="flex flex-wrap gap-2 px-3 pt-3 text-[11px] font-semibold">
        <span className="px-2.5 py-1 rounded-full bg-white text-emerald-600 border border-sky-100 shadow-sm dark:bg-slate-900 dark:text-emerald-400 dark:border-sky-900/40">
          ↑ Entrou {brl(totalIncome)}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-white text-sky-700 border border-sky-100 shadow-sm dark:bg-slate-900 dark:text-sky-300 dark:border-sky-900/40">
          ↓ Saiu {brl(monthlyOutflow)}
        </span>
        {unpaidEstimate > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-white text-amber-600 border border-sky-100 shadow-sm dark:bg-slate-900 dark:text-amber-300 dark:border-sky-900/40">
            ⏳ A vencer {brl(unpaidEstimate)}
          </span>
        )}
        <span className={`px-2.5 py-1 rounded-full bg-white border border-sky-100 shadow-sm dark:bg-slate-900 dark:border-sky-900/40 ${balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          Saldo {brl(balance)}
        </span>
      </div>

      {/* grid do mês */}
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-sky-400 dark:text-sky-500">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const d = byDay[day];
            const status = cellStatus(day);
            const isToday = day === today;
            const isSel = day === selectedDay;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={[
                  "relative h-11 rounded-xl border text-[12px] font-semibold transition-colors shadow-sm",
                  status === "overdue"
                    ? "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50"
                    : status === "due"
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50"
                      : "bg-white border-sky-100 hover:bg-sky-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-sky-950/40",
                  isSel ? "border-sky-400 dark:border-sky-500" : "",
                  isToday ? "ring-2 ring-sky-400 ring-offset-1 ring-offset-white dark:ring-sky-500 dark:ring-offset-slate-950" : "",
                ].join(" ")}
                aria-label={`Dia ${day}`}
              >
                <span className={day < today && !isToday ? "text-muted-foreground" : "text-slate-700 dark:text-slate-200"}>{day}</span>
                {/* indicadores: conta (✓/⚠) + pontos de despesa/renda */}
                <span className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5">
                  {status === "paid" && <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" strokeWidth={4} />}
                  {(status === "due" || status === "overdue") && (
                    <span className={`text-[9px] font-black leading-none ${status === "overdue" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>!</span>
                  )}
                  {d?.expenses?.length ? <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> : null}
                  {d?.incomes?.length ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> : null}
                  {d?.installments?.length ? <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* detalhe do dia selecionado */}
        <div className="mt-3 rounded-xl border border-sky-100 bg-white/80 dark:bg-slate-900/60 dark:border-sky-900/40 p-3 shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-bold">
              Dia {selectedDay}{selectedDay === today ? " · hoje" : ""}
            </span>
            {selSpent > 0 && <span className="text-xs font-semibold text-card-despesas-text">−{brl(selSpent)}</span>}
          </div>

          <div className="space-y-1.5">
            {sel.incomes.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between text-[13px]">
                <span className="truncate">💵 {i.description}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">+{brl(i.value || 0)}</span>
              </div>
            ))}
            {sel.expenses.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate">{e.description}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {e.category && <span className="category-badge">{e.category}</span>}
                  <span className="font-semibold">−{brl(e.value || 0)}</span>
                </span>
              </div>
            ))}
            {sel.installments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-[13px]">
                <span className="truncate">💳 {p.description} ({p.paidInstallments + 1}/{p.totalInstallments})</span>
                <span className="font-semibold shrink-0">−{brl(p.installmentValue || 0)}</span>
              </div>
            ))}
            {sel.bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 text-[13px]">
                <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                  <Checkbox checked={b.paid} onCheckedChange={() => toggleBill(selectedDay, b.id)} />
                  <span className={`truncate ${b.paid ? "line-through text-muted-foreground" : ""}`}>
                    {b.name}{!b.paid && selectedDay < today ? " · venceu" : !b.paid && selectedDay === today ? " · vence hoje" : ""}
                  </span>
                  {b.fixedId && <span className="category-badge shrink-0">fixo</span>}
                </label>
                <span className="flex items-center gap-1.5 shrink-0">
                  {typeof b.value === "number" && b.value > 0 && (
                    <span className={`font-semibold ${b.paid ? "text-muted-foreground" : ""}`}>−{brl(b.value)}</span>
                  )}
                  {/* conta vinda de fixo se gerencia lá — só a manual tem X */}
                  {!b.fixedId && (
                    <button onClick={() => removeBill(selectedDay, b.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${b.name}`}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              </div>
            ))}
            {!sel.incomes.length && !sel.expenses.length && !sel.bills.length && !sel.installments.length && (
              <p className="text-xs text-muted-foreground">Nada neste dia ainda.</p>
            )}
          </div>

          {/* adicionar conta no dia — escreve finance-dueDays (dispara first_bill) */}
          <div className="flex gap-2 mt-3">
            <Input
              value={newBill}
              onChange={(e) => setNewBill(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addBill(selectedDay); }}
              placeholder={`Conta que vence dia ${selectedDay} (ex: luz)`}
              className="h-9 text-[13px] rounded-full border-sky-200 focus-visible:ring-sky-400 dark:border-sky-900/50"
            />
            <button
              onClick={() => addBill(selectedDay)}
              className="h-9 w-9 rounded-full bg-sky-500 text-white grid place-items-center shrink-0 hover:bg-sky-600 transition-colors shadow-sm"
              aria-label="Adicionar conta"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Despesas e rendas aparecem no dia sozinhas. Custo fixo com dia vira conta aqui automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
};
