import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { getMonthTotals } from "@/components/finance/storage-keys";
import { computeDailyBudget } from "@/lib/finance-totals";
import { trackEvent } from "@/lib/analytics";

/**
 * "Pergunte ao CORE" — parece assistente, é determinístico: perguntas prontas,
 * respostas montadas de template com os números REAIS (mesma fonte única do
 * Dashboard/Saúde). Zero custo por mensagem, zero chance de alucinar sobre o
 * dinheiro dos outros. O "digitando…" é teatro — 600ms de suspense.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", restaurante: "Restaurante", mercado: "Mercado",
  transporte: "Transporte", combustivel: "Combustível", lazer: "Lazer",
  saude: "Saúde", farmacia: "Farmácia", vestuario: "Vestuário",
  educacao: "Educação", eletronicos: "Eletrônicos", delivery: "Delivery",
  presente: "Presentes", pets: "Pets", moradia: "Moradia", casa: "Casa",
  contas_casa: "Contas da Casa", plano_saude: "Plano de Saúde",
  assinaturas: "Assinaturas", internet_telefone: "Internet/Telefone",
  academia: "Academia", beleza: "Beleza", servicos: "Serviços", outros: "Outros",
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const fmt2 = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface AskCtx {
  totalIncome: number;
  monthlyOutflow: number;
  savingsRate: number;
  monthlyInstallments: number;
  totalInvestments: number;
  totalDebts: number;
  expenses: any[];
  fixedExpenses: any[];
  dueDays: any[];
  goals: any[];
  investments: any[];
}

interface Question {
  key: string;
  emoji: string;
  label: string;
  answer: (ctx: AskCtx, extra: { budgets: Record<string, number>; streak: number; userId: string | null }) => string;
}

const spentByCategory = (ctx: AskCtx): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const e of [...ctx.expenses, ...ctx.fixedExpenses]) {
    const cat = e.category || "outros";
    out[cat] = (out[cat] || 0) + (e.value || 0);
  }
  return out;
};

const QUESTIONS: Question[] = [
  {
    key: "hoje",
    emoji: "💸",
    label: "Quanto posso gastar hoje?",
    answer: (ctx) => {
      const b = computeDailyBudget(ctx.totalIncome, ctx.monthlyOutflow, ctx.dueDays, ctx.fixedExpenses);
      if (ctx.totalIncome <= 0) return "Ainda não vi nenhuma receita este mês — registra sua renda na aba Meu Financeiro que eu te digo na hora.";
      if (b.cantSpend) {
        return `Hoje o ideal é segurar. Seu saldo do mês (${fmt(b.currentBalance)}) já está comprometido com ${fmt(b.unpaidBillsEstimate)} de contas a vencer.\n\nQualquer gasto agora sai do que deveria sobrar.`;
      }
      return `Você pode gastar até ${fmt(b.perDay)} hoje sem apertar o resto do mês.\n\nA conta: sobram ${fmt(b.availableReal)} livres (já reservei ${fmt(b.unpaidBillsEstimate)} pras contas a vencer) ÷ ${b.remainingDays} dias restantes.`;
    },
  },
  {
    key: "limites",
    emoji: "🎯",
    label: "Como estão meus limites?",
    answer: (ctx, { budgets }) => {
      const entries = Object.entries(budgets).filter(([, v]) => v > 0);
      if (entries.length === 0) {
        return "Você ainda não definiu limites por categoria. Cria na aba LIMITES — aí eu te aviso quando algum estiver perto de estourar.";
      }
      const spent = spentByCategory(ctx);
      const ranked = entries
        .map(([cat, limit]) => ({ cat, limit, used: spent[cat] || 0, pct: ((spent[cat] || 0) / limit) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 4);
      const lines = ranked.map((r) => {
        const label = CATEGORY_LABELS[r.cat] || r.cat;
        const icon = r.pct >= 100 ? "🔴" : r.pct >= 80 ? "🟡" : "🟢";
        return `${icon} ${label}: ${fmt(r.used)} de ${fmt(r.limit)} (${Math.round(r.pct)}%)`;
      });
      const worst = ranked[0];
      const tail = worst.pct >= 100
        ? `\n\n${CATEGORY_LABELS[worst.cat] || worst.cat} estourou — bora segurar aí até o mês virar.`
        : worst.pct >= 80
        ? `\n\nFica de olho em ${CATEGORY_LABELS[worst.cat] || worst.cat}: sobra só ${fmt(worst.limit - worst.used)}.`
        : "\n\nTudo sob controle por enquanto. 👊";
      return lines.join("\n") + tail;
    },
  },
  {
    key: "fortes",
    emoji: "💪",
    label: "Quais meus pontos fortes?",
    answer: (ctx, { streak }) => {
      const pts: string[] = [];
      if (ctx.savingsRate >= 20) pts.push(`✅ Taxa de poupança de ${ctx.savingsRate.toFixed(0)}% — acima da meta saudável (20%)`);
      else if (ctx.savingsRate > 0) pts.push(`✅ Mês no azul: ${fmt(ctx.totalIncome - ctx.monthlyOutflow)} sobrando`);
      const types = new Set(ctx.investments.map((i: any) => i.type)).size;
      if (types >= 3) pts.push(`✅ Carteira diversificada: ${types} tipos de investimento`);
      else if (ctx.totalInvestments > 0) pts.push(`✅ ${fmt(ctx.totalInvestments)} investidos e crescendo`);
      if (streak >= 7) pts.push(`✅ ${streak} dias seguidos cuidando do dinheiro`);
      const allBills = ctx.dueDays.flatMap((d: any) => d.bills || []);
      const paid = allBills.filter((b: any) => b.paid).length;
      if (allBills.length > 0 && paid / allBills.length >= 0.7) pts.push(`✅ Contas em dia: ${paid} de ${allBills.length} pagas`);
      if (ctx.totalDebts === 0) pts.push("✅ Zero parcelas pendentes — sem dívida te esperando");
      if (pts.length === 0) {
        return "Sendo honesto: ainda é cedo pra apontar pontos fortes — registra mais uns dias de movimento que eu te devolvo um raio-X de verdade.\n\nO que já vale celebrar: você está AQUI, olhando pros números. A maioria não olha.";
      }
      return `Olha o que você está mandando bem:\n\n${pts.slice(0, 4).join("\n")}`;
    },
  },
  {
    key: "fracos",
    emoji: "⚠️",
    label: "Onde tô vacilando?",
    answer: (ctx, { budgets }) => {
      const pts: string[] = [];
      if (ctx.savingsRate < 0) pts.push(`⚠️ O mês está no vermelho: ${fmt(Math.abs(ctx.totalIncome - ctx.monthlyOutflow))} a mais saindo do que entrando`);
      else if (ctx.savingsRate < 10) pts.push(`⚠️ Poupança em ${ctx.savingsRate.toFixed(0)}% — abaixo dos 20% saudáveis`);
      const spent = spentByCategory(ctx);
      const busted = Object.entries(budgets)
        .filter(([cat, limit]) => limit > 0 && (spent[cat] || 0) / limit >= 0.85)
        .sort((a, b) => (spent[b[0]] || 0) / b[1] - (spent[a[0]] || 0) / a[1])[0];
      if (busted) {
        const pct = Math.round(((spent[busted[0]] || 0) / busted[1]) * 100);
        pts.push(`⚠️ ${CATEGORY_LABELS[busted[0]] || busted[0]} em ${pct}% do limite`);
      }
      const today = new Date().getDate();
      const overdue = ctx.dueDays.flatMap((d: any) =>
        (d.bills || []).filter((b: any) => !b.paid && d.day < today).map((b: any) => b.name));
      if (overdue.length > 0) pts.push(overdue.length > 1
        ? `⚠️ ${overdue.length} contas já venceram sem pagar: ${overdue.slice(0, 2).join(", ")}`
        : `⚠️ 1 conta já venceu sem pagar: ${overdue[0]}`);
      if (ctx.totalIncome > 0 && ctx.monthlyInstallments / ctx.totalIncome > 0.15) {
        pts.push(`⚠️ Parcelas comendo ${Math.round((ctx.monthlyInstallments / ctx.totalIncome) * 100)}% da renda`);
      }
      if (pts.length === 0) {
        return "Procurei vacilo e... não achei nada gritante. 👏\n\nPoupança ok, limites sob controle, contas em dia. Segue o jogo.";
      }
      return `Sem rodeio — é aqui que dá pra melhorar:\n\n${pts.slice(0, 3).join("\n")}\n\nUm de cada vez. Escolhe o primeiro e ataca essa semana.`;
    },
  },
  {
    key: "conta",
    emoji: "📅",
    label: "Qual a próxima conta a vencer?",
    answer: (ctx) => {
      const today = new Date().getDate();
      const unpaid = ctx.dueDays
        .flatMap((d: any) => (d.bills || []).filter((b: any) => !b.paid).map((b: any) => ({ ...b, day: d.day })))
        .sort((a: any, b: any) => {
          const aFuture = a.day >= today ? 0 : 1;
          const bFuture = b.day >= today ? 0 : 1;
          return aFuture - bFuture || a.day - b.day;
        });
      if (unpaid.length === 0) return "Nenhuma conta em aberto — tudo pago. 👏\n\nIsso é mais raro do que parece.";
      const next = unpaid[0];
      const dist = next.day >= today ? (next.day === today ? "vence HOJE" : `vence dia ${next.day} (em ${next.day - today} dia${next.day - today > 1 ? "s" : ""})`) : `venceu dia ${next.day} — paga essa primeiro`;
      const rest = unpaid.slice(1, 3).map((b: any) => `· ${b.name}${b.value ? ` (${fmt(b.value)})` : ""} — dia ${b.day}`);
      return `📌 ${next.name}${next.value ? ` — ${fmt(next.value)}` : ""}, ${dist}.${rest.length ? `\n\nDepois vêm:\n${rest.join("\n")}` : ""}`;
    },
  },
  {
    key: "umano",
    emoji: "🔮",
    label: "Quanto junto em 1 ano nesse ritmo?",
    answer: (ctx) => {
      const balance = ctx.totalIncome - ctx.monthlyOutflow;
      if (ctx.totalIncome <= 0) return "Preciso ver sua renda primeiro — registra na aba Meu Financeiro e volta aqui.";
      if (balance <= 0) {
        return `Nesse ritmo, nada — o mês fecha ${fmt(Math.abs(balance))} no vermelho.\n\nMas olha: cortando isso pra zero e guardando só 10% da renda (${fmt(ctx.totalIncome * 0.1)}/mês), em 1 ano são ${fmt(ctx.totalIncome * 0.1 * 12)}. Dá pra chegar lá.`;
      }
      const yearly = balance * 12;
      const withCurrent = yearly + ctx.totalInvestments;
      return `Sobrando ${fmt(balance)}/mês como agora:\n\n📈 Em 12 meses: ${fmt(yearly)} guardados\n💰 Somando o que você já tem investido: ~${fmt(withCurrent)}\n\nE isso SEM contar rendimento — aplicado, é mais.`;
    },
  },
  {
    key: "vsmes",
    emoji: "📊",
    label: "Tô melhor que mês passado?",
    answer: (ctx, { userId }) => {
      const prevMonth = MONTHS[(new Date().getMonth() + 11) % 12];
      const prev = getMonthTotals(prevMonth, userId);
      const prevOutflow = prev.custosFixos + prev.custosVariaveis;
      if (prevOutflow <= 0 && prev.receitas <= 0) {
        return `Ainda não tenho ${prevMonth} registrado pra comparar. A partir do mês que vem essa resposta fica boa.`;
      }
      const today = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const paceOutflow = (ctx.monthlyOutflow / today) * daysInMonth;
      const better = paceOutflow < prevOutflow;
      return `${prevMonth}: ${fmt(prevOutflow)} de gastos.\nEste mês até agora: ${fmt(ctx.monthlyOutflow)} — no ritmo atual, fecha em ~${fmt(paceOutflow)}.\n\n${better ? "✅ Sim! Nesse passo você gasta MENOS que mês passado." : `⚠️ No ritmo atual, passa ${fmt(paceOutflow - prevOutflow)} do mês anterior. Dá tempo de frear.`}`;
    },
  },
];

/* ----------------------------------------------------------------- chat */

