import { useState, useEffect, useMemo } from "react";
import { useSetTrackedTab } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft, DollarSign } from "lucide-react";

import { useUserData } from "@/hooks/use-user-data";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IncomeTable } from "@/components/IncomeTable";
import { ExpenseTable } from "@/components/ExpenseTable";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { BillsDueCards } from "@/components/BillsDueCards";
import { Calculator } from "@/components/Calculator";
import { Notes } from "@/components/Notes";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useAuth } from "@/hooks/use-auth";

import { FinancialSummary } from "@/components/FinancialSummary";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { AnnualBudget } from "@/components/AnnualBudget";
import { MonthlyBudget } from "@/components/MonthlyBudget";
import { WishlistItems } from "@/components/WishlistItems";
import { InvestmentsTracker } from "@/components/InvestmentsTracker";
import { FinancialHealth } from "@/components/FinancialHealth";
import { TravelBudget } from "@/components/travel/TravelBudget";
import { Dashboard } from "@/components/Dashboard";
import { Simulators } from "@/components/Simulators";

import { Reports } from "@/components/Reports";
import { MonthlySheet } from "@/components/MonthlySheet";
import { MonthTurnover } from "@/components/MonthTurnover";
import { CategoryBudgets } from "@/components/CategoryBudgets";
import { MonthComparison } from "@/components/finance/MonthComparison";
import { TrackedCard } from "@/components/admin/TrackedCard";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];


