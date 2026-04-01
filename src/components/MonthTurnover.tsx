import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight, Copy, Sparkles, Calendar, Trophy, Flame, Target } from "lucide-react";
import { getMonthTotals, getFinanceStorageKeys, getCurrentMonthName } from "@/components/finance/storage-keys";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const copyToMonth = (fromMonth: string, toMonth: string, options: { fixed: boolean; bills: boolean }) => {
  const fromKeys = getFinanceStorageKeys(fromMonth);
  const toKeys = getFinanceStorageKeys(toMonth);

  if (options.fixed) {
    const fixed = localStorage.getItem(fromKeys.fixed);
    if (fixed) {
      const items = JSON.parse(fixed).map((i: any) => ({ ...i, id: Date.now().toString() + Math.random() }));
      localStorage.setItem(toKeys.fixed, JSON.stringify(items));
    }
  }

  if (options.bills) {
    const dueDays = localStorage.getItem(fromKeys.dueDays);
    if (dueDays) {
      const days = JSON.parse(dueDays).map((d: any) => ({
        ...d,
        bills: d.bills.map((b: any) => ({ ...b, id: Date.now().toString() + Math.random(), paid: false })),
      }));
      localStorage.setItem(toKeys.dueDays, JSON.stringify(days));
    }
  }
};

interface MonthTurnoverProps {
  onOpenMonth?: (month: string) => void;
}

// Badge definitions
const checkBadges = (prevMonth: string, prevBalance: number) => {
  const badges: { icon: string; label: string; description: string }[] = [];

  // "Mês Fechado" — has data for prev month
  const prevData = getMonthTotals(prevMonth);
  if (prevData.receitas > 0 || prevData.custosFixos > 0 || prevData.custosVariaveis > 0) {
    badges.push({ icon: "📄", label: "Mês Fechado", description: `Registros completos em ${prevMonth}` });
  }

  // "3 Meses Seguidos" — check 3 consecutive months with positive balance
  const prevIdx = months.indexOf(prevMonth);
  let consecutivePositive = 0;
  for (let i = 0; i < 3; i++) {
    const idx = prevIdx - i < 0 ? prevIdx - i + 12 : prevIdx - i;
    const data = getMonthTotals(months[idx]);
    const bal = data.receitas - data.custosFixos - data.custosVariaveis;
    if (bal > 0 && (data.receitas > 0 || data.custosFixos > 0)) {
      consecutivePositive++;
    } else break;
  }
  if (consecutivePositive >= 3) {
    badges.push({ icon: "🔥", label: "3 Meses Seguidos", description: "3 meses consecutivos no positivo!" });
  }

  // "Constância" — check last 3 months have data
  let consecutiveData = 0;
  for (let i = 0; i < 3; i++) {
    const idx = prevIdx - i < 0 ? prevIdx - i + 12 : prevIdx - i;
    const data = getMonthTotals(months[idx]);
    if (data.receitas > 0 || data.custosFixos > 0 || data.custosVariaveis > 0) {
      consecutiveData++;
    } else break;
  }
  if (consecutiveData >= 3) {
    badges.push({ icon: "⭐", label: "Constância", description: "Registrou dados 3 meses seguidos" });
  }

  return badges;
};

