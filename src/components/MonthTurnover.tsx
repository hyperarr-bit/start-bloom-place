import { useState, useEffect } from "react";
import { localDayKey } from "@/lib/utils";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight, Copy, Sparkles, Calendar } from "lucide-react";
import { getMonthTotals, getFinanceStorageKeys, getCurrentMonthName, getMonthKey, getCurrentYear, readMonthData, writeMonthData } from "@/components/finance/storage-keys";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const readLocalKey = (userId: string | null, logicalKey: string) =>
  readMonthData(userId, logicalKey);

const countItems = (userId: string | null, logicalKey: string) => {
  const data = readLocalKey(userId, logicalKey);
  return Array.isArray(data) ? data.length : 0;
};

/*
 * ESCRITA QUE O REACT NÃO VIA (08/08).
 *
 * `copyToMonth` gravava direto no localStorage (`u:{uid}:finance-dueDays`),
 * mas a tela de Finanças guarda esse mesmo balde num `usePersistedState` —
 * que hidrata UMA vez (hydratedRef) e nunca mais relê a chave. Resultado: a
 * cópia acontecia no disco, a tela continuava com o array velho em memória e
 * o PRÓXIMO toque na UI (marcar um pago, adicionar uma conta) salvava o velho
 * por cima. A cópia sumia sem erro nenhum — e o reset de "pago" que vinha
 * junto ia embora com ela.
 *
 * Pior: `writeMonthData` grava SÓ local. Nada disso chegava ao Supabase, então
 * a cópia também não viajava com a conta pro app da loja.
 *
 * `aplicar` é a porta pro estado do React do mês CORRENTE (a tela passa os
 * setters). Quando o alvo é um mês passado — que ninguém tem em memória — o
 * caminho antigo continua valendo.
 */
const copyToMonth = (
  userId: string | null,
  fromMonth: string,
  toMonth: string,
  options: {
    fixed: boolean; bills: boolean; incomes: boolean; categoryBudgets: boolean; notes: boolean;
  },
  aplicar?: (logicalKey: string, value: any) => boolean,
) => {
  const fromKeys = getFinanceStorageKeys(fromMonth);
  const toKeys = getFinanceStorageKeys(toMonth);
  const newId = () => Date.now().toString() + Math.random();

  // Tenta primeiro pelo estado do React; só cai no disco se ninguém adotou a
  // chave (mês passado, ou tela de Finanças não montada).
  const gravar = (logicalKey: string, value: any) => {
    if (aplicar?.(logicalKey, value)) return;
    writeMonthData(userId, logicalKey, value);
  };

  if (options.fixed) {
    const data = readLocalKey(userId, fromKeys.fixed);
    if (data) {
      const items = data.map((i: any) => ({ ...i, id: newId() }));
      gravar(toKeys.fixed, items);
    }
  }

  if (options.bills) {
    const data = readLocalKey(userId, fromKeys.dueDays);
    if (data) {
      const days = data.map((d: any) => ({
        ...d,
        bills: (Array.isArray(d?.bills) ? d.bills : []).map((b: any) => ({ ...b, id: newId(), paid: false })),
      }));
      gravar(toKeys.dueDays, days);
    }
  }

  if (options.incomes) {
    const data = readLocalKey(userId, fromKeys.incomes);
    if (data) {
      const items = data.map((i: any) => ({
        ...i,
        id: newId(),
        date: localDayKey(),
      }));
      gravar(toKeys.incomes, items);
    }
  }

  if (options.categoryBudgets) {
    const year = getCurrentYear();
    const fromKey = isCurrentMonthCheck(fromMonth)
      ? "finance-category-budgets"
      : `finance-${year}-${getMonthKey(fromMonth)}-category-budgets`;
    const toKey = isCurrentMonthCheck(toMonth)
      ? "finance-category-budgets"
      : `finance-${year}-${getMonthKey(toMonth)}-category-budgets`;
    const baseBudgets = readLocalKey(userId, "finance-category-budgets");
    const monthBudgets = readLocalKey(userId, fromKey);
    const data = monthBudgets || baseBudgets;
    if (data) gravar(toKey, data);
  }

  if (options.notes) {
    const data = readLocalKey(userId, fromKeys.notes);
    if (data) {
      const items = data.map((n: any) => ({ ...n, id: newId() }));
      gravar(toKeys.notes, items);
    }
  }
};

const isCurrentMonthCheck = (month: string) => month === getCurrentMonthName();

