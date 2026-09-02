import { useState, useEffect, useMemo } from "react";
import { useSetTrackedTab } from "@/hooks/use-module-tracker";
import { useScrollActiveTabIntoView } from "@/hooks/use-scroll-active-tab";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useNavigate, useLocation } from "react-router-dom";
import { ModuleTip } from "@/components/ModuleTip";
import { ArrowLeft, DollarSign, Sparkles } from "lucide-react";
import { AskCore } from "@/components/ask/AskCore";

import { useUserData } from "@/hooks/use-user-data";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IncomeTable } from "@/components/IncomeTable";
import { ExpenseTable } from "@/components/ExpenseTable";
import { ConviteAvaliacao, type GastoDoConvite } from "@/components/avaliacao/ConviteAvaliacao";
import { reservarConvitePrimeiroGasto } from "@/lib/avaliacao";
import { FixedExpensesTable } from "@/components/FixedExpensesTable";
import { MonthCalendar } from "@/components/finance/MonthCalendar";
import { EmergencyFund, useReservaEmergencia, metaDaReserva } from "@/components/finance/EmergencyFund";
import { Calculator } from "@/components/Calculator";
import { Notes } from "@/components/Notes";
import { SpotlightOverlay } from "@/components/onboarding/SpotlightOverlay";
import { useModuleCompletionFlow } from "@/hooks/use-module-completion-flow";
import { useAuth } from "@/hooks/use-auth";

import { FinancialSummary } from "@/components/FinancialSummary";
import { InstallmentTracker } from "@/components/InstallmentTracker";
import { DividasEntrePessoas } from "@/components/finance/DividasEntrePessoas";
import { AnnualBudget } from "@/components/AnnualBudget";
import { MonthlyBudget } from "@/components/MonthlyBudget";
import { WishlistItems } from "@/components/WishlistItems";
import { InvestmentsTracker } from "@/components/InvestmentsTracker";
import { FinancialHealth } from "@/components/FinancialHealth";
import { TravelBudget } from "@/components/travel/TravelBudget";
import { PedirLembretes } from "@/components/finance/PedirLembretes";
import { Dashboard } from "@/components/Dashboard";
import { Simulators } from "@/components/Simulators";

import { Reports } from "@/components/Reports";
import { MonthlySheet } from "@/components/MonthlySheet";
import { MonthTurnover } from "@/components/MonthTurnover";
import { CategoryBudgets } from "@/components/CategoryBudgets";
import { MonthComparison } from "@/components/finance/MonthComparison";
import { TrackedCard } from "@/components/admin/TrackedCard";
import { computeMonthlyOutflow, computeSavingsRate } from "@/lib/finance-totals";
import { syncFixedExpensesToBills } from "@/lib/finance-sync";
import { usarListaDoPerfil, mesclarPerfil, PERFIL_PESSOAL, PERFIL_TODOS, type Perfil } from "@/lib/finance-perfil";
import { SeletorDePerfil } from "@/components/finance/SeletorDePerfil";
import { WrappedBanner } from "@/components/wrapped/WrappedBanner";
import { QuizWelcome, ImportStarterHint } from "@/components/onboarding/QuizWelcome";
import { ImportExtrato } from "@/components/finance/ImportExtrato";
import { getQuizAnswers, GASTO_ANCHOR, VICTORY_PHRASE } from "@/lib/funnel";
import { WeeklyChallenge } from "@/components/challenges/WeeklyChallenge";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];