interface Msg {
  role: "user" | "core";
  text: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: AskCtx;
}

export const AskCore = ({ open, onOpenChange, ctx }: Props) => {
  const { user } = useAuth();
  const { get } = useUserData();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      trackEvent("ask_core_open", {});
      setMessages([{ role: "core", text: "Oi! 👋 Eu leio os seus números na hora. Pergunta aí embaixo:" }]);
      setAsked([]);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const budgets = useMemo(() => get<Record<string, number>>("finance-category-budgets", {}), [get]);
  const streak = get<number>("finance-streak", 0);

  const ask = (q: Question) => {
    if (typing) return;
    trackEvent("ask_core_question", { q: q.key });
    setAsked((a) => [...a, q.key]);
    setMessages((m) => [...m, { role: "user", text: q.label }]);
    setTyping(true);
    const answer = q.answer(ctx, { budgets, streak, userId: user?.id ?? null });
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "core", text: answer }]);
    }, 650);
  };

  const remaining = QUESTIONS.filter((q) => !asked.includes(q.key));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[85dvh] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-accent/10 text-accent">
              <Sparkles className="w-4 h-4" />
            </span>
            Pergunte ao CORE
          </SheetTitle>
          <p className="text-xs text-muted-foreground !mt-1">Respostas na hora, direto dos seus números.</p>
        </SheetHeader>

        {/* mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* perguntas prontas */}
        <div className="shrink-0 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {remaining.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {remaining.map((q) => (
                <button
                  key={q.key}
                  onClick={() => ask(q)}
                  disabled={typing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[12px] font-semibold hover:border-accent/50 active:scale-95 transition-all disabled:opacity-50"
                >
                  <span>{q.emoji}</span> {q.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-1">
              Por hoje é isso — os números mudam, as respostas também. Volta amanhã. ✨
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
