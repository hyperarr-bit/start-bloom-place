import { useState, useEffect, useMemo } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IncomeTable } from "@/components/IncomeTable";
import { ExpenseTable } from "@/components/ExpenseTable";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { BillsDueCards } from "@/components/BillsDueCards";
import { Calculator } from "@/components/Calculator";
import { Notes } from "@/components/Notes";

import { FinancialSummary } from "@/components/FinancialSummary";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { AnnualBudget } from "@/components/AnnualBudget";
import { MonthlyBudget } from "@/components/MonthlyBudget";
import { WishlistItems } from "@/components/WishlistItems";
import { InvestmentsTracker } from "@/components/InvestmentsTracker";
import { FinancialHealth } from "@/components/FinancialHealth";
import { TravelPlanner } from "@/components/TravelPlanner";
import { Dashboard } from "@/components/Dashboard";
import { Simulators } from "@/components/Simulators";
import { Gamification } from "@/components/Gamification";
import { Reports } from "@/components/Reports";
import { MonthlySheet } from "@/components/MonthlySheet";
import { MonthTurnover } from "@/components/MonthTurnover";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];


const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const [incomes, setIncomes] = usePersistedState("finance-incomes", [] as any[]);

  const [expenses, setExpenses] = usePersistedState("finance-expenses", [] as any[]);

  const [fixedExpenses, setFixedExpenses] = usePersistedState("finance-fixed-expenses", [] as any[]);

  const [dueDays, setDueDays] = usePersistedState("finance-dueDays", [
    { day: 5, color: "yellow", bills: [] as any[] },
    { day: 10, color: "slate", bills: [] as any[] },
    { day: 20, color: "indigo", bills: [] as any[] },
    { day: 30, color: "emerald", bills: [] as any[] },
  ]);

  const [notes, setNotes] = usePersistedState("finance-notes", [] as any[]);

  const [goals] = usePersistedState("finance-goals", [] as any[]);

  const [installments, setInstallments] = usePersistedState("finance-installments", [] as any[]);

  const [annualData, setAnnualData] = usePersistedState("finance-annual", 
    months.map((m) => ({
      month: m,
      receitas: 0,
      custosFixos: 0,
      custosVariaveis: 0,
      dividas: 0,
    }))
  );

  const [monthlyBudgets, setMonthlyBudgets] = usePersistedState("finance-monthly-budgets",
    months.map((m) => ({ month: m, value: 0, hasNote: false }))
  );

  const [wishlistItems, setWishlistItems] = usePersistedState("finance-wishlist", [] as any[]);

  const [investments, setInvestments] = usePersistedState("finance-investments", [] as any[]);

  const [trips, setTrips] = usePersistedState("finance-trips", [] as any[]);

  // Gamification state
  const [streakDays, setStreakDays] = usePersistedState("finance-streak", 0);
  const [challenge52Weeks, setChallenge52Weeks] = usePersistedState<number[]>("finance-52weeks", []);

  // Computed values
  const totalIncome = incomes.reduce((sum: number, i: any) => sum + i.value, 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.value, 0);
  const totalDebts = installments.reduce((sum: number, i: any) => sum + (i.totalInstallments - i.paidInstallments) * i.installmentValue, 0);
  const totalInvestments = investments.reduce((sum: number, i: any) => sum + i.currentValue, 0);
  const monthlyInstallments = installments.reduce((sum: number, i: any) => i.paidInstallments < i.totalInstallments ? sum + i.installmentValue : sum, 0);
  const emergencyFund = goals.find((g: any) => g.name.toLowerCase().includes("emergência"))?.currentValue || 0;
  const emergencyFundGoal = goals.find((g: any) => g.name.toLowerCase().includes("emergência"))?.targetValue || totalExpenses * 6;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Bills paid rate
  const allBills = dueDays.flatMap((d: any) => d.bills);
  const billsPaidRate = allBills.length > 0 ? (allBills.filter((b: any) => b.paid).length / allBills.length) * 100 : 100;

  // Goals progress
  const goalsProgress = goals.length > 0
    ? goals.reduce((sum: number, g: any) => sum + Math.min((g.currentValue / g.targetValue) * 100, 100), 0) / goals.length
    : 0;

  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const tabs = [
    { id: "dashboard", label: "📊 DASHBOARD" },
    { id: "financeiro", label: "💰 MEU FINANCEIRO" },
    { id: "investimentos", label: "📈 INVESTIMENTOS" },
    { id: "itens", label: "❤️ DESEJOS" },
    { id: "viagem", label: "✈️ VIAGEM" },
    { id: "simuladores", label: "🧮 SIMULADORES" },
    { id: "desafios", label: "🏆 DESAFIOS" },
    { id: "relatorios", label: "📋 RELATÓRIOS" },
    { id: "saude", label: "💚 SAÚDE FINANCEIRA" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lg">≡</span>
          <h1 className="text-base font-bold tracking-tight">CORE — FINANÇAS</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`notion-tab whitespace-nowrap text-[11px] ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <ModuleTip
          moduleId="financas"
          tips={[
            "Comece adicionando suas receitas (salário, freelance, etc.) na aba 💰 Receitas",
            "Cadastre despesas fixas (aluguel, contas) e variáveis separadamente",
            "Use o Dashboard para ter uma visão geral da sua saúde financeira",
            "Defina metas de economia e acompanhe o progresso"
          ]}
        />
        {/* Compact summary bar - all tabs except dashboard and financeiro */}
        {activeTab !== "dashboard" && activeTab !== "financeiro" && (
          <div className="bg-card rounded-lg border border-border px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-muted-foreground">Receitas</span>
              <span className="text-xs font-bold text-green-500">R$ {totalIncome.toLocaleString("pt-BR")}</span>
            </div>
            <div className="w-px h-4 bg-border flex-shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-muted-foreground">Despesas</span>
              <span className="text-xs font-bold text-red-400">R$ {totalExpenses.toLocaleString("pt-BR")}</span>
            </div>
            <div className="w-px h-4 bg-border flex-shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-muted-foreground">Dívidas</span>
              <span className="text-xs font-bold text-orange-400">R$ {totalDebts.toLocaleString("pt-BR")}</span>
            </div>
            <div className="w-px h-4 bg-border flex-shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-muted-foreground">Invest.</span>
              <span className="text-xs font-bold text-purple-400">R$ {totalInvestments.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <Dashboard
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            totalDebts={totalDebts}
            totalInvestments={totalInvestments}
            expenses={expenses}
            fixedExpenses={fixedExpenses}
            dueDays={dueDays}
            annualData={annualData}
            savingsRate={savingsRate}
          />
        )}

        {activeTab === "financeiro" && (
          <>
            {openMonth ? (
              <MonthlySheet month={openMonth} onClose={() => setOpenMonth(null)} />
            ) : (
              <>
                <MonthTurnover onOpenMonth={setOpenMonth} />
                <FinancialSummary
                  totalIncome={totalIncome}
                  totalExpenses={totalExpenses}
                  totalDebts={totalDebts}
                  totalInvestments={totalInvestments}
                />
                <div className="grid lg:grid-cols-[1fr_280px] gap-4 min-w-0">
                  <div className="min-w-0">
                    <IncomeTable incomes={incomes} setIncomes={setIncomes} />
                  </div>
                  <Calculator />
                </div>
                <div className="min-w-0">
                  <FixedExpensesTable expenses={fixedExpenses} setExpenses={setFixedExpenses} />
                </div>
                <div className="grid lg:grid-cols-[1fr_280px] gap-4 min-w-0">
                  <div className="min-w-0">
                    <ExpenseTable expenses={expenses} setExpenses={setExpenses} />
                  </div>
                  <Notes notes={notes} setNotes={setNotes} />
                </div>
                <BillsDueCards dueDays={dueDays} setDueDays={setDueDays} />
                <InstallmentTracker installments={installments} setInstallments={setInstallments} variableExpenses={expenses} />
                <div className="grid lg:grid-cols-[1fr_200px] gap-4">
                  <AnnualBudget />
                  <MonthlyBudget budgets={monthlyBudgets} setBudgets={setMonthlyBudgets} onOpenMonth={setOpenMonth} />
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "investimentos" && (
          <InvestmentsTracker investments={investments} setInvestments={setInvestments} />
        )}

        {activeTab === "itens" && (
          <WishlistItems 
            items={wishlistItems} 
            setItems={setWishlistItems} 
            monthlyBudget={totalIncome}
            totalExpenses={totalExpenses}
            totalDebts={totalDebts}
            monthlyInstallments={monthlyInstallments}
          />
        )}

        {activeTab === "viagem" && (
          <TravelPlanner trips={trips} setTrips={setTrips} />
        )}

        {activeTab === "simuladores" && (
          <Simulators />
        )}

        {activeTab === "desafios" && (
          <Gamification
            savingsRate={savingsRate}
            billsPaidRate={billsPaidRate}
            goalsProgress={goalsProgress}
            totalInvestments={totalInvestments}
            totalDebts={totalDebts}
            streakDays={streakDays}
            setStreakDays={setStreakDays}
            challenge52Weeks={challenge52Weeks}
            setChallenge52Weeks={setChallenge52Weeks}
          />
        )}

        {activeTab === "relatorios" && (
          <Reports
            incomes={incomes}
            expenses={expenses}
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            totalDebts={totalDebts}
            totalInvestments={totalInvestments}
            setIncomes={setIncomes}
            setExpenses={setExpenses}
          />
        )}

        {activeTab === "saude" && (
          <FinancialHealth
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            totalDebts={totalDebts}
            totalInvestments={totalInvestments}
            emergencyFund={emergencyFund}
            emergencyFundGoal={emergencyFundGoal}
            goals={goals}
            dueDays={dueDays}
            installments={installments}
            wishlistItems={wishlistItems}
            trips={trips}
            investments={investments}
          />
        )}
      </main>
    </div>
  );
};

export default Index;