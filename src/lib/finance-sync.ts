/**
 * Fase 2 do feedback da Aline (11/07): "as coisas estarem mais integradas".
 *
 * Custo fixo com `day` preenchido VIRA conta do mês em `finance-dueDays`
 * automaticamente — com checkbox de pago, valor real (melhora a estimativa
 * de "a vencer") e alertas inteligentes de vencimento, sem cadastro duplo.
 *
 * Regras:
 *  - o vínculo é o `fixedId` na conta (bill) gerada;
 *  - se já existe conta manual com o MESMO nome, ela é ADOTADA (ganha o
 *    fixedId e move pro dia do fixo) em vez de duplicar — cobre quem
 *    cadastrava "Aluguel" nos dois lugares;
 *  - fixo removido → conta vinculada some; dia/nome/valor mudou → conta
 *    acompanha (estado de "pago" é preservado);
 *  - retorna null quando nada mudou (guarda contra loop de render).
 */

interface Bill {
  id: string;
  name: string;
  paid: boolean;
  value?: number;
  fixedId?: string;
}

interface DueDay {
  day: number;
  color: string;
  bills: Bill[];
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function syncFixedExpensesToBills(fixedExpenses: any[], dueDays: DueDay[]): DueDay[] | null {
  let changed = false;
  const days: DueDay[] = (dueDays ?? []).map((d) => ({ ...d, bills: [...(d.bills ?? [])] }));
  const dayFor = (n: number): DueDay => {
    let d = days.find((x) => x.day === n);
    if (!d) { d = { day: n, color: "slate", bills: [] }; days.push(d); changed = true; }
    return d;
  };

  const withDay = (fixedExpenses ?? []).filter((f) => f?.day >= 1 && f.day <= 31);
  const liveIds = new Set(withDay.map((f) => f.id));

  // fixo sumiu → conta vinculada sai junto
  for (const d of days) {
    const before = d.bills.length;
    d.bills = d.bills.filter((b) => !b.fixedId || liveIds.has(b.fixedId));
    if (d.bills.length !== before) changed = true;
  }

  for (const f of withDay) {
    let holder: DueDay | undefined;
    let bill: Bill | undefined;
    for (const d of days) {
      const b = d.bills.find((x) => x.fixedId === f.id);
      if (b) { holder = d; bill = b; break; }
    }
    if (!bill) {
      // adota conta manual homônima em vez de duplicar
      for (const d of days) {
        const b = d.bills.find((x) => !x.fixedId && norm(x.name) === norm(f.description));
        if (b) { holder = d; bill = b; b.fixedId = f.id; changed = true; break; }
      }
    }
    if (!bill) {
      dayFor(f.day).bills.push({ id: `fx-${f.id}`, name: f.description, paid: false, value: f.value, fixedId: f.id });
      changed = true;
      continue;
    }
    if (holder && holder.day !== f.day) {
      holder.bills = holder.bills.filter((b) => b !== bill);
      dayFor(f.day).bills.push(bill);
      changed = true;
    }
    if (bill.name !== f.description) { bill.name = f.description; changed = true; }
    if (typeof f.value === "number" && bill.value !== f.value) { bill.value = f.value; changed = true; }
  }

  if (!changed) return null;
  return days.sort((a, b) => a.day - b.day);
}
