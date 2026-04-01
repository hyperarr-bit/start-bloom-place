import { useState, useEffect, useCallback } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight, Copy, Sparkles, CalendarCheck, Trophy, Flame, Target, CheckCircle, FileText, Receipt, CreditCard, StickyNote, DollarSign } from "lucide-react";
import { getMonthTotals, getFinanceStorageKeys, getCurrentMonthName, BASE_FINANCE_KEYS, getPrefixedKeys } from "@/components/finance/storage-keys";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface MonthTurnoverProps {
  onOpenMonth?: (month: string) => void;
}

export const MonthTurnover = ({ onOpenMonth }: MonthTurnoverProps) => {
  const { get, set: setData, loaded } = useUserData();
  const [lastSeenMonth, setLastSeenMonth] = usePersistedState<string>("finance-last-seen-month", "");
  const [showRecap, setShowRecap] = useState(false);
  const [step, setStep] = useState<"recap" | "copy" | "badges">("recap");
  const [copyFixed, setCopyFixed] = useState(true);
  const [copyBills, setCopyBills] = useState(true);
  const [copyIncomes, setCopyIncomes] = useState(false);
  const [copyInstallments, setCopyInstallments] = useState(true);
  const [copyNotes, setCopyNotes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(false);

  const currentMonth = getCurrentMonthName();
  const currentMonthIdx = months.indexOf(currentMonth);
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const prevMonth = months[prevMonthIdx];

  // Getter that uses useUserData
  const dataGetter = useCallback((key: string, fallback: any) => get(key, fallback), [get]);

  // Archive: move base keys → prefixed keys for the previous month
  const archivePreviousMonth = useCallback(() => {
    const prefixed = getPrefixedKeys(prevMonth);
    const baseKeys = BASE_FINANCE_KEYS;

    // Copy each base key to the prefixed key for the previous month
    const keyPairs: [string, string][] = [
      [baseKeys.incomes, prefixed.incomes],
      [baseKeys.expenses, prefixed.expenses],
      [baseKeys.fixed, prefixed.fixed],
      [baseKeys.dueDays, prefixed.dueDays],
      [baseKeys.notes, prefixed.notes],
      [baseKeys.installments, prefixed.installments],
    ];

    keyPairs.forEach(([fromKey, toKey]) => {
      const data = get(fromKey, null);
      if (data !== null && data !== undefined) {
        // Only archive if the prefixed key doesn't already have data
        const existing = get(toKey, null);
        if (existing === null || existing === undefined || (Array.isArray(existing) && existing.length === 0)) {
          setData(toKey, data);
        }
      }
    });

    // Clear base keys for the new month
    Object.values(baseKeys).forEach((key) => {
      setData(key, []);
    });

    setArchived(true);
  }, [prevMonth, get, setData]);

  // Check if base keys have data (= previous month's data before archiving)
  const baseHasData = useCallback(() => {
    const incomes = get(BASE_FINANCE_KEYS.incomes, []);
    const expenses = get(BASE_FINANCE_KEYS.expenses, []);
    const fixed = get(BASE_FINANCE_KEYS.fixed, []);
    return (
      (Array.isArray(incomes) && incomes.length > 0) ||
      (Array.isArray(expenses) && expenses.length > 0) ||
      (Array.isArray(fixed) && fixed.length > 0)
    );
  }, [get]);

  // Read prev month totals (after archiving, read from prefixed keys)
  const prevData = getMonthTotals(prevMonth, dataGetter);
  const prevHasData = prevData.receitas + prevData.custosFixos + prevData.custosVariaveis > 0;

  const prevFixedCount = (() => {
    const keys = getFinanceStorageKeys(prevMonth);
    const raw = get(keys.fixed, []);
    return Array.isArray(raw) ? raw.length : 0;
  })();

  const prevIncomesCount = (() => {
    const keys = getFinanceStorageKeys(prevMonth);
    const raw = get(keys.incomes, []);
    return Array.isArray(raw) ? raw.length : 0;
  })();

  const prevInstallmentsCount = (() => {
    const keys = getFinanceStorageKeys(prevMonth);
    const raw = get(keys.installments, []);
    return Array.isArray(raw) ? raw.length : 0;
  })();

  const prevNotesCount = (() => {
    const keys = getFinanceStorageKeys(prevMonth);
    const raw = get(keys.notes, []);
    return Array.isArray(raw) ? raw.length : 0;
  })();

  const totalExpenses = prevData.custosFixos + prevData.custosVariaveis;
  const prevBalance = prevData.receitas - totalExpenses - prevData.dividas;

  const prevBillsInfo = (() => {
    const keys = getFinanceStorageKeys(prevMonth);
    const days = get(keys.dueDays, []);
    if (!Array.isArray(days) || days.length === 0) return { total: 0, paid: 0 };
    const allBills = days.flatMap((d: any) => d.bills || []);
    return { total: allBills.length, paid: allBills.filter((b: any) => b.paid).length };
  })();

  const savingsRate = prevData.receitas > 0
    ? ((prevData.receitas - totalExpenses) / prevData.receitas) * 100
    : 0;

  // Badge check using getter
  const badges = (() => {
    const result: { icon: string; label: string; description: string }[] = [];
    if (prevData.receitas > 0 || prevData.custosFixos > 0 || prevData.custosVariaveis > 0) {
      result.push({ icon: "📄", label: "Mês Fechado", description: `Registros completos em ${prevMonth}` });
    }
    const prevIdx = months.indexOf(prevMonth);
    let consecutivePositive = 0;
    for (let i = 0; i < 3; i++) {
      const idx = prevIdx - i < 0 ? prevIdx - i + 12 : prevIdx - i;
      const data = getMonthTotals(months[idx], dataGetter);
      const bal = data.receitas - data.custosFixos - data.custosVariaveis;
      if (bal > 0 && (data.receitas > 0 || data.custosFixos > 0)) {
        consecutivePositive++;
      } else break;
    }
    if (consecutivePositive >= 3) {
      result.push({ icon: "🔥", label: "3 Meses Seguidos", description: "3 meses consecutivos no positivo!" });
    }
    let consecutiveData = 0;
    for (let i = 0; i < 3; i++) {
      const idx = prevIdx - i < 0 ? prevIdx - i + 12 : prevIdx - i;
      const data = getMonthTotals(months[idx], dataGetter);
      if (data.receitas > 0 || data.custosFixos > 0 || data.custosVariaveis > 0) {
        consecutiveData++;
      } else break;
    }
    if (consecutiveData >= 3) {
      result.push({ icon: "⭐", label: "Constância", description: "Registrou dados 3 meses seguidos" });
    }
    return result;
  })();

  // Month turnover detection
  useEffect(() => {
    if (!loaded) return;

    const currentKey = `${currentMonth}-${new Date().getFullYear()}`;

    // If lastSeenMonth is empty, this is the first visit ever — just record and don't show modal
    if (!lastSeenMonth) {
      setLastSeenMonth(currentKey);
      return;
    }

    // If already seen this month, nothing to do
    if (lastSeenMonth === currentKey) return;

    // Month changed! Check if there's data to archive from base keys
    const hasBaseData = baseHasData();

    if (hasBaseData) {
      // Archive base keys → previous month prefixed keys
      archivePreviousMonth();
    }

    // Update last seen month
    setLastSeenMonth(currentKey);

    // Show recap if previous month has data (either already in prefixed keys or just archived)
    // We use a small delay to let the archive writes propagate
    setTimeout(() => {
      setShowRecap(true);
    }, 100);
  }, [loaded, lastSeenMonth]);

  // copyToMonth using useUserData
  const copyToMonth = useCallback((fromMonth: string, toMonth: string, options: { fixed: boolean; bills: boolean; incomes: boolean; installments: boolean; notes: boolean }) => {
    const fromKeys = getFinanceStorageKeys(fromMonth);
    const toKeys = getFinanceStorageKeys(toMonth);

    if (options.fixed) {
      const fixed = get(fromKeys.fixed, []);
      if (Array.isArray(fixed) && fixed.length > 0) {
        const items = fixed.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random() }));
        setData(toKeys.fixed, items);
      }
    }

    if (options.bills) {
      const dueDays = get(fromKeys.dueDays, []);
      if (Array.isArray(dueDays) && dueDays.length > 0) {
        const days = dueDays.map((d: any) => ({
          ...d,
          bills: (d.bills || []).map((b: any) => ({ ...b, id: Date.now().toString() + Math.random(), paid: false })),
        }));
        setData(toKeys.dueDays, days);
      }
    }

    if (options.incomes) {
      const incomes = get(fromKeys.incomes, []);
      if (Array.isArray(incomes) && incomes.length > 0) {
        const items = incomes.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random() }));
        setData(toKeys.incomes, items);
      }
    }

    if (options.installments) {
      const installments = get(fromKeys.installments, []);
      if (Array.isArray(installments) && installments.length > 0) {
        const items = installments.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random() }));
        setData(toKeys.installments, items);
      }
    }

    if (options.notes) {
      const notes = get(fromKeys.notes, []);
      if (Array.isArray(notes) && notes.length > 0) {
        const items = notes.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random() }));
        setData(toKeys.notes, items);
      }
    }
  }, [get, setData]);

  const getMessage = () => {
    if (prevBalance > 0 && savingsRate >= 30) {
      return {
        emoji: "🏆",
        text: `Parabéns! Você economizou ${savingsRate.toFixed(0)}% da renda em ${prevMonth}. Continue assim!`,
        tone: "great" as const,
      };
    }
    if (prevBalance > 0) {
      return {
        emoji: "✅",
        text: `Bom trabalho! Você fechou ${prevMonth} no positivo. Vamos manter o ritmo em ${currentMonth}!`,
        tone: "good" as const,
      };
    }
    if (prevBalance === 0) {
      return {
        emoji: "⚖️",
        text: `${prevMonth} ficou no zero a zero. Que tal traçar uma meta de economia para ${currentMonth}?`,
        tone: "neutral" as const,
      };
    }
    return {
      emoji: "💪",
      text: `Seus gastos superaram a renda em ${prevMonth}. Que tal revisar os custos variáveis? Estamos juntos! 🤝`,
      tone: "tough" as const,
    };
  };

  const message = getMessage();

  const handleCopy = () => {
    copyToMonth(prevMonth, currentMonth, { fixed: copyFixed, bills: copyBills, incomes: copyIncomes, installments: copyInstallments, notes: copyNotes });
    setCopied(true);
    setTimeout(() => {
      if (badges.length > 0) {
        setStep("badges");
        setCopied(false);
      } else {
        setShowRecap(false);
        setStep("recap");
        setCopied(false);
      }
    }, 1200);
  };

  const handleClose = () => {
    setShowRecap(false);
    setStep("recap");
  };

  const triggerRecap = () => {
    setStep("recap");
    setShowRecap(true);
  };

  const toneIcons = {
    great: <Trophy className="w-8 h-8 text-accent" />,
    good: <CheckCircle className="w-8 h-8 text-card-receitas-text" />,
    neutral: <Target className="w-8 h-8 text-primary" />,
    tough: <Flame className="w-8 h-8 text-card-dividas-text" />,
  };

  return (
    <>
      {/* Banner clicável */}
      {prevHasData && (
        <button
          onClick={triggerRecap}
          className="w-full bg-card rounded-xl border border-border p-3.5 flex items-center gap-3 hover:bg-muted/50 transition-all text-left group"
        >
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <CalendarCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Resumo de {prevMonth}</p>
            <p className="text-xs text-muted-foreground truncate">
              Toque para ver como foi seu mês
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {prevBalance >= 0
              ? <span className="text-xs font-bold text-card-receitas-text">+R$ {prevBalance.toLocaleString("pt-BR")}</span>
              : <span className="text-xs font-bold text-card-dividas-text">-R$ {Math.abs(prevBalance).toLocaleString("pt-BR")}</span>
            }
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </button>
      )}

      <Dialog open={showRecap} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-md w-[92vw] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Resumo do mês</DialogTitle>
          <AnimatePresence mode="wait">
            {/* STEP 1: RECAP */}
            {step === "recap" && (
              <motion.div
                key="recap"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 space-y-4"
              >
                {/* Header */}
                <div className="text-center space-y-2 rounded-xl p-4 -mx-1 bg-muted/50 border border-border">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  >
                    {toneIcons[message.tone]}
                  </motion.div>
                  <h2 className="text-lg font-bold">{prevMonth} acabou!</h2>
                  <p className="text-xs text-muted-foreground">Aqui está seu resumo financeiro</p>
                </div>

                {/* Cards de receita e despesa */}
                <div className="grid grid-cols-2 gap-2">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl p-3 bg-card-receitas border border-card-receitas-border"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3 h-3 text-card-receitas-text" />
                      <span className="text-xs text-card-receitas-text font-medium">Receitas</span>
                    </div>
                    <p className="text-sm font-bold text-card-receitas-text">
                      R$ {prevData.receitas.toLocaleString("pt-BR")}
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 }}
                    className="rounded-xl p-3 bg-card-despesas border border-card-despesas-border"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown className="w-3 h-3 text-card-despesas-text" />
                      <span className="text-xs text-card-despesas-text font-medium">Despesas</span>
                    </div>
                    <p className="text-sm font-bold text-card-despesas-text">
                      R$ {totalExpenses.toLocaleString("pt-BR")}
                    </p>
                  </motion.div>
                </div>

                {/* Saldo */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`rounded-xl p-4 text-center border ${
                    prevBalance >= 0 ? "bg-card-investimentos border-card-investimentos-border" : "bg-card-dividas border-card-dividas-border"
                  }`}
                >
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Saldo</span>
                  <p className={`text-2xl font-bold mt-1 ${prevBalance >= 0 ? "text-card-investimentos-text" : "text-card-dividas-text"}`}>
                    {prevBalance >= 0 ? "+" : "-"}R$ {Math.abs(prevBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </motion.div>

                {/* Stats extras */}
                <div className="grid grid-cols-2 gap-2">
                  {prevBillsInfo.total > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <div>
                        <span className="text-xs text-muted-foreground block">Contas pagas</span>
                        <span className="text-xs font-bold">
                          {prevBillsInfo.paid}/{prevBillsInfo.total} ({Math.round((prevBillsInfo.paid / prevBillsInfo.total) * 100)}%)
                        </span>
                      </div>
                    </div>
                  )}
                  {savingsRate > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <Flame className="w-3.5 h-3.5 text-accent" />
                      <div>
                        <span className="text-xs text-muted-foreground block">Economia</span>
                        <span className="text-xs font-bold">{savingsRate.toFixed(0)}% da renda</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mensagem motivacional */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-xl p-3 bg-muted/50 border border-border"
                >
                  <p className="text-xs text-center leading-relaxed">{message.text}</p>
                </motion.div>

                {/* Ações */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-10 rounded-xl"
                    onClick={() => {
                      handleClose();
                      onOpenMonth?.(prevMonth);
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ver detalhes
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs gap-1.5 h-10 rounded-xl"
                    onClick={() => setStep("copy")}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Começar {currentMonth}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: COPY WIZARD */}
            {step === "copy" && (
              <motion.div
                key="copy"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 space-y-4"
              >
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ y: -10 }}
                    animate={{ y: 0 }}
                  >
                    <Copy className="w-8 h-8 text-primary mx-auto" />
                  </motion.div>
                  <h2 className="text-lg font-bold">Preparar {currentMonth}</h2>
                  <p className="text-xs text-muted-foreground">
                    Quer copiar seus custos fixos de {prevMonth} para {currentMonth}?
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyFixed} onCheckedChange={(v) => setCopyFixed(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5 text-muted-foreground" /> Copiar custos fixos</p>
                      <p className="text-xs text-muted-foreground">
                        Aluguel, contas, assinaturas ({prevFixedCount} itens)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyBills} onCheckedChange={(v) => setCopyBills(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5 text-muted-foreground" /> Copiar vencimentos</p>
                      <p className="text-xs text-muted-foreground">
                        Contas por dia de vencimento (marcadas como não pagas)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyIncomes} onCheckedChange={(v) => setCopyIncomes(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> Copiar receitas</p>
                      <p className="text-xs text-muted-foreground">
                        Salário, freelance, etc. — valores podem variar ({prevIncomesCount} itens)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyInstallments} onCheckedChange={(v) => setCopyInstallments(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" /> Copiar parcelas/dívidas</p>
                      <p className="text-xs text-muted-foreground">
                        Parcelas em andamento continuam no novo mês ({prevInstallmentsCount} itens)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyNotes} onCheckedChange={(v) => setCopyNotes(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5 text-muted-foreground" /> Copiar notas</p>
                      <p className="text-xs text-muted-foreground">
                        Anotações e lembretes financeiros ({prevNotesCount} itens)
                      </p>
                    </div>
                  </label>
                </div>

                {copied ? (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-center py-4"
                  >
                    <p className="text-sm font-bold text-success flex items-center justify-center gap-1.5"><CheckCircle className="w-4 h-4" /> Dados copiados com sucesso!</p>
                  </motion.div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-10 rounded-xl"
                      onClick={() => {
                        if (badges.length > 0) setStep("badges");
                        else handleClose();
                      }}
                    >
                      Pular
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1.5 h-10 rounded-xl"
                      onClick={handleCopy}
                      disabled={!copyFixed && !copyBills && !copyIncomes && !copyInstallments && !copyNotes}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Preparar {currentMonth}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: BADGES */}
            {step === "badges" && (
              <motion.div
                key="badges"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 space-y-5"
              >
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <Trophy className="w-8 h-8 text-accent mx-auto" />
                  </motion.div>
                  <h2 className="text-lg font-bold">Conquistas Desbloqueadas!</h2>
                  <p className="text-xs text-muted-foreground">Você ganhou novas badges</p>
                </div>

                <div className="space-y-2">
                  {badges.map((badge, i) => (
                    <motion.div
                      key={badge.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.15 }}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-accent/10 border border-accent/20"
                    >
                      <span className="text-2xl">{badge.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold">{badge.label}</p>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                      </div>
                      <Trophy className="w-4 h-4 text-accent" />
                    </motion.div>
                  ))}
                </div>

                <Button
                  size="sm"
                  className="w-full text-xs gap-1.5 h-10 rounded-xl"
                  onClick={handleClose}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Vamos lá, {currentMonth}! 🚀
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};