const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // No demo aberto (/preview/financas) o "voltar" deve sair pra LP, não pro app.
  const isPreview = location.pathname.startsWith("/preview");
  const { user, isSubscribed } = useAuth();
  const { get: getUserData, set: setUserData, isGuest, loaded: userDataLoaded } = useUserData();
  /* CONVITE NO PRIMEIRO GASTO (02/09) — ver ConviteAvaliacao. A reserva (uma
     por aparelho, só se nunca lançou nada, só se a cota permite) acontece
     AQUI, na hora do toque; a folha entra 1,2s depois, com a linha nova já
     visível na tabela — mesma coreografia do ✓ da conta paga. */
  const [convite, setConvite] = useState<GastoDoConvite | null>(null);
  const aoPrimeiroGasto = (gasto: GastoDoConvite) => {
    if (!reservarConvitePrimeiroGasto(user?.id ?? null, gasto.id)) return;
    window.setTimeout(() => setConvite(gasto), 1200);
  };
  // Quem veio do funil chega com as respostas do quiz no aparelho — a 1ª
  // sessão usa isso (card de plano + copy do tutorial com o R$ da pessoa).
  const quiz = getQuizAnswers();
  const quizAnchor = GASTO_ANCHOR[quiz.gasto ?? ""] ?? null;
  const quizVictory = VICTORY_PHRASE[quiz.vitoria ?? ""];
  const { onModuleComplete: onFinanceTutorialComplete, CompletionDialog: FinanceCompletionDialog } = useModuleCompletionFlow("financas");
  const [activeTab, setActiveTab] = useState(
    getUserData<string>("spotlight-done-financas", "") !== "true" ? "financeiro" : "dashboard"
  );
  useScrollActiveTabIntoView(activeTab);
  useSetTrackedTab(activeTab);
  /* Mês aberto passa a carregar o ANO junto (01/09) — sem ele a planilha de
     um mês de 2024 abria lendo as chaves de 2026 e mostrava tudo vazio. */
  const [openMonth, setOpenMonth] = useState<{ month: string; year: number } | null>(null);
  const abrirMes = (month: string, year?: number) =>
    setOpenMonth({ month, year: year ?? new Date().getFullYear() });
  // Finanças virou a tela-raiz do app (pivot "só finanças"): o header dá acesso à
  const [askOpen, setAskOpen] = useState(false);

  const handleReplayFinanceTutorial = () => {
    setUserData("spotlight-done-financas", "");
    setActiveTab("financeiro");
    window.location.reload();
  };


  const [incomesTodos, setIncomesTodos] = usePersistedState("finance-incomes", [] as any[]);

  const [expensesTodos, setExpensesTodos] = usePersistedState("finance-expenses", [] as any[]);

  const [fixedExpensesTodos, setFixedExpensesTodos] = usePersistedState("finance-fixed-expenses", [] as any[]);

  const [dueDays, setDueDays] = usePersistedState("finance-dueDays", [
    { day: 5, color: "yellow", bills: [] as any[] },
    { day: 10, color: "slate", bills: [] as any[] },
    { day: 20, color: "indigo", bills: [] as any[] },
    { day: 30, color: "emerald", bills: [] as any[] },
  ]);

  const [notes, setNotes] = usePersistedState("finance-notes", [] as any[]);

  const [goals] = usePersistedState("finance-goals", [] as any[]);

  const [installmentsTodos, setInstallmentsTodos] = usePersistedState("finance-installments", [] as any[]);

  /* PERFIS PF/PJ (01/09, pedido por WhatsApp: "separar a questão da pf e pj...
     isso aqui é da empresa x isso aqui é da empresa y").

     A filtragem acontece AQUI, num lugar só. Cada lista vira [visíveis, setter
     que mescla de volta] e mantém o NOME de antes — por isso nada abaixo desta
     linha precisou mudar: tabelas, totais, calendário e dashboard continuam
     recebendo `expenses`/`incomes` como sempre, só que já do perfil escolhido.
     A regra de mesclagem (e o risco de apagar lançamento dos outros perfis)
     mora em @/lib/finance-perfil, com teste dedicado. */
  const [perfis, setPerfis] = usePersistedState<Perfil[]>("finance-perfis", []);
  const [perfilAtivo, setPerfilAtivo] = usePersistedState<string>("finance-perfil-ativo", PERFIL_PESSOAL);
  /* Perfil apagado noutro aparelho deixaria a tela filtrando por algo que não
     existe mais — Finanças vazia sem explicação. Cai no pessoal. */
  const perfilValido = perfilAtivo === PERFIL_PESSOAL || perfilAtivo === PERFIL_TODOS
    || perfis.some((p) => p.id === perfilAtivo) ? perfilAtivo : PERFIL_PESSOAL;

  const [incomes, setIncomes] = usarListaDoPerfil(incomesTodos, setIncomesTodos, perfilValido);
  const [expenses, setExpenses] = usarListaDoPerfil(expensesTodos, setExpensesTodos, perfilValido);
  const [fixedExpenses, setFixedExpenses] = usarListaDoPerfil(fixedExpensesTodos, setFixedExpensesTodos, perfilValido);
  const [installments, setInstallments] = usarListaDoPerfil(installmentsTodos, setInstallmentsTodos, perfilValido);

  /* A PORTA DA CÓPIA DO MÊS — ligada pela primeira vez em 02/09.
     O MonthTurnover declarou esta prop em 08/08 e ninguém nunca a passou
     (`git log -S` confirma): toda cópia caía no localStorage e era engolida
     pela próxima gravação da tela — o relato de 01/09 ("repliquei e sumiu").
     A cópia entra sempre no perfil PESSOAL, independente do filtro ativo:
     o arquivo de um mês passado é anterior aos perfis, e aplicar a mesclagem
     do perfil da vez etiquetaria custo de casa como sendo da empresa. */
  const aplicarNoMesCorrente = (chave: string, valor: unknown): boolean => {
    switch (chave) {
      case "finance-incomes":
        setIncomesTodos(mesclarPerfil(incomesTodos, valor as any[], PERFIL_PESSOAL)); return true;
      case "finance-fixed-expenses":
        setFixedExpensesTodos(mesclarPerfil(fixedExpensesTodos, valor as any[], PERFIL_PESSOAL)); return true;
      case "finance-dueDays":
        setDueDays(valor as any[]); return true;
      case "finance-notes":
        setNotes(valor as any[]); return true;
      default:
        return false; // sem dono em memória — o MonthTurnover persiste local+servidor
    }
  };

  // Fase 2 do feedback da Aline: custo fixo com "dia" vira conta do mês
  // automaticamente (checkbox de pago + alertas + valor real no "a vencer").
  // O sync devolve null quando nada mudou — sem loop de render.
  useEffect(() => {
    if (!userDataLoaded) return;
    /* LISTA COMPLETA de propósito. O sync apaga toda conta cujo custo fixo
       não esteja na lista (finance-sync.ts): com a lista filtrada por perfil,
       trocar pra "Empresa X" apagaria as contas do Pessoal do calendário. */
    const synced = syncFixedExpensesToBills(fixedExpensesTodos, dueDays);
    if (synced) setDueDays(synced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDataLoaded, fixedExpensesTodos, dueDays]);

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
  const totalVariableExpenses = expenses.reduce((sum: number, e: any) => sum + e.value, 0);
  const totalFixedExpenses = fixedExpenses.reduce((sum: number, e: any) => sum + (e.value || 0), 0);
  const totalExpenses = totalVariableExpenses + totalFixedExpenses;
  const totalDebts = installments.reduce((sum: number, i: any) => sum + (i.totalInstallments - i.paidInstallments) * i.installmentValue, 0);
  const totalInvestments = investments.reduce((sum: number, i: any) => sum + i.currentValue, 0);
  const monthlyInstallments = installments.reduce((sum: number, i: any) => i.paidInstallments < i.totalInstallments ? sum + i.installmentValue : sum, 0);
  // "Despesas do mês" oficial (fixas + variáveis + parcelas) — é o número que
  // Dashboard, Relatórios, Saúde e a barra de resumo mostram. Fonte única em
  // lib/finance-totals; NÃO recalcular taxa/saldo em componente nenhum.
  const monthlyOutflow = computeMonthlyOutflow(totalVariableExpenses, totalFixedExpenses, monthlyInstallments);

  /* Reserva de emergência DECLARADA pela pessoa (08/08). Enquanto ela não
     registrar, o app segue estimando como antes — ver FinancialHealth. */
  const [reservaEmergencia] = useReservaEmergencia();
  const irParaReserva = () => {
    document.getElementById("reserva-emergencia")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const savingsRate = computeSavingsRate(totalIncome, monthlyOutflow);
  // O alvo da reserva é 6 meses de despesa. Antes vinha de uma meta chamada
  // "emergência" — do módulo Metas, removido em 31/03 — então era sempre o
  // fallback mesmo. Agora é explícito.
  const emergencyFundGoal = monthlyOutflow * 6;

  // Bills paid rate
  const allBills = dueDays.flatMap((d: any) => Array.isArray(d?.bills) ? d.bills : []);
  const billsPaidRate = allBills.length > 0 ? (allBills.filter((b: any) => b?.paid).length / allBills.length) * 100 : 100;

  // Goals progress
  const goalsProgress = goals.length > 0
    ? goals.reduce((sum: number, g: any) => sum + Math.min((g.currentValue / g.targetValue) * 100, 100), 0) / goals.length
    : 0;

  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  /* Versão curta pra tela estreita (05/08). Medido no motor do aparelho do
     dono (Chromium 77, 360px): "agosto de 2026" ocupa 87px e o cabeçalho
     precisa de 329px num espaço de 328 — por isso ele via "Agosto De 2..."
     cortado. Abaixo de 400px entra "Ago 2026" (~50px) e o rótulo cabe
     inteiro; daí pra cima nada muda. */
  const mesCurto = new Date()
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(/\.?\s*de\s*/i, " ")
    .replace(".", "");

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
      {FinanceCompletionDialog}
      <SpotlightOverlay
        moduleKey="financas"
        onComplete={onFinanceTutorialComplete}
        steps={[
          
          // COPY DA MISSÃO, não do toque (27/07). A frase antiga dizia o QUE
          // lançar e o anel apontava pro "+", como se a tarefa fosse apertar
          // um botão. É o oposto: escreve, põe o valor, e AÍ salva. Cada passo
          // com formulário agora diz os três tempos, na ordem.
          { selector: '[data-spotlight="add-income"]', label: quizAnchor ? `Você disse que uns ${quizAnchor.month} somem todo mês. Bora achar esse dinheiro: escreva sua renda (salário, freela), o valor ao lado, e toque no + pra salvar.` : 'Bora montar seu painel! Escreva sua renda (salário, freela), o valor ao lado, e toque no + pra salvar.', advanceOnAction: "first_income", checkKey: "finance-incomes", onEnter: () => setActiveTab("financeiro") },
          { selector: '[data-spotlight="add-fixed"]', label: 'Agora um gasto fixo — aluguel, internet, aquela assinatura. Nome, valor, dia do vencimento, e salva no +.', advanceOnAction: "first_fixed_expense", checkKey: "finance-fixed-expenses", onEnter: () => setActiveTab("financeiro") },

          { selector: '[data-spotlight="add-bill"]', label: 'Esse é o MEU MÊS: o que você lança aparece no dia. Toque num dia e adicione uma conta que vence — o CORE te lembra.', advanceOnAction: "first_bill", checkKey: "finance-dueDays", checkValue: (v: any) => Array.isArray(v) && v.some((d: any) => Array.isArray(d?.bills) && d.bills.length > 0), onEnter: () => setActiveTab("financeiro") },
          { selector: '[data-spotlight="tab-investimentos"]', label: 'Guarda ou investe algo? Você acompanha por aqui.', onEnter: () => { setActiveTab("financeiro"); setTimeout(() => document.querySelector('[data-spotlight="tab-investimentos"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="add-investment"]', label: 'Toque em Adicionar e cadastre seu primeiro aporte — dá pra pular se ainda não tiver.', advanceOnAction: "first_investment", checkKey: "finance-investments", skippable: true, placement: "above", onEnter: () => setActiveTab("investimentos") },
          { selector: '[data-spotlight="tab-itens"]', label: 'Quer comprar algo? Liste seus desejos e veja se cabe no bolso.', onEnter: () => { setActiveTab("investimentos"); setTimeout(() => document.querySelector('[data-spotlight="tab-itens"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="add-wish"]', label: 'Toque em Adicionar Desejo e preencha o que você quer comprar — o CORE te diz se cabe.', advanceOnAction: "first_wish", checkKey: "finance-wishlist", skippable: true, placement: "above", onEnter: () => setActiveTab("itens") },
          { selector: '[data-spotlight="tab-limites"]', label: 'Toque em LIMITES — defina um teto de gasto por categoria.', onEnter: () => { setActiveTab("itens"); setTimeout(() => document.querySelector('[data-spotlight="tab-limites"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          // BECO SEM SAÍDA (27/07, bug do dono: "no passo 9 crie um limite não
          // tá passando para o 10 mesmo após ter adicionado"). Este passo só
          // sabia avançar pelo auto-avanço por DADO — e esse auto-avanço é
          // desligado no "Rever tutorial" (senão o tour de quem já tem dados
          // voa sozinho). Resultado: no replay o passo era intransponível.
          // Agora ele avança pela AÇÃO first_limit, que vale nos dois modos.
          { selector: '[data-spotlight="add-limit"]', label: 'Escolha uma categoria e defina quanto quer gastar nela no mês (ex: comida, lazer).', advanceOnClick: false, advanceOnAction: "first_limit", checkKey: "finance-category-budgets", checkValue: (v: any) => v && typeof v === "object" && Object.keys(v).length > 0, placement: "below", onEnter: () => setActiveTab("limites") },
          { selector: '[data-spotlight="tab-relatorios"]', label: 'Seus relatórios do mês saem prontos aqui — dá uma olhada.', onEnter: () => { setActiveTab("limites"); setTimeout(() => document.querySelector('[data-spotlight="tab-relatorios"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
          { selector: '[data-spotlight="tab-saude"]', label: `E sua saúde financeira vira um índice simples. Pronto — seu painel pra ${quizVictory ?? "cuidar do seu dinheiro"} tá montado! 🎉`, onEnter: () => { setActiveTab("relatorios"); setTimeout(() => document.querySelector('[data-spotlight="tab-saude"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 150); } },
        ]}
      />
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Faxina 16/07: hambúrguer saiu — a seta leva pro hub (o menu de
              conta mora lá, no GreetingHeader). No preview, volta pra /lp. */}
          <button
            onClick={() => navigate(isPreview ? "/lp" : "/home")}
            aria-label={isPreview ? "Voltar" : "Todos os módulos"}
            className="hover:bg-muted rounded-md p-1 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <DollarSign className="w-5 h-5 text-amber-600" />
          <h1 className="text-base font-bold tracking-tight shrink-0">FINANÇAS</h1>
          <div className="flex items-center gap-2 ml-auto min-w-0">
            {/* truncate + nowrap (04/08): sem isto "agosto de 2026" QUEBRAVA em
                duas linhas no aperto e caía por cima do título/chips (foto do
                dono no aparelho de tela estreita). Mês é rótulo — ou cabe numa
                linha, ou encurta. */}
            <span className="text-muted-foreground text-xs capitalize whitespace-nowrap truncate max-[399px]:hidden">{currentMonth}</span>
            <span className="text-muted-foreground text-xs capitalize whitespace-nowrap min-[400px]:hidden">{mesCurto}</span>
            {/* Pergunte ao CORE — disponível em qualquer aba */}
            <button
              onClick={() => setAskOpen(true)}
              aria-label="Pergunte ao CORE"
              className="grid place-items-center w-8 h-8 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
            </button>
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
          /* 2×2 EM VEZ DE FAIXA ROLÁVEL (29/07, foto do dono: "essa parte que
             fala receitas, despesas, investimentos tá meio estranha").
             Eram 4 colunas com valores de 5 dígitos numa tela de 360px: cabia
             rolando, mas quem olha vê o último número cortado na borda e lê
             como tela quebrada — ninguém adivinha que aquilo rola de lado.
             Em duas linhas de dois, cada número tem largura inteira e nada se
             move. */
          <div className="bg-card rounded-lg border border-border px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">Receitas</span>
              <span className="text-xs font-bold text-green-500 truncate">R$ {totalIncome.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">Despesas</span>
              <span className="text-xs font-bold text-red-400 truncate">R$ {monthlyOutflow.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">Dívidas</span>
              <span className="text-xs font-bold text-orange-400 truncate">R$ {totalDebts.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">Invest.</span>
              <span className="text-xs font-bold text-purple-400 truncate">R$ {totalInvestments.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <>
            <WrappedBanner />
            {/* Convite dos lembretes: entra ACIMA do dashboard e só quando já
                existe conta cadastrada — pedir permissão antes de haver o que
                lembrar queima a única chance no Android 13+. */}
            <PedirLembretes dueDays={dueDays as never} />
            <TrackedCard cardKey="weekly-challenge" tab="dashboard">
              <WeeklyChallenge expenses={expenses} />
            </TrackedCard>
            <TrackedCard cardKey="dashboard" tab="dashboard">
              <Dashboard
                totalIncome={totalIncome}
                totalExpenses={monthlyOutflow}
                monthlyInstallments={monthlyInstallments}
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
              <MonthlySheet month={openMonth.month} year={openMonth.year} onClose={() => setOpenMonth(null)} />
            ) : (
              <>
                {getUserData<string>("spotlight-done-financas", "") !== "true" && (
                  <>
                    <QuizWelcome />
                    <ImportStarterHint
                      action={
                        <ImportExtrato
                          expenses={expenses}
                          incomes={incomes}
                          setExpenses={setExpenses}
                          setIncomes={setIncomes}
                        />
                      }
                    />
                  </>
                )}
                {/* Virada de mês NÃO existe na demo (06/08, relato do dono): o
                    visitante do funil abria MEU FINANCEIRO e levava "Julho
                    acabou — preparar agosto" com tudo zerado. Recap é ritual
                    de quem TEM mês anterior; a demo é vitrine. */}
                {/* Antes de tudo porque muda o significado de todo número
                    abaixo. Some inteiro pra quem não tem empresa — vira um
                    link de uma linha (ver o componente). */}
                {!isPreview && (
                  <SeletorDePerfil
                    perfis={perfis}
                    setPerfis={setPerfis}
                    ativo={perfilValido}
                    setAtivo={setPerfilAtivo}
                  />
                )}
                {!isPreview && (
                  <TrackedCard cardKey="month-turnover" tab="financeiro">
                    <MonthTurnover onOpenMonth={abrirMes} aplicarNoMesCorrente={aplicarNoMesCorrente} />
                  </TrackedCard>
                )}
                <TrackedCard cardKey="summary" tab="financeiro">
                  <FinancialSummary
                    totalIncome={totalIncome}
                    totalExpenses={monthlyOutflow}
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
                      <ExpenseTable expenses={expenses} setExpenses={setExpenses} onPrimeiroGasto={aoPrimeiroGasto} />
                    </TrackedCard>
                  </div>
                  <TrackedCard cardKey="notes" tab="financeiro">
                    <Notes notes={notes} setNotes={setNotes} />
                  </TrackedCard>
                </div>
                {/* MEU MÊS absorve os cards de "Contas a Vencer": mesma chave
                    finance-dueDays, mas integrada com despesas/rendas datadas
                    (feedback escrito da assinante de 11/07). */}
                <TrackedCard cardKey="month-calendar" tab="financeiro">
                  <MonthCalendar
                    incomes={incomes}
                    expenses={expenses}
                    fixedExpenses={fixedExpenses}
                    dueDays={dueDays}
                    setDueDays={setDueDays}
                    installments={installments}
                    totalIncome={totalIncome}
                    monthlyOutflow={monthlyOutflow}
                    reserva={{
                      guardado: reservaEmergencia.guardado,
                      meta: metaDaReserva(monthlyOutflow, reservaEmergencia.meses),
                      registrada: reservaEmergencia.registrada,
                    }}
                    onAbrirReserva={irParaReserva}
                  />
                </TrackedCard>
                {/* RESERVA logo abaixo do MEU MÊS (08/08). A pergunta que
                    chegou foi "onde eu registro minha reserva?" — antes ela
                    não existia como lugar, só como um número derivado na 9ª
                    aba. Fica colada no cartão do mês porque é ali que a pessoa
                    olha quando pensa em dinheiro do mês; o chip do MEU MÊS
                    rola até aqui. */}
                <TrackedCard cardKey="emergency-fund" tab="financeiro">
                  <div id="reserva-emergencia" className="scroll-mt-20">
                    <EmergencyFund despesaMensal={monthlyOutflow} />
                  </div>
                </TrackedCard>
                <TrackedCard cardKey="installments" tab="financeiro">
                  <InstallmentTracker installments={installments} setInstallments={setInstallments} variableExpenses={expenses} />
                </TrackedCard>
                {/* Logo abaixo do parcelamento porque é a dúvida que nasce ali
                    ("e a dívida que não é do cartão?"), e longe o bastante do
                    topo pra deixar claro que não conversa com os totais. */}
                <TrackedCard cardKey="dividas-pessoas" tab="financeiro">
                  <DividasEntrePessoas />
                </TrackedCard>
                <div className="grid lg:grid-cols-[1fr_200px] gap-4">
                  <TrackedCard cardKey="annual-budget" tab="financeiro">
                    <AnnualBudget />
                  </TrackedCard>
                  <TrackedCard cardKey="monthly-budget" tab="financeiro">
                    <MonthlyBudget budgets={monthlyBudgets} setBudgets={setMonthlyBudgets} onOpenMonth={abrirMes} />
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
              totalExpenses={monthlyOutflow}
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
              totalExpenses={totalVariableExpenses}
              totalFixedExpenses={totalFixedExpenses}
              monthlyInstallments={monthlyInstallments}
              totalDebts={totalDebts}
              totalInvestments={totalInvestments}
              emergencyFundGoal={emergencyFundGoal}
              dueDays={dueDays}
              installments={installments}
              wishlistItems={wishlistItems}
              trips={trips}
              investments={investments}
              reservaDeclarada={reservaEmergencia}
            />
          </TrackedCard>
        )}
      </main>

      <AskCore
        open={askOpen}
        onOpenChange={setAskOpen}
        ctx={{
          totalIncome,
          monthlyOutflow,
          savingsRate,
          monthlyInstallments,
          totalInvestments,
          totalDebts,
          expenses,
          fixedExpenses,
          dueDays,
          goals,
          investments,
        }}
      />
      <ConviteAvaliacao gasto={convite} pagante={isSubscribed} onFechar={() => setConvite(null)} />
    </div>
  );
};

export default Index;