export const MonthTurnover = ({ onOpenMonth }: MonthTurnoverProps) => {
  const [lastSeenMonth, setLastSeenMonth] = usePersistedState<string>("finance-last-seen-month", "");
  const [showRecap, setShowRecap] = useState(false);
  const [step, setStep] = useState<"recap" | "copy" | "badges">("recap");
  const [copyFixed, setCopyFixed] = useState(true);
  const [copyBills, setCopyBills] = useState(true);
  const [copied, setCopied] = useState(false);

  const currentMonth = getCurrentMonthName();
  const currentMonthIdx = months.indexOf(currentMonth);
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const prevMonth = months[prevMonthIdx];

  const prevData = getMonthTotals(prevMonth);
  const prevHasData = prevData.receitas + prevData.custosFixos + prevData.custosVariaveis > 0;

  const prevFixedCount = (() => {
    try {
      const keys = getFinanceStorageKeys(prevMonth);
      const raw = localStorage.getItem(keys.fixed);
      return raw ? JSON.parse(raw).length : 0;
    } catch { return 0; }
  })();

  const totalExpenses = prevData.custosFixos + prevData.custosVariaveis;
  const prevBalance = prevData.receitas - totalExpenses - prevData.dividas;

  const prevBillsInfo = (() => {
    try {
      const keys = getFinanceStorageKeys(prevMonth);
      const raw = localStorage.getItem(keys.dueDays);
      if (!raw) return { total: 0, paid: 0 };
      const days = JSON.parse(raw);
      const allBills = days.flatMap((d: any) => d.bills || []);
      return { total: allBills.length, paid: allBills.filter((b: any) => b.paid).length };
    } catch { return { total: 0, paid: 0 }; }
  })();

  const savingsRate = prevData.receitas > 0
    ? ((prevData.receitas - totalExpenses) / prevData.receitas) * 100
    : 0;

  const badges = checkBadges(prevMonth, prevBalance);

  useEffect(() => {
    const currentKey = `${currentMonth}-${new Date().getFullYear()}`;
    if (lastSeenMonth && lastSeenMonth !== currentKey && prevHasData) {
      setShowRecap(true);
    }
    if (!lastSeenMonth || lastSeenMonth !== currentKey) {
      setLastSeenMonth(currentKey);
    }
  }, []);

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
    copyToMonth(prevMonth, currentMonth, { fixed: copyFixed, bills: copyBills });
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

  const toneColors = {
    great: "from-amber-400/20 to-yellow-500/10 border-amber-400/40",
    good: "from-emerald-400/20 to-green-500/10 border-emerald-400/40",
    neutral: "from-blue-400/20 to-sky-500/10 border-blue-400/40",
    tough: "from-orange-400/20 to-red-500/10 border-orange-400/40",
  };

  return (
    <>
      {/* Banner clicável */}
      {prevHasData && (
        <button
          onClick={triggerRecap}
          className="w-full bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 p-3.5 flex items-center gap-3 hover:from-primary/10 hover:to-primary/15 transition-all text-left group"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">📊 Resumo de {prevMonth}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              Toque para ver como foi seu mês e preparar {currentMonth}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {prevBalance >= 0
              ? <span className="text-[10px] font-bold text-emerald-500">+R$ {prevBalance.toLocaleString("pt-BR")}</span>
              : <span className="text-[10px] font-bold text-destructive">-R$ {Math.abs(prevBalance).toLocaleString("pt-BR")}</span>
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
                {/* Header celebratório */}
                <div className={`text-center space-y-2 rounded-xl p-4 -mx-1 bg-gradient-to-b ${toneColors[message.tone]} border`}>
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="text-5xl"
                  >
                    {message.emoji}
                  </motion.div>
                  <h2 className="text-lg font-bold">{prevMonth} acabou!</h2>
                  <p className="text-[11px] text-muted-foreground">Aqui está seu resumo 📊</p>
                </div>

                {/* Cards de receita e despesa */}
                <div className="grid grid-cols-2 gap-2">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Receitas</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      R$ {prevData.receitas.toLocaleString("pt-BR")}
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 }}
                    className="rounded-xl p-3 bg-red-500/10 border border-red-500/20"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">Despesas</span>
                    </div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
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
                    prevBalance >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
                  }`}
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saldo</span>
                  <p className={`text-2xl font-bold mt-1 ${prevBalance >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {prevBalance >= 0 ? "+" : "-"}R$ {Math.abs(prevBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </motion.div>

                {/* Stats extras */}
                <div className="grid grid-cols-2 gap-2">
                  {prevBillsInfo.total > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Contas pagas</span>
                        <span className="text-xs font-bold">
                          {prevBillsInfo.paid}/{prevBillsInfo.total} ({Math.round((prevBillsInfo.paid / prevBillsInfo.total) * 100)}%)
                        </span>
                      </div>
                    </div>
                  )}
                  {savingsRate > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Economia</span>
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
                  className={`rounded-xl p-3 bg-gradient-to-r ${toneColors[message.tone]} border`}
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
                    📄 Ver detalhes
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs gap-1.5 h-10 rounded-xl"
                    onClick={() => setStep("copy")}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Começar {currentMonth}! 🚀
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
                    className="text-4xl"
                  >📋</motion.div>
                  <h2 className="text-lg font-bold">Preparar {currentMonth}</h2>
                  <p className="text-xs text-muted-foreground">
                    Quer copiar seus custos fixos de {prevMonth} para {currentMonth}?
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyFixed} onCheckedChange={(v) => setCopyFixed(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold">✅ Copiar custos fixos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Aluguel, contas, assinaturas ({prevFixedCount} itens)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyBills} onCheckedChange={(v) => setCopyBills(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold">✅ Copiar vencimentos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Contas por dia de vencimento (marcadas como não pagas)
                      </p>
                    </div>
                  </label>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/50 bg-muted/10 opacity-60">
                    <Checkbox checked={false} disabled />
                    <div className="flex-1">
                      <p className="text-xs font-bold">❌ Copiar receitas</p>
                      <p className="text-[10px] text-muted-foreground">
                        Valores podem variar entre meses
                      </p>
                    </div>
                  </div>
                </div>

                {copied ? (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-center py-4"
                  >
                    <p className="text-sm font-bold text-emerald-500">✅ Dados copiados com sucesso!</p>
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
                      disabled={!copyFixed && !copyBills}
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
                    className="text-5xl"
                  >🏆</motion.div>
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
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20"
                    >
                      <span className="text-2xl">{badge.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold">{badge.label}</p>
                        <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                      </div>
                      <Trophy className="w-4 h-4 text-amber-500" />
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