const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get: getUserData, set: setUserData, isGuest } = useUserData();
  const [activeTab, setActiveTab] = useState(
    getUserData<string>("spotlight-done-financas", "") !== "true" ? "financeiro" : "dashboard"
  );
  useScrollActiveTabIntoView(activeTab);
  useSetTrackedTab(activeTab);
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


  // Computed values
  const totalIncome = incomes.reduce((sum: number, i: any) => sum + i.value, 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.value, 0);
  const totalFixedExpenses = fixedExpenses.reduce((sum: number, e: any) => sum + (e.value || 0), 0);
  const totalDebts = installments.reduce((sum: number, i: any) => sum + (i.totalInstallments - i.paidInstallments) * i.installmentValue, 0);
  const totalInvestments = investments.reduce((sum: number, i: any) => sum + i.currentValue, 0);
  const monthlyInstallments = installments.reduce((sum: number, i: any) => i.paidInstallments < i.totalInstallments ? sum + i.installmentValue : sum, 0);
  const emergencyFund = goals.find((g: any) => g.name.toLowerCase().includes("emergência"))?.currentValue || 0;
  const emergencyFundGoal = goals.find((g: any) => g.name.toLowerCase().includes("emergência"))?.targetValue || totalExpenses * 6;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Bills paid rate
  const allBills = dueDays.flatMap((d: any) => Array.isArray(d?.bills) ? d.bills : []);
  const billsPaidRate = allBills.length > 0 ? (allBills.filter((b: any) => b?.paid).length / allBills.length) * 100 : 100;

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
    
    { id: "limites", label: "🎯 LIMITES" },
    { id: "relatorios", label: "📋 RELATÓRIOS" },
    { id: "saude", label: "💚 SAÚDE FINANCEIRA" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SpotlightOverlay
        moduleKey="financas"
        onComplete={() => {
          // Após terminar o tutorial, espera ~5s e abre o cadastro rápido (7 dias grátis).
          if (isGuest) {
            setTimeout(() => setUserData("quicksignup-pending", "true"), 3000);
          }
        }}
        steps={[
          
          { selector: '[data-spotlight="add-income"]', label: 'Adicione sua receita (salário, freelas...).', advanceOnAction: "first_income", checkKey: "finance-incomes", onEnter: () => setActiveTab("financeiro") },
          { selector: '[data-spotlight="add-fixed"]', label: 'Cadastre um custo fixo (aluguel, internet...).', advanceOnAction: "first_fixed_expense", checkKey: "finance-fixed-expenses", onEnter: () => setActiveTab("financeiro") },
          
          { selector: '[data-spotlight="add-bill"]', label: 'Clique em "Editar" e adicione 1 conta no vencimento.', advanceOnAction: "first_bill", checkKey: "finance-dueDays", checkValue: (v: any) => Array.isArray(v) && v.some((d: any) => Array.isArray(d?.bills) && d.bills.length > 0), onEnter: () => setActiveTab("financeiro") },
          { selector: '[data-spotlight="tab-investimentos"]', label: 'Acompanhe seus investimentos aqui.', onEnter: () => { setActiveTab("financeiro"); setTimeout(() => document.querySelector('[data-spotlight="tab-investimentos"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="add-investment"]', label: 'Cadastre seu primeiro aporte.', advanceOnAction: "first_investment", checkKey: "finance-investments", skippable: true, placement: "above", onEnter: () => setActiveTab("investimentos") },
          { selector: '[data-spotlight="tab-itens"]', label: 'Liste o que quer comprar e priorize.', onEnter: () => { setActiveTab("investimentos"); setTimeout(() => document.querySelector('[data-spotlight="tab-itens"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="add-wish"]', label: 'Adicione um item da sua lista de desejos.', advanceOnAction: "first_wish", checkKey: "finance-wishlist", skippable: true, placement: "above", onEnter: () => setActiveTab("itens") },
          { selector: '[data-spotlight="tab-limites"]', label: 'Toque em LIMITES embaixo.', onEnter: () => { setActiveTab("itens"); setTimeout(() => document.querySelector('[data-spotlight="tab-limites"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="add-limit"]', label: 'Adicione um limite pra uma categoria.', advanceOnClick: false, checkKey: "finance-category-budgets", checkValue: (v: any) => v && typeof v === "object" && Object.keys(v).length > 0, placement: "below", onEnter: () => setActiveTab("limites") },
          { selector: '[data-spotlight="tab-relatorios"]', label: 'Veja relatórios mensais automáticos.', onEnter: () => { setActiveTab("limites"); setTimeout(() => document.querySelector('[data-spotlight="tab-relatorios"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="tab-saude"]', label: 'Acompanhe sua saúde financeira em um índice.', onEnter: () => { setActiveTab("relatorios"); setTimeout(() => document.querySelector('[data-spotlight="tab-saude"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
        ]}
      />
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} aria-label="Voltar" className="hover:bg-muted rounded-md p-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <DollarSign className="w-5 h-5 text-amber-600" />
          <h1 className="text-base font-bold tracking-tight">FINANÇAS</h1>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground text-xs capitalize">{currentMonth}</span>
            <ThemeToggle />
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id} data-active={activeTab === tab.id}
              data-spotlight={tab.id === "financeiro" ? "financeiro" : `tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`notion-tab whitespace-nowrap text-[11px] ${activeTab === tab.id ? "notion-tab-active" : "hover:bg-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
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
          <>
            <TrackedCard cardKey="dashboard" tab="dashboard">
              <Dashboard
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                totalDebts={totalDebts}
                totalInvestments={totalInvestments}
                expenses={expenses}
                fixedExpenses={fixedExpenses}
                dueDays={dueDays}
                savingsRate={savingsRate}
                incomes={incomes}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            </TrackedCard>
            <TrackedCard cardKey="month-comparison" tab="dashboard">
              <MonthComparison />
            </TrackedCard>
          </>
        )}

        {activeTab === "financeiro" && (
          <>
            {openMonth ? (
              <MonthlySheet month={openMonth} onClose={() => setOpenMonth(null)} />
            ) : (
              <>
                <TrackedCard cardKey="month-turnover" tab="financeiro">
                  <MonthTurnover onOpenMonth={setOpenMonth} />
                </TrackedCard>
                <TrackedCard cardKey="summary" tab="financeiro">
                  <FinancialSummary
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    totalDebts={totalDebts}
                    totalInvestments={totalInvestments}
                  />
                </TrackedCard>
                <div className="grid lg:grid-cols-[1fr_280px] gap-4 min-w-0">
                  <div className="min-w-0">
                    <TrackedCard cardKey="incomes" tab="financeiro">
                      <IncomeTable incomes={incomes} setIncomes={setIncomes} prefillExample={getUserData<string>("spotlight-done-financas", "") !== "true" && incomes.length === 0} />
                    </TrackedCard>
                  </div>
                  <TrackedCard cardKey="calculator" tab="financeiro">
                    <Calculator />
                  </TrackedCard>
                </div>
                <div className="min-w-0">
                  <TrackedCard cardKey="fixed-expenses" tab="financeiro">
                    <FixedExpensesTable expenses={fixedExpenses} setExpenses={setFixedExpenses} />
                  </TrackedCard>
                </div>
                <div className="grid lg:grid-cols-[1fr_280px] gap-4 min-w-0">
                  <div className="min-w-0">
                    <TrackedCard cardKey="expenses" tab="financeiro">
                      <ExpenseTable expenses={expenses} setExpenses={setExpenses} />
                    </TrackedCard>
                  </div>
                  <TrackedCard cardKey="notes" tab="financeiro">
                    <Notes notes={notes} setNotes={setNotes} />
                  </TrackedCard>
                </div>
                <TrackedCard cardKey="bills-due" tab="financeiro">
                  <BillsDueCards dueDays={dueDays} setDueDays={setDueDays} />
                </TrackedCard>
                <TrackedCard cardKey="installments" tab="financeiro">
                  <InstallmentTracker installments={installments} setInstallments={setInstallments} variableExpenses={expenses} />
                </TrackedCard>
                <div className="grid lg:grid-cols-[1fr_200px] gap-4">
                  <TrackedCard cardKey="annual-budget" tab="financeiro">
                    <AnnualBudget />
                  </TrackedCard>
                  <TrackedCard cardKey="monthly-budget" tab="financeiro">
                    <MonthlyBudget budgets={monthlyBudgets} setBudgets={setMonthlyBudgets} onOpenMonth={setOpenMonth} />
                  </TrackedCard>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "investimentos" && (
          <TrackedCard cardKey="investments" tab="investimentos">
            <InvestmentsTracker investments={investments} setInvestments={setInvestments} />
          </TrackedCard>
        )}

        {activeTab === "itens" && (
          <TrackedCard cardKey="wishlist" tab="itens">
            <WishlistItems 
              items={wishlistItems} 
              setItems={setWishlistItems} 
              monthlyBudget={totalIncome}
              totalExpenses={totalExpenses}
              totalDebts={totalDebts}
              monthlyInstallments={monthlyInstallments}
              fixedExpenses={fixedExpenses}
              dueDays={dueDays}
            />
          </TrackedCard>
        )}

        {activeTab === "viagem" && (
          <TrackedCard cardKey="travel-budget" tab="viagem">
            <TravelBudget />
          </TrackedCard>
        )}

        {activeTab === "simuladores" && (
          <TrackedCard cardKey="simulators" tab="simuladores">
            <Simulators />
          </TrackedCard>
        )}


        {activeTab === "limites" && (
          <TrackedCard cardKey="category-budgets" tab="limites">
            <CategoryBudgets expenses={[...expenses, ...fixedExpenses]} />
          </TrackedCard>
        )}

        {activeTab === "relatorios" && (
          <TrackedCard cardKey="reports" tab="relatorios">
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
          </TrackedCard>
        )}

        {activeTab === "saude" && (
          <TrackedCard cardKey="financial-health" tab="saude">
            <FinancialHealth
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              totalFixedExpenses={totalFixedExpenses}
              monthlyInstallments={monthlyInstallments}
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
          </TrackedCard>
        )}
      </main>
    </div>
  );
};

export default Index;