interface MonthTurnoverProps {
  onOpenMonth?: (month: string) => void;
  /**
   * Aplica um valor no estado do React do mês corrente. Devolve `true` quando
   * a chave tem dono em memória (aí a gravação em disco não é feita aqui — o
   * `usePersistedState` do dono já persiste e sincroniza). Sem esta porta a
   * cópia é sobrescrita no toque seguinte da tela.
   */
  aplicarNoMesCorrente?: (logicalKey: string, value: any) => boolean;
}

export const MonthTurnover = ({ onOpenMonth, aplicarNoMesCorrente }: MonthTurnoverProps) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [lastSeenMonth, setLastSeenMonth] = usePersistedState<string>("finance-last-seen-month", "");
  const [turnoverAck, setTurnoverAck] = usePersistedState<string>("finance-turnover-ack", "");
  const [showRecap, setShowRecap] = useState(false);
  const [step, setStep] = useState<"recap" | "copy">("recap");
  const [copyFixed, setCopyFixed] = useState(true);
  const [copyBills, setCopyBills] = useState(true);
  const [copyIncomes, setCopyIncomes] = useState(true);
  const [copyCategoryBudgets, setCopyCategoryBudgets] = useState(true);
  const [copyNotes, setCopyNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentMonth = getCurrentMonthName();
  const currentMonthIdx = months.indexOf(currentMonth);
  const prevMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const prevMonth = months[prevMonthIdx];

  const year = new Date().getFullYear();
  const currentKey = `${currentMonth}-${year}`;
  const prevKey = `${prevMonth}-${prevMonthIdx === 11 ? year - 1 : year}`;

  const prevData = getMonthTotals(prevMonth, userId);

  /*
   * "O mês passado teve movimento?" precisa olhar os DOIS lugares (02/08).
   *
   * Perguntar só pra chave arquivada era o defeito que desligava este cartão
   * exatamente quando ele era necessário: nada arquivava, a chave vinha
   * vazia, ele concluía "mês passado foi parado" e não aparecia. O único
   * escritor daquela chave era ele mesmo, na virada seguinte — círculo
   * fechado.
   *
   * Agora, se ainda houver lançamento do mês passado parado no balde do mês
   * corrente (o caso de quem abriu o app antes do arquivamento rodar), isso
   * também conta como movimento.
   */
  const prevAindaNoBaldeCorrente = (() => {
    const anoDoPrev = prevMonthIdx === 11 ? year - 1 : year;
    const alvo = `${anoDoPrev}-${String(prevMonthIdx + 1).padStart(2, "0")}`;
    const correntes = getFinanceStorageKeys(currentMonth);
    const ler = (chave: string) => {
      const v = readLocalKey(userId, chave);
      return Array.isArray(v) ? (v as { date?: unknown }[]) : [];
    };
    return [...ler(correntes.expenses), ...ler(correntes.incomes)].some(
      (i) => typeof i?.date === "string" && i.date.startsWith(alvo),
    );
  })();

  const prevHasData =
    prevData.receitas + prevData.custosFixos + prevData.custosVariaveis > 0 ||
    prevAindaNoBaldeCorrente;

  const prevKeys = getFinanceStorageKeys(prevMonth);
  const prevFixedCount = countItems(userId, prevKeys.fixed);
  const prevIncomesCount = countItems(userId, prevKeys.incomes);
  const prevNotesCount = countItems(userId, prevKeys.notes);

  const prevBalance = prevData.receitas - prevData.custosFixos - prevData.custosVariaveis - prevData.dividas;

  const prevBillsInfo = (() => {
    const data = readLocalKey(userId, prevKeys.dueDays);
    if (!data) return { total: 0, paid: 0 };
    const allBills = data.flatMap((d: any) => d.bills || []);
    return { total: allBills.length, paid: allBills.filter((b: any) => b.paid).length };
  })();

  const hasCategoryBudgets = (() => {
    const base = readLocalKey(userId, "finance-category-budgets");
    const yr = getCurrentYear();
    const monthKey = `finance-${yr}-${getMonthKey(prevMonth)}-category-budgets`;
    const month = readLocalKey(userId, monthKey);
    const data = month || base;
    return data && Object.keys(data).length > 0;
  })();

  // Janela de virada: só mostra o card/recap nos primeiros 7 dias do mês,
  // se o usuário estava ativo no mês anterior e ainda não confirmou a virada.
  const dayOfMonth = new Date().getDate();
  const isTurnoverWindow =
    dayOfMonth <= 7 &&
    prevHasData &&
    lastSeenMonth === prevKey &&
    turnoverAck !== currentKey;

  /*
   * O sinal só é gasto DEPOIS da decisão (02/08).
   *
   * Antes, os dois aconteciam no mesmo efeito de montagem: decidir se o
   * cartão aparece e gravar "último mês visto". Como a decisão usa os
   * valores do PRIMEIRO render — quando os dados ainda podem não ter
   * chegado — o cartão não aparecia e o sinal era queimado no mesmo
   * instante. A partir dali `lastSeenMonth === prevKey` nunca mais era
   * verdade e a virada daquele mês ficava perdida pra sempre.
   *
   * Agora `lastSeenMonth` só avança quando não há mais virada pendente:
   * a pessoa confirmou, ou a janela dos 7 dias passou. Ou seja, ele passa
   * a significar "o último mês cuja virada já foi resolvida" — que é o que
   * o resto do componente já assumia que ele significava.
   */
  useEffect(() => {
    if (isTurnoverWindow) setShowRecap(true);
  }, [isTurnoverWindow]);

  useEffect(() => {
    if (isTurnoverWindow) return;
    if (lastSeenMonth !== currentKey) {
      setLastSeenMonth(currentKey);
    }
  }, [isTurnoverWindow, lastSeenMonth, currentKey, setLastSeenMonth]);


  const savingsRate = prevData.receitas > 0
    ? ((prevData.receitas - prevData.custosVariaveis - prevData.custosFixos) / prevData.receitas) * 100
    : 0;

  const getMessage = () => {
    if (prevBalance > 0 && savingsRate >= 30) {
      return { emoji: "🏆", text: `Incrível! Você economizou ${savingsRate.toFixed(0)}% da renda em ${prevMonth}. Continue assim!` };
    }
    if (prevBalance > 0) {
      return { emoji: "✅", text: `Bom trabalho! Você fechou ${prevMonth} no positivo. Vamos manter o ritmo!` };
    }
    if (prevBalance === 0) {
      return { emoji: "⚖️", text: `${prevMonth} ficou no zero a zero. Que tal traçar uma meta de economia para ${currentMonth}?` };
    }
    return { emoji: "💪", text: `${prevMonth} foi desafiador, mas você está no controle. Vamos planejar ${currentMonth} melhor!` };
  };

  const message = getMessage();

  const handleCopy = () => {
    copyToMonth(userId, prevMonth, currentMonth, {
      fixed: copyFixed,
      bills: copyBills,
      incomes: copyIncomes,
      categoryBudgets: copyCategoryBudgets,
      notes: copyNotes,
    }, aplicarNoMesCorrente);
    setCopied(true);
    setTimeout(() => {
      setShowRecap(false);
      setStep("recap");
      setCopied(false);
    }, 1500);
  };

  const handleClose = () => {
    setShowRecap(false);
    setStep("recap");
    setTurnoverAck(currentKey);
  };

  const triggerRecap = () => {
    setStep("recap");
    setShowRecap(true);
  };

  const anySelected = copyFixed || copyBills || copyIncomes || copyCategoryBudgets || copyNotes;

  return (
    <>
      {isTurnoverWindow && (

        <button
          onClick={triggerRecap}
          className="w-full bg-card rounded-lg border border-border overflow-hidden hover:bg-muted/20 transition-colors text-left"
        >
          <div className="bg-muted/40 px-4 py-2 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold tracking-wide uppercase">Resumo de {prevMonth}</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Receitas</p>
                <p className="text-xs font-bold tabular-nums text-green-400">R$ {prevData.receitas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Despesas</p>
                <p className="text-xs font-bold tabular-nums text-red-400">R$ {(prevData.custosVariaveis + prevData.custosFixos).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Saldo</p>
                <p className={`text-xs font-bold tabular-nums ${prevBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {prevBalance >= 0 ? "+" : ""}R$ {prevBalance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Toque para ver detalhes e preparar {currentMonth}
            </p>
          </div>
        </button>
      )}

      <Dialog open={showRecap} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-md w-[92vw] p-0 gap-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {step === "recap" && (
              <motion.div
                key="recap"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 space-y-5"
              >
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="text-4xl"
                  >
                    {message.emoji}
                  </motion.div>
                  <h2 className="text-lg font-bold">{prevMonth} acabou!</h2>
                  <p className="text-xs text-muted-foreground">Aqui está seu resumo financeiro</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-3 bg-card-receitas border border-card-receitas-border">
                    <span className="text-[10px] text-card-receitas-text font-medium">Receitas</span>
                    <p className="text-sm font-bold text-card-receitas-text">
                      R$ {prevData.receitas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-lg p-3 bg-card-despesas border border-card-despesas-border">
                    <span className="text-[10px] text-card-despesas-text font-medium">Despesas</span>
                    <p className="text-sm font-bold text-card-despesas-text">
                      R$ {(prevData.custosVariaveis + prevData.custosFixos).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className={`rounded-lg p-3 text-center border ${
                  prevBalance >= 0 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    {prevBalance >= 0
                      ? <TrendingUp className="w-4 h-4 text-success" />
                      : <TrendingDown className="w-4 h-4 text-destructive" />
                    }
                    <span className="text-[10px] font-bold text-muted-foreground">SALDO</span>
                  </div>
                  <p className={`text-xl font-bold ${prevBalance >= 0 ? "text-success" : "text-destructive"}`}>
                    R$ {prevBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {prevBillsInfo.total > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground">Contas pagas</span>
                    <span className="text-xs font-bold">
                      {prevBillsInfo.paid}/{prevBillsInfo.total} ({Math.round((prevBillsInfo.paid / prevBillsInfo.total) * 100)}%)
                    </span>
                  </div>
                )}

                {savingsRate > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground">Taxa de economia</span>
                    <span className="text-xs font-bold">{savingsRate.toFixed(0)}%</span>
                  </div>
                )}

                <div className="rounded-lg p-3 bg-primary/5 border border-primary/20">
                  <p className="text-xs text-center">{message.text}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      handleClose();
                      onOpenMonth?.(prevMonth);
                    }}
                  >
                    Ver detalhes
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => setStep("copy")}
                  >
                    <Sparkles className="w-3 h-3" />
                    Preparar {currentMonth}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "copy" && (
              <motion.div
                key="copy"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 space-y-5"
              >
                <div className="text-center space-y-2">
                  <div className="text-3xl">📋</div>
                  <h2 className="text-lg font-bold">Preparar {currentMonth}</h2>
                  <p className="text-xs text-muted-foreground">
                    Copiar dados de {prevMonth} para {currentMonth}?
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Custos Fixos */}
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyFixed} onCheckedChange={(v) => setCopyFixed(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold">Custos Fixos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Aluguel, contas, assinaturas ({prevFixedCount} itens)
                      </p>
                    </div>
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </label>

                  {/* Vencimentos */}
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyBills} onCheckedChange={(v) => setCopyBills(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold">Vencimentos</p>
                      <p className="text-[10px] text-muted-foreground">
                        Contas por dia ({prevBillsInfo.total} contas, marcadas como não pagas)
                      </p>
                    </div>
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </label>

                  {/* Receitas */}
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <Checkbox checked={copyIncomes} onCheckedChange={(v) => setCopyIncomes(!!v)} />
                    <div className="flex-1">
                      <p className="text-xs font-bold">Receitas</p>
                      <p className="text-[10px] text-muted-foreground">
                        Salário, freelances, etc. ({prevIncomesCount} fontes)
                      </p>
                    </div>
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </label>

                  {/* Limites por Categoria */}
                  {hasCategoryBudgets && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                      <Checkbox checked={copyCategoryBudgets} onCheckedChange={(v) => setCopyCategoryBudgets(!!v)} />
                      <div className="flex-1">
                        <p className="text-xs font-bold">Limites por Categoria</p>
                        <p className="text-[10px] text-muted-foreground">
                          Tetos de gasto definidos por categoria
                        </p>
                      </div>
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </label>
                  )}

                  {/* Notas */}
                  {prevNotesCount > 0 && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer">
                      <Checkbox checked={copyNotes} onCheckedChange={(v) => setCopyNotes(!!v)} />
                      <div className="flex-1">
                        <p className="text-xs font-bold">Notas</p>
                        <p className="text-[10px] text-muted-foreground">
                          Lembretes e anotações ({prevNotesCount} notas)
                        </p>
                      </div>
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </label>
                  )}
                </div>

                <div className="rounded-lg p-2 bg-muted/30">
                  <p className="text-[10px] text-muted-foreground text-center">
                    💡 Valores podem ser ajustados após a cópia
                  </p>
                </div>

                {copied ? (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-center py-3"
                  >
                    <p className="text-sm font-bold text-success">✅ Dados copiados com sucesso!</p>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={handleClose}
                    >
                      Pular
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1"
                      onClick={handleCopy}
                      disabled={!anySelected}
                    >
                      <Copy className="w-3 h-3" />
                      Copiar para {currentMonth}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};